from datetime import timedelta
from decimal import Decimal

from django.db.models import Avg, Count, DecimalField, ExpressionWrapper, F, Sum
from django.db.models.functions import ExtractHour, TruncDate, TruncMonth, TruncWeek, TruncYear
from django.utils import timezone
from django.http import HttpResponse
from django.utils.dateparse import parse_date
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from accounts.permissions import IsManagerOrAdmin, IsStaffOrAbove, ReadWriteRolePermission
from crm.models import Customer, Feedback
from inventory.models import Ingredient
from pos.models import Order, OrderItem, Payment

from .models import Expense
from .period_report import build_period_report, export_csv, export_pdf, export_xlsx, report_filename, resolve_period
from .serializers import ExpenseSerializer

TRUNC_FUNCS = {
    "daily": TruncDate,
    "weekly": TruncWeek,
    "monthly": TruncMonth,
    "yearly": TruncYear,
}


def parse_date_range(request, default_days=30):
    start = parse_date(request.query_params.get("start", "")) or (
        timezone.localdate() - timedelta(days=default_days)
    )
    end = parse_date(request.query_params.get("end", "")) or timezone.localdate()
    return start, end


class ExpenseViewSet(viewsets.ModelViewSet):
    """Manager gets read-only visibility into the Accounting page's expenses ledger
    (viewing/oversight); only Admin can add, edit or delete an expense."""

    queryset = Expense.objects.all()
    serializer_class = ExpenseSerializer
    permission_classes = [ReadWriteRolePermission]
    read_roles = (User.Role.ADMIN, User.Role.MANAGER)
    write_roles = (User.Role.ADMIN,)
    filterset_fields = ["category", "date"]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class SalesReportView(APIView):
    """SRS 4: Sales Reports (daily/weekly/monthly/yearly)."""

    permission_classes = [IsManagerOrAdmin]

    def get(self, request):
        period = request.query_params.get("period", "daily")
        trunc = TRUNC_FUNCS.get(period, TruncDate)
        start, end = parse_date_range(request)

        qs = (
            Order.objects.exclude(status=Order.Status.CANCELLED)
            .filter(created_at__date__gte=start, created_at__date__lte=end)
            .annotate(period=trunc("created_at"))
            .values("period")
            .annotate(revenue=Sum("total"), order_count=Count("id"), tax_collected=Sum("tax_amount"))
            .order_by("period")
        )
        return Response({"period": period, "start": start, "end": end, "results": list(qs)})


class BestSellersView(APIView):
    """SRS 4: Performance Trends - best-selling items."""

    permission_classes = [IsManagerOrAdmin]

    def get(self, request):
        start, end = parse_date_range(request)
        limit = int(request.query_params.get("limit", 10))

        qs = (
            OrderItem.objects.exclude(order__status=Order.Status.CANCELLED)
            .filter(order__created_at__date__gte=start, order__created_at__date__lte=end)
            .values("product__id", "product__name")
            .annotate(
                quantity_sold=Sum("quantity"),
                revenue=Sum(
                    ExpressionWrapper(
                        F("quantity") * F("unit_price") - F("discount"),
                        output_field=DecimalField(max_digits=12, decimal_places=3),
                    )
                ),
            )
            .order_by("-quantity_sold")[:limit]
        )
        return Response(list(qs))


class PeakHoursView(APIView):
    """SRS 4: Performance Trends - peak hours."""

    permission_classes = [IsManagerOrAdmin]

    def get(self, request):
        start, end = parse_date_range(request)
        qs = (
            Order.objects.exclude(status=Order.Status.CANCELLED)
            .filter(created_at__date__gte=start, created_at__date__lte=end)
            .annotate(hour=ExtractHour("created_at"))
            .values("hour")
            .annotate(order_count=Count("id"), revenue=Sum("total"))
            .order_by("hour")
        )
        return Response(list(qs))


class CustomerTrafficView(APIView):
    """SRS 4: Performance Trends - customer traffic (orders per period as a foot-traffic proxy)."""

    permission_classes = [IsManagerOrAdmin]

    def get(self, request):
        period = request.query_params.get("period", "daily")
        trunc = TRUNC_FUNCS.get(period, TruncDate)
        start, end = parse_date_range(request)

        qs = (
            Order.objects.exclude(status=Order.Status.CANCELLED)
            .filter(created_at__date__gte=start, created_at__date__lte=end)
            .annotate(period=trunc("created_at"))
            .values("period")
            .annotate(orders=Count("id"), unique_customers=Count("customer", distinct=True))
            .order_by("period")
        )
        return Response(list(qs))


class RevenueProfitView(APIView):
    """SRS 4: Revenue & Profit - gross revenue, net profit, expense analysis."""

    permission_classes = [IsManagerOrAdmin]

    def get(self, request):
        start, end = parse_date_range(request)
        orders = Order.objects.exclude(status=Order.Status.CANCELLED).filter(
            created_at__date__gte=start, created_at__date__lte=end
        )
        gross_revenue = orders.aggregate(total=Sum("total"))["total"] or Decimal("0")

        cogs = (
            OrderItem.objects.filter(order__in=orders)
            .aggregate(
                total=Sum(
                    ExpressionWrapper(
                        F("quantity") * F("product__cost_price"),
                        output_field=DecimalField(max_digits=12, decimal_places=3),
                    )
                )
            )["total"]
            or Decimal("0")
        )

        expenses = (
            Expense.objects.filter(date__gte=start, date__lte=end).aggregate(total=Sum("amount"))["total"]
            or Decimal("0")
        )

        net_profit = gross_revenue - cogs - expenses
        return Response(
            {
                "start": start,
                "end": end,
                "gross_revenue": gross_revenue,
                "cost_of_goods_sold": cogs,
                "expenses": expenses,
                "net_profit": net_profit,
            }
        )


