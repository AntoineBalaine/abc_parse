# Start from the official Docker Claude sandbox image
FROM docker/sandbox-templates:claude-code

# Switch to root to install packages
USER root

# Install git, curl, wget, ca-certificates, vim
RUN apt-get update && apt-get install -y \
    git \
    curl \
    wget \
    ca-certificates \
    vim \
    && rm -rf /var/lib/apt/lists/*

# Verify installations
RUN git --version && node --version && npm --version

# Create a non-root user
RUN useradd -m -s /bin/bash claude

# Create and set permissions on workspace directory
RUN mkdir -p /workspace && chown claude:claude /workspace

# Switch to non-root user
USER claude

# Set vim as the default editor
ENV EDITOR=vim

# Set working directory
WORKDIR /workspace
