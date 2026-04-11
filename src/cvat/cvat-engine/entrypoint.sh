#!/bin/bash
set -e

echo "🚀 Running Django migrations..."
python3 manage.py migrate --noinput

echo "🔐 Ensuring superuser exists..."
python3 manage.py shell <<EOF
from django.contrib.auth import get_user_model
User = get_user_model()

username = "admin"
password = "admin123"
email = "admin@example.com"

if not User.objects.filter(username=username).exists():
    User.objects.create_superuser(username=username, password=password, email=email)
    print("Superuser created:", username)
else:
    print("Superuser already exists:", username)
EOF

echo "▶️ Starting CVAT server..."
exec supervisord -c /home/django/supervisord/server.conf
