"""
Django settings for config project (Share Cafe Management System backend).
"""

import os
from datetime import timedelta
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.environ.get(
    "DJANGO_SECRET_KEY",
    "django-insecure-3ook($fv80!^^$+u4bfn!zohp&(&h207v3yh!8-3%k(tirag4j",
)

DEBUG = os.environ.get("DJANGO_DEBUG", "true").lower() == "true"

ALLOWED_HOSTS = os.environ.get("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1").split(",")


INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # third-party
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "django_filters",
    # local apps
    "accounts",
    "inventory",
    "pos",
    "invoices",
    "hr",
    "payroll",
    "crm",
    "analytics",
    "notifications",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "accounts.middleware.IPAccessControlMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"


DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        # Overridable so the deployed container can point this at a mounted volume
        # (persists across image rebuilds/redeploys) instead of the image's own filesystem.
        "NAME": os.environ.get("DJANGO_DB_PATH", str(BASE_DIR / "db.sqlite3")),
        # SQLite only allows one writer at a time — with multiple gunicorn workers,
        # two requests writing at once (e.g. login's ActivityLog + ActiveSession
        # writes) can otherwise fail immediately with "database is locked" instead of
        # just waiting the extra few milliseconds for the other write to finish.
        "OPTIONS": {"timeout": 20},
    }
}

# WAL mode lets readers and writers work concurrently instead of blocking each other on
# every request — the single biggest lever for running SQLite behind more than one
# gunicorn worker without "database is locked" errors under everyday concurrent use.
if DATABASES["default"]["ENGINE"] == "django.db.backends.sqlite3":
    from django.db.backends.signals import connection_created

    def _set_sqlite_pragmas(sender, connection, **kwargs):
        if connection.vendor == "sqlite":
            connection.cursor().execute("PRAGMA journal_mode=WAL;")

    connection_created.connect(_set_sqlite_pragmas)

AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "Asia/Muscat"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
# WhiteNoise serves Django's own static files (admin CSS/JS) directly from the app
# process — the frontend SPA itself is a separate app served by nginx, this is only
# for the Django admin panel at /admin/.
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "accounts.authentication.SingleDeviceJWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_FILTER_BACKENDS": (
        "django_filters.rest_framework.DjangoFilterBackend",
    ),
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 25,
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(hours=8),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
}

# django-cors-headers: allow the local Vite dev server for now.
CORS_ALLOWED_ORIGINS = os.environ.get(
    "CORS_ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
).split(",")

# Needed for POST requests (e.g. the Django admin login form) to be accepted once the
# app is reached over a real host/IP instead of localhost — Django checks the Origin
# header against this list for any state-changing request.
_csrf_origins = os.environ.get("CSRF_TRUSTED_ORIGINS", "")
CSRF_TRUSTED_ORIGINS = [o for o in _csrf_origins.split(",") if o]

# --- Share Cafe specific settings ---

# IP-based login (SRS section 1). Enforced by accounts.middleware.IPAccessControlMiddleware
# against the accounts.IPAccessRule table. When DEBUG is on, loopback/private addresses are
# always allowed so local development isn't locked out; disable via IP_ACCESS_ENFORCE_IN_DEBUG.
IP_ACCESS_CONTROL_ENABLED = os.environ.get("IP_ACCESS_CONTROL_ENABLED", "true").lower() == "true"
IP_ACCESS_ENFORCE_IN_DEBUG = os.environ.get("IP_ACCESS_ENFORCE_IN_DEBUG", "false").lower() == "true"

# With DEBUG=False, Django's own default logging config still exists but gunicorn's
# --error-logfile doesn't capture it the same way runserver's console does — make 500s
# print their full traceback to stderr (which `docker compose logs` shows) instead of
# just a bare status code with nothing to diagnose.
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "root": {"handlers": ["console"], "level": "WARNING"},
    "loggers": {
        "django.request": {"handlers": ["console"], "level": "ERROR", "propagate": False},
    },
}
