const express = require('express');
const router = express.Router();
const { requireUser, requireRole } = require('../middleware/telegramAuth');

// Helper: Get XP settings
function getXpSettings(db) {
  const settings = db.prepare('SELECT key, value FROM settings WHERE key IN (?, ?)').all('xp_per_level', 'xp_multiplier');
  return {
    xpPerLevel: parseInt(settings.find(s => s.key === 'xp_per_level')?.value || '1000'),
    multiplier: parseFloat(settings.find(s => s.key === 'xp_multiplier')?.value || '1.2')
  };
}

// Helper: Calculate XP needed for level
function getXpForLevel(level, xpSettings) {
  return Math.floor(xpSettings.xpPerLevel * Math.pow(xpSettings.multiplier, level - 1));
}

// Helper: Add XP and calculate level ups
function addXpToUser(db, userId, xpAmount, xpSettings) {
  const user = db.prepare('SELECT xp, level, total_xp FROM users WHERE id = ?').get(userId);
  if (!user) return null;

  let newXp = user.xp + xpAmount;
  let newLevel = user.level;
  let newTotalXp = user.total_xp + xpAmount;

  // Prevent negative XP
  if (newXp < 0) newXp = 0;
  if (newTotalXp < 0) newTotalXp = 0;

  // Level down logic if XP goes negative
  if (newXp < 0) {
    while (newXp < 0 && newLevel > 1) {
      newLevel--;
      const xpForPrevLevel = getXpForLevel(newLevel, xpSettings);
      newXp += xpForPrevLevel;
    }
    if (newXp < 0) newXp = 0;
  }

  // Level up logic
  let xpNeeded = getXpForLevel(newLevel, xpSettings);
  while (newXp >= xpNeeded) {
    newXp -= xpNeeded;
    newLevel++;
    xpNeeded = getXpForLevel(newLevel, xpSettings);
  }

  db.prepare('UPDATE users SET xp = ?, level = ?, total_xp = ?, updated_at = datetime("now") WHERE id = ?')
    .run(newXp, newLevel, newTotalXp, userId);

  return { xp: newXp, level: newLevel, totalXp: newTotalXp };
}

// Helper: Subtract XP (for trainers/admins)
function subtractXpFromUser(db, userId, xpAmount, xpSettings) {
  const user = db.prepare('SELECT xp, level, total_xp FROM users WHERE id = ?').get(userId);
  if (!user) return null;

  return addXpToUser(db, userId, -xpAmount, xpSettings);
}

// Helper: Check and unlock achievements
function checkAchievements(db, userId) {
  const user = db.prepare(`
    SELECT u.*, 
      (SELECT json_group_object(skill_id, value) FROM user_skills WHERE user_id = u.id) as skills_json
    FROM users u WHERE u.id = ?
  `).get(userId);
  
  if (!user) return [];

  const skills = user.skills_json ? JSON.parse(user.skills_json) : {};
  const achievements = db.prepare('SELECT * FROM achievements').all();
  const userAchievements = db.prepare('SELECT achievement_id FROM user_achievements WHERE user_id = ?').all(userId);
  const unlockedIds = new Set(userAchievements.map(a => a.achievement_id));

  const newlyUnlocked = [];

  for (const ach of achievements) {
    if (unlockedIds.has(ach.id)) continue;
    
    const conditions = JSON.parse(ach.conditions_json || '{}');
    let unlocked = true;

    if (conditions.minLevel && user.level < conditions.minLevel) unlocked = false;
    if (conditions.minTrainings && user.trainings_completed < conditions.minTrainings) unlocked = false;
    if (conditions.minStreak && user.streak < conditions.minStreak) unlocked = false;
    if (conditions.minTotalXp && user.total_xp < conditions.minTotalXp) unlocked = false;
    if (conditions.minSkillValue) {
      const skillValue = skills[conditions.minSkillValue.skill] || 0;
      if (skillValue < conditions.minSkillValue.value) unlocked = false;
    }

    if (unlocked) {
      db.prepare('INSERT INTO user_achievements (user_id, achievement_id) VALUES (?, ?)').run(userId, ach.id);
      newlyUnlocked.push(ach);
    }
  }

  return newlyUnlocked;
}

