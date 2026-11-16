"""Period reports (daily / monthly / yearly) built straight from the database, plus their
PDF, CSV and Excel exports. Backs the Reports page and GET /api/analytics/period-report/.

Money definitions used throughout (all OMR, 3 decimals):
  gross_sales   = sum of order subtotals (item prices before discount, excl. VAT)
  net_sales     = gross_sales - discounts            (what the cafe actually earned, excl. VAT)
  vat           = VAT charged on orders (owed to the tax authority, so NOT profit)
  total_billed  = net_sales + vat                    (what customers paid)
  net_profit    = net_sales - cost of goods sold - expenses
Cancelled orders are excluded from every figure and only reported as a count.
"""

import calendar
import csv
import io
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from decimal import Decimal

from django.db.models import Count, DecimalField, ExpressionWrapper, F, Sum
from django.db.models.functions import ExtractHour, TruncDate, TruncMonth
from django.utils import timezone

from pos.models import Order, OrderItem, Payment

from .models import Expense

ZERO = Decimal("0.000")
Q3 = Decimal("0.001")
MONEY = DecimalField(max_digits=14, decimal_places=3)

CAFE_NAME = "Swalif Cafe"
CAFE_ADDRESS = "Al Saadah, Salalah, Oman"


def _d(value) -> Decimal:
    return (value or ZERO).quantize(Q3)


def english_name(name: str | None) -> str:
    """Menu names are stored bilingual ("Latte (S) · لاتيه"); keep the English part for
    the PDF, whose built-in fonts have no Arabic glyphs."""
    if not name:
        return ""
    return name.split(" · ")[0].strip()


@dataclass
class Period:
    kind: str  # daily | monthly | yearly
    start: date  # inclusive
    end: date  # exclusive
    label: str
    slug: str  # used in download filenames


def resolve_period(kind: str, year: int | None, month: int | None, day: date | None) -> Period:
    today = timezone.localdate()
    if kind == "daily":
        d = day or today
        return Period("daily", d, d + timedelta(days=1), d.strftime("%d %B %Y"), d.isoformat())
    if kind == "yearly":
        y = year or today.year
        return Period("yearly", date(y, 1, 1), date(y + 1, 1, 1), str(y), str(y))
    y, m = year or today.year, month or today.month
    if not 1 <= m <= 12:
        raise ValueError("month must be 1-12")
    start = date(y, m, 1)
    end = date(y + 1, 1, 1) if m == 12 else date(y, m + 1, 1)
    return Period("monthly", start, end, start.strftime("%B %Y"), f"{y}-{m:02d}")


def _aware(d: date) -> datetime:
    return timezone.make_aware(datetime.combine(d, datetime.min.time()))


