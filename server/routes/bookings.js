const express = require('express');
const { body, validationResult } = require('express-validator');
const Booking = require('../models/Booking');
const Availability = require('../models/Availability');
const Service = require('../models/Service');
const Settings = require('../models/Settings');
const { sendSMS, formatBookingSMS } = require('../services/smsService');

const router = express.Router();

router.get('/slots/:date', async (req, res) => {
  try {
    const date = new Date(req.params.date);
    date.setHours(0, 0, 0, 0);
    const availability = await Availability.findOne({ date });
    if (!availability || !availability.isOpen) {
      return res.json({ isOpen: false, slots: [] });
    }

    const slots = availability.timeSlots.map(slot => ({
      ...slot,
      isAvailable: slot.isAvailable && slot.currentBookings < slot.maxBookings
    }));

    res.json({ isOpen: true, slots, slotInterval: availability.slotInterval });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/', [
  body('customerName').notEmpty().withMessage('Name is required'),
  body('customerEmail').isEmail().withMessage('Valid email is required'),
  body('customerPhone').notEmpty().withMessage('Phone number is required'),
  body('services').isArray({ min: 1 }).withMessage('At least one service is required'),
  body('date').isISO8601().withMessage('Date is required'),
  body('timeSlot').notEmpty().withMessage('Time slot is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }

    const { customerName, customerEmail, customerPhone, services: serviceIds, date, timeSlot, notes } = req.body;

    const selectedServices = await Service.find({ _id: { $in: serviceIds }, isActive: true });
    if (selectedServices.length !== serviceIds.length) {
      return res.status(400).json({ message: 'One or more selected services are unavailable' });
    }

    const bookingDate = new Date(date);
    bookingDate.setHours(0, 0, 0, 0);

    const availability = await Availability.findOne({ date: bookingDate });
    if (!availability || !availability.isOpen) {
      return res.status(400).json({ message: 'This date is not available for booking' });
    }

    const slot = availability.timeSlots.find(s => s.startTime === timeSlot);
    if (!slot) {
      return res.status(400).json({ message: 'Invalid time slot' });
    }

    if (slot.currentBookings >= slot.maxBookings) {
      return res.status(400).json({ message: 'This time slot is fully booked' });
    }

    const existingBooking = await Booking.findOne({
      date: bookingDate,
      timeSlot,
      status: { $in: ['pending', 'confirmed'] }
    });
    if (existingBooking) {
      return res.status(400).json({ message: 'This time slot is already booked' });
    }

    const totalPrice = selectedServices.reduce((sum, s) => sum + s.price, 0);
    const totalDuration = selectedServices.reduce((sum, s) => sum + s.duration, 0);

    const booking = new Booking({
      customerName,
      customerEmail,
      customerPhone,
      services: serviceIds,
      date: bookingDate,
      timeSlot,
      totalPrice,
      totalDuration,
      notes: notes || ''
    });

    await booking.save();

    slot.currentBookings += 1;
    if (slot.currentBookings >= slot.maxBookings) {
      slot.isAvailable = false;
    }
    await availability.save();

    const smsMessage = formatBookingSMS(booking, selectedServices);
    const smsResult = await sendSMS(customerPhone, smsMessage);
    if (smsResult.success) {
      booking.smsSent = true;
      await booking.save();
    }

    const settings = await Settings.findOne();
    const messengerPageId = settings?.messengerPageId || process.env.MESSENGER_PAGE_ID || '100069308407532';

    const bookingSummary = {
      services: selectedServices.map(s => s.name).join(', '),
      date: new Date(date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
      time: timeSlot
    };
    const refData = encodeURIComponent(JSON.stringify(bookingSummary));
    const messengerUrl = `https://m.me/${messengerPageId}?ref=${refData}`;

    res.status(201).json({
      booking,
      messengerUrl,
      smsStatus: smsResult.mock ? 'mock' : smsResult.success ? 'sent' : 'failed'
    });
  } catch (error) {
    console.error('Booking error:', error);
    res.status(500).json({ message: 'Failed to create booking. Please try again.' });
  }
});

module.exports = router;
