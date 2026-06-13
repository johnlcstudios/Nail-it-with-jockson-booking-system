const mongoose = require('mongoose');

const timeSlotSchema = new mongoose.Schema({
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  isAvailable: { type: Boolean, default: true },
  maxBookings: { type: Number, default: 1 },
  currentBookings: { type: Number, default: 0 }
});

const availabilitySchema = new mongoose.Schema({
  date: { type: Date, required: true, unique: true },
  isOpen: { type: Boolean, default: true },
  timeSlots: [timeSlotSchema],
  slotInterval: { type: Number, default: 60 }
}, { timestamps: true });

module.exports = mongoose.model('Availability', availabilitySchema);