def build_period_report(period: Period) -> dict:
    start_dt, end_dt = _aware(period.start), _aware(period.end)
    in_range = Order.objects.filter(created_at__gte=start_dt, created_at__lt=end_dt)
    orders = in_range.exclude(status=Order.Status.CANCELLED)
    items = OrderItem.objects.filter(order__in=orders)
    expenses = Expense.objects.filter(date__gte=period.start, date__lt=period.end)

    line_revenue = ExpressionWrapper(F("quantity") * F("unit_price") - F("discount"), output_field=MONEY)
    line_cost = ExpressionWrapper(F("quantity") * F("product__cost_price"), output_field=MONEY)

    agg = orders.aggregate(
        count=Count("id"),
        gross=Sum("subtotal"),
        discount=Sum("discount_amount"),
        vat=Sum("tax_amount"),
        total=Sum("total"),
    )
    cogs = _d(items.aggregate(v=Sum(line_cost))["v"])
    expense_total = _d(expenses.aggregate(v=Sum("amount"))["v"])
    gross, discount, vat = _d(agg["gross"]), _d(agg["discount"]), _d(agg["vat"])
    net_sales = gross - discount
    order_count = agg["count"]
    payments_received = _d(Payment.objects.filter(order__in=orders).aggregate(v=Sum("amount"))["v"])

    summary = {
        "orders": order_count,
        "cancelled_orders": in_range.filter(status=Order.Status.CANCELLED).count(),
        "items_sold": items.aggregate(v=Sum("quantity"))["v"] or 0,
        "gross_sales": gross,
        "discounts": discount,
        "net_sales": net_sales,
        "vat": vat,
        "total_billed": _d(agg["total"]),
        "avg_order_value": (net_sales / order_count).quantize(Q3) if order_count else ZERO,
        "cogs": cogs,
        "expenses": expense_total,
        "net_profit": net_sales - cogs - expense_total,
        "payments_received": payments_received,
    }

    return {
        "period": period.kind,
        "label": period.label,
        "slug": period.slug,
        "start": period.start,
        "end": period.end - timedelta(days=1),  # inclusive, for display
        "generated_at": timezone.localtime(),
        "summary": summary,
        "breakdown": _breakdown(period, orders, items, expenses, line_cost),
        "products": [
            {
                "product": r["product__name"],
                "category": r["product__category__name"] or "Uncategorized",
                "quantity": r["qty"],
                "revenue": _d(r["revenue"]),
            }
            for r in items.values("product__id", "product__name", "product__category__name")
            .annotate(qty=Sum("quantity"), revenue=Sum(line_revenue))
            .order_by("-revenue", "-qty")
        ],
        "categories": [
            {"category": r["product__category__name"] or "Uncategorized", "quantity": r["qty"], "revenue": _d(r["revenue"])}
            for r in items.values("product__category__name")
            .annotate(qty=Sum("quantity"), revenue=Sum(line_revenue))
            .order_by("-revenue")
        ],
        "payments": [
            {
                "method": r["method"],
                "label": Payment.Method(r["method"]).label if r["method"] in Payment.Method.values else r["method"],
                "count": r["count"],
                "total": _d(r["total"]),
            }
            for r in Payment.objects.filter(order__in=orders)
            .values("method")
            .annotate(count=Count("id"), total=Sum("amount"))
            .order_by("-total")
        ],
        "order_types": [
            {
                "type": r["order_type"],
                "label": Order.OrderType(r["order_type"]).label if r["order_type"] in Order.OrderType.values else r["order_type"],
                "count": r["count"],
                "net_sales": _d(r["gross"]) - _d(r["disc"]),
            }
            for r in orders.values("order_type")
            .annotate(count=Count("id"), gross=Sum("subtotal"), disc=Sum("discount_amount"))
            .order_by("-count")
        ],
        "expenses": [
            {"category": r["category"], "count": r["count"], "total": _d(r["total"])}
            for r in expenses.values("category").annotate(count=Count("id"), total=Sum("amount")).order_by("-total")
        ],
        "expense_items": [
            {"date": e.date, "category": e.category, "amount": _d(e.amount), "note": e.note}
            for e in expenses.order_by("date", "id")
        ],
    }


