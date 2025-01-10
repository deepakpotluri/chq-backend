// index.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

// CORS configuration for both local and production
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:5173', // For Vite
      'https://visainformation.vercel.app/' ,
       '*'
    ];
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));

app.use(express.json());

// MongoDB connection - replace with your MongoDB URI
const MONGODB_URI = 'your-mongodb-uri-here';

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB Connected'))
.catch(err => console.error('MongoDB Connection Error:', err));

// Schema
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
app.get('/api/countries', async (req, res) => {
  try {
    const countries = await VisaInfo.distinct('Country Name');
    res.json(countries.sort());
  } catch (error) {
    console.error('Error fetching countries:', error);
    res.status(500).json({ message: 'Failed to fetch countries' });
  }
});

app.get('/api/visa-info/:country', async (req, res) => {
  try {
    const visaRecords = await VisaInfo.find({ 'Country Name': req.params.country });
    
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

    // Filter out empty strings
    Object.keys(transformedData).forEach(key => {
      transformedData[key] = transformedData[key].filter(item => item !== '');
    });

    res.json(transformedData);
  } catch (error) {
    console.error('Error fetching visa info:', error);
    res.status(500).json({ message: 'Failed to fetch visa information' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;