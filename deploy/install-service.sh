#!/bin/bash
# Install Claude Remote as a systemd service

set -e

USER=$(whoami)
INSTALL_DIR=$(cd "$(dirname "$0")/.." && pwd)

echo "Installing Claude Remote as systemd service..."
echo "Install directory: $INSTALL_DIR"
echo "User: $USER"

# Create systemd service file
sudo tee /etc/systemd/system/claude-remote.service > /dev/null << EOF
[Unit]
Description=Claude Remote Server
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$INSTALL_DIR
ExecStart=/usr/bin/node $INSTALL_DIR/server/src/index.js
Restart=always
RestartSec=10
Environment="NODE_ENV=production"
Environment="PORT=3001"
Environment="PATH=/home/$USER/.claude/bin:/usr/local/bin:/usr/bin:/bin"

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd and enable service
sudo systemctl daemon-reload
sudo systemctl enable claude-remote
sudo systemctl start claude-remote

echo ""
echo "╔════════════════════════════════════════════════════════╗"
echo "║              Service Installed!                        ║"
echo "╠════════════════════════════════════════════════════════╣"
echo "║  Commands:                                             ║"
echo "║    sudo systemctl status claude-remote                 ║"
echo "║    sudo systemctl restart claude-remote                ║"
echo "║    sudo journalctl -u claude-remote -f                 ║"
echo "╠════════════════════════════════════════════════════════╣"
echo "║  Access: http://YOUR_VM_IP:3001                        ║"
echo "╚════════════════════════════════════════════════════════╝"
