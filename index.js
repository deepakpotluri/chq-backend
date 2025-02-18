const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

const PORT = process.env.PORT || 5000;

// Middleware
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173', // For Vite
  'https://visainformation.vercel.app',
  '*',
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
  },
}));
app.use(express.json());

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('MongoDB Connected Successfully');
  })
  .catch(err => console.log('MongoDB connection error:', err));

const Rank = require('./models/Rank');

// Rankings API route
app.get('/api/rankings', async (req, res) => {
  try {
  
    const data = await Rank.findOne();
    if (!data || !data.Ranks) {
      return res.status(404).json({ message: 'No rankings found' });
    }

    const sortedRanks = data.Ranks.sort((a, b) => a.rank - b.rank);
    res.json(sortedRanks);
  } catch (error) {
    console.error('Error fetching rankings:', error);
    res.status(500).json({ message: error.message });
  }
});

const Country = require('./models/Country');

app.get('/api/countries/:country', async (req, res) => {
  try {
    const countryParam = decodeURIComponent(req.params.country);
    const result = await Country.findOne(
      { 'CountryNames.name': countryParam },
      { 'CountryNames.$': 1 }
    );

    if (!result || !result.CountryNames || result.CountryNames.length === 0) {
      return res.status(404).json({ message: 'Country not found' });
    }

    res.json(result.CountryNames[0]);
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    dbState: mongoose.connection.readyState,
    timestamp: new Date().toISOString()
  });
});
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));


// Export the app for Vercel
module.exports = app;