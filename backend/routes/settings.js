const express = require('express');
const router = express.Router();

// GET /api/settings - Get all settings
router.get('/', (req, res) => {
  const settings = req.db.prepare('SELECT * FROM settings').all();
  
  const result = {};
  for (const s of settings) {
    // Try to parse as number
    const numValue = parseFloat(s.value);
    result[s.key] = isNaN(numValue) ? s.value : numValue;
  }

  res.json(result);
});

// GET /api/settings/xp - Get XP configuration
router.get('/xp', (req, res) => {
  const settings = req.db.prepare('SELECT key, value FROM settings WHERE key IN (?, ?, ?)').all('xp_per_level', 'xp_multiplier', 'weekend_bonus');
  
  res.json({
    xpPerLevel: parseInt(settings.find(s => s.key === 'xp_per_level')?.value || '1000'),
    multiplier: parseFloat(settings.find(s => s.key === 'xp_multiplier')?.value || '1.2'),
    weekendBonus: parseInt(settings.find(s => s.key === 'weekend_bonus')?.value || '2')
  });
});

// PUT /api/settings/xp - Update XP configuration
router.put('/xp', (req, res) => {
  const { xpPerLevel, multiplier, weekendBonus } = req.body;

  try {
    const updateSetting = req.db.prepare(`
      INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = datetime('now')
    `);

    if (xpPerLevel !== undefined) {
      updateSetting.run('xp_per_level', xpPerLevel.toString(), xpPerLevel.toString());
    }
    if (multiplier !== undefined) {
      updateSetting.run('xp_multiplier', multiplier.toString(), multiplier.toString());
    }
    if (weekendBonus !== undefined) {
      updateSetting.run('weekend_bonus', weekendBonus.toString(), weekendBonus.toString());
    }

    const settings = req.db.prepare('SELECT key, value FROM settings WHERE key IN (?, ?, ?)').all('xp_per_level', 'xp_multiplier', 'weekend_bonus');
    
    res.json({
      xpPerLevel: parseInt(settings.find(s => s.key === 'xp_per_level')?.value || '1000'),
      multiplier: parseFloat(settings.find(s => s.key === 'xp_multiplier')?.value || '1.2'),
      weekendBonus: parseInt(settings.find(s => s.key === 'weekend_bonus')?.value || '2')
    });
  } catch (error) {
    console.error('Update XP settings error:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// GET /api/settings/:key - Get single setting
router.get('/:key', (req, res) => {
  const setting = req.db.prepare('SELECT * FROM settings WHERE key = ?').get(req.params.key);
  
  if (!setting) {
    return res.status(404).json({ error: 'Setting not found' });
  }

  const numValue = parseFloat(setting.value);
  res.json({
    key: setting.key,
    value: isNaN(numValue) ? setting.value : numValue
  });
});

// PUT /api/settings/:key - Update single setting
router.put('/:key', (req, res) => {
  const { value } = req.body;

  if (value === undefined) {
    return res.status(400).json({ error: 'Value required' });
  }

  try {
    req.db.prepare(`
      INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = datetime('now')
    `).run(req.params.key, value.toString(), value.toString());

    const numValue = parseFloat(value);
    res.json({
      key: req.params.key,
      value: isNaN(numValue) ? value : numValue
    });
  } catch (error) {
    console.error('Update setting error:', error);
    res.status(500).json({ error: 'Failed to update setting' });
  }
});

module.exports = router;
