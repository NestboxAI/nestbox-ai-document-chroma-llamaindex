#
# 🧑‍💻 Development
#
FROM node:20-alpine as dev
# add the missing shared libraries from alpine base image
RUN apk add --no-cache libc6-compat
# Create app folder
WORKDIR /app

# Set to dev environment
ENV NODE_ENV dev

# Create non-root user for Docker
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nestjs -u 1001

# Copy source code into app folder
COPY --chown=nestjs:nodejs . .

# Install dependencies model 
WORKDIR /app/nestbox-ai-document-chroma-llamaindex
RUN yarn --frozen-lockfile

# Set Docker as a non-root user
USER node

#
# 🏡 Production Build
#
FROM node:20-alpine as build

WORKDIR /app
RUN apk add --no-cache libc6-compat

# Set to production environment
ENV NODE_ENV production

# Re-create non-root user for Docker
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nestjs -u 1001

# Copy source code
COPY --chown=nestjs:nodejs . .

# In order to run `yarn build` we need access to the Nest CLI.
# Nest CLI is a dev dependency.
COPY --chown=nestjs:nodejs --from=dev /app/nestbox-ai-document-chroma-llamaindex/node_modules ./nestbox-ai-document-chroma-llamaindex/node_modules

WORKDIR /app/nestbox-ai-document-chroma-llamaindex
RUN yarn build

# Set Docker as a non-root user
USER node

#
# 🚀 Production Server
# Use the NVIDIA CUDA base image for GPU support
#
FROM nvidia/cuda:11.8.0-devel-ubuntu22.04 as prod

# Set environment variable to automatically accept EULA
ENV DEBIAN_FRONTEND=noninteractive

# Install Python, pip, curl, and other necessary packages
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    curl \
    nvidia-cuda-toolkit \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash -

RUN apt-get install -y nodejs

# Install NVIDIA cuDNN and container toolkit with automatic license acceptance
RUN apt-get update && \
    echo "debconf debconf/frontend select Noninteractive" | debconf-set-selections && \
    apt-get install -y --no-install-recommends nvidia-cudnn nvidia-container-toolkit && \
    rm -rf /var/lib/apt/lists/*

# Create a symbolic link for Python
RUN ln -s /usr/bin/python3 /usr/bin/python

# Install Ollama CLI
RUN curl -fsSL https://ollama.com/install.sh | sh

# Set the working directory
WORKDIR /app

# Expose the ports that the app and Ollama will use
EXPOSE 11434
EXPOSE 80

# Set environment variables
ENV OLLAMA_HOST http://0.0.0.0:11434

# Set to production environment
ENV NODE_ENV production

# Re-create non-root user for Docker
RUN groupadd -g 1001 nodejs 
RUN useradd -m -u 1001 -g nodejs nestjs

# Copy only the necessary files
COPY --chown=nestjs:nodejs --from=build /app/nestbox-ai-document-chroma-llamaindex/node_modules node_modules

RUN export GIN_MODE=release
RUN pip install chromadb

# Setup ollama and run the node service
RUN echo "#!/bin/sh\n\
    npm rebuild --verbose sharp\n\
    chroma run &\n\
    sleep 10\n\
    node dist/index.js" > /app/start.sh && chmod +x /app/start.sh

# Default command to run the setup script
CMD ["/app/start.sh"]
