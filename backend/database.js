const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

let db = null;
const dbPath = process.env.DB_PATH || path.join(__dirname, 'data.db');

// Helper to create a sqlite3-like API wrapper around sql.js
function createDbWrapper(database) {
  const saveDb = () => {
    const data = database.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  };

  // Auto-save every 5 seconds
  setInterval(saveDb, 5000);

  return {
    prepare: (sql) => {
      return {
        run: (...params) => {
          database.run(sql, params);
          saveDb();
          return { lastInsertRowid: database.exec("SELECT last_insert_rowid()")[0]?.values[0]?.[0], changes: database.getRowsModified() };
        },
        get: (...params) => {
          const stmt = database.prepare(sql);
          stmt.bind(params);
          if (stmt.step()) {
            const cols = stmt.getColumnNames();
            const values = stmt.get();
            stmt.free();
            const result = {};
            cols.forEach((col, i) => result[col] = values[i]);
            return result;
          }
          stmt.free();
          return undefined;
        },
        all: (...params) => {
          const stmt = database.prepare(sql);
          stmt.bind(params);
          const results = [];
          while (stmt.step()) {
            const cols = stmt.getColumnNames();
            const values = stmt.get();
            const row = {};
            cols.forEach((col, i) => row[col] = values[i]);
            results.push(row);
          }
          stmt.free();
          return results;
        }
      };
    },
    exec: (sql) => {
      database.exec(sql);
      saveDb();
    },
    pragma: (pragma) => {
      database.exec(`PRAGMA ${pragma}`);
    },
    close: () => {
      saveDb();
      database.close();
    }
  };
}

