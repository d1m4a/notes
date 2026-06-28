# Notes

Личное приложение на React + Express для сохранения ссылок и текстовых заметок в JSON-файл.

## Локальный Запуск

```bash
npm install
npm run build
npm start
```

Открой `http://127.0.0.1:3001`.

Если `NOTES_PASSWORD` не задан, локальный пароль по умолчанию: `notes`.

## Переменные Окружения

На сервере используй реальные значения:

```bash
PORT=3001
NOTES_PASSWORD=your-private-password
SESSION_SECRET=your-long-random-session-secret
COOKIE_SECURE=false
NOTES_DATA_DIR=/var/www/notes/shared
```

Включай `COOKIE_SECURE=true` только после настройки HTTPS.

`NOTES_DATA_DIR` - папка, где будет храниться `notes.json`. Держи ее вне временных папок сборки, чтобы заметки не терялись при обновлениях.

## Деплой На VPS

Пример для Ubuntu-сервера.

### 1. Установить Node.js

Установи Node.js 22+ через NodeSource или образ провайдера VPS.

```bash
node --version
npm --version
```

### 2. Склонировать Проект

```bash
sudo mkdir -p /var/www
sudo chown -R $USER:$USER /var/www
cd /var/www
git clone -b codex/notes-app https://github.com/d1m4a/notes.git
cd notes
```

### 3. Настроить Окружение

```bash
mkdir -p /var/www/notes/shared
cp .env.example .env
nano .env
```

В `.env` задай свои реальные `NOTES_PASSWORD` и `SESSION_SECRET`.

### 4. Собрать Проект

```bash
npm install
npm run build
```

### 5. Запустить Через pm2

```bash
sudo npm install -g pm2
pm2 start ecosystem.config.cjs --update-env
pm2 save
pm2 startup
```

После `pm2 startup` выполни команду, которую напечатает pm2.

Полезные команды:

```bash
pm2 status
pm2 logs notes
pm2 restart notes --update-env
```

### 6. Обновить Приложение

```bash
cd /var/www/notes
git pull
npm install
npm run build
pm2 restart notes --update-env
```

## Nginx Reverse Proxy

Создай файл `/etc/nginx/sites-available/notes`:

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

Включи конфиг:

```bash
sudo ln -s /etc/nginx/sites-available/notes /etc/nginx/sites-enabled/notes
sudo nginx -t
sudo systemctl reload nginx
```

Для HTTPS:

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

Когда HTTPS заработает, поставь `COOKIE_SECURE=true` в `.env` и перезапусти приложение:

```bash
pm2 restart notes --update-env
```
