const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  customerName: { type: String, required: true, trim: true },
  customerEmail: { type: String, required: true, trim: true },
  customerPhone: { type: String, required: true, trim: true },
  services: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true }],
  date: { type: Date, required: true },
  timeSlot: { type: String, required: true },
  status: { type: String, enum: ['pending', 'confirmed', 'completed', 'cancelled'], default: 'confirmed' },
  totalPrice: { type: Number, required: true },
  totalDuration: { type: Number, required: true },
  smsSent: { type: Boolean, default: false },
  notes: { type: String, default: '' }
}, { timestamps: true });

bookingSchema.index({ date: 1, status: 1 });
bookingSchema.index({ customerName: 'text', customerEmail: 'text' });

module.exports = mongoose.model('Booking', bookingSchema);
