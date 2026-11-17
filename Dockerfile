FROM python:3.11-slim

WORKDIR /app
COPY backend/ /app/backend/
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

WORKDIR /app/backend
EXPOSE 8010
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8010"]
