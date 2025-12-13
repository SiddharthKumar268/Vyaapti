// backend/server.js

const express = require('express');
const cors = require('cors');
const path = require('path');
const client = require('./config/database');

// Import routes
const summaryRoutes = require('./routes/summaryRoutes');
const chainRoutes = require('./routes/chainRoutes');
const accountRoutes = require('./routes/accountRoutes');
const chartRoutes = require('./routes/chartRoutes');
const mlRoutes = require('./routes/mlRoutes');  // NEW: ML routes

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('frontend'));

// Connect to database
client.connect()
    .then(() => console.log('✓ Connected to DataStax Astra DB'))
    .catch(err => console.error('✗ Astra DB connection error:', err));

// Routes
app.use('/api', summaryRoutes);
app.use('/api', chainRoutes);
app.use('/api', accountRoutes);
app.use('/api', chartRoutes);
app.use('/api/ml', mlRoutes);  // NEW: ML API endpoints

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════╗
║  RTGS Risk-Chain Analyzer Server          ║
║  Running on http://localhost:${PORT}       ║
║  DataStax Astra DB (Mumbai, India)        ║
║  ML Models: K-Means + Random Forest       ║
╚════════════════════════════════════════════╝
    `);
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\nShutting down gracefully...');
    await client.shutdown();
    process.exit(0);
});