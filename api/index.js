const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/scraper', require('./scraper'));
app.use('/api/sheets', require('./sheets'));
app.use('/api/domains', require('./domains'));

// Health check
app.get('/api', (req, res) => {
    res.json({ status: 'ok', message: 'Streaming Link Scraper API' });
});

module.exports = app;
