FROM python:3.11-slim-bookworm

# libgl1/libglib2.0 for opencv (PaddleOCR dep); libgomp1 is paddlepaddle's
# OpenMP runtime — without it `import paddle` fails immediately with
# "libgomp.so.1: cannot open shared object file"; pango/cairo/gdk-pixbuf for
# WeasyPrint.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
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

EXPOSE 8000

# Render (and most PaaS Docker runners) inject $PORT at container start rather
# than a fixed port — shell form so that substitution actually happens.
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
