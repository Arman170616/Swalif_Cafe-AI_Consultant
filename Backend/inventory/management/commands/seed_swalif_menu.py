"""Load the real Swalif Cafe (سوالف كافيه) menu into Category/Product.

Transcribed from the cafe's printed menu (prices in OMR). Idempotent: re-running updates
prices of existing items (matched by name) instead of creating duplicates, so it's safe to
run on every deploy or after the menu changes:

    python manage.py seed_swalif_menu
    python manage.py seed_swalif_menu --dry-run

Items sold in two sizes become two products, "(S)" and "(L)", because Product has no size
field. Names are bilingual ("English · عربي") so POS search works in either language.
"""

from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction

from inventory.models import Category, Product

# (category, [(english, arabic, small_or_only_price, large_price_or_None), ...])
MENU = [
    (
        "Hot Coffee · القهوة الساخنة",
        [
            ("Espresso", "اسبريسو", "1.000", None),
            ("Americano", "امريكانو", "1.100", None),
            ("Macchiato", "مكياتو", "1.000", None),
            ("Cortado", "كورتادو", "1.000", "1.200"),
            ("Cappuccino", "كابتشينو", "1.100", "1.300"),
            ("Mocha", "موكا", "1.400", "1.600"),
            ("White Mocha", "وايت موكا", "1.400", "1.600"),
            ("Dark Mocha", "دارك موكا", "1.400", "1.600"),
            ("Latte", "لاتيه", "1.100", "1.300"),
            ("Spanish Latte", "سبانش لاتيه", "1.300", "1.500"),
            ("Saffron Latte", "زعفران لاتيه", "1.600", "1.800"),
            ("Pistachio Latte", "فستق لاتيه", "1.500", "1.700"),
            ("Vanilla Latte", "فانيلا لاتيه", "1.400", "1.600"),
            ("Rose Latte", "روز لاتيه", "1.400", "1.600"),
            ("Hazelnut Latte", "بندق لاتيه", "1.400", "1.600"),
            ("Flat White", "فلات وايت", "1.300", None),
            ("Matcha", "ماتشا", "1.600", None),
            ("Hot Chocolate", "شوكولاته", "1.000", "1.200"),
            ("Turkish Coffee", "قهوة تركية", "1.000", None),
        ],
    ),
    (
        "Iced Coffee · القهوة الباردة",
        [
            ("Iced Americano", "امريكانو بارد", "1.200", None),
            ("Iced Mocha", "موكا بارد", "1.400", None),
            ("Iced White Mocha", "وايت موكا بارد", "1.600", None),
            ("Iced Latte", "لاتيه بارد", "1.300", None),
            ("Iced Spanish Latte", "سبانش لاتيه بارد", "1.500", None),
            ("Iced Saffron Latte", "زعفران لاتيه بارد", "1.800", None),
            ("Iced Vanilla Latte", "فانيلا لاتيه بارد", "1.600", None),
            ("Iced Rose Latte", "روز لاتيه بارد", "1.600", None),
            ("Iced Pistachio Latte", "فستق لاتيه بارد", "1.700", None),
            ("Iced Hazelnut Latte", "بندق لاتيه بارد", "1.600", None),
            ("Iced Vanilla", "فانيلا بارد", "1.800", None),
            ("Iced Hazelnut", "بندق بارد", "1.600", None),
        ],
    ),
    (
        "Drip Coffee · القهوة المقطرة",
        [
            ("V60", "V60", "1.600", None),
            ("Siphon", "سايفون", "1.800", None),
            ("Chemex", "كيمكس", "1.600", None),
        ],
    ),
    (
        "Mojitos · موهيتوس",
        [
            ("Strawberry Mojito", "موهيتو فراولة", "1.300", None),
            ("Lemon Mint Mojito", "موهيتو ليمون نعناع", "1.300", None),
            ("Passion Fruit Mojito", "موهيتو باشن فروت", "1.300", None),
            ("Mixed Berry Mojito", "موهيتو مكس بيري", "1.300", None),
            ("Blue Lagoon Mojito", "موهيتو بلو لاجون", "1.300", None),
            ("Red Bull Mojito", "موهيتو ردبول", "2.000", None),
            ("Peach Iced Tea", "شاي مثلج خوخ", "1.200", None),
        ],
    ),
    (
        "Fresh Juices · العصائر الطازجة",
        [
            ("Orange Juice", "عصير برتقال", "1.200", None),
            ("Mango Juice", "عصير مانجو", "1.400", None),
            ("Strawberry Juice", "عصير فراولة", "1.400", None),
            ("Avocado Juice", "عصير أفوكادو", "1.200", None),
            ("Lemon Mint Juice", "عصير ليمون نعناع", "1.200", None),
            ("Beetroot, Orange & Pomegranate", "شمندر و برتقال و رمان", "1.600", None),
            ("Classic Cocktail", "كوكتيل كلاسيك", "1.600", None),
        ],
    ),
    (
        "Smoothies · سموذي",
        [
            ("Oreo Smoothie", "سموذي اوريو", "0.800", "1.400"),
            ("Nutella Smoothie", "سموذي نوتيلا", "0.800", "1.400"),
            ("Strawberry Smoothie", "سموذي فراولة", "0.800", "1.400"),
            ("Lotus Smoothie", "سموذي لوتس", "0.800", "1.400"),
            ("KitKat Smoothie", "سموذي كت كات", "0.800", "1.400"),
            ("Vanilla Smoothie", "سموذي فانيلا", "0.800", "1.400"),
            ("Mango Smoothie", "سموذي مانجو", "0.800", "1.400"),
            ("Banana Smoothie", "سموذي موز", "0.800", "1.400"),
        ],
    ),
    (
        "Slushies · سلاشيز",
        [
            ("Strawberry Slush", "سلاش فراولة", "1.200", None),
            ("Cool Blue Slush", "سلاش كول بلو", "1.200", None),
        ],
    ),
    (
        "Frappuccino · فرابتشينو",
        [
            ("Oreo Frappuccino", "فرابتشينو اوريو", "1.600", None),
            ("Pistachio Frappuccino", "فرابتشينو فستق", "1.600", None),
            ("Caramel Frappuccino", "فرابتشينو كراميل", "1.600", None),
            ("Coffee Frappuccino", "فرابتشينو كافي", "1.500", None),
            ("Mocha Frappuccino", "فرابتشينو موكا", "1.600", None),
            ("White Mocha Frappuccino", "فرابتشينو وايت موكا", "1.600", None),
            ("Affogato Frappuccino", "فرابتشينو أفوجاتو", "1.600", None),
            ("Swalif One Frappuccino", "فرابتشينو سوالف اون", "1.800", None),
        ],
    ),
    (
        "Coffee Dallah · دلة قهوة",
        [
            ("Arabic Coffee Dallah", "دلة قهوة عربية", "2.500", None),
            ("Saudi Coffee Dallah", "دلة قهوة سعودية", "2.500", None),
        ],
    ),
    (
        "Desserts · الحلا",
        [
            ("Tiramisu", "تيراميسو", "2.200", None),
            ("Oreo Cheesecake", "تشيز كيك اوريو", "1.400", None),
            ("Lotus Cheesecake", "تشيز كيك لوتس", "1.400", None),
            ("Cookies", "كوكيز", "1.200", None),
            ("San Sebastian Cheesecake", "سان سبيستيان", "2.500", None),
            ("Ferrero Chocolate", "شوكولاته فيريرو", "2.000", None),
        ],
    ),
    (
        "Breakfast · الفطور",
        [
            ("Halloumi, Cheese & Mortadella Croissant", "كرواسون حلومي جبن مرتديلا", "1.000", None),
            ("Omelette Croissant", "كرواسون اومليت", "1.000", None),
            ("Sausage Croissant", "كرواسون نقانق", "1.000", None),
            ("Cheese & Mortadella Toast", "توست جبن مرتديلا", "0.800", None),
            ("Cheese & Tuna Toast", "توست جبن تونه", "0.800", None),
            ("Chicken Toast", "توست دجاج", "0.800", None),
            ("Egg Toast", "توست بيض", "0.800", None),
            ("Sausage Toast", "توست نقانق", "0.800", None),
            ("Club Sandwich", "كلوب ساندويتش", "1.200", None),
            ("American Breakfast – Mortadella & Egg", "فطور أمريكي مرتديلا بيض", "1.500", None),
            ("American Breakfast – Omelette & Sausage", "فطور أمريكي اومليت نقانق", "1.500", None),
            ("Cheese & Honey Crepe", "كريب جبن و عسل", "1.200", None),
            ("Cheese & Oman Chips Crepe", "كريب جبن و بطاطس عمان", "1.200", None),
        ],
    ),
]