async function initDatabase() {
  const SQL = await initSqlJs();
  
  // Load existing database or create new
  let database;
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    database = new SQL.Database(fileBuffer);
  } else {
    database = new SQL.Database();
  }
  
  db = createDbWrapper(database);
  
  // Enable foreign keys
  db.pragma('foreign_keys = ON');
  
  // Create tables
  db.exec(`
    -- Users table
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_id TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      avatar TEXT,
      role TEXT DEFAULT 'STUDENT',
      level INTEGER DEFAULT 1,
      xp INTEGER DEFAULT 0,
      total_xp INTEGER DEFAULT 0,
      city TEXT,
      branch TEXT,
      trainings_completed INTEGER DEFAULT 0,
      join_date TEXT DEFAULT (date('now')),
      streak INTEGER DEFAULT 0,
      last_training_date TEXT,
      last_qr_scan_date TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Skills definitions
    CREATE TABLE IF NOT EXISTS skills (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      enabled INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- User skills (many-to-many)
    CREATE TABLE IF NOT EXISTS user_skills (
      user_id INTEGER NOT NULL,
      skill_id TEXT NOT NULL,
      value INTEGER DEFAULT 0,
      PRIMARY KEY (user_id, skill_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE
    );

    -- Achievements definitions
    CREATE TABLE IF NOT EXISTS achievements (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      image_url TEXT,
      conditions_json TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- User achievements (many-to-many)
    CREATE TABLE IF NOT EXISTS user_achievements (
      user_id INTEGER NOT NULL,
      achievement_id TEXT NOT NULL,
      unlocked_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, achievement_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (achievement_id) REFERENCES achievements(id) ON DELETE CASCADE
    );

    -- Training history
    CREATE TABLE IF NOT EXISTS training_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      date TEXT DEFAULT (date('now')),
      skill_focus TEXT,
      xp_earned INTEGER NOT NULL,
      source TEXT DEFAULT 'manual',
      qr_id TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- QR codes
    CREATE TABLE IF NOT EXISTS qr_codes (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      city TEXT NOT NULL,
      branch TEXT NOT NULL,
      xp_amount INTEGER DEFAULT 150,
      skill_id TEXT,
      skills_json TEXT,
      achievement_id TEXT,
      is_training_preset INTEGER DEFAULT 0,
      max_uses INTEGER,
      uses_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      expires_at TEXT
    );

    -- Cities
    CREATE TABLE IF NOT EXISTS cities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Branches
    CREATE TABLE IF NOT EXISTS branches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      city_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(city_id, name),
      FOREIGN KEY (city_id) REFERENCES cities(id) ON DELETE CASCADE
    );

    -- Settings (key-value store)
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Insert default skills if not exist
  const defaultSkills = [
    { id: 'serve', label: 'Подача' },
    { id: 'receive', label: 'Прием' },
    { id: 'attack', label: 'Атака' },
    { id: 'block', label: 'Блок' },
    { id: 'set', label: 'Пас' },
    { id: 'stamina', label: 'Физо' }
  ];

  const insertSkill = db.prepare(`INSERT OR IGNORE INTO skills (id, label) VALUES (?, ?)`);
  for (const skill of defaultSkills) {
    insertSkill.run(skill.id, skill.label);
  }

  // Insert default settings if not exist
  const defaultSettings = [
    { key: 'xp_per_level', value: '1000' },
    { key: 'xp_multiplier', value: '1.2' },
    { key: 'weekend_bonus', value: '2' }
  ];

  const insertSetting = db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`);
  for (const setting of defaultSettings) {
    insertSetting.run(setting.key, setting.value);
  }

  // Insert default cities and branches
  const defaultCities = {
    'Минск': ['Центр', 'Уручье', 'Запад'],
    'Гомель': ['Восток', 'Север'],
    'Брест': ['Юг', 'Центр'],
    'Гродно': ['Замок', 'Лида-филиал']
  };

  const insertCity = db.prepare(`INSERT OR IGNORE INTO cities (name) VALUES (?)`);
  
  for (const [city, branches] of Object.entries(defaultCities)) {
    insertCity.run(city);
    const cityRecord = db.prepare(`SELECT id FROM cities WHERE name = ?`).get(city);
    if (cityRecord) {
      const insertBranch = db.prepare(`INSERT OR IGNORE INTO branches (city_id, name) VALUES (?, ?)`);
      for (const branch of branches) {
        insertBranch.run(cityRecord.id, branch);
      }
    }
  }

  // Insert default achievements
  const defaultAchievements = [
    {
      id: 'ach_serve_1',
      title: 'Первый эйс',
      description: 'Достигни уровня подачи 15',
      image_url: 'https://api.dicebear.com/7.x/icons/svg?seed=ace&icon=star',
      conditions: { minSkillValue: { skill: 'serve', value: 15 } }
    },
    {
      id: 'ach_lvl_5',
      title: 'Минский Тигр',
      description: 'Достигни 5 уровня',
      image_url: 'https://api.dicebear.com/7.x/icons/svg?seed=tiger&icon=trophy',
      conditions: { minLevel: 5 }
    },
    {
      id: 'ach_train_10',
      title: 'Начинающий',
      description: 'Пройди 10 тренировок',
      image_url: 'https://api.dicebear.com/7.x/icons/svg?seed=train&icon=dumbbell',
      conditions: { minTrainings: 10 }
    },
    {
      id: 'ach_streak_7',
      title: 'Недельный марафон',
      description: 'Сохрани стрик 7 дней',
      image_url: 'https://api.dicebear.com/7.x/icons/svg?seed=streak&icon=flame',
      conditions: { minStreak: 7 }
    }
  ];

  const insertAchievement = db.prepare(`
    INSERT OR IGNORE INTO achievements (id, title, description, image_url, conditions_json)
    VALUES (?, ?, ?, ?, ?)
  `);

  for (const ach of defaultAchievements) {
    insertAchievement.run(ach.id, ach.title, ach.description, ach.image_url, JSON.stringify(ach.conditions));
  }

  // Insert default QR code
  const insertQR = db.prepare(`INSERT OR IGNORE INTO qr_codes (id, title, city, branch, xp_amount) VALUES (?, ?, ?, ?, ?)`);
  insertQR.run('qr_default_branch', 'Тренировка в зале', 'Минск', 'Центр', 150);

  console.log('✅ Database initialized successfully');
  return db;
}

module.exports = { initDatabase };
