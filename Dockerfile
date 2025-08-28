FROM python:3.11-slim

WORKDIR /app

# Copy the public directory first
COPY public /app/public

# Copy the src directory inside public so relative paths work
COPY src /app/public/src

# Expose port 8080 to match your local setup
EXPOSE 8080

# Use Python's built-in HTTP server, just like your local command
CMD ["python3", "-m", "http.server", "8080", "--bind", "0.0.0.0"]