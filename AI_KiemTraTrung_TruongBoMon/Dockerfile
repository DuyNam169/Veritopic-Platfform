FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HF_HOME=/root/.cache/huggingface

WORKDIR /app

COPY requirements-api.txt ./requirements-api.txt
RUN pip install --no-cache-dir \
      --index-url https://download.pytorch.org/whl/cpu \
      torch==2.4.1+cpu \
    && pip install --no-cache-dir -r requirements-api.txt

COPY src ./src
RUN mkdir -p /app/models

EXPOSE 8001

CMD ["python", "-m", "uvicorn", "src.inference.api:app", "--host", "0.0.0.0", "--port", "8001"]
