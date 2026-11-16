from rest_framework import serializers

from django.contrib.auth import get_user_model
from django.utils import timezone

from inventory.models import Product
from pos.models import Payment

from .models import Customer, CustomerPackage, Feedback, PackagePlan


class CustomerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Customer
        fields = [
            "id",
            "name",
            "phone",
            "email",
            "membership_card_number",
            "loyalty_points",
            "created_at",
        ]
        read_only_fields = ["loyalty_points"]


class FeedbackSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source="customer.name", read_only=True)

    class Meta:
        model = Feedback
        fields = ["id", "customer", "customer_name", "order", "rating", "comment", "created_at"]


class OrderSummarySerializer(serializers.Serializer):
    id = serializers.IntegerField()
    order_type = serializers.CharField()
    status = serializers.CharField()
    total = serializers.DecimalField(max_digits=10, decimal_places=3)
    created_at = serializers.DateTimeField()


class PackagePlanSerializer(serializers.ModelSerializer):
    category_names = serializers.SerializerMethodField()
    active_clients = serializers.SerializerMethodField()

    class Meta:
        model = PackagePlan
        fields = [
            "id", "name", "description", "price", "drinks_per_month", "daily_limit",
            "categories", "category_names", "is_active", "active_clients", "created_at",
        ]

    def get_category_names(self, obj):
        return [c.name for c in obj.categories.all()]

    def get_active_clients(self, obj):
        today = timezone.localdate()
        return sum(1 for p in obj.sold.filter(start_date__lte=today, end_date__gte=today) if p.drinks_remaining > 0)


class CustomerPackageSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source="customer.name", read_only=True)
    customer_phone = serializers.CharField(source="customer.phone", read_only=True)
    drinks_used = serializers.IntegerField(read_only=True)
    drinks_remaining = serializers.IntegerField(read_only=True)
    used_today = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()
    days_left = serializers.SerializerMethodField()
    total_paid = serializers.DecimalField(source="sale_order.total", max_digits=10, decimal_places=3, read_only=True, default=None)
    eligible_categories = serializers.SerializerMethodField()
    redemptions = serializers.SerializerMethodField()

    class Meta:
        model = CustomerPackage
        fields = [
            "id", "customer", "customer_name", "customer_phone", "plan", "plan_name", "price", "total_paid",
            "drinks_total", "drinks_used", "drinks_remaining", "daily_limit", "used_today",
            "start_date", "end_date", "status", "days_left", "eligible_categories", "sale_order",
            "redemptions", "created_at",
        ]

    def get_used_today(self, obj):
        return obj.used_on(timezone.localdate())

    def get_status(self, obj):
        return obj.status_on(timezone.localdate())

    def get_days_left(self, obj):
        return max((obj.end_date - timezone.localdate()).days + 1, 0)

    def get_eligible_categories(self, obj):
        return list(obj.plan.categories.values_list("id", flat=True))

    def get_redemptions(self, obj):
        rows = obj.redemptions.select_related("order").prefetch_related("order__items__product")[:30]
        return [
            {
                "id": r.id,
                "order": r.order_id,
                "quantity": r.quantity,
                "cancelled": r.order.status == "cancelled",
                "items": [f"{i.quantity}× {i.product.name}" for i in r.order.items.all()],
                "created_at": r.created_at,
            }
            for r in rows
        ]


class SellPackageSerializer(serializers.Serializer):
    """Sell a package to an existing client (`customer`) or a new one (`customer_name`)."""

    customer = serializers.PrimaryKeyRelatedField(queryset=Customer.objects.all(), required=False, allow_null=True)
    customer_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    customer_phone = serializers.CharField(max_length=30, required=False, allow_blank=True)
    plan = serializers.PrimaryKeyRelatedField(queryset=PackagePlan.objects.all())
    payment_method = serializers.ChoiceField(choices=Payment.Method.choices)
    start_date = serializers.DateField(required=False, allow_null=True)

    def validate(self, attrs):
        if not attrs.get("customer") and not (attrs.get("customer_name") or "").strip():
            raise serializers.ValidationError({"customer_name": "Pick an existing client or enter a new client's name."})
        return attrs


class RenewPackageSerializer(serializers.Serializer):
    payment_method = serializers.ChoiceField(choices=Payment.Method.choices)


class RedeemItemSerializer(serializers.Serializer):
    product = serializers.PrimaryKeyRelatedField(queryset=Product.objects.filter(is_active=True))
    quantity = serializers.IntegerField(min_value=1, max_value=50)


class RedeemSerializer(serializers.Serializer):
    items = RedeemItemSerializer(many=True)
    served_by = serializers.PrimaryKeyRelatedField(
        queryset=get_user_model().objects.filter(is_active=True), required=False, allow_null=True
    )
    table_number = serializers.CharField(max_length=20, required=False, allow_blank=True)
