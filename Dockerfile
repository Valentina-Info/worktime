# Use the official Node.js image as base
FROM node:22-alpine

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Provide the database URL while Next.js collects route metadata at build time.
ARG DATABASE_URL=postgresql://user:password@db:5432/timetracking
ENV DATABASE_URL=$DATABASE_URL

# Build the application
RUN npm run build

# Expose the port the app runs on
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
