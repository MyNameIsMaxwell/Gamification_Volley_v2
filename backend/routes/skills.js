const express = require('express');
const router = express.Router();

// GET /api/skills - Get all skill definitions
router.get('/', (req, res) => {
  const skills = req.db.prepare('SELECT * FROM skills ORDER BY created_at').all();
  
  res.json(skills.map(s => ({
    id: s.id,
    label: s.label,
    enabled: Boolean(s.enabled)
  })));
});

// GET /api/skills/enabled - Get only enabled skills
router.get('/enabled', (req, res) => {
  const skills = req.db.prepare('SELECT * FROM skills WHERE enabled = 1 ORDER BY created_at').all();
  
  res.json(skills.map(s => ({
    id: s.id,
    label: s.label
  })));
});

// POST /api/skills - Create new skill
router.post('/', (req, res) => {
  const { label } = req.body;

  if (!label) {
    return res.status(400).json({ error: 'Label required' });
  }

  try {
    const id = `skill_${Date.now()}`;
    req.db.prepare('INSERT INTO skills (id, label) VALUES (?, ?)').run(id, label);

    // Add this skill to all existing users with value 0
    const users = req.db.prepare('SELECT id FROM users').all();
    const insertUserSkill = req.db.prepare('INSERT OR IGNORE INTO user_skills (user_id, skill_id, value) VALUES (?, ?, 0)');
    for (const user of users) {
      insertUserSkill.run(user.id, id);
    }

    res.status(201).json({ id, label, enabled: true });
  } catch (error) {
    console.error('Create skill error:', error);
    res.status(500).json({ error: 'Failed to create skill' });
  }
});

// PUT /api/skills/:id - Update skill
router.put('/:id', (req, res) => {
  const { label, enabled } = req.body;

  const existing = req.db.prepare('SELECT * FROM skills WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Skill not found' });
  }

  try {
    req.db.prepare(`
      UPDATE skills SET
        label = ?,
        enabled = ?
      WHERE id = ?
    `).run(
      label || existing.label,
      enabled !== undefined ? (enabled ? 1 : 0) : existing.enabled,
      req.params.id
    );

    const skill = req.db.prepare('SELECT * FROM skills WHERE id = ?').get(req.params.id);
    res.json({
      id: skill.id,
      label: skill.label,
      enabled: Boolean(skill.enabled)
    });
  } catch (error) {
    console.error('Update skill error:', error);
    res.status(500).json({ error: 'Failed to update skill' });
  }
});

// PUT /api/skills/:id/toggle - Toggle skill enabled/disabled
router.put('/:id/toggle', (req, res) => {
  const existing = req.db.prepare('SELECT * FROM skills WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Skill not found' });
  }

  try {
    const newEnabled = existing.enabled ? 0 : 1;
    req.db.prepare('UPDATE skills SET enabled = ? WHERE id = ?').run(newEnabled, req.params.id);

    res.json({
      id: existing.id,
      label: existing.label,
      enabled: Boolean(newEnabled)
    });
  } catch (error) {
    console.error('Toggle skill error:', error);
    res.status(500).json({ error: 'Failed to toggle skill' });
  }
});

// DELETE /api/skills/:id - Delete skill
router.delete('/:id', (req, res) => {
  const existing = req.db.prepare('SELECT * FROM skills WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Skill not found' });
  }

  try {
    req.db.prepare('DELETE FROM skills WHERE id = ?').run(req.params.id);
    res.json({ success: true, deleted: req.params.id });
  } catch (error) {
    console.error('Delete skill error:', error);
    res.status(500).json({ error: 'Failed to delete skill' });
  }
});

module.exports = router;
