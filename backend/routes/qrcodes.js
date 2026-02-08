const express = require('express');
const router = express.Router();

// Helper to format QR code response
function formatQR(qr) {
  return {
    id: qr.id,
    title: qr.title,
    city: qr.city,
    branch: qr.branch,
    xpAmount: qr.xp_amount,
    skillId: qr.skill_id,
    skills: qr.skills_json ? JSON.parse(qr.skills_json) : null,
    achievementId: qr.achievement_id,
    isTrainingPreset: !!qr.is_training_preset,
    maxUses: qr.max_uses,
    usesCount: qr.uses_count || 0,
    createdAt: qr.created_at,
    expiresAt: qr.expires_at
  };
}

// GET /api/qrcodes - Get all QR codes
router.get('/', (req, res) => {
  const { city, branch } = req.query;
  
  let query = 'SELECT * FROM qr_codes WHERE 1=1';
  const params = [];

  if (city) {
    query += ' AND city = ?';
    params.push(city);
  }
  if (branch) {
    query += ' AND branch = ?';
    params.push(branch);
  }

  query += ' ORDER BY created_at DESC';

  const qrCodes = req.db.prepare(query).all(...params);
  
  res.json(qrCodes.map(formatQR));
});

// GET /api/qrcodes/:id - Get single QR code
router.get('/:id', (req, res) => {
  const qr = req.db.prepare('SELECT * FROM qr_codes WHERE id = ?').get(req.params.id);
  
  if (!qr) {
    return res.status(404).json({ error: 'QR code not found' });
  }

  // Get scan statistics
  const stats = req.db.prepare(`
    SELECT 
      COUNT(*) as total_scans,
      COUNT(DISTINCT user_id) as unique_users,
      SUM(xp_earned) as total_xp_awarded
    FROM training_history
    WHERE qr_id = ?
  `).get(req.params.id);

  res.json({
    ...formatQR(qr),
    stats: {
      totalScans: stats.total_scans,
      uniqueUsers: stats.unique_users,
      totalXpAwarded: stats.total_xp_awarded || 0
    }
  });
});

// POST /api/qrcodes - Create new QR code
router.post('/', (req, res) => {
  const { title, city, branch, xpAmount, skillId, skills, achievementId, expiresAt, isTrainingPreset, maxUses } = req.body;

  if (!title || !city || !branch) {
    return res.status(400).json({ error: 'title, city, and branch required' });
  }

  try {
    const id = `qr_${Date.now()}`;
    
    // Calculate total XP from skills if provided
    let totalXp = xpAmount || 150;
    if (skills && Array.isArray(skills)) {
      totalXp = skills.reduce((sum, s) => sum + (s.xpAmount || 0), 0);
    }

    req.db.prepare(`
      INSERT INTO qr_codes (id, title, city, branch, xp_amount, skill_id, skills_json, achievement_id, expires_at, is_training_preset, max_uses)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, 
      title, 
      city, 
      branch, 
      totalXp,
      skillId || null, 
      skills ? JSON.stringify(skills) : null,
      achievementId || null, 
      expiresAt || null,
      isTrainingPreset ? 1 : 0,
      maxUses || null
    );

    const qr = req.db.prepare('SELECT * FROM qr_codes WHERE id = ?').get(id);
    
    res.status(201).json(formatQR(qr));
  } catch (error) {
    console.error('Create QR error:', error);
    res.status(500).json({ error: 'Failed to create QR code' });
  }
});

// PUT /api/qrcodes/:id - Update QR code
router.put('/:id', (req, res) => {
  const { title, city, branch, xpAmount, skillId, skills, achievementId, expiresAt, maxUses } = req.body;

  const existing = req.db.prepare('SELECT * FROM qr_codes WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'QR code not found' });
  }

  try {
    // Calculate total XP from skills if provided
    let totalXp = xpAmount !== undefined ? xpAmount : existing.xp_amount;
    if (skills && Array.isArray(skills)) {
      totalXp = skills.reduce((sum, s) => sum + (s.xpAmount || 0), 0);
    }

    req.db.prepare(`
      UPDATE qr_codes SET
        title = ?,
        city = ?,
        branch = ?,
        xp_amount = ?,
        skill_id = ?,
        skills_json = ?,
        achievement_id = ?,
        expires_at = ?,
        max_uses = ?
      WHERE id = ?
    `).run(
      title || existing.title,
      city || existing.city,
      branch || existing.branch,
      totalXp,
      skillId !== undefined ? skillId : existing.skill_id,
      skills !== undefined ? (skills ? JSON.stringify(skills) : null) : existing.skills_json,
      achievementId !== undefined ? achievementId : existing.achievement_id,
      expiresAt !== undefined ? expiresAt : existing.expires_at,
      maxUses !== undefined ? maxUses : existing.max_uses,
      req.params.id
    );

    const qr = req.db.prepare('SELECT * FROM qr_codes WHERE id = ?').get(req.params.id);
    
    res.json(formatQR(qr));
  } catch (error) {
    console.error('Update QR error:', error);
    res.status(500).json({ error: 'Failed to update QR code' });
  }
});

// DELETE /api/qrcodes/:id - Delete QR code
router.delete('/:id', (req, res) => {
  const existing = req.db.prepare('SELECT * FROM qr_codes WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'QR code not found' });
  }

  try {
    req.db.prepare('DELETE FROM qr_codes WHERE id = ?').run(req.params.id);
    res.json({ success: true, deleted: req.params.id });
  } catch (error) {
    console.error('Delete QR error:', error);
    res.status(500).json({ error: 'Failed to delete QR code' });
  }
});

module.exports = router;
