FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Environment variable to trigger AWS Secrets Manager fetch
ENV USE_SECRETS_MANAGER=true

# Expose the port the app runs on (from .env.example)
EXPOSE 5000

# Start the application
CMD ["npm", "start"]