def _breakdown(period: Period, orders, items, expenses, line_cost) -> list[dict]:
    """One row per hour (daily, active hours only), per day (monthly) or per month (yearly)."""
    if period.kind == "daily":
        bucket = ExtractHour("created_at")
        item_bucket = ExtractHour("order__created_at")
        keys = list(range(24))
        exp_by_key: dict = {}
    elif period.kind == "monthly":
        bucket = TruncDate("created_at")
        item_bucket = TruncDate("order__created_at")
        days = calendar.monthrange(period.start.year, period.start.month)[1]
        keys = [period.start + timedelta(days=i) for i in range(days)]
        exp_by_key = {r["date"]: r["v"] for r in expenses.values("date").annotate(v=Sum("amount"))}
    else:
        bucket = TruncMonth("created_at")
        item_bucket = TruncMonth("order__created_at")
        keys = [date(period.start.year, m, 1) for m in range(1, 13)]
        exp_by_key = {}
        for r in expenses.annotate(m=TruncMonth("date")).values("m").annotate(v=Sum("amount")):
            exp_by_key[r["m"]] = r["v"]

    def norm(k):
        # TruncMonth over a DateTimeField yields an aware datetime; compare as dates
        return k.date() if isinstance(k, datetime) else k

    by_key = {
        norm(r["b"]): r
        for r in orders.annotate(b=bucket)
        .values("b")
        .annotate(n=Count("id"), gross=Sum("subtotal"), disc=Sum("discount_amount"), vat=Sum("tax_amount"))
    }
    cost_by_key = {norm(r["b"]): r["v"] for r in items.annotate(b=item_bucket).values("b").annotate(v=Sum(line_cost))}

    rows = []
    for k in keys:
        r = by_key.get(k)
        if period.kind == "daily" and not r:
            continue  # skip hours with no orders
        net_sales = (_d(r["gross"]) - _d(r["disc"])) if r else ZERO
        exp = _d(exp_by_key.get(k))
        cost = _d(cost_by_key.get(k))
        if period.kind == "daily":
            key, label = f"{k:02d}:00", f"{k:02d}:00"
        elif period.kind == "monthly":
            key, label = k.isoformat(), k.strftime("%a %d %b")
        else:
            key, label = k.isoformat(), k.strftime("%B")
        rows.append(
            {
                "key": key,
                "label": label,
                "orders": r["n"] if r else 0,
                "net_sales": net_sales,
                "vat": _d(r["vat"]) if r else ZERO,
                "cogs": cost,
                "expenses": exp,
                "net_profit": net_sales - cost - exp,
            }
        )
    return rows


# ─── Exports ──────────────────────────────────────────────────────────────────

SUMMARY_ROWS = [
    ("Orders", "orders"),
    ("Cancelled orders (excluded)", "cancelled_orders"),
    ("Items sold", "items_sold"),
    ("Gross sales (excl. VAT)", "gross_sales"),
    ("Discounts", "discounts"),
    ("Net sales (excl. VAT)", "net_sales"),
    ("VAT collected (5%)", "vat"),
    ("Total billed (incl. VAT)", "total_billed"),
    ("Average order value", "avg_order_value"),
    ("Cost of goods sold", "cogs"),
    ("Expenses", "expenses"),
    ("Net profit", "net_profit"),
    ("Payments received", "payments_received"),
]

BREAKDOWN_HEADERS = ["Period", "Orders", "Net sales", "VAT", "Cost of goods", "Expenses", "Net profit"]


def _sections(report: dict, english_only: bool = False) -> list[tuple[str, list[str], list[list]]]:
    """The report as (title, headers, rows) tables, shared by CSV, Excel and PDF."""
    name = english_name if english_only else (lambda s: s or "")
    s = report["summary"]
    unit = {"daily": "Hour", "monthly": "Day", "yearly": "Month"}[report["period"]]
    return [
        ("Summary", ["Metric", "Value"], [[label, s[key]] for label, key in SUMMARY_ROWS]),
        (
            f"Breakdown by {unit.lower()}",
            [unit] + BREAKDOWN_HEADERS[1:],
            [[r["label"], r["orders"], r["net_sales"], r["vat"], r["cogs"], r["expenses"], r["net_profit"]] for r in report["breakdown"]],
        ),
        (
            "Sales by category",
            ["Category", "Qty sold", "Revenue"],
            [[name(r["category"]), r["quantity"], r["revenue"]] for r in report["categories"]],
        ),
        (
            "Sales by product",
            ["Product", "Category", "Qty sold", "Revenue"],
            [[name(r["product"]), name(r["category"]), r["quantity"], r["revenue"]] for r in report["products"]],
        ),
        ("Payments by method", ["Method", "Payments", "Amount"], [[r["label"], r["count"], r["total"]] for r in report["payments"]]),
        ("Orders by type", ["Type", "Orders", "Net sales"], [[r["label"], r["count"], r["net_sales"]] for r in report["order_types"]]),
        ("Expenses by category", ["Category", "Entries", "Amount"], [[r["category"], r["count"], r["total"]] for r in report["expenses"]]),
        (
            "Expense entries",
            ["Date", "Category", "Amount", "Note"],
            [[r["date"].isoformat(), r["category"], r["amount"], r["note"]] for r in report["expense_items"]],
        ),
    ]


