# syntax=docker/dockerfile:1.6
FROM mambaorg/micromamba:1.5-focal
USER root
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
     && rm -rf /var/lib/apt/lists/*

# Install pixi (curl is included in the micromamba base image)
RUN curl -fsSL https://pixi.sh/install.sh | bash
ENV PATH="/root/.pixi/bin:$PATH"

WORKDIR /app

# Copy pixi configuration
COPY pixi.toml .

# Install dependencies using pixi
RUN pixi install

# Copy application files
COPY src/ ./src/
COPY public/ ./public/

EXPOSE 8000
CMD ["pixi", "run", "start"]
