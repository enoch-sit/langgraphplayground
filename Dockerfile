FROM python:3.11-slim

WORKDIR /app

# Install system dependencies + Node.js for React build + PostgreSQL client
RUN apt-get update && apt-get install -y \
    gcc \
    curl \
    postgresql-client \
    && curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy frontend and build React
COPY frontend/package*.json frontend/
WORKDIR /app/frontend
RUN npm install
COPY frontend/ .
RUN npm run build

# Copy application code
WORKDIR /app
COPY . .

# Copy wait script and make it executable
COPY wait-for-postgres.sh /wait-for-postgres.sh
RUN chmod +x /wait-for-postgres.sh

# Expose port
EXPOSE 2024

# Run the application with wait script
CMD ["/wait-for-postgres.sh", "uvicorn", "src.agent.webapp:app", "--host", "0.0.0.0", "--port", "2024"]