// Helper: Update streak
function updateStreak(db, userId) {
  const user = db.prepare('SELECT last_training_date, streak FROM users WHERE id = ?').get(userId);
  if (!user) return 0;

  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  let newStreak = user.streak;
  if (user.last_training_date === yesterday) {
    newStreak = user.streak + 1;
  } else if (user.last_training_date !== today) {
    newStreak = 1;
  }

  db.prepare('UPDATE users SET streak = ?, last_training_date = ? WHERE id = ?').run(newStreak, today, userId);
  return newStreak;
}

// Helper: Format user response
function formatUser(db, user) {
  // Get all enabled skills and merge with user's skill values
  const enabledSkills = db.prepare('SELECT id FROM skills WHERE enabled = 1').all();
  const userSkills = db.prepare('SELECT skill_id, value FROM user_skills WHERE user_id = ?').all(user.id);
  const userSkillsMap = userSkills.reduce((acc, s) => ({ ...acc, [s.skill_id]: s.value }), {});
  
  // Ensure all enabled skills are present (with default value 1 if missing)
  const allSkills = {};
  for (const skill of enabledSkills) {
    allSkills[skill.id] = userSkillsMap[skill.id] !== undefined ? userSkillsMap[skill.id] : 1;
    // Also insert missing skills into user_skills table
    if (userSkillsMap[skill.id] === undefined) {
      db.prepare('INSERT OR IGNORE INTO user_skills (user_id, skill_id, value) VALUES (?, ?, 1)').run(user.id, skill.id);
    }
  }

  const achievements = db.prepare('SELECT achievement_id FROM user_achievements WHERE user_id = ?').all(user.id);
  const history = db.prepare('SELECT * FROM training_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 50').all(user.id);

  return {
    id: user.id.toString(),
    telegramId: user.telegram_id,
    name: user.name,
    avatar: user.avatar,
    role: user.role,
    level: user.level,
    xp: user.xp,
    totalXp: user.total_xp,
    city: user.city,
    branch: user.branch,
    trainingsCompleted: user.trainings_completed,
    joinDate: user.join_date,
    streak: user.streak,
    lastTrainingDate: user.last_training_date,
    lastQRScanDate: user.last_qr_scan_date,
    assignedCity: user.assigned_city || null,
    assignedBranch: user.assigned_branch || null,
    skills: allSkills,
    achievements: achievements.map(a => a.achievement_id),
    trainingHistory: history.map(h => ({
      id: h.id.toString(),
      date: h.date,
      skillFocus: h.skill_focus || 'general',
      xpEarned: h.xp_earned,
      source: h.source,
      qrId: h.qr_id,
      operatorId: h.operator_id,
      reason: h.reason
    }))
  };
}

