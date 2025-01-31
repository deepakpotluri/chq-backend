const mongoose = require('mongoose');

const countrySchema = new mongoose.Schema({
  CountryNames: [{
    name: { type: String, required: true },
    selection1: [{
      name: { type: String }
    }],
    selection2: [{
      name: { type: String }
    }],
    selection3: [{
      name: { type: String }
    }],
    selection4: [{
      name: { type: String }
    }],
    selection5: [{
      name: { type: String }
    }]
  }]
}, { collection: 'countries' });

// Add index for case-insensitive search
countrySchema.index({ "CountryNames.name": 1 }, { 
  collation: { locale: 'en', strength: 2 } 
});

const Country = mongoose.model('Country', countrySchema);

module.exports = Country;