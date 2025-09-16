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

# Install dependencies using pixi
RUN pixi install

# Copy application files
COPY src/ ./src/
COPY public/ ./public/

EXPOSE 8000
CMD ["pixi", "run", "start"]
