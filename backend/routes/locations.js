const express = require('express');
const router = express.Router();

// GET /api/locations - Get all cities with branches
router.get('/', (req, res) => {
  const cities = req.db.prepare('SELECT * FROM cities ORDER BY name').all();
  const branches = req.db.prepare('SELECT * FROM branches ORDER BY name').all();

  const result = {};
  for (const city of cities) {
    result[city.name] = branches
      .filter(b => b.city_id === city.id)
      .map(b => b.name);
  }

  res.json(result);
});

// GET /api/locations/cities - Get all cities
router.get('/cities', (req, res) => {
  const cities = req.db.prepare(`
    SELECT c.*, 
      (SELECT COUNT(*) FROM branches WHERE city_id = c.id) as branch_count,
      (SELECT COUNT(*) FROM users WHERE city = c.name) as user_count
    FROM cities c
    ORDER BY c.name
  `).all();

  res.json(cities.map(c => ({
    id: c.id,
    name: c.name,
    branchCount: c.branch_count,
    userCount: c.user_count
  })));
});

// GET /api/locations/branches - Get all branches
router.get('/branches', (req, res) => {
  const { city } = req.query;

  let query = `
    SELECT b.*, c.name as city_name,
      (SELECT COUNT(*) FROM users WHERE city = c.name AND branch = b.name) as user_count
    FROM branches b
    JOIN cities c ON b.city_id = c.id
  `;
  const params = [];

  if (city) {
    query += ' WHERE c.name = ?';
    params.push(city);
  }

  query += ' ORDER BY c.name, b.name';

  const branches = req.db.prepare(query).all(...params);

  res.json(branches.map(b => ({
    id: b.id,
    name: b.name,
    city: b.city_name,
    userCount: b.user_count
  })));
});

// POST /api/locations/cities - Add new city
router.post('/cities', (req, res) => {
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'City name required' });
  }

  try {
    const result = req.db.prepare('INSERT INTO cities (name) VALUES (?)').run(name);
    res.status(201).json({ id: result.lastInsertRowid, name, branches: [] });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(400).json({ error: 'City already exists' });
    }
    console.error('Create city error:', error);
    res.status(500).json({ error: 'Failed to create city' });
  }
});

// POST /api/locations/branches - Add new branch
router.post('/branches', (req, res) => {
  const { city, name } = req.body;

  if (!city || !name) {
    return res.status(400).json({ error: 'City and branch name required' });
  }

  try {
    const cityRecord = req.db.prepare('SELECT id FROM cities WHERE name = ?').get(city);
    if (!cityRecord) {
      return res.status(404).json({ error: 'City not found' });
    }

    const result = req.db.prepare('INSERT INTO branches (city_id, name) VALUES (?, ?)').run(cityRecord.id, name);
    res.status(201).json({ id: result.lastInsertRowid, name, city });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(400).json({ error: 'Branch already exists in this city' });
    }
    console.error('Create branch error:', error);
    res.status(500).json({ error: 'Failed to create branch' });
  }
});

// DELETE /api/locations/cities/:name - Delete city and all its branches
router.delete('/cities/:name', (req, res) => {
  const city = req.db.prepare('SELECT id FROM cities WHERE name = ?').get(req.params.name);
  if (!city) {
    return res.status(404).json({ error: 'City not found' });
  }

  try {
    req.db.prepare('DELETE FROM cities WHERE id = ?').run(city.id);
    res.json({ success: true, deleted: req.params.name });
  } catch (error) {
    console.error('Delete city error:', error);
    res.status(500).json({ error: 'Failed to delete city' });
  }
});

// DELETE /api/locations/branches - Delete branch
router.delete('/branches', (req, res) => {
  const { city, name } = req.body;

  if (!city || !name) {
    return res.status(400).json({ error: 'City and branch name required' });
  }

  const cityRecord = req.db.prepare('SELECT id FROM cities WHERE name = ?').get(city);
  if (!cityRecord) {
    return res.status(404).json({ error: 'City not found' });
  }

  try {
    const result = req.db.prepare('DELETE FROM branches WHERE city_id = ? AND name = ?').run(cityRecord.id, name);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Branch not found' });
    }
    res.json({ success: true, deleted: { city, branch: name } });
  } catch (error) {
    console.error('Delete branch error:', error);
    res.status(500).json({ error: 'Failed to delete branch' });
  }
});

module.exports = router;
