FROM python:3.11-slim

WORKDIR /app/backend

# Copy requirements first for better caching
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application
COPY . .

# Set Python path
ENV PYTHONPATH=/app

# Expose port
EXPOSE 8000

# Run the application with auto-reload for development
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
