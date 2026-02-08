# VolleyLevel - Школа волейбола

Геймифицированное приложение для школы волейбола с поддержкой Telegram Mini App.

## Запуск локально (разработка)

**Требования:** Node.js 18+

### 1. Установите зависимости

```bash
# Фронтенд
npm install

# Бэкенд
cd backend
npm install
cd ..
```

### 2. Настройте API ключ DeepSeek в файле `.env`:
```
DEEPSEEK_API_KEY=ваш_ключ_здесь
```
Получить ключ: https://platform.deepseek.com/api_keys

### 3. Запустите бэкенд и фронтенд

**Терминал 1 (бэкенд):**
```bash
cd backend
npm start
```

**Терминал 2 (фронтенд):**
```bash
npm run dev
```

Откройте http://localhost:3000

---

## Деплой на Ubuntu сервер

### 1. Загрузите файлы на сервер

Скопируйте на сервер:
- Папку `dist/` (фронтенд)
- Папку `backend/` (бэкенд)

### 2. Установите зависимости бэкенда на сервере

```bash
cd /home/backend
npm install --production
```

### 3. Настройте nginx

Обновите конфиг `/etc/nginx/sites-available/tgbot`:

```nginx
server {
    listen 443 ssl;
    server_name summarymaxwell.ru;

    ssl_certificate /etc/letsencrypt/live/summarymaxwell.ru/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/summarymaxwell.ru/privkey.pem;

    # Frontend
    location / {
        alias /home/dist/;
        try_files $uri $uri/ /index.html;
    }

    # API Backend
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Health check
    location /health {
        proxy_pass http://127.0.0.1:8000;
    }
}
```

### 4. Запустите бэкенд через PM2

```bash
# Установите PM2
npm install -g pm2

# Запустите бэкенд
cd /home/backend
pm2 start server.js --name volleylevel-api

# Автозапуск при перезагрузке сервера
pm2 save
pm2 startup
```

### 5. Перезагрузите nginx

```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## API Endpoints

| Endpoint | Метод | Описание |
|----------|-------|----------|
| `/api/users/me` | GET | Текущий пользователь |
| `/api/users/register` | POST | Регистрация |
| `/api/users/award-xp` | POST | Начисление XP |
| `/api/users/scan-qr` | POST | Сканирование QR |
| `/api/rankings/players` | GET | Рейтинг игроков |
| `/api/rankings/branches` | GET | Рейтинг филиалов |
| `/api/rankings/cities` | GET | Рейтинг городов |
| `/api/achievements` | GET/POST | Достижения |
| `/api/qrcodes` | GET/POST | QR коды |
| `/api/skills` | GET/POST | Навыки |
| `/api/locations` | GET | Города и филиалы |
| `/api/settings/xp` | GET/PUT | Настройки XP |

---

## Структура проекта

```
├── App.tsx                 # Главный компонент
├── components/             # React компоненты
├── services/
│   ├── api.ts              # API клиент
│   └── deepseekService.ts  # AI советы
├── utils/                  # Утилиты
├── backend/
│   ├── server.js           # Express сервер
│   ├── database.js         # SQLite инициализация
│   └── routes/             # API маршруты
└── dist/                   # Production сборка
```

## Технологии

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS
- **Backend:** Node.js, Express, SQLite (sql.js)
- **AI:** DeepSeek API
- **Telegram:** Web App SDK
