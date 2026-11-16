from django.conf import settings
from django.db import models


class Customer(models.Model):
    name = models.CharField(max_length=150)
    phone = models.CharField(max_length=30, blank=True)
    email = models.EmailField(blank=True)
    membership_card_number = models.CharField(max_length=30, unique=True, blank=True, null=True)
    loyalty_points = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Feedback(models.Model):
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name="feedback")
    order = models.ForeignKey("pos.Order", null=True, blank=True, on_delete=models.SET_NULL, related_name="feedback")
    rating = models.PositiveSmallIntegerField()
    comment = models.CharField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.customer} rated {self.rating}"


class PackagePlan(models.Model):
    """A fixed monthly package clients can buy, e.g. "30 coffees a month for 25 OMR".

    `price` is excl. VAT like every menu price — 5% VAT is added when it's sold.
    """

    name = models.CharField(max_length=120)
    description = models.CharField(max_length=255, blank=True)
    price = models.DecimalField(max_digits=10, decimal_places=3)
    drinks_per_month = models.PositiveIntegerField(help_text="Items the client can redeem per month")
    daily_limit = models.PositiveSmallIntegerField(
        null=True, blank=True, help_text="Max items per day (blank = no daily limit)"
    )
    categories = models.ManyToManyField(
        "inventory.Category",
        blank=True,
        related_name="package_plans",
        help_text="Menu categories that can be redeemed (none selected = any item)",
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["price", "name"]

    def __str__(self):
        return self.name


class CustomerPackage(models.Model):
    """One client's package for one month. Renewing creates the next month's row, so the
    history of every month bought stays intact. Plan terms are copied in at sale time so
    later edits to the plan don't change what a client already paid for."""

    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name="packages")
    plan = models.ForeignKey(PackagePlan, on_delete=models.PROTECT, related_name="sold")
    plan_name = models.CharField(max_length=120)
    price = models.DecimalField(max_digits=10, decimal_places=3)
    drinks_total = models.PositiveIntegerField()
    daily_limit = models.PositiveSmallIntegerField(null=True, blank=True)
    start_date = models.DateField()
    end_date = models.DateField(help_text="Last day the package can be used (inclusive)")
    sale_order = models.OneToOneField(
        "pos.Order", null=True, blank=True, on_delete=models.SET_NULL, related_name="package_sold"
    )
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-start_date", "-id"]

    def __str__(self):
        return f"{self.customer} — {self.plan_name} ({self.start_date:%b %Y})"

    @property
    def drinks_used(self) -> int:
        # Redemptions on cancelled orders give the drinks back.
        return (
            self.redemptions.exclude(order__status="cancelled").aggregate(n=models.Sum("quantity"))["n"] or 0
        )

    @property
    def drinks_remaining(self) -> int:
        return max(self.drinks_total - self.drinks_used, 0)

    def used_on(self, day) -> int:
        return (
            self.redemptions.exclude(order__status="cancelled")
            .filter(created_at__date=day)
            .aggregate(n=models.Sum("quantity"))["n"]
            or 0
        )

    def status_on(self, day) -> str:
        if day < self.start_date:
            return "upcoming"
        if day > self.end_date:
            return "expired"
        if self.drinks_remaining <= 0:
            return "used_up"
        return "active"


class PackageRedemption(models.Model):
    """Items taken against a package, recorded per POS order."""

    package = models.ForeignKey(CustomerPackage, on_delete=models.CASCADE, related_name="redemptions")
    order = models.ForeignKey("pos.Order", on_delete=models.CASCADE, related_name="package_redemptions")
    quantity = models.PositiveIntegerField()
    redeemed_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