class EmployeePerformanceView(APIView):
    """SRS 4: Employee Performance - orders served, revenue generated, rating, ranking.

    Grouped by `served_by` (who actually took the order, not just who was logged in) and
    scoped to Manager/Staff — the Admin account isn't an employee and shouldn't clutter
    this leaderboard even if it was used to ring up a test order.

    Admin/Manager see the full leaderboard; a Staff account only ever gets its own row
    back (its personal performance card on the self-service HR page), never anyone else's.
    """

    permission_classes = [IsStaffOrAbove]

    def get(self, request):
        start, end = parse_date_range(request)
        orders = Order.objects.exclude(status=Order.Status.CANCELLED).filter(
            created_at__date__gte=start,
            created_at__date__lte=end,
            served_by__isnull=False,
            served_by__role__in=[User.Role.MANAGER, User.Role.STAFF],
        )
        if request.user.role == User.Role.STAFF:
            orders = orders.filter(served_by=request.user)
        orders = orders.values("served_by").annotate(
            orders_served=Count("id"), revenue_generated=Sum("total")
        ).order_by("-revenue_generated")

        results = []
        for row in orders:
            user_id = row["served_by"]
            avg_rating = Feedback.objects.filter(order__served_by_id=user_id).aggregate(avg=Avg("rating"))[
                "avg"
            ]
            user = User.objects.filter(pk=user_id).first()
            results.append(
                {
                    "user_id": user_id,
                    "username": user.username if user else None,
                    "orders_served": row["orders_served"],
                    "revenue_generated": row["revenue_generated"],
                    "average_rating": round(avg_rating, 2) if avg_rating else None,
                }
            )

        for rank, row in enumerate(results, start=1):
            row["rank"] = rank

        return Response(results)


class OverviewView(APIView):
    """Bundled numbers for the frontend's top-level Dashboard/Overview page: today's
    revenue/orders, customer count, inventory value, low-stock count, and revenue split
    by order type (dine-in/takeaway/delivery/talabat) in place of a multi-branch
    breakdown, since this system models a single location.
    """

    permission_classes = [IsManagerOrAdmin]

    def get(self, request):
        today = timezone.localdate()
        orders_today = Order.objects.filter(created_at__date=today).exclude(status=Order.Status.CANCELLED)
        revenue_today = orders_today.aggregate(total=Sum("total"))["total"] or Decimal("0")

        inventory_value = (
            Ingredient.objects.aggregate(
                total=Sum(
                    ExpressionWrapper(
                        F("quantity_on_hand") * F("cost_per_unit"),
                        output_field=DecimalField(max_digits=14, decimal_places=3),
                    )
                )
            )["total"]
            or Decimal("0")
        )
        low_stock_count = sum(1 for i in Ingredient.objects.all() if i.is_low_stock)

        order_type_breakdown = list(
            orders_today.values("order_type").annotate(revenue=Sum("total"), order_count=Count("id"))
        )

        return Response(
            {
                "date": today,
                "revenue_today": revenue_today,
                "orders_today": orders_today.count(),
                "customer_count": Customer.objects.count(),
                "inventory_value": inventory_value,
                "low_stock_count": low_stock_count,
                "order_type_breakdown": order_type_breakdown,
            }
        )


class CashflowView(APIView):
    """Payment amounts grouped by method over a date range — backs the Accounting
    page's "cash on hand" proxy and the Reports page's cashflow tab. Not a true
    balance-sheet cash figure, just what came in through each payment method.
    """

    permission_classes = [IsManagerOrAdmin]

    def get(self, request):
        start, end = parse_date_range(request)
        qs = (
            Payment.objects.filter(order__created_at__date__gte=start, order__created_at__date__lte=end)
            .exclude(order__status=Order.Status.CANCELLED)
            .values("method")
            .annotate(total=Sum("amount"), count=Count("id"))
            .order_by("-total")
        )
        return Response({"start": start, "end": end, "results": list(qs)})


class PeriodReportView(APIView):
    """Full daily/monthly/yearly report from the database, as JSON or a download.

    GET /api/analytics/period-report/?period=monthly&year=2026&month=11
        period=daily&date=2026-11-15 · period=yearly&year=2026
        &export=pdf|csv|xlsx  → file download instead of JSON
    (`export`, not `format`: DRF reserves ?format= for its own renderer switching.)
    """

    permission_classes = [IsManagerOrAdmin]
    EXPORTS = {
        "pdf": (export_pdf, "application/pdf"),
        "csv": (export_csv, "text/csv; charset=utf-8"),
        "xlsx": (export_xlsx, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
    }

    def get(self, request):
        q = request.query_params
        kind = q.get("period", "monthly")
        if kind not in ("daily", "monthly", "yearly"):
            return Response({"detail": "period must be daily, monthly or yearly"}, status=400)
        try:
            year = int(q["year"]) if q.get("year") else None
            month = int(q["month"]) if q.get("month") else None
            if year is not None and not 2000 <= year <= 2100:
                raise ValueError
            day = parse_date(q.get("date", "")) if q.get("date") else None
            period = resolve_period(kind, year, month, day)
        except (ValueError, TypeError):
            return Response({"detail": "Invalid year, month or date."}, status=400)

        report = build_period_report(period)
        export = q.get("export")
        if not export:
            return Response(report)
        if export not in self.EXPORTS:
            return Response({"detail": "export must be pdf, csv or xlsx"}, status=400)
        builder, content_type = self.EXPORTS[export]
        response = HttpResponse(builder(report), content_type=content_type)
        response["Content-Disposition"] = f'attachment; filename="{report_filename(report, export)}"'
        return response
