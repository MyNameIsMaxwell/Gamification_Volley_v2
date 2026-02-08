const express = require('express');
const router = express.Router();

// GET /api/achievements - Get all achievements
router.get('/', (req, res) => {
  const achievements = req.db.prepare('SELECT * FROM achievements ORDER BY created_at').all();
  
  res.json(achievements.map(a => ({
    id: a.id,
    title: a.title,
    description: a.description,
    imageUrl: a.image_url,
    conditions: JSON.parse(a.conditions_json || '{}')
  })));
});

// GET /api/achievements/:id - Get single achievement
router.get('/:id', (req, res) => {
  const achievement = req.db.prepare('SELECT * FROM achievements WHERE id = ?').get(req.params.id);
  
  if (!achievement) {
    return res.status(404).json({ error: 'Achievement not found' });
  }

  // Get users who have this achievement
  const users = req.db.prepare(`
    SELECT u.id, u.name, u.avatar, ua.unlocked_at
    FROM user_achievements ua
    JOIN users u ON ua.user_id = u.id
    WHERE ua.achievement_id = ?
    ORDER BY ua.unlocked_at DESC
  `).all(req.params.id);

  res.json({
    id: achievement.id,
    title: achievement.title,
    description: achievement.description,
    imageUrl: achievement.image_url,
    conditions: JSON.parse(achievement.conditions_json || '{}'),
    unlockedBy: users.map(u => ({
      id: u.id.toString(),
      name: u.name,
      avatar: u.avatar,
      unlockedAt: u.unlocked_at
    }))
  });
});

// POST /api/achievements - Create new achievement
router.post('/', (req, res) => {
  const { title, description, imageUrl, conditions } = req.body;

  if (!title) {
    return res.status(400).json({ error: 'Title required' });
  }

  try {
    const id = `ach_${Date.now()}`;
    req.db.prepare(`
      INSERT INTO achievements (id, title, description, image_url, conditions_json)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, title, description || '', imageUrl || '', JSON.stringify(conditions || {}));

    const achievement = req.db.prepare('SELECT * FROM achievements WHERE id = ?').get(id);
    
    res.status(201).json({
      id: achievement.id,
      title: achievement.title,
      description: achievement.description,
      imageUrl: achievement.image_url,
      conditions: JSON.parse(achievement.conditions_json || '{}')
    });
  } catch (error) {
    console.error('Create achievement error:', error);
    res.status(500).json({ error: 'Failed to create achievement' });
  }
});

// PUT /api/achievements/:id - Update achievement
router.put('/:id', (req, res) => {
  const { title, description, imageUrl, conditions } = req.body;

  const existing = req.db.prepare('SELECT * FROM achievements WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Achievement not found' });
  }

  try {
    req.db.prepare(`
      UPDATE achievements SET
        title = ?,
        description = ?,
        image_url = ?,
        conditions_json = ?
      WHERE id = ?
    `).run(
      title || existing.title,
      description !== undefined ? description : existing.description,
      imageUrl !== undefined ? imageUrl : existing.image_url,
      conditions ? JSON.stringify(conditions) : existing.conditions_json,
      req.params.id
    );

    const achievement = req.db.prepare('SELECT * FROM achievements WHERE id = ?').get(req.params.id);
    
    res.json({
      id: achievement.id,
      title: achievement.title,
      description: achievement.description,
      imageUrl: achievement.image_url,
      conditions: JSON.parse(achievement.conditions_json || '{}')
    });
  } catch (error) {
    console.error('Update achievement error:', error);
    res.status(500).json({ error: 'Failed to update achievement' });
  }
});

// DELETE /api/achievements/:id - Delete achievement
router.delete('/:id', (req, res) => {
  const existing = req.db.prepare('SELECT * FROM achievements WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Achievement not found' });
  }

  try {
    req.db.prepare('DELETE FROM achievements WHERE id = ?').run(req.params.id);
    res.json({ success: true, deleted: req.params.id });
  } catch (error) {
    console.error('Delete achievement error:', error);
    res.status(500).json({ error: 'Failed to delete achievement' });
  }
});

// POST /api/achievements/:id/unlock - Manually unlock achievement for user
router.post('/:id/unlock', (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'userId required' });
  }

  const achievement = req.db.prepare('SELECT * FROM achievements WHERE id = ?').get(req.params.id);
  if (!achievement) {
    return res.status(404).json({ error: 'Achievement not found' });
  }

  const user = req.db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  try {
    req.db.prepare(`
      INSERT OR IGNORE INTO user_achievements (user_id, achievement_id)
      VALUES (?, ?)
    `).run(userId, req.params.id);

    res.json({
      success: true,
      achievement: {
        id: achievement.id,
        title: achievement.title
      },
      user: {
        id: user.id.toString(),
        name: user.name
      }
    });
  } catch (error) {
    console.error('Unlock achievement error:', error);
    res.status(500).json({ error: 'Failed to unlock achievement' });
  }
});

module.exports = router;
