#!/bin/sh
set -e

echo "⏳ Đang chờ PostgreSQL sẵn sàng tại ${POSTGRES_HOST}:${POSTGRES_PORT}..."
while ! nc -z "${POSTGRES_HOST:-db}" "${POSTGRES_PORT:-5432}"; do
  sleep 1
done
echo "PostgreSQL đã sẵn sàng."

python manage.py migrate --noinput

if [ "$1" = "runserver" ]; then
  echo "Chạy server dev tại 0.0.0.0:8000"
  exec python manage.py runserver 0.0.0.0:8000
elif [ "$1" = "gunicorn" ]; then
  echo "Chạy Gunicorn (production)"
  exec gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 3
else
  exec "$@"
fi
