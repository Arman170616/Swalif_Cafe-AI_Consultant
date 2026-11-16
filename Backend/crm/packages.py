"""Selling, renewing and redeeming fixed monthly packages (crm.CustomerPackage).

Accounting model — the money is counted once, when the package is sold:
  * Sale/renewal  → a POS Order of type "package" with no items, subtotal = plan price,
                    5% VAT on top, paid in full. Shows up in reports as a "Package sale".
  * Redemption    → a normal POS Order with the real menu items (so stock, kitchen flow
                    and best-sellers all work), each line discounted to zero, no payment.
"""

import calendar
from datetime import date, timedelta
from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from pos.models import Order, Payment
from pos.serializers import OrderCreateSerializer

from .models import CustomerPackage, PackagePlan, PackageRedemption


def month_end(start: date) -> date:
    """Last day of a one-month package starting on `start` (15 Nov → 14 Dec)."""
    y, m = (start.year + 1, 1) if start.month == 12 else (start.year, start.month + 1)
    day = min(start.day, calendar.monthrange(y, m)[1])
    return date(y, m, day) - timedelta(days=1)


@transaction.atomic
def sell_package(*, customer, plan: PackagePlan, method: str, start: date | None, user) -> CustomerPackage:
    if not plan.is_active:
        raise ValidationError({"plan": "This package plan is no longer offered."})
    start = start or timezone.localdate()

    order = Order.objects.create(
        order_type=Order.OrderType.PACKAGE,
        status=Order.Status.DELIVERED,
        customer=customer,
        created_by=user,
        served_by=user,
        notes=f"Package: {plan.name} ({start:%d %b %Y})",
    )
    # No items, so set the totals directly rather than via recalculate_totals().
    order.subtotal = plan.price
    order.tax_amount = (plan.price * order.tax_rate).quantize(Decimal("0.001"))
    order.total = (plan.price + order.tax_amount).quantize(Decimal("0.001"))
    order.save(update_fields=["subtotal", "tax_amount", "total", "updated_at"])
    Payment.objects.create(order=order, method=method, amount=order.total, received_by=user)

    return CustomerPackage.objects.create(
        customer=customer,
        plan=plan,
        plan_name=plan.name,
        price=plan.price,
        drinks_total=plan.drinks_per_month,
        daily_limit=plan.daily_limit,
        start_date=start,
        end_date=month_end(start),
        sale_order=order,
        created_by=user,
    )


def renew_package(package: CustomerPackage, *, method: str, user) -> CustomerPackage:
    """Next month for the same client and plan. Starts the day after their latest package
    ends, or today if that one has already run out."""
    latest = package.customer.packages.order_by("-end_date").first() or package
    today = timezone.localdate()
    start = max(latest.end_date + timedelta(days=1), today)
    return sell_package(customer=package.customer, plan=package.plan, method=method, start=start, user=user)


@transaction.atomic
def redeem(package: CustomerPackage, *, items: list[dict], user, served_by=None, table_number="", request=None) -> Order:
    # Lock the package row so two tills can't redeem the last drinks at the same moment.
    package = CustomerPackage.objects.select_for_update().get(pk=package.pk)
    today = timezone.localdate()
    status = package.status_on(today)
    if status != "active":
        raise ValidationError(
            {
                "upcoming": f"This package only starts on {package.start_date:%d %b %Y}.",
                "expired": f"This package ended on {package.end_date:%d %b %Y} — renew it first.",
                "used_up": "All drinks in this package have been used — renew it first.",
            }[status]
        )

    qty = sum(i["quantity"] for i in items)
    if qty < 1:
        raise ValidationError("Add at least one item to redeem.")
    if qty > package.drinks_remaining:
        raise ValidationError(f"Only {package.drinks_remaining} left in this package (tried to redeem {qty}).")
    if package.daily_limit:
        left_today = package.daily_limit - package.used_on(today)
        if qty > left_today:
            raise ValidationError(
                f"Daily limit is {package.daily_limit} — {max(left_today, 0)} left today (tried to redeem {qty})."
            )

    allowed = set(package.plan.categories.values_list("id", flat=True))
    if allowed:
        bad = [i["product"].name for i in items if i["product"].category_id not in allowed]
        if bad:
            names = ", ".join(sorted({b.split(" · ")[0] for b in bad}))
            raise ValidationError(f"Not included in this package: {names}.")

    data = {
        "order_type": Order.OrderType.DINE_IN,
        "table_number": table_number or "",
        "customer": package.customer_id,
        "notes": f"Package redemption: {package.plan_name}",
        "items": [
            {
                "product": i["product"].id,
                "quantity": i["quantity"],
                # Fully covered by the prepaid package — revenue was booked at sale time.
                "discount": (i["product"].price * i["quantity"]).quantize(Decimal("0.001")),
            }
            for i in items
        ],
    }
    if served_by is not None:
        data["served_by"] = served_by.id
    serializer = OrderCreateSerializer(data=data, context={"request": request})
    serializer.is_valid(raise_exception=True)
    order = serializer.save()

    PackageRedemption.objects.create(package=package, order=order, quantity=qty, redeemed_by=user)
    return order