// GET /api/users/me - Get or create current user by Telegram ID
router.get('/me', (req, res) => {
  if (!req.telegramUser) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const telegramId = req.telegramUser.id.toString();
  
  try {
    // Try to find existing user
    let user = req.db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(telegramId);
    
    if (!user) {
      // Auto-register new user from Telegram data
      const name = [req.telegramUser.firstName, req.telegramUser.lastName].filter(Boolean).join(' ') || 'Player';
      const avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${telegramId}`;
      
      console.log(`[Auth] Auto-registering new user: telegramId=${telegramId}, name=${name}`);
      
      const result = req.db.prepare(`
        INSERT INTO users (telegram_id, name, avatar, city, branch)
        VALUES (?, ?, ?, ?, ?)
      `).run(telegramId, name, avatar, 'Минск', 'Центр');

      // Initialize skills for new user
      const skills = req.db.prepare('SELECT DISTINCT id FROM skills WHERE enabled = 1').all();
      const insertSkill = req.db.prepare('INSERT OR IGNORE INTO user_skills (user_id, skill_id, value) VALUES (?, ?, 1)');
      for (const skill of skills) {
        insertSkill.run(result.lastInsertRowid, skill.id);
      }

      user = req.db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
    }
    
    console.log(`[Auth] User loaded: id=${user.id}, telegramId=${user.telegram_id}, name=${user.name}`);
    res.json(formatUser(req.db, user));
  } catch (error) {
    console.error('Get/create user error:', error);
    res.status(500).json({ error: 'Failed to get or create user' });
  }
});

// POST /api/users/register - Register new user (no requireUser — user doesn't exist yet!)
router.post('/register', (req, res) => {
  if (!req.telegramUser) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  const { name, avatar, city, branch } = req.body;
  const telegramId = req.telegramUser.id.toString();
  
  if (!name) {
    return res.status(400).json({ error: 'name required' });
  }

  try {
    // Check if user exists
    const existing = req.db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(telegramId);
    if (existing) {
      return res.json(formatUser(req.db, existing));
    }

    // Create new user
    const result = req.db.prepare(`
      INSERT INTO users (telegram_id, name, avatar, city, branch)
      VALUES (?, ?, ?, ?, ?)
    `).run(telegramId, name, avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${telegramId}`, city || 'Минск', branch || 'Центр');

    // Initialize skills
    const skills = req.db.prepare('SELECT DISTINCT id FROM skills WHERE enabled = 1').all();
    const insertSkill = req.db.prepare('INSERT OR IGNORE INTO user_skills (user_id, skill_id, value) VALUES (?, ?, 1)');
    for (const skill of skills) {
      insertSkill.run(result.lastInsertRowid, skill.id);
    }

    const user = req.db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(formatUser(req.db, user));
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

// GET /api/users - Get all users (requires Telegram auth, no requireUser needed)
router.get('/', (req, res) => {
  if (!req.telegramUser) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const users = req.db.prepare('SELECT * FROM users ORDER BY total_xp DESC').all();
  res.json(users.map(u => formatUser(req.db, u)));
});

// GET /api/users/zone/students - Get students in trainer's zone (trainer/admin)
// NOTE: This route must be BEFORE /:id to avoid matching 'zone' as an id
router.get('/zone/students', requireRole(['TRAINER', 'ADMIN']), (req, res) => {
  try {
    let users;
    
    if (req.user.role === 'ADMIN') {
      // Admin sees all students
      users = req.db.prepare('SELECT * FROM users ORDER BY total_xp DESC').all();
    } else {
      // Trainer sees only students in their zone
      const trainerCity = req.user.assigned_city || req.user.city;
      const trainerBranch = req.user.assigned_branch;
      
      if (trainerBranch) {
        users = req.db.prepare('SELECT * FROM users WHERE city = ? AND branch = ? ORDER BY total_xp DESC')
          .all(trainerCity, trainerBranch);
      } else {
        users = req.db.prepare('SELECT * FROM users WHERE city = ? ORDER BY total_xp DESC')
          .all(trainerCity);
      }
    }
    
    res.json(users.map(u => formatUser(req.db, u)));
  } catch (error) {
    console.error('Get zone students error:', error);
    res.status(500).json({ error: 'Failed to get zone students' });
  }
});

// GET /api/users/:id - Get user by ID
router.get('/:id', (req, res) => {
  const user = req.db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json(formatUser(req.db, user));
});

// Helper: Check trainer zone restriction
function checkTrainerZone(db, trainer, targetUserId) {
  if (trainer.role === 'ADMIN') return { allowed: true };
  
  // Trainer: check assigned city/branch or fallback to own city
  const trainerCity = trainer.assigned_city || trainer.city;
  const trainerBranch = trainer.assigned_branch; // null means all branches in city
  
  const target = db.prepare('SELECT city, branch FROM users WHERE id = ?').get(targetUserId);
  if (!target) return { allowed: false, error: 'User not found' };
  
  if (target.city !== trainerCity) {
    return { allowed: false, error: `Вы можете управлять только учениками из города "${trainerCity}"` };
  }
  
  if (trainerBranch && target.branch !== trainerBranch) {
    return { allowed: false, error: `Вы можете управлять только учениками из филиала "${trainerBranch}"` };
  }
  
  return { allowed: true };
}

// POST /api/users/award-xp - Award XP to user (trainer/admin) - just XP, no training count
router.post('/award-xp', requireRole(['TRAINER', 'ADMIN']), (req, res) => {
  const { userId, xpAmount, skillId, reason } = req.body;

  if (!userId || !xpAmount) {
    return res.status(400).json({ error: 'userId and xpAmount required' });
  }

  if (xpAmount <= 0) {
    return res.status(400).json({ error: 'xpAmount must be positive' });
  }

  try {
    // Check trainer zone restriction
    const zoneCheck = checkTrainerZone(req.db, req.user, userId);
    if (!zoneCheck.allowed) {
      return res.status(403).json({ error: zoneCheck.error });
    }

    const xpSettings = getXpSettings(req.db);
    const today = new Date().toISOString().split('T')[0];

    // Check weekend bonus
    const isWeekend = [0, 6].includes(new Date().getDay());
    const finalXp = isWeekend ? xpAmount * 2 : xpAmount;

    // Add XP
    const result = addXpToUser(req.db, userId, finalXp, xpSettings);
    if (!result) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update skill if provided - use XP directly (not divided)
    if (skillId) {
      req.db.prepare(`
        INSERT INTO user_skills (user_id, skill_id, value) VALUES (?, ?, ?)
        ON CONFLICT(user_id, skill_id) DO UPDATE SET value = value + ?
      `).run(userId, skillId, finalXp, finalXp);
    }

    // Record XP history with operator and reason
    req.db.prepare(`
      INSERT INTO training_history (user_id, date, skill_focus, xp_earned, source, operator_id, reason)
      VALUES (?, ?, ?, ?, 'xp_bonus', ?, ?)
    `).run(userId, today, skillId || 'general', finalXp, req.userId, reason || null);

    // Check achievements
    const newAchievements = checkAchievements(req.db, userId);

    const user = req.db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    res.json({
      user: formatUser(req.db, user),
      xpAwarded: finalXp,
      weekendBonus: isWeekend,
      newAchievements: newAchievements.map(a => ({
        id: a.id,
        title: a.title,
        description: a.description,
        imageUrl: a.image_url
      }))
    });
  } catch (error) {
    console.error('Award XP error:', error);
    res.status(500).json({ error: 'Failed to award XP' });
  }
});

// POST /api/users/deduct-xp - Deduct XP from user (trainer/admin)
router.post('/deduct-xp', requireRole(['TRAINER', 'ADMIN']), (req, res) => {
  const { userId, xpAmount, skillId, reason } = req.body;

  if (!userId || !xpAmount) {
    return res.status(400).json({ error: 'userId and xpAmount required' });
  }

  if (xpAmount <= 0) {
    return res.status(400).json({ error: 'xpAmount must be positive' });
  }

  try {
    // Check trainer zone restriction
    const zoneCheck = checkTrainerZone(req.db, req.user, userId);
    if (!zoneCheck.allowed) {
      return res.status(403).json({ error: zoneCheck.error });
    }

    const xpSettings = getXpSettings(req.db);
    const today = new Date().toISOString().split('T')[0];

    // Subtract XP
    const result = subtractXpFromUser(req.db, userId, xpAmount, xpSettings);
    if (!result) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update skill if provided
    if (skillId) {
      const currentSkill = req.db.prepare('SELECT value FROM user_skills WHERE user_id = ? AND skill_id = ?').get(userId, skillId);
      const currentValue = currentSkill?.value || 0;
      const newValue = Math.max(0, currentValue - xpAmount);
      
      req.db.prepare(`
        INSERT INTO user_skills (user_id, skill_id, value) VALUES (?, ?, ?)
        ON CONFLICT(user_id, skill_id) DO UPDATE SET value = ?
      `).run(userId, skillId, newValue, newValue);
    }

    // Record XP deduction in history with operator and reason
    req.db.prepare(`
      INSERT INTO training_history (user_id, date, skill_focus, xp_earned, source, operator_id, reason)
      VALUES (?, ?, ?, ?, 'xp_deduction', ?, ?)
    `).run(userId, today, skillId || 'general', -xpAmount, req.userId, reason || null);

    const user = req.db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    res.json({
      user: formatUser(req.db, user),
      xpDeducted: xpAmount,
      newAchievements: [] // No achievements on deduction
    });
  } catch (error) {
    console.error('Deduct XP error:', error);
    res.status(500).json({ error: 'Failed to deduct XP' });
  }
});

// POST /api/users/log-training - Log a training session with multiple skills (trainer/admin)
router.post('/log-training', requireRole(['TRAINER', 'ADMIN']), (req, res) => {
  const { userId, skills, isPreset, presetName } = req.body;
  // skills is an array of { skillId, xpAmount }

  if (!userId || !skills || !Array.isArray(skills) || skills.length === 0) {
    return res.status(400).json({ error: 'userId and skills array required' });
  }

  try {
    const xpSettings = getXpSettings(req.db);
    const today = new Date().toISOString().split('T')[0];

    // Check weekend bonus
    const isWeekend = [0, 6].includes(new Date().getDay());
    
    let totalXpAwarded = 0;
    const skillUpdates = [];

    for (const { skillId, xpAmount } of skills) {
      const finalXp = isWeekend ? xpAmount * 2 : xpAmount;
      totalXpAwarded += finalXp;

      // Update skill value - use XP directly (not divided), skill value = accumulated XP
      if (skillId && skillId !== 'general') {
        req.db.prepare(`
          INSERT INTO user_skills (user_id, skill_id, value) VALUES (?, ?, ?)
          ON CONFLICT(user_id, skill_id) DO UPDATE SET value = value + ?
        `).run(userId, skillId, finalXp, finalXp);
        skillUpdates.push({ skillId, xp: finalXp, increase: finalXp });
      }
    }

    // Add total XP to user
    const result = addXpToUser(req.db, userId, totalXpAwarded, xpSettings);
    if (!result) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update trainings count and streak - THIS counts as a training
    req.db.prepare('UPDATE users SET trainings_completed = trainings_completed + 1 WHERE id = ?').run(userId);
    updateStreak(req.db, userId);

    // Record training with summary
    const skillNames = skills.map(s => s.skillId).join('+');
    req.db.prepare(`
      INSERT INTO training_history (user_id, date, skill_focus, xp_earned, source)
      VALUES (?, ?, ?, ?, ?)
    `).run(userId, today, presetName || skillNames, totalXpAwarded, isPreset ? 'preset' : 'training');

    // Check achievements
    const newAchievements = checkAchievements(req.db, userId);

    const user = req.db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    res.json({
      user: formatUser(req.db, user),
      totalXpAwarded,
      skillUpdates,
      weekendBonus: isWeekend,
      newAchievements: newAchievements.map(a => ({
        id: a.id,
        title: a.title,
        description: a.description,
        imageUrl: a.image_url
      }))
    });
  } catch (error) {
    console.error('Log training error:', error);
    res.status(500).json({ error: 'Failed to log training' });
  }
});

// POST /api/users/scan-qr - Scan QR code
router.post('/scan-qr', requireUser, (req, res) => {
  const { qrId } = req.body;
  const userId = req.userId;

  if (!qrId) {
    return res.status(400).json({ error: 'qrId required' });
  }

  try {
    // Check if QR exists
    const qr = req.db.prepare('SELECT * FROM qr_codes WHERE id = ?').get(qrId);
    if (!qr) {
      return res.status(404).json({ error: 'QR code not found' });
    }

    // Check if expired
    if (qr.expires_at && new Date(qr.expires_at) < new Date()) {
      return res.status(400).json({ error: 'QR code has expired' });
    }

    // Check max uses
    if (qr.max_uses && qr.uses_count >= qr.max_uses) {
      return res.status(400).json({ error: 'QR code max uses reached' });
    }

    // Check if already scanned this QR today
    const user = req.db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const today = new Date().toISOString().split('T')[0];
    
    // Check if user already scanned ANY QR today (1 per day limit)
    const todayScans = req.db.prepare(`
      SELECT * FROM training_history 
      WHERE user_id = ? AND date = ? AND source = 'qr'
    `).all(userId, today);
    
    if (todayScans.length > 0) {
      return res.status(400).json({ error: 'You can only scan one QR code per day' });
    }

    // Increment QR uses count
    req.db.prepare('UPDATE qr_codes SET uses_count = uses_count + 1 WHERE id = ?').run(qrId);

    // Award XP
    const xpSettings = getXpSettings(req.db);
    const isWeekend = [0, 6].includes(new Date().getDay());

    let totalXpAwarded = 0;
    const skillUpdates = [];
    let skillFocusName = 'general';

    // Check if QR has multiple skills (training preset)
    const skills = qr.skills_json ? JSON.parse(qr.skills_json) : null;

    if (skills && Array.isArray(skills) && skills.length > 0) {
      // Multiple skills - like a training preset
      for (const { skillId, xpAmount } of skills) {
        const finalXp = isWeekend ? xpAmount * 2 : xpAmount;
        totalXpAwarded += finalXp;

        if (skillId && skillId !== 'general') {
          req.db.prepare(`
            INSERT INTO user_skills (user_id, skill_id, value) VALUES (?, ?, ?)
            ON CONFLICT(user_id, skill_id) DO UPDATE SET value = value + ?
          `).run(userId, skillId, finalXp, finalXp);
          skillUpdates.push({ skillId, xp: finalXp });
        }
      }
      skillFocusName = qr.title;
    } else {
      // Single skill or general XP (legacy format)
      const finalXp = isWeekend ? qr.xp_amount * 2 : qr.xp_amount;
      totalXpAwarded = finalXp;

      if (qr.skill_id) {
        req.db.prepare(`
          INSERT INTO user_skills (user_id, skill_id, value) VALUES (?, ?, ?)
          ON CONFLICT(user_id, skill_id) DO UPDATE SET value = value + ?
        `).run(userId, qr.skill_id, finalXp, finalXp);
        skillUpdates.push({ skillId: qr.skill_id, xp: finalXp });
        skillFocusName = qr.skill_id;
      }
    }

    // Add total XP to user
    addXpToUser(req.db, userId, totalXpAwarded, xpSettings);

    // Update trainings and streak
    req.db.prepare('UPDATE users SET trainings_completed = trainings_completed + 1, last_qr_scan_date = ? WHERE id = ?').run(today, userId);
    updateStreak(req.db, userId);

    // Record training
    req.db.prepare(`
      INSERT INTO training_history (user_id, date, skill_focus, xp_earned, source, qr_id)
      VALUES (?, ?, ?, ?, 'qr', ?)
    `).run(userId, today, skillFocusName, totalXpAwarded, qrId);

    // Unlock achievement if attached to QR
    if (qr.achievement_id) {
      req.db.prepare(`
        INSERT OR IGNORE INTO user_achievements (user_id, achievement_id) VALUES (?, ?)
      `).run(userId, qr.achievement_id);
    }

    // Check other achievements
    const newAchievements = checkAchievements(req.db, userId);

    const updatedUser = req.db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    res.json({
      user: formatUser(req.db, updatedUser),
      qr: { 
        id: qr.id, 
        title: qr.title, 
        xpAmount: qr.xp_amount,
        skills: skills
      },
      xpAwarded: totalXpAwarded,
      skillUpdates,
      weekendBonus: isWeekend,
      newAchievements: newAchievements.map(a => ({
        id: a.id,
        title: a.title,
        description: a.description,
        imageUrl: a.image_url
      }))
    });
  } catch (error) {
    console.error('Scan QR error:', error);
    res.status(500).json({ error: 'Failed to scan QR' });
  }
});

// PUT /api/users/:id/role - Update user role (admin only)
router.put('/:id/role', requireRole(['ADMIN']), (req, res) => {
  const { role } = req.body;
  if (!['STUDENT', 'TRAINER', 'ADMIN'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  const user = req.db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  req.db.prepare('UPDATE users SET role = ?, updated_at = datetime("now") WHERE id = ?').run(role, req.params.id);
  const updatedUser = req.db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  
  res.json(formatUser(req.db, updatedUser));
});

// PUT /api/users/:id/profile - Update user profile (admin only, or self)
router.put('/:id/profile', requireUser, (req, res) => {
  const { name, avatar, city, branch } = req.body;
  
  const user = req.db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Allow self-edit or admin edit
  if (req.userId !== user.id && req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  try {
    // Build update query dynamically based on provided fields
    const updates = [];
    const values = [];
    
    if (name !== undefined && name.trim()) {
      updates.push('name = ?');
      values.push(name.trim());
    }
    if (avatar !== undefined) {
      updates.push('avatar = ?');
      values.push(avatar);
    }
    if (city !== undefined && city.trim()) {
      updates.push('city = ?');
      values.push(city.trim());
    }
    if (branch !== undefined && branch.trim()) {
      updates.push('branch = ?');
      values.push(branch.trim());
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    updates.push('updated_at = datetime("now")');
    values.push(req.params.id);

    req.db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    
    const updatedUser = req.db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    res.json(formatUser(req.db, updatedUser));
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// PUT /api/users/:id/stats - Update user stats (admin only)
router.put('/:id/stats', requireRole(['ADMIN']), (req, res) => {
  const { xp, totalXp, level, trainingsCompleted, streak } = req.body;
  
  const user = req.db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  try {
    const updates = [];
    const values = [];
    
    if (xp !== undefined && xp >= 0) {
      updates.push('xp = ?');
      values.push(xp);
    }
    if (totalXp !== undefined && totalXp >= 0) {
      updates.push('total_xp = ?');
      values.push(totalXp);
    }
    if (level !== undefined && level >= 1) {
      updates.push('level = ?');
      values.push(level);
    }
    if (trainingsCompleted !== undefined && trainingsCompleted >= 0) {
      updates.push('trainings_completed = ?');
      values.push(trainingsCompleted);
    }
    if (streak !== undefined && streak >= 0) {
      updates.push('streak = ?');
      values.push(streak);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    updates.push('updated_at = datetime("now")');
    values.push(req.params.id);

    req.db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    
    const updatedUser = req.db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    res.json(formatUser(req.db, updatedUser));
  } catch (error) {
    console.error('Update stats error:', error);
    res.status(500).json({ error: 'Failed to update stats' });
  }
});

// POST /api/users/:id/achievements/:achievementId - Grant achievement to user (admin only)
router.post('/:id/achievements/:achievementId', requireRole(['ADMIN']), (req, res) => {
  const { id, achievementId } = req.params;
  
  const user = req.db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const achievement = req.db.prepare('SELECT * FROM achievements WHERE id = ?').get(achievementId);
  if (!achievement) {
    return res.status(404).json({ error: 'Achievement not found' });
  }

  try {
    req.db.prepare(`
      INSERT OR IGNORE INTO user_achievements (user_id, achievement_id) VALUES (?, ?)
    `).run(id, achievementId);

    res.json({ success: true, message: 'Achievement granted' });
  } catch (error) {
    console.error('Grant achievement error:', error);
    res.status(500).json({ error: 'Failed to grant achievement' });
  }
});

// DELETE /api/users/:id/achievements/:achievementId - Revoke achievement from user (admin only)
router.delete('/:id/achievements/:achievementId', requireRole(['ADMIN']), (req, res) => {
  const { id, achievementId } = req.params;
  
  try {
    req.db.prepare('DELETE FROM user_achievements WHERE user_id = ? AND achievement_id = ?').run(id, achievementId);
    res.json({ success: true, message: 'Achievement revoked' });
  } catch (error) {
    console.error('Revoke achievement error:', error);
    res.status(500).json({ error: 'Failed to revoke achievement' });
  }
});

// POST /api/users/:id/recalculate-skills - Recalculate skills from training history (admin only)
router.post('/:id/recalculate-skills', requireRole(['ADMIN']), (req, res) => {
  const { id } = req.params;
  
  const user = req.db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  try {
    // Reset all user skills to 0
    req.db.prepare('DELETE FROM user_skills WHERE user_id = ?').run(id);
    
    // Get all training history
    const history = req.db.prepare('SELECT * FROM training_history WHERE user_id = ?').all(id);
    
    // Recalculate skills from history
    const skillTotals = {};
    for (const training of history) {
      const skillFocus = training.skill_focus;
      const xpEarned = training.xp_earned;
      
      // Handle preset trainings (e.g., "Прием + Пас" or "receive+set")
      if (skillFocus && skillFocus.includes('+')) {
        // For presets, we need to split XP among skills
        // But we don't know the exact split, so we'll distribute evenly
        const parts = skillFocus.split('+').map(s => s.trim().toLowerCase());
        const xpPerSkill = Math.floor(xpEarned / parts.length);
        
        // Map Russian names to skill IDs
        const nameToId = {
          'прием': 'receive', 'приём': 'receive',
          'пас': 'set',
          'атака': 'attack',
          'блок': 'block',
          'подача': 'serve',
          'физо': 'stamina', 'физподготовка': 'stamina'
        };
        
        for (const part of parts) {
          const skillId = nameToId[part] || part;
          if (skillId && skillId !== 'general') {
            skillTotals[skillId] = (skillTotals[skillId] || 0) + xpPerSkill;
          }
        }
      } else if (skillFocus && skillFocus !== 'general') {
        // Single skill training
        skillTotals[skillFocus] = (skillTotals[skillFocus] || 0) + xpEarned;
      }
    }
    
    // Insert recalculated skills
    for (const [skillId, value] of Object.entries(skillTotals)) {
      req.db.prepare(`
        INSERT INTO user_skills (user_id, skill_id, value) VALUES (?, ?, ?)
        ON CONFLICT(user_id, skill_id) DO UPDATE SET value = ?
      `).run(id, skillId, value, value);
    }
    
    // Check achievements with new skill values
    const newAchievements = checkAchievements(req.db, id);
    
    const updatedUser = req.db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    res.json({
      user: formatUser(req.db, updatedUser),
      recalculatedSkills: skillTotals,
      newAchievements: newAchievements.map(a => ({
        id: a.id,
        title: a.title
      }))
    });
  } catch (error) {
    console.error('Recalculate skills error:', error);
    res.status(500).json({ error: 'Failed to recalculate skills' });
  }
});

// GET /api/users/:id/xp-history - Get XP operation history for a user (trainer/admin)
router.get('/:id/xp-history', requireRole(['TRAINER', 'ADMIN']), (req, res) => {
  const { id } = req.params;
  
  try {
    // Check trainer zone restriction
    const zoneCheck = checkTrainerZone(req.db, req.user, id);
    if (!zoneCheck.allowed) {
      return res.status(403).json({ error: zoneCheck.error });
    }

    const history = req.db.prepare(`
      SELECT th.*, u.name as operator_name 
      FROM training_history th 
      LEFT JOIN users u ON th.operator_id = u.id 
      WHERE th.user_id = ? 
      ORDER BY th.created_at DESC 
      LIMIT 100
    `).all(id);

    res.json(history.map(h => ({
      id: h.id,
      date: h.date,
      skillFocus: h.skill_focus || 'general',
      xpEarned: h.xp_earned,
      source: h.source,
      qrId: h.qr_id,
      operatorId: h.operator_id,
      operatorName: h.operator_name || null,
      reason: h.reason || null,
      createdAt: h.created_at
    })));
  } catch (error) {
    console.error('Get XP history error:', error);
    res.status(500).json({ error: 'Failed to get XP history' });
  }
});

// PUT /api/users/:id/assignment - Update trainer assignment (admin only)
router.put('/:id/assignment', requireRole(['ADMIN']), (req, res) => {
  const { assignedCity, assignedBranch } = req.body;
  
  const user = req.db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  if (user.role !== 'TRAINER') {
    return res.status(400).json({ error: 'Assignments can only be set for trainers' });
  }

  try {
    req.db.prepare('UPDATE users SET assigned_city = ?, assigned_branch = ?, updated_at = datetime("now") WHERE id = ?')
      .run(assignedCity || null, assignedBranch || null, req.params.id);
    
    const updatedUser = req.db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    res.json(formatUser(req.db, updatedUser));
  } catch (error) {
    console.error('Update assignment error:', error);
    res.status(500).json({ error: 'Failed to update assignment' });
  }
});

module.exports = router;
