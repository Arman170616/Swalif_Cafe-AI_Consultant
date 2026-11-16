from rest_framework.routers import DefaultRouter

from .views import CustomerPackageViewSet, CustomerViewSet, FeedbackViewSet, PackagePlanViewSet

router = DefaultRouter()
router.register("customers", CustomerViewSet)
router.register("feedback", FeedbackViewSet)
router.register("package-plans", PackagePlanViewSet)
router.register("packages", CustomerPackageViewSet)

urlpatterns = router.urls
