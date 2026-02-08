const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDatabase } = require('./database');

// Import routes
const usersRoutes = require('./routes/users');
const rankingsRoutes = require('./routes/rankings');
const achievementsRoutes = require('./routes/achievements');
const qrcodesRoutes = require('./routes/qrcodes');
const skillsRoutes = require('./routes/skills');
const locationsRoutes = require('./routes/locations');
const settingsRoutes = require('./routes/settings');

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(cors());
app.use(express.json());

// Start server
async function startServer() {
  try {
    // Initialize database
    const db = await initDatabase();

    // Make db available to routes
    app.use((req, res, next) => {
      req.db = db;
      next();
    });

    // API Routes
    app.use('/api/users', usersRoutes);
    app.use('/api/rankings', rankingsRoutes);
    app.use('/api/achievements', achievementsRoutes);
    app.use('/api/qrcodes', qrcodesRoutes);
    app.use('/api/skills', skillsRoutes);
    app.use('/api/locations', locationsRoutes);
    app.use('/api/settings', settingsRoutes);

    // Health check
    app.get('/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // Error handling
    app.use((err, req, res, next) => {
      console.error('Error:', err);
      res.status(500).json({ error: 'Internal server error' });
    });

    app.listen(PORT, () => {
      console.log(`🏐 VolleyLevel API running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
