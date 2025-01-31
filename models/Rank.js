const mongoose = require('mongoose');

const rankSchema = new mongoose.Schema({
  Ranks: [{
    rank: Number,
    visa_free_destinations: Number,
    countries: [String]
  }]
}, { collection: 'rank' }); // Explicitly specify collection name
const Rank = mongoose.model('Rank', rankSchema);

module.exports = Rank;