def _title(report: dict) -> str:
    kind = {"daily": "Daily", "monthly": "Monthly", "yearly": "Yearly"}[report["period"]]
    return f"{kind} Report — {report['label']}"


def report_filename(report: dict, ext: str) -> str:
    return f"swalif-{report['period']}-report-{report['slug']}.{ext}"


def export_csv(report: dict) -> bytes:
    out = io.StringIO()
    w = csv.writer(out)
    w.writerow([CAFE_NAME, _title(report)])
    w.writerow(["Period", f"{report['start']} to {report['end']}"])
    w.writerow(["Generated", report["generated_at"].strftime("%Y-%m-%d %H:%M")])
    w.writerow(["Currency", "OMR"])
    for title, headers, rows in _sections(report):
        w.writerow([])
        w.writerow([title.upper()])
        w.writerow(headers)
        w.writerows(rows if rows else [["(none)"]])
    # UTF-8 BOM so Excel opens Arabic product names correctly
    return ("﻿" + out.getvalue()).encode("utf-8")


def export_xlsx(report: dict) -> bytes:
    from openpyxl import Workbook
    from openpyxl.styles import Alignment, Font, PatternFill
    from openpyxl.utils import get_column_letter

    wb = Workbook()
    wb.remove(wb.active)
    head_fill = PatternFill("solid", fgColor="7A2340")
    head_font = Font(bold=True, color="FFFFFF")
    for title, headers, rows in _sections(report):
        ws = wb.create_sheet(title[:31])
        ws.append([f"{CAFE_NAME} — {_title(report)}"])
        ws["A1"].font = Font(bold=True, size=13, color="7A2340")
        ws.append([f"{report['start']} to {report['end']} · OMR"])
        ws.append([])
        ws.append(headers)
        for cell in ws[4]:
            cell.fill, cell.font = head_fill, head_font
        for row in rows:
            ws.append([float(v) if isinstance(v, Decimal) else v for v in row])
        for row in ws.iter_rows(min_row=5):
            for cell in row:
                if isinstance(cell.value, float):
                    cell.number_format = "#,##0.000"
                    cell.alignment = Alignment(horizontal="right")
        for i, h in enumerate(headers, start=1):
            width = max([len(str(h))] + [len(str(r[i - 1])) for r in rows]) + 2
            ws.column_dimensions[get_column_letter(i)].width = min(max(width, 10), 48)
        ws.freeze_panes = "A5"
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def export_pdf(report: dict) -> bytes:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import mm
    from reportlab.platypus import KeepTogether, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

    maroon, gold, ink = colors.HexColor("#7A2340"), colors.HexColor("#C08F1E"), colors.HexColor("#1F2937")
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4, leftMargin=15 * mm, rightMargin=15 * mm, topMargin=15 * mm, bottomMargin=15 * mm,
        title=f"{CAFE_NAME} {_title(report)}", author=CAFE_NAME,
    )
    styles = getSampleStyleSheet()
    h_title = ParagraphStyle("t", parent=styles["Title"], textColor=maroon, alignment=0, fontSize=20, spaceAfter=2)
    h_sec = ParagraphStyle("s", parent=styles["Heading3"], textColor=maroon, spaceBefore=10, spaceAfter=4)
    small = ParagraphStyle("m", parent=styles["Normal"], fontSize=8.5, textColor=colors.HexColor("#6B7280"))

    def fmt(v):
        if isinstance(v, Decimal):
            return f"{v:,.3f}"
        return "" if v is None else str(v)

    s = report["summary"]
    els = [
        Paragraph(CAFE_NAME, h_title),
        Paragraph(f"{CAFE_ADDRESS}", small),
        Spacer(1, 6),
        Paragraph(f"<b>{_title(report)}</b>", ParagraphStyle("p", parent=styles["Heading2"], textColor=ink, spaceAfter=0)),
        Paragraph(
            f"Period {report['start']:%d %b %Y} – {report['end']:%d %b %Y} · Generated "
            f"{report['generated_at']:%d %b %Y %H:%M} · All amounts in OMR",
            small,
        ),
        Spacer(1, 8),
    ]

    # KPI strip
    kpis = [("Net sales", s["net_sales"]), ("VAT collected", s["vat"]), ("Expenses", s["expenses"]), ("Net profit", s["net_profit"])]
    kpi_table = Table(
        [[k for k, _ in kpis], [fmt(v) for _, v in kpis]],
        colWidths=[45 * mm] * 4,
    )
    kpi_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FBEEF0")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#6B7280")),
        ("FONTSIZE", (0, 0), (-1, 0), 8),
        ("FONTNAME", (0, 1), (-1, 1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 1), (-1, 1), 14),
        ("TEXTCOLOR", (0, 1), (-1, 1), maroon),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 1), (-1, 1), 8),
        ("LINEBELOW", (0, 1), (-1, 1), 2, gold),
    ]))
    els += [kpi_table]

    for title, headers, rows in _sections(report, english_only=True):
        body = [headers] + ([[fmt(v) for v in r] for r in rows] if rows else [["No data for this period"] + [""] * (len(headers) - 1)])
        first_col = 75 * mm if title in ("Summary", "Sales by product", "Expense entries") else 45 * mm
        rest = (180 * mm - first_col) / max(len(headers) - 1, 1)
        t = Table(body, colWidths=[first_col] + [rest] * (len(headers) - 1), repeatRows=1)
        style = [
            ("BACKGROUND", (0, 0), (-1, 0), maroon),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 8.5),
            ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F7F3F0")]),
            ("LINEBELOW", (0, -1), (-1, -1), 0.5, colors.HexColor("#D1D5DB")),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ]
        if title == "Summary":
            net_row = next(i for i, r in enumerate(SUMMARY_ROWS, start=1) if r[1] == "net_profit")
            style += [("FONTNAME", (0, net_row), (-1, net_row), "Helvetica-Bold"), ("TEXTCOLOR", (0, net_row), (-1, net_row), maroon)]
        if title == "Expense entries":
            style.append(("ALIGN", (1, 0), (1, -1), "LEFT"))
            style.append(("ALIGN", (3, 0), (3, -1), "LEFT"))
        if title == "Sales by product":
            style.append(("ALIGN", (1, 0), (1, -1), "LEFT"))
        t.setStyle(TableStyle(style))
        els.append(KeepTogether([Paragraph(title, h_sec), t]) if len(body) < 25 else Paragraph(title, h_sec))
        if len(body) >= 25:
            els.append(t)

    els += [
        Spacer(1, 10),
        Paragraph(
            "Net sales exclude VAT; VAT is owed to the tax authority and is not counted as profit. "
            "Cancelled orders are excluded. Cost of goods uses each menu item's cost price — items "
            "without a cost price count as zero. Product names are shown in English; the CSV and "
            "Excel exports also include the Arabic names.",
            small,
        ),
    ]

    def footer(canvas, doc_):
        canvas.saveState()
        canvas.setFont("Helvetica", 7.5)
        canvas.setFillColor(colors.HexColor("#9CA3AF"))
        canvas.drawString(15 * mm, 9 * mm, f"{CAFE_NAME} · {_title(report)}")
        canvas.drawRightString(A4[0] - 15 * mm, 9 * mm, f"Page {doc_.page}")
        canvas.restoreState()

    doc.build(els, onFirstPage=footer, onLaterPages=footer)
    return buf.getvalue()
