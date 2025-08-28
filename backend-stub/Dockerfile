# syntax=docker/dockerfile:1.6
FROM python:3.11-slim
ENV PIP_NO_CACHE_DIR=1 PIP_ROOT_USER_ACTION=ignore PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1

RUN --mount=type=cache,target=/var/cache/apt \
    apt-get update && apt-get install -y --no-install-recommends \
      libglib2.0-0 libsm6 libxext6 libxrender1 libgomp1 libgl1 \
      libjpeg62-turbo libpng16-16 libtiff6 ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .

RUN --mount=type=cache,target=/root/.cache/pip \
    python -m pip install --upgrade pip && \
    python -m pip install --only-binary=:all: --prefer-binary \
      --extra-index-url https://download.pytorch.org/whl/cpu \
      -r requirements.txt && \
    rm -rf /tmp/pip-*

# Copy only backend code (no public directory)
COPY main.py .
COPY model_loader.py .
COPY models/ ./models/

EXPOSE 8000
CMD ["python","-m","uvicorn","main:app","--host","0.0.0.0","--port","8000"]
