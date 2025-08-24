FROM node:18-alpine

# Install build dependencies including curl for Powers of Tau download
RUN apk add --no-cache python3 make g++ curl

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies (include dev dependencies for circom)
RUN npm ci

# Copy source code and circuit files
COPY src ./src
COPY templates ./templates
COPY circuits ./circuits
COPY scripts ./scripts

# Build circuits and TypeScript
RUN npm run build:circuits || echo "Circuit build failed, continuing with app build..."
RUN npm run build

# Create necessary directories
RUN mkdir -p logs circuits/build circuits/setup

# Clean up dev dependencies after build
RUN npm ci --only=production

# Expose port
EXPOSE 3000

# Set user
USER node

# Start application
CMD ["node", "dist/index.js"]