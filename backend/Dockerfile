FROM python:3.12-slim AS runtime
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
COPY backend/pyproject.toml backend/constraints.txt ./
COPY backend/app ./app
RUN pip install --no-cache-dir -c constraints.txt . && useradd --create-home appuser && mkdir /data && chown appuser:appuser /data
USER appuser
ENV ORDERFLOW_DATABASE_URL=sqlite:////data/orders.db
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
