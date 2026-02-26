const crypto = require('crypto');

/**
 * Validates Telegram WebApp initData
 * @param {string} initData - Raw initData string from Telegram WebApp
 * @param {string} botToken - Telegram Bot Token
 * @returns {Object|null} - Parsed user data or null if invalid
 */
function validateTelegramInitData(initData, botToken) {
  if (!initData || !botToken) {
    return null;
  }

  try {
    // Parse initData
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) {
      return null;
    }

    // Remove hash from params
    params.delete('hash');

    // Sort params and create data-check-string
    const dataCheckArray = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`);

    const dataCheckString = dataCheckArray.join('\n');

    // Create secret key
    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();

    // Calculate hash
    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    // Verify hash
    if (calculatedHash !== hash) {
      return null;
    }

    // Parse user data
    const userStr = params.get('user');
    if (!userStr) {
      return null;
    }

    const user = JSON.parse(decodeURIComponent(userStr));
    return {
      id: user.id,
      firstName: user.first_name,
      lastName: user.last_name,
      username: user.username,
      languageCode: user.language_code,
      isPremium: user.is_premium || false
    };
  } catch (error) {
    console.error('Telegram initData validation error:', error);
    return null;
  }
}

/**
 * Middleware to validate Telegram WebApp initData
 */
function telegramAuthMiddleware(req, res, next) {
  // Allow health check without auth
  if (req.path === '/health') {
    return next();
  }

  // Get initData from header or query
  const initData = req.headers['x-telegram-init-data'] || req.query.initData;
  
  const isDevelopment = process.env.NODE_ENV !== 'production';
  
  console.log(`[TelegramAuth] ${req.method} ${req.originalUrl} | NODE_ENV=${process.env.NODE_ENV} | isDev=${isDevelopment} | hasInitData=${!!initData} | initDataLength=${initData ? initData.length : 0}`);

  // For development ONLY: allow mock user if no initData
  if (!initData && isDevelopment) {
    console.warn('[TelegramAuth] ⚠️ No initData — using MOCK user (dev mode). Set NODE_ENV=production to enforce real auth!');
    req.telegramUser = {
      id: 123456789,
      firstName: 'Test',
      lastName: 'User',
      username: 'testuser'
    };
    return next();
  }

  if (!initData) {
    console.error('[TelegramAuth] ❌ No initData and NODE_ENV=production — rejecting request');
    return res.status(401).json({ error: 'Telegram initData required. Open the app via Telegram.' });
  }

  const botToken = process.env.BOT_TOKEN;
  if (!botToken) {
    console.error('[TelegramAuth] ❌ BOT_TOKEN not configured in .env!');
    return res.status(500).json({ error: 'Server configuration error: BOT_TOKEN missing' });
  }

  const user = validateTelegramInitData(initData, botToken);
  if (!user) {
    console.error('[TelegramAuth] ❌ initData validation FAILED (wrong BOT_TOKEN or tampered data)');
    return res.status(401).json({ error: 'Invalid Telegram initData' });
  }

  console.log(`[TelegramAuth] ✅ Authenticated: telegramId=${user.id}, name=${user.firstName} ${user.lastName || ''}`);
  req.telegramUser = user;
  next();
}

/**
 * Middleware to check user role
 * @param {string[]} allowedRoles - Array of allowed roles
 */
function requireRole(allowedRoles) {
  return async (req, res, next) => {
    if (!req.telegramUser) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    try {
      // Get user from database
      const user = req.db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(req.telegramUser.id.toString());
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      if (!allowedRoles.includes(user.role)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      req.user = user;
      req.userId = user.id;
      next();
    } catch (error) {
      console.error('Role check error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  };
}

/**
 * Middleware to ensure user exists in database (for any authenticated user)
 */
async function requireUser(req, res, next) {
  if (!req.telegramUser) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const user = req.db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(req.telegramUser.id.toString());
    
    if (!user) {
      return res.status(404).json({ error: 'User not found. Please register first.' });
    }

    req.user = user;
    req.userId = user.id;
    next();
  } catch (error) {
    console.error('User lookup error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  telegramAuthMiddleware,
  requireRole,
  requireUser,
  validateTelegramInitData
};
