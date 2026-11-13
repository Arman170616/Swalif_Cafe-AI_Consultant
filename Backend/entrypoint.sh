#!/bin/sh
set -e

python manage.py migrate --noinput
python manage.py collectstatic --noinput

# SQLite only ever allows one writer at a time across the whole file, no matter how
# generous the busy_timeout — WAL mode only stops readers from blocking on a writer,
# it doesn't parallelize writers. The one deployment shape that's actually immune to
# "database is locked" is a single worker AND a single thread (each request still runs
# to completion — including its DB writes — before the next one starts, so there's
# never a second connection to contend with). Deliberately no --threads here: passing
# any --threads value >1 makes gunicorn switch to the gthread worker class, which hands
# out one SQLite connection per thread and reintroduces the exact same "database is
# locked" races as multiple worker processes did. Fine for this app's real scale — a
# handful of cafe staff, not a high-traffic site — and the standard recommendation for
# Django+SQLite generally.
exec gunicorn config.wsgi:application \
    --bind 0.0.0.0:8000 \
    --workers 1 \
    --timeout 60 \
    --access-logfile - \
    --error-logfile -
