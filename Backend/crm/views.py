from django.db.models import ProtectedError
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from accounts.models import User
from accounts.permissions import ReadWriteRolePermission
from pos.serializers import OrderSerializer

from .models import Customer, CustomerPackage, Feedback, PackagePlan
from .packages import redeem, renew_package, sell_package
from .serializers import (
    CustomerPackageSerializer,
    CustomerSerializer,
    FeedbackSerializer,
    OrderSummarySerializer,
    PackagePlanSerializer,
    RedeemSerializer,
    RenewPackageSerializer,
    SellPackageSerializer,
)


class CustomerViewSet(viewsets.ModelViewSet):
    queryset = Customer.objects.all()
    serializer_class = CustomerSerializer
    filterset_fields = ["membership_card_number"]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    search_fields = ["name", "phone", "membership_card_number"]

    @action(detail=True, methods=["get"])
    def purchase_history(self, request, pk=None):
        customer = self.get_object()
        orders = customer.orders.exclude(status="cancelled").order_by("-created_at")
        return Response(OrderSummarySerializer(orders, many=True).data)


class FeedbackViewSet(viewsets.ModelViewSet):
    queryset = Feedback.objects.select_related("customer").all()
    serializer_class = FeedbackSerializer
    filterset_fields = ["customer", "order", "rating"]


class PackagePlanViewSet(viewsets.ModelViewSet):
    """Monthly package plans. Admin defines them; Manager can see them to sell them."""

    queryset = PackagePlan.objects.prefetch_related("categories").all()
    serializer_class = PackagePlanSerializer
    permission_classes = [ReadWriteRolePermission]
    read_roles = (User.Role.ADMIN, User.Role.MANAGER)
    write_roles = (User.Role.ADMIN,)
    filterset_fields = ["is_active"]

    def destroy(self, request, *args, **kwargs):
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            return Response(
                {"detail": "This plan has already been sold, so it can't be deleted — switch it off instead."},
                status=status.HTTP_400_BAD_REQUEST,
            )


class CustomerPackageViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """Clients' monthly packages: list/see them, sell (POST), renew and redeem at POS.

    GET filters: ?customer=<id> · ?status=active|expired|used_up|upcoming ·
                 ?latest=1 (one row per client — their newest package) · ?search=<name/phone>
    """

    queryset = CustomerPackage.objects.select_related("customer", "plan", "sale_order").all()
    serializer_class = CustomerPackageSerializer
    permission_classes = [ReadWriteRolePermission]
    read_roles = (User.Role.ADMIN, User.Role.MANAGER)
    write_roles = (User.Role.ADMIN, User.Role.MANAGER)
    pagination_class = None  # a cafe's package clients fit in one list; status is computed

    def get_queryset(self):
        qs = super().get_queryset()
        q = self.request.query_params
        if q.get("customer"):
            qs = qs.filter(customer_id=q["customer"])
        if q.get("search"):
            from django.db.models import Q

            term = q["search"].strip()
            qs = qs.filter(Q(customer__name__icontains=term) | Q(customer__phone__icontains=term))
        return qs

    def list(self, request, *args, **kwargs):
        rows = list(self.get_queryset())
        if request.query_params.get("latest"):
            seen, latest = set(), []
            for p in sorted(rows, key=lambda p: (p.end_date, p.id), reverse=True):
                if p.customer_id not in seen:
                    seen.add(p.customer_id)
                    latest.append(p)
            rows = latest
        wanted = request.query_params.get("status")
        if wanted:
            today = timezone.localdate()
            rows = [p for p in rows if p.status_on(today) == wanted]
        rows.sort(key=lambda p: p.customer.name.lower())
        return Response(self.get_serializer(rows, many=True).data)

    def create(self, request):
        s = SellPackageSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        d = s.validated_data
        customer = d.get("customer")
        if customer is None:
            customer = Customer.objects.create(name=d["customer_name"].strip(), phone=(d.get("customer_phone") or "").strip())
        package = sell_package(
            customer=customer, plan=d["plan"], method=d["payment_method"], start=d.get("start_date"), user=request.user
        )
        return Response(self.get_serializer(package).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def renew(self, request, pk=None):
        s = RenewPackageSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        package = renew_package(self.get_object(), method=s.validated_data["payment_method"], user=request.user)
        return Response(self.get_serializer(package).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def redeem(self, request, pk=None):
        package = self.get_object()
        s = RedeemSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        order = redeem(
            package,
            items=s.validated_data["items"],
            user=request.user,
            served_by=s.validated_data.get("served_by"),
            table_number=s.validated_data.get("table_number", ""),
            request=request,
        )
        package.refresh_from_db()
        return Response(
            {"order": OrderSerializer(order).data, "package": self.get_serializer(package).data},
            status=status.HTTP_201_CREATED,
        )
