const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  salonName: { type: String, default: 'Nail It With Jockson' },
  creativeHours: {
    monday: { open: String, close: String, isOpen: Boolean },
    tuesday: { open: String, close: String, isOpen: Boolean },
    wednesday: { open: String, close: String, isOpen: Boolean },
    thursday: { open: String, close: String, isOpen: Boolean },
    friday: { open: String, close: String, isOpen: Boolean },
    saturday: { open: String, close: String, isOpen: Boolean },
    sunday: { open: String, close: String, isOpen: Boolean }
  },
  slotInterval: { type: Number, default: 60, min: 15, max: 180 },
  messengerPageId: { type: String, default: '100069308407532' }
}, { timestamps: true });

module.exports = mongoose.model('Settings', settingsSchema);
