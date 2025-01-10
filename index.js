// Required modules
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables from .env
dotenv.config();

// Initialize Express app
const app = express();

// Middleware for parsing JSON
app.use(express.json());

// CORS configuration
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

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI;

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB Connected'))
.catch(err => console.error('MongoDB Connection Error:', err));

// Define schema and model
const visaSchema = new mongoose.Schema({
  'Country Name': String,
  'Visa Free Destinations': String,
  'Visa On  Arrival': String,
  'eTA': String,
  'Visa Online': String,
  'Visa Required': String,
});

const VisaInfo = mongoose.model('countries', visaSchema);

// Routes

/**
 * GET /api/countries
 * Fetches a distinct list of country names.
 */
app.get('/api/countries', async (req, res) => {
  try {
    const countries = await VisaInfo.distinct('Country Name');
    res.json(countries.sort());
  } catch (error) {
    console.error('Error fetching countries:', error);
    res.status(500).json({ message: 'Failed to fetch countries' });
  }
});

/**
 * GET /api/visa-info/:country
 * Fetches visa information for a specific country.
 */
app.get('/api/visa-info/:country', async (req, res) => {
  try {
    const country = req.params.country;
    const visaRecords = await VisaInfo.find({ 'Country Name': country });

    if (!visaRecords || visaRecords.length === 0) {
      return res.status(404).json({ message: 'Country not found' });
    }

    const transformedData = {
      visaFree: [],
      visaOnArrival: [],
      eTA: [],
      visaOnline: [],
      visaRequired: [],
    };

    visaRecords.forEach(record => {
      if (record['Visa Free Destinations']) 
        transformedData.visaFree.push(record['Visa Free Destinations']);
      if (record['Visa On  Arrival']) 
        transformedData.visaOnArrival.push(record['Visa On  Arrival']);
      if (record['eTA']) 
        transformedData.eTA.push(record['eTA']);
      if (record['Visa Online']) 
        transformedData.visaOnline.push(record['Visa Online']);
      if (record['Visa Required']) 
        transformedData.visaRequired.push(record['Visa Required']);
    });

    // Remove empty strings from arrays
    Object.keys(transformedData).forEach(key => {
      transformedData[key] = transformedData[key].filter(item => item.trim() !== '');
    });

    res.json(transformedData);
  } catch (error) {
    console.error('Error fetching visa info:', error);
    res.status(500).json({ message: 'Failed to fetch visa information' });
  }
});

/**
 * GET /api/health
 * Health check endpoint.
 */
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Handle invalid routes
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