# Item descriptions where the printed menu spells out what's included.
DESCRIPTIONS = {
    "American Breakfast – Mortadella & Egg": "بيض - خبز - جبن - مرتديلا · Egg, bread, cheese, mortadella",
    "American Breakfast – Omelette & Sausage": "اومليت - نقانق - مربى - زبدة · Omelette, sausage, jam, butter",
}


def _product_name(en: str, ar: str, size: str | None) -> str:
    suffix = f" ({size})" if size else ""
    return f"{en}{suffix} · {ar}" if en != ar else f"{en}{suffix}"


class Command(BaseCommand):
    help = "Create/update the Swalif Cafe menu (categories + products) from the printed menu."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true", help="Show what would change without saving.")

    @transaction.atomic
    def handle(self, *args, dry_run=False, **options):
        created = updated = unchanged = 0

        for cat_index, (category_name, items) in enumerate(MENU):
            category, _ = Category.objects.get_or_create(name=category_name)
            if category.position != cat_index:
                category.position = cat_index
                category.save(update_fields=["position"])
            position = 0
            for en, ar, small, large in items:
                variants = [("S", small), ("L", large)] if large else [(None, small)]
                for size, price in variants:
                    name = _product_name(en, ar, size)
                    defaults = {
                        "category": category,
                        "price": Decimal(price),
                        "description": DESCRIPTIONS.get(en, ""),
                        "is_active": True,
                        "position": position,
                    }
                    position += 1
                    product = Product.objects.filter(name=name).first()
                    if product is None:
                        Product.objects.create(name=name, **defaults)
                        created += 1
                    elif any(getattr(product, k) != v for k, v in defaults.items()):
                        for k, v in defaults.items():
                            setattr(product, k, v)
                        product.save()
                        updated += 1
                    else:
                        unchanged += 1

        if dry_run:
            transaction.set_rollback(True)
        prefix = "[dry run] " if dry_run else ""
        self.stdout.write(
            self.style.SUCCESS(
                f"{prefix}Swalif menu: {created} created, {updated} updated, {unchanged} unchanged "
                f"across {len(MENU)} categories."
            )
        )
