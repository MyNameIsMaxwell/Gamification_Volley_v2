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

### 2. Настройте переменные окружения

Создайте файл `.env` в корне проекта или в папке `backend/`:

```bash
# DeepSeek API для AI-советов
DEEPSEEK_API_KEY=ваш_ключ_здесь

# Telegram Bot Token (обязательно для production)
BOT_TOKEN=ваш_telegram_bot_token

# Режим работы (опционально)
NODE_ENV=development
```

**Где получить ключи:**
- DeepSeek API: https://platform.deepseek.com/api_keys
- Telegram Bot Token: создайте бота через [@BotFather](https://t.me/BotFather) в Telegram

**Важно:** `BOT_TOKEN` необходим для валидации Telegram WebApp initData на сервере. Без него приложение не будет работать в production режиме.

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

**Примечание:** В режиме разработки (localhost) приложение работает без валидации Telegram initData. Для тестирования полной функциональности используйте Telegram Mini App.

---

## Деплой на Ubuntu сервер

### 1. Загрузите файлы на сервер

Скопируйте на сервер:
- Папку `dist/` (фронтенд)
- Папку `backend/` (бэкенд)

### 2. Настройте переменные окружения на сервере

Создайте файл `.env` в папке `backend/`:

```bash
BOT_TOKEN=ваш_telegram_bot_token
DEEPSEEK_API_KEY=ваш_ключ_здесь
NODE_ENV=production
```

### 3. Установите зависимости бэкенда на сервере

```bash
cd /home/backend
npm install --production
```

### 4. Настройте nginx

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

### 5. Запустите бэкенд через PM2

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

### 6. Перезагрузите nginx

```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## Настройка Telegram Mini App

### 1. Создайте бота через BotFather

1. Откройте [@BotFather](https://t.me/BotFather) в Telegram
2. Отправьте команду `/newbot`
3. Следуйте инструкциям для создания бота
4. Сохраните полученный `BOT_TOKEN`

### 2. Настройте Mini App

1. Откройте [@BotFather](https://t.me/BotFather)
2. Выберите вашего бота
3. Отправьте команду `/newapp`
4. Укажите название и описание приложения
5. Загрузите иконку (512x512px)
6. Укажите URL вашего приложения: `https://ваш-домен.ru`
7. Сохраните полученную ссылку на Mini App

### 3. Безопасность

Приложение использует серверную валидацию Telegram `initData` через HMAC-SHA256. Это гарантирует:
- Подлинность данных пользователя
- Защиту от подмены ролей и прав доступа
- Безопасность административных операций

**Важно:** В production режиме все API запросы требуют валидного Telegram initData. Без него приложение вернет ошибку 401.

---

## API Endpoints

| Endpoint | Метод | Описание |
|----------|-------|----------|
| `/api/users/me` | GET | Текущий пользователь (требует auth) |
| `/api/users/register` | POST | Регистрация (требует auth) |
| `/api/users/award-xp` | POST | Начисление XP (требует роль TRAINER/ADMIN) |
| `/api/users/deduct-xp` | POST | Списание XP (требует роль TRAINER/ADMIN) |
| `/api/users/scan-qr` | POST | Сканирование QR (требует auth, лимит 1 в сутки) |
| `/api/users/:id/role` | PUT | Изменение роли (требует роль ADMIN) |
| `/api/users/:id/profile` | PUT | Редактирование профиля (self или ADMIN) |
| `/api/users/:id/stats` | PUT | Редактирование статистики (требует роль ADMIN) |
| `/api/rankings/players` | GET | Рейтинг игроков |
| `/api/rankings/branches` | GET | Рейтинг филиалов |
| `/api/rankings/cities` | GET | Рейтинг городов |
| `/api/achievements` | GET/POST | Достижения |
| `/api/qrcodes` | GET/POST | QR коды (POST требует роль TRAINER/ADMIN) |
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
- **Telegram:** Web App SDK с серверной валидацией initData

## Особенности безопасности

- ✅ Серверная валидация Telegram initData (HMAC-SHA256)
- ✅ Ролевая модель доступа (STUDENT, TRAINER, ADMIN)
- ✅ Защита административных операций
- ✅ Лимит сканирования QR: 1 раз в сутки на пользователя
- ✅ Пользователи появляются в рейтинге только после первой тренировки

## Роли и права доступа

- **STUDENT (Ученик):**
  - Просмотр своего профиля и статистики
  - Сканирование QR кодов (1 раз в сутки)
  - Просмотр рейтингов

- **TRAINER (Тренер):**
  - Все права ученика
  - Начисление/списание XP ученикам
  - Запись тренировок
  - Создание и управление QR кодами

- **ADMIN (Администратор):**
  - Все права тренера
  - Управление ролями пользователей
  - Редактирование профилей и статистики
  - Управление достижениями
  - Полный доступ к настройкам системы
