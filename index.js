const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('✅ MongoDB Connected Successfully!'))
  .catch(err => {
    console.error('❌ MongoDB Connection Error:', err);
    process.exit(1);
  });

const visaSchema = new mongoose.Schema({
  'Country Name': String,
  'Visa Free Destinations': String,
  'Visa On  Arrival': String,
  'eTA': String,
  'Visa Online': String,
  'Visa Required': String,
});

const VisaInfo = mongoose.model('countries', visaSchema);

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
      if (record['Visa Free Destinations']) {
        transformedData.visaFree.push(record['Visa Free Destinations']);
      }
      if (record['Visa On  Arrival']) {
        transformedData.visaOnArrival.push(record['Visa On  Arrival']);
      }
      if (record['eTA']) {
        transformedData.eTA.push(record['eTA']);
      }
      if (record['Visa Online']) {
        transformedData.visaOnline.push(record['Visa Online']);
      }
      if (record['Visa Required']) {
        transformedData.visaRequired.push(record['Visa Required']);
      }
    });

    Object.keys(transformedData).forEach(key => {
      transformedData[key] = transformedData[key].filter(item => item !== '');
    });

    res.json(transformedData);
  } catch (error) {
    console.error(`Error fetching visa info for ${req.params.country}:`, error);
    res.status(500).json({ message: 'Failed to fetch visa information' });
  }
});

// Determine if the app is running on localhost
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`🚀 Server running locally on port ${PORT}`);
  });
}

// Export the app for Vercel
module.exports = app;
