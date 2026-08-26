FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# System dependencies:
#  - libpq-dev, gcc: build psycopg2
#  - các gói libpango/libcairo/libgdk-pixbuf/shared-mime-info: BẮT BUỘC cho WeasyPrint (xuất PDF)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libpq-dev gcc \
    libpango-1.0-0 libpangocairo-1.0-0 \
    libcairo2 libgdk-pixbuf-2.0-0 libffi-dev \
    shared-mime-info fonts-dejavu-core \
    netcat-traditional \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements/ requirements/
ARG REQUIREMENTS_FILE=requirements/dev.txt
RUN pip install --no-cache-dir -r ${REQUIREMENTS_FILE}

COPY . .
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 8000
ENTRYPOINT ["/entrypoint.sh"]
