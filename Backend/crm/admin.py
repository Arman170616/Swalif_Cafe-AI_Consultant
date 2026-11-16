from django.contrib import admin

from .models import Customer, Feedback


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ("name", "phone", "membership_card_number", "loyalty_points")
    search_fields = ("name", "phone", "membership_card_number")


@admin.register(Feedback)
class FeedbackAdmin(admin.ModelAdmin):
    list_display = ("customer", "rating", "order", "created_at")
    list_filter = ("rating",)


from .models import CustomerPackage, PackagePlan, PackageRedemption  # noqa: E402


@admin.register(PackagePlan)
class PackagePlanAdmin(admin.ModelAdmin):
    list_display = ("name", "price", "drinks_per_month", "daily_limit", "is_active")
    filter_horizontal = ("categories",)


class PackageRedemptionInline(admin.TabularInline):
    model = PackageRedemption
    extra = 0
    readonly_fields = ("order", "quantity", "redeemed_by", "created_at")


@admin.register(CustomerPackage)
class CustomerPackageAdmin(admin.ModelAdmin):
    list_display = ("customer", "plan_name", "start_date", "end_date", "drinks_total")
    list_filter = ("plan",)
    search_fields = ("customer__name", "customer__phone")
    inlines = [PackageRedemptionInline]
