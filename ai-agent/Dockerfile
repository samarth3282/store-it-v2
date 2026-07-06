FROM python:3.10-slim

# Set working directory
WORKDIR /app

# Copy requirements file
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code
COPY . .

# Environment variable to trigger AWS Secrets Manager fetch
ENV USE_SECRETS_MANAGER=true

# Expose the port the app runs on
EXPOSE 8000

# Start the FastAPI application via uvicorn
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
