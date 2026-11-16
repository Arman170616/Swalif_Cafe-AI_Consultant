from datetime import date, timedelta
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from analytics.period_report import build_period_report, resolve_period
from inventory.models import Category, Product
from pos.models import Order

from .models import Customer, CustomerPackage, PackagePlan
from .packages import month_end


class MonthEndTests(TestCase):
    def test_month_end(self):
        self.assertEqual(month_end(date(2026, 11, 15)), date(2026, 12, 14))
        self.assertEqual(month_end(date(2026, 11, 1)), date(2026, 11, 30))
        self.assertEqual(month_end(date(2026, 12, 1)), date(2026, 12, 31))
        self.assertEqual(month_end(date(2027, 1, 31)), date(2027, 2, 27))  # Feb has no 31st


class PackageApiTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(username="a", password="x", role=User.Role.ADMIN)
        self.manager = User.objects.create_user(username="m", password="x", role=User.Role.MANAGER)
        self.coffee = Category.objects.create(name="Hot Coffee · القهوة الساخنة")
        self.dessert = Category.objects.create(name="Desserts · الحلا")
        self.latte = Product.objects.create(name="Latte (S) · لاتيه", category=self.coffee, price=Decimal("1.100"))
        self.cake = Product.objects.create(name="Tiramisu · تيراميسو", category=self.dessert, price=Decimal("2.200"))
        self.api = APIClient()
        self.api.force_authenticate(self.manager)

        admin_api = APIClient()
        admin_api.force_authenticate(self.admin)
        r = admin_api.post(
            "/api/crm/package-plans/",
            {"name": "Coffee 30", "price": "25.000", "drinks_per_month": 30, "daily_limit": 2, "categories": [self.coffee.id]},
            format="json",
        )
        self.assertEqual(r.status_code, 201, r.data)
        self.plan = PackagePlan.objects.get(pk=r.data["id"])

    def sell(self, **extra):
        body = {"customer_name": "Ahmed", "customer_phone": "9000", "plan": self.plan.id, "payment_method": "cash", **extra}
        r = self.api.post("/api/crm/packages/", body, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        return r.data

    def redeem(self, pkg_id, product, qty):
        return self.api.post(
            f"/api/crm/packages/{pkg_id}/redeem/", {"items": [{"product": product.id, "quantity": qty}]}, format="json"
        )

    def test_manager_cannot_create_plans(self):
        r = self.api.post("/api/crm/package-plans/", {"name": "x", "price": "1", "drinks_per_month": 1}, format="json")
        self.assertEqual(r.status_code, 403)

    def test_sell_books_revenue_with_vat_once(self):
        pkg = self.sell()
        self.assertEqual(pkg["status"], "active")
        self.assertEqual(pkg["drinks_remaining"], 30)
        self.assertEqual(Customer.objects.filter(name="Ahmed").count(), 1)
        order = Order.objects.get(pk=pkg["sale_order"])
        self.assertEqual(order.order_type, Order.OrderType.PACKAGE)
        self.assertEqual(order.total, Decimal("26.250"))  # 25.000 + 5% VAT
        self.assertEqual(order.amount_paid, Decimal("26.250"))

        self.assertEqual(self.redeem(pkg["id"], self.latte, 2).status_code, 201)
        report = build_period_report(resolve_period("daily", None, None, None))
        # Package money counted once; the redeemed lattes add nothing to sales.
        self.assertEqual(report["summary"]["net_sales"], Decimal("25.000"))
        self.assertEqual(report["summary"]["vat"], Decimal("1.250"))
        latte_row = next(p for p in report["products"] if p["product"].startswith("Latte"))
        self.assertEqual(latte_row["quantity"], 2)
        self.assertEqual(latte_row["revenue"], Decimal("0.000"))
        self.assertIn("Package sale", [t["label"] for t in report["order_types"]])

    def test_redeem_creates_free_order_and_counts_down(self):
        pkg = self.sell()
        r = self.redeem(pkg["id"], self.latte, 2)
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(Decimal(r.data["order"]["total"]), Decimal("0"))
        self.assertEqual(r.data["package"]["drinks_remaining"], 28)
        self.assertEqual(r.data["package"]["used_today"], 2)

    def test_daily_limit(self):
        pkg = self.sell()
        self.assertEqual(self.redeem(pkg["id"], self.latte, 2).status_code, 201)
        r = self.redeem(pkg["id"], self.latte, 1)
        self.assertEqual(r.status_code, 400)
        self.assertIn("Daily limit", str(r.data))

    def test_category_restriction(self):
        pkg = self.sell()
        r = self.redeem(pkg["id"], self.cake, 1)
        self.assertEqual(r.status_code, 400)
        self.assertIn("Not included", str(r.data))

    def test_cannot_exceed_remaining(self):
        self.plan.drinks_per_month, self.plan.daily_limit = 3, None
        self.plan.save()
        pkg = self.sell()
        self.assertEqual(self.redeem(pkg["id"], self.latte, 3).status_code, 201)
        r = self.redeem(pkg["id"], self.latte, 1)
        self.assertEqual(r.status_code, 400)
        self.assertEqual(CustomerPackage.objects.get(pk=pkg["id"]).status_on(timezone.localdate()), "used_up")

    def test_cancelled_redemption_gives_drinks_back(self):
        pkg = self.sell()
        order_id = self.redeem(pkg["id"], self.latte, 2).data["order"]["id"]
        Order.objects.filter(pk=order_id).update(status=Order.Status.CANCELLED)
        self.assertEqual(CustomerPackage.objects.get(pk=pkg["id"]).drinks_remaining, 30)

    def test_expired_package_blocks_redeem_and_renew_starts_today(self):
        pkg = self.sell(start_date=(timezone.localdate() - timedelta(days=40)).isoformat())
        self.assertEqual(pkg["status"], "expired")
        self.assertEqual(self.redeem(pkg["id"], self.latte, 1).status_code, 400)
        r = self.api.post(f"/api/crm/packages/{pkg['id']}/renew/", {"payment_method": "card"}, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data["start_date"], timezone.localdate().isoformat())
        self.assertEqual(r.data["status"], "active")

    def test_renew_active_package_starts_after_it_ends(self):
        pkg = self.sell()
        r = self.api.post(f"/api/crm/packages/{pkg['id']}/renew/", {"payment_method": "cash"}, format="json")
        self.assertEqual(r.data["start_date"], (date.fromisoformat(pkg["end_date"]) + timedelta(days=1)).isoformat())
        self.assertEqual(r.data["status"], "upcoming")

    def test_latest_list_and_plan_delete_protection(self):
        pkg = self.sell()
        self.api.post(f"/api/crm/packages/{pkg['id']}/renew/", {"payment_method": "cash"}, format="json")
        rows = self.api.get("/api/crm/packages/?latest=1").data
        self.assertEqual(len(rows), 1)
        admin_api = APIClient()
        admin_api.force_authenticate(self.admin)
        r = admin_api.delete(f"/api/crm/package-plans/{self.plan.id}/")
        self.assertEqual(r.status_code, 400)

    def test_inactive_plan_cannot_be_sold(self):
        self.plan.is_active = False
        self.plan.save()
        r = self.api.post(
            "/api/crm/packages/", {"customer_name": "B", "plan": self.plan.id, "payment_method": "cash"}, format="json"
        )
        self.assertEqual(r.status_code, 400)


class TopCustomersTests(TestCase):
    def setUp(self):
        self.manager = User.objects.create_user(username="m2", password="x", role=User.Role.MANAGER)
        cat = Category.objects.create(name="Hot Coffee")
        self.latte = Product.objects.create(name="Latte", category=cat, price=Decimal("1.000"))
        self.api = APIClient()
        self.api.force_authenticate(self.manager)
        self.sara = Customer.objects.create(name="Sara", phone="1")
        self.omar = Customer.objects.create(name="Omar", phone="2")

    def order(self, customer, qty):
        r = self.api.post("/api/pos/orders/", {"order_type": "dine_in", "customer": customer.id, "items": [{"product": self.latte.id, "quantity": qty}]}, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        return r.data

    def test_ranked_by_amount_with_visits_and_packages(self):
        self.order(self.sara, 1)
        self.order(self.sara, 1)
        self.order(self.omar, 5)
        cancelled = self.order(self.omar, 10)
        Order.objects.filter(pk=cancelled["id"]).update(status=Order.Status.CANCELLED)
        report = build_period_report(resolve_period("daily", None, None, None))
        top = report["top_customers"]
        self.assertEqual([t["name"] for t in top], ["Omar", "Sara"])
        self.assertEqual(top[0]["orders"], 1)
        self.assertEqual(top[0]["amount"], Decimal("5.250"))  # cancelled order ignored
        self.assertEqual(top[1]["orders"], 2)
        self.assertEqual(top[1]["amount"], Decimal("2.100"))

    def test_payments_ledger_is_manager_only_and_date_filtered(self):
        staff = User.objects.create_user(username="s", password="x", role=User.Role.STAFF)
        o = self.order(self.sara, 1)
        self.api.post(f"/api/pos/orders/{o['id']}/add_payment/", {"method": "cash", "amount": o["total"]}, format="json")
        r = self.api.get("/api/pos/payments/", {"start": timezone.localdate().isoformat()})
        self.assertEqual(r.data["count"], 1)
        self.assertEqual(r.data["results"][0]["customer_name"], "Sara")
        self.assertEqual(self.api.get("/api/pos/payments/", {"start": "2000-01-01", "end": "2000-01-02"}).data["count"], 0)
        staff_api = APIClient()
        staff_api.force_authenticate(staff)
        self.assertEqual(staff_api.get("/api/pos/payments/").status_code, 403)
