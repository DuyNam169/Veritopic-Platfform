#!/bin/sh

set -e

POSTGRES_HOST="${POSTGRES_HOST:-db}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"

echo "⏳ Đang chờ PostgreSQL tại ${POSTGRES_HOST}:${POSTGRES_PORT}..."

until nc -z "$POSTGRES_HOST" "$POSTGRES_PORT"; do
    sleep 1
done

echo "PostgreSQL đã sẵn sàng."

python manage.py migrate --noinput

if [ "$1" = "runserver" ]; then
    echo "Chạy Django development server tại 0.0.0.0:8000"
    exec python manage.py runserver 0.0.0.0:8000

elif [ "$1" = "gunicorn" ]; then
    echo "Chạy Gunicorn production server"
    exec gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 3

else
    exec "$@"
fi
