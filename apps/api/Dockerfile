FROM python:3.11-slim-bookworm

# libgl1/libglib2.0 for opencv (PaddleOCR dep); pango/cairo/gdk-pixbuf for WeasyPrint.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libcairo2 \
    libgdk-pixbuf2.0-0 \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir --default-timeout=180 --retries 10 -r requirements.txt

COPY app ./app

# Hugging Face Spaces (Docker SDK) routes traffic to this port by default.
EXPOSE 7860

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7860"]
