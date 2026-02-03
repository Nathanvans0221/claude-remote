#!/bin/bash
# Setup script for Claude Remote on Ubuntu VM
# Run as: curl -sSL https://raw.githubusercontent.com/.../setup-vm.sh | bash

set -e

echo "╔════════════════════════════════════════════════════════╗"
echo "║         Claude Remote - VM Setup Script                ║"
echo "╚════════════════════════════════════════════════════════╝"

# Update system
echo "[1/7] Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
echo "[2/7] Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install build essentials (for better-sqlite3)
echo "[3/7] Installing build tools..."
sudo apt install -y build-essential python3

# Install Claude Code
echo "[4/7] Installing Claude Code..."
curl -fsSL https://claude.ai/install.sh | bash
export PATH="$HOME/.claude/bin:$PATH"
echo 'export PATH="$HOME/.claude/bin:$PATH"' >> ~/.bashrc

# Clone the project (replace with your repo)
echo "[5/7] Setting up project..."
cd ~
if [ -d "claude-remote" ]; then
  cd claude-remote && git pull
else
  git clone https://github.com/Nathanvans0221/claude-remote.git
  cd claude-remote
fi

# Install dependencies
echo "[6/7] Installing dependencies..."
npm run install:all

# Build web UI
echo "[7/7] Building web UI..."
npm run build:web

echo ""
echo "╔════════════════════════════════════════════════════════╗"
echo "║                   Setup Complete!                      ║"
echo "╠════════════════════════════════════════════════════════╣"
echo "║  Next steps:                                           ║"
echo "║  1. Authenticate Claude: claude auth login             ║"
echo "║  2. Start server: npm start                            ║"
echo "║  3. Or use systemd: sudo ./deploy/install-service.sh   ║"
echo "╚════════════════════════════════════════════════════════╝"
