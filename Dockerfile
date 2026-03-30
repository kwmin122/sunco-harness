FROM node:24-slim

WORKDIR /app

# Install git (required for simple-git)
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY packages/cli/package.json packages/cli/
COPY packages/skills-harness/package.json packages/skills-harness/
COPY packages/skills-workflow/package.json packages/skills-workflow/
COPY packages/skills-extension/package.json packages/skills-extension/

# Install dependencies
RUN npm ci --ignore-scripts

# Copy source and build
COPY . .
RUN npx turbo build

# Set entrypoint
ENTRYPOINT ["node", "packages/cli/dist/cli.js"]
CMD ["--help"]
