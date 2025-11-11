# syntax=docker/dockerfile:1.6
FROM debian:12-slim

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install pixi
RUN curl -fsSL https://pixi.sh/install.sh | bash

ENV PATH="/root/.pixi/bin:$PATH"

WORKDIR /app

# Copy pixi configuration
COPY pyproject.toml .
RUN pixi workspace platform add linux-aarch64
# Install dependencies using pixi
RUN pixi install

# Build frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && npm ci
COPY frontend/ ./
RUN npm run build

# Copy application files
WORKDIR /app
COPY agentic_cervical_screener/ ./agentic_cervical_screener/
COPY public/ ./public/

EXPOSE 8000
CMD ["pixi", "run", "start"]
