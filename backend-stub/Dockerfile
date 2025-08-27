FROM python:3.11-slim
WORKDIR /app

# Copy requirements and install dependencies
COPY backend-stub/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the main application
COPY backend-stub/main.py .

# Copy the public directory with images and mock data
COPY public /app/public

# Expose port
EXPOSE 8000

# Run the application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
