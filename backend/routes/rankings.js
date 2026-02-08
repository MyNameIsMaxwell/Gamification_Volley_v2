const express = require('express');
const router = express.Router();

// GET /api/rankings/players - Get players ranking
router.get('/players', (req, res) => {
  const { city, branch, limit = 100 } = req.query;
  
  let query = `
    SELECT 
      u.id, u.name, u.avatar, u.level, u.total_xp, u.city, u.branch, u.streak
    FROM users u
    WHERE u.role = 'STUDENT'
  `;
  const params = [];

  if (city) {
    query += ' AND u.city = ?';
    params.push(city);
  }
  if (branch) {
    query += ' AND u.branch = ?';
    params.push(branch);
  }

  query += ' ORDER BY u.total_xp DESC LIMIT ?';
  params.push(parseInt(limit));

  const users = req.db.prepare(query).all(...params);

  res.json(users.map((u, index) => ({
    rank: index + 1,
    id: u.id.toString(),
    name: u.name,
    avatar: u.avatar,
    level: u.level,
    totalXp: u.total_xp,
    city: u.city,
    branch: u.branch,
    streak: u.streak
  })));
});

// GET /api/rankings/branches - Get branches ranking
router.get('/branches', (req, res) => {
  const { city } = req.query;

  let query = `
    SELECT 
      u.city,
      u.branch,
      COUNT(u.id) as student_count,
      SUM(u.total_xp) as total_xp,
      AVG(u.total_xp) as avg_xp
    FROM users u
    WHERE u.role = 'STUDENT'
  `;
  const params = [];

  if (city) {
    query += ' AND u.city = ?';
    params.push(city);
  }

  query += ' GROUP BY u.city, u.branch ORDER BY total_xp DESC';

  const branches = req.db.prepare(query).all(...params);

  res.json(branches.map((b, index) => ({
    rank: index + 1,
    city: b.city,
    branch: b.branch,
    studentCount: b.student_count,
    totalXp: b.total_xp,
    avgXp: Math.round(b.avg_xp)
  })));
});

// GET /api/rankings/cities - Get cities ranking
router.get('/cities', (req, res) => {
  const cities = req.db.prepare(`
    SELECT 
      u.city,
      COUNT(u.id) as student_count,
      SUM(u.total_xp) as total_xp,
      AVG(u.total_xp) as avg_xp,
      COUNT(DISTINCT u.branch) as branch_count
    FROM users u
    WHERE u.role = 'STUDENT'
    GROUP BY u.city
    ORDER BY total_xp DESC
  `).all();

  res.json(cities.map((c, index) => ({
    rank: index + 1,
    city: c.city,
    studentCount: c.student_count,
    branchCount: c.branch_count,
    totalXp: c.total_xp,
    avgXp: Math.round(c.avg_xp)
  })));
});

// GET /api/rankings/skills - Get top users by specific skill
router.get('/skills/:skillId', (req, res) => {
  const { skillId } = req.params;
  const { limit = 50 } = req.query;

  const users = req.db.prepare(`
    SELECT 
      u.id, u.name, u.avatar, u.level, u.city, u.branch,
      us.value as skill_value
    FROM users u
    JOIN user_skills us ON u.id = us.user_id
    WHERE us.skill_id = ? AND u.role = 'STUDENT'
    ORDER BY us.value DESC
    LIMIT ?
  `).all(skillId, parseInt(limit));

  res.json(users.map((u, index) => ({
    rank: index + 1,
    id: u.id.toString(),
    name: u.name,
    avatar: u.avatar,
    level: u.level,
    city: u.city,
    branch: u.branch,
    skillValue: u.skill_value
  })));
});

// GET /api/rankings/streaks - Get users by streak
router.get('/streaks', (req, res) => {
  const { limit = 50 } = req.query;

  const users = req.db.prepare(`
    SELECT 
      id, name, avatar, level, city, branch, streak
    FROM users
    WHERE role = 'STUDENT' AND streak > 0
    ORDER BY streak DESC
    LIMIT ?
  `).all(parseInt(limit));

  res.json(users.map((u, index) => ({
    rank: index + 1,
    id: u.id.toString(),
    name: u.name,
    avatar: u.avatar,
    level: u.level,
    city: u.city,
    branch: u.branch,
    streak: u.streak
  })));
});

module.exports = router;
