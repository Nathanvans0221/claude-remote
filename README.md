# Claude Remote

Access Claude Code from anywhere - phone, tablet, any browser. Submit tasks, monitor progress, view results.

## Quick Start (Local Testing)

```bash
# Install dependencies
npm run install:all

# Start dev servers (API + Web)
npm run dev

# Open http://localhost:5173
```

## Architecture

```
┌─────────────────┐     ┌─────────────────────────────────┐
│  Phone/Browser  │────▶│  Web UI                         │
│                 │     │  - Submit tasks                 │
└─────────────────┘     │  - View progress/results        │
                        └───────────┬─────────────────────┘
                                    │ API calls
                                    ▼
                        ┌─────────────────────────────────┐
                        │  Server                         │
                        │  - Express API (port 3001)      │
                        │  - SQLite task queue            │
                        │  - Claude Code runner           │
                        └─────────────────────────────────┘
```

## Deploy to VM (24/7 Access)

### 1. Create VM

**DigitalOcean (Recommended):**
- Create Droplet: Ubuntu 22.04, $12/month (2GB RAM)
- Add SSH key for access

**Or AWS/Azure/GCP** - any Ubuntu VM works.

### 2. SSH into VM

```bash
ssh root@YOUR_VM_IP
```

### 3. Run Setup Script

```bash
# Create non-root user (recommended)
adduser nathan
usermod -aG sudo nathan
su - nathan

# Clone and setup
git clone https://github.com/Nathanvans0221/claude-remote.git
cd claude-remote
chmod +x deploy/*.sh
./deploy/setup-vm.sh
```

### 4. Authenticate Claude

```bash
claude auth login
# Follow the browser auth flow
```

### 5. Install as Service

```bash
sudo ./deploy/install-service.sh
```

### 6. Access from Anywhere

Open `http://YOUR_VM_IP:3001` on your phone or any browser.

## Optional: Add HTTPS with Domain

1. Point your domain to VM IP
2. Install nginx and certbot:
   ```bash
   sudo apt install nginx certbot python3-certbot-nginx
   ```
3. Copy nginx config:
   ```bash
   sudo cp deploy/nginx.conf /etc/nginx/sites-available/claude-remote
   # Edit the server_name
   sudo ln -s /etc/nginx/sites-available/claude-remote /etc/nginx/sites-enabled/
   sudo certbot --nginx -d claude.yourdomain.com
   ```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/status` | Server status and queue counts |
| GET | `/api/tasks` | List all tasks |
| GET | `/api/tasks/:id` | Get single task |
| POST | `/api/tasks` | Create new task |
| DELETE | `/api/tasks/:id` | Delete task |

### Create Task Example

```bash
curl -X POST http://YOUR_VM_IP:3001/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Fix login bug",
    "prompt": "Find and fix the authentication bug in src/auth.js",
    "project": "my-app"
  }'
```

## Projects

The task runner supports these projects (configured in web/src/App.jsx):

- `action-center-static` - Static dashboard
- `action-center-pwa` - PWA version
- `blln-automation` - BLN data sync

Add more in `PROJECTS` array in App.jsx.

## Monitoring

```bash
# View service status
sudo systemctl status claude-remote

# View live logs
sudo journalctl -u claude-remote -f

# Restart service
sudo systemctl restart claude-remote
```

## Security Notes

- The VM has full Claude Code access - treat it like your dev machine
- Consider adding basic auth or IP whitelisting for production
- Don't expose the API without HTTPS in production
- Keep your Claude API key secure on the VM

## Cost Estimate

- **DigitalOcean Droplet**: $12/month (2GB RAM)
- **Claude API**: Pay per use (main cost for heavy usage)
- **Domain (optional)**: ~$12/year

## Troubleshooting

**Claude not found:**
```bash
export PATH="$HOME/.claude/bin:$PATH"
```

**Service won't start:**
```bash
sudo journalctl -u claude-remote -n 50
```

**SQLite errors:**
```bash
# Rebuild native modules
cd ~/claude-remote/server
npm rebuild better-sqlite3
```
