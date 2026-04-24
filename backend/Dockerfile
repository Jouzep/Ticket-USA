FROM mcr.microsoft.com/playwright/python:v1.49.0-noble

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Install deps first for better caching
COPY pyproject.toml ./
RUN pip install --upgrade pip && \
    pip install .

# Copy source
COPY app ./app
COPY tests ./tests

EXPOSE 8000

# Shell form so $PORT is expanded (Railway/Render set $PORT at runtime)
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
