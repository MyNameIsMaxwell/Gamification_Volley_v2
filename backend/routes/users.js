const express = require('express');
const router = express.Router();

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
    skills: allSkills,
    achievements: achievements.map(a => a.achievement_id),
    trainingHistory: history.map(h => ({
      id: h.id.toString(),
      date: h.date,
      skillFocus: h.skill_focus || 'general',
      xpEarned: h.xp_earned,
      source: h.source,
      qrId: h.qr_id
    }))
  };
}

// GET /api/users/me - Get current user by Telegram ID
router.get('/me', (req, res) => {
  const telegramId = req.query.telegram_id;
  if (!telegramId) {
    return res.status(400).json({ error: 'telegram_id required' });
  }

  const user = req.db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(telegramId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json(formatUser(req.db, user));
});

// POST /api/users/register - Register new user
router.post('/register', (req, res) => {
  const { telegramId, name, avatar, city, branch } = req.body;
  
  if (!telegramId || !name) {
    return res.status(400).json({ error: 'telegramId and name required' });
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
    const skills = req.db.prepare('SELECT id FROM skills WHERE enabled = 1').all();
    const insertSkill = req.db.prepare('INSERT INTO user_skills (user_id, skill_id, value) VALUES (?, ?, 1)');
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

// GET /api/users - Get all users
router.get('/', (req, res) => {
  const users = req.db.prepare('SELECT * FROM users ORDER BY total_xp DESC').all();
  res.json(users.map(u => formatUser(req.db, u)));
});

// GET /api/users/:id - Get user by ID
router.get('/:id', (req, res) => {
  const user = req.db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json(formatUser(req.db, user));
});

// POST /api/users/award-xp - Award XP to user (trainer/admin) - just XP, no training count
router.post('/award-xp', (req, res) => {
  const { userId, xpAmount, skillId } = req.body;

  if (!userId || !xpAmount) {
    return res.status(400).json({ error: 'userId and xpAmount required' });
  }

  try {
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

    // Record XP history (but not as training)
    req.db.prepare(`
      INSERT INTO training_history (user_id, date, skill_focus, xp_earned, source)
      VALUES (?, ?, ?, ?, 'xp_bonus')
    `).run(userId, today, skillId || 'general', finalXp);

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

// POST /api/users/log-training - Log a training session with multiple skills
router.post('/log-training', (req, res) => {
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
router.post('/scan-qr', (req, res) => {
  const { userId, qrId } = req.body;

  if (!userId || !qrId) {
    return res.status(400).json({ error: 'userId and qrId required' });
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
    
    // Check if user already scanned THIS specific QR today
    const alreadyScanned = req.db.prepare(`
      SELECT * FROM training_history 
      WHERE user_id = ? AND qr_id = ? AND date = ?
    `).get(userId, qrId, today);
    
    if (alreadyScanned) {
      return res.status(400).json({ error: 'You already scanned this QR code today' });
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

// PUT /api/users/:id/role - Update user role
router.put('/:id/role', (req, res) => {
  const { role } = req.body;
  if (!['STUDENT', 'TRAINER', 'ADMIN'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  req.db.prepare('UPDATE users SET role = ?, updated_at = datetime("now") WHERE id = ?').run(role, req.params.id);
  const user = req.db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  res.json(formatUser(req.db, user));
});

// PUT /api/users/:id/profile - Update user profile (name, avatar, city, branch)
router.put('/:id/profile', (req, res) => {
  const { name, avatar, city, branch } = req.body;
  
  const user = req.db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
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
router.put('/:id/stats', (req, res) => {
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

// POST /api/users/:id/achievements/:achievementId - Grant achievement to user
router.post('/:id/achievements/:achievementId', (req, res) => {
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

// DELETE /api/users/:id/achievements/:achievementId - Revoke achievement from user
router.delete('/:id/achievements/:achievementId', (req, res) => {
  const { id, achievementId } = req.params;
  
  try {
    req.db.prepare('DELETE FROM user_achievements WHERE user_id = ? AND achievement_id = ?').run(id, achievementId);
    res.json({ success: true, message: 'Achievement revoked' });
  } catch (error) {
    console.error('Revoke achievement error:', error);
    res.status(500).json({ error: 'Failed to revoke achievement' });
  }
});

// POST /api/users/:id/recalculate-skills - Recalculate skills from training history
router.post('/:id/recalculate-skills', (req, res) => {
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

module.exports = router;
