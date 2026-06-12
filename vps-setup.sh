#!/bin/bash

# Setup script for bouh deployment target VPS (Ubuntu/Debian)
# Run this script on your VPS as root user to prepare it for Docker deployment.

set -e

echo "=== Starting VPS Setup for Docker & Docker Compose ==="

# 1. Update package index and install basic prerequisites
echo "--> Updating package lists..."
apt-get update -y
apt-get install -y \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    ufw

# 2. Add Docker's official GPG key and setup repository
echo "--> Setting up Docker repository..."
mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg --yes

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

# 3. Install Docker Engine, containerd, and Docker Compose plugin
echo "--> Installing Docker Engine and Docker Compose..."
apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# 4. Start and enable Docker service
echo "--> Enabling and starting Docker daemon..."
systemctl enable docker
systemctl start docker

# 5. Create application directory
echo "--> Creating deployment directory at /app/bouh..."
mkdir -p /app/bouh
chmod 755 /app/bouh

# 6. Configure simple firewall (UFW)
echo "--> Configuring firewall rules..."
ufw allow 22/tcp      # SSH
ufw allow 80/tcp      # HTTP (Next.js)
ufw allow 443/tcp     # HTTPS (Future SSL setup)
ufw allow 5432/tcp    # Postgres (Exposed port - optional, can disable if preferred)
echo "y" | ufw enable

# 7. Print verification message
echo "=== VPS Setup Completed Successfully ==="
echo "Docker version: $(docker --version)"
echo "Docker Compose version: $(docker compose version)"
echo "The VPS is now ready for deployment. Please configure your GitHub Secrets next."
