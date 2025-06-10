# Use the official Node.js runtime as the base image
FROM node:22-alpine

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Install dependencies
RUN npm install --only=production

# Copy the compiled JavaScript files
COPY dist/ ./

# Expose port (optional, adjust as needed)
# EXPOSE 3000

# Define the command to run the application
CMD ["time", "node", "index.js"]
