# Notes

Personal React + Express app for saving links and formatted text notes into a JSON file.

## Local Run

```bash
npm install
npm run build
npm start
```

Open `http://127.0.0.1:3001`.

Default local password is `notes` when `NOTES_PASSWORD` is not set.

## Environment Variables

Use real values on the server:

```bash
PORT=3001
NOTES_PASSWORD=your-private-password
SESSION_SECRET=your-long-random-session-secret
COOKIE_SECURE=false
NOTES_DATA_DIR=/var/www/notes/shared
```

Set `COOKIE_SECURE=true` only after HTTPS is configured.

`NOTES_DATA_DIR` is where `notes.json` will be stored. Keep it outside temporary build folders so notes survive deploys.

## VPS Deploy

Example for Ubuntu server.

### 1. Install Node.js

Install Node.js 22+ from NodeSource or your VPS provider image.

```bash
node --version
npm --version
```

### 2. Clone The Project

```bash
sudo mkdir -p /var/www
sudo chown -R $USER:$USER /var/www
cd /var/www
git clone -b codex/notes-app https://github.com/d1m4a/notes.git
cd notes
```

### 3. Configure Environment

```bash
mkdir -p /var/www/notes/shared
cp .env.example .env
nano .env
```

Edit `.env` and set your real `NOTES_PASSWORD` and `SESSION_SECRET`.

### 4. Build

```bash
npm install
npm run build
```

### 5. Run With pm2

```bash
sudo npm install -g pm2
pm2 start ecosystem.config.cjs --update-env
pm2 save
pm2 startup
```

After `pm2 startup`, run the command that pm2 prints.

Useful commands:

```bash
pm2 status
pm2 logs notes
pm2 restart notes --update-env
```

### 6. Update Deploy

```bash
cd /var/www/notes
git pull
npm install
npm run build
pm2 restart notes --update-env
```

## Nginx Reverse Proxy

Create `/etc/nginx/sites-available/notes`:

```nginx
server {
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable it:

```bash
sudo ln -s /etc/nginx/sites-available/notes /etc/nginx/sites-enabled/notes
sudo nginx -t
sudo systemctl reload nginx
```

For HTTPS:

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

After HTTPS works, set `COOKIE_SECURE=true` in `.env` and restart:

```bash
pm2 restart notes --update-env
```
