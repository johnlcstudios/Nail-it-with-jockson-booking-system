const express = require('express');
const { body, validationResult } = require('express-validator');
const Availability = require('../models/Availability');
const Settings = require('../models/Settings');
const auth = require('../middleware/auth');

const router = express.Router();

const generateTimeSlots = (openTime, closeTime, interval) => {
  const slots = [];
  const [openH, openM] = openTime.split(':').map(Number);
  const [closeH, closeM] = closeTime.split(':').map(Number);
  let currentMinutes = openH * 60 + openM;
  const closeMinutes = closeH * 60 + closeM;

  while (currentMinutes + interval <= closeMinutes) {
    const startH = Math.floor(currentMinutes / 60);
    const startM = currentMinutes % 60;
    const endMinutes = currentMinutes + interval;
    const endH = Math.floor(endMinutes / 60);
    const endM = endMinutes % 60;

    const pad = (n) => n.toString().padStart(2, '0');
    slots.push({
      startTime: `${pad(startH)}:${pad(startM)}`,
      endTime: `${pad(endH)}:${pad(endM)}`,
      isAvailable: true,
      maxBookings: 1,
      currentBookings: 0
    });
    currentMinutes += interval;
  }
  return slots;
};

router.get('/settings', auth, async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings({
        creativeHours: {
          monday: { open: '09:00', close: '18:00', isOpen: true },
          tuesday: { open: '09:00', close: '18:00', isOpen: true },
          wednesday: { open: '09:00', close: '18:00', isOpen: true },
          thursday: { open: '09:00', close: '18:00', isOpen: true },
          friday: { open: '09:00', close: '18:00', isOpen: true },
          saturday: { open: '09:00', close: '18:00', isOpen: true },
          sunday: { open: '10:00', close: '16:00', isOpen: false }
        },
        slotInterval: 60
      });
      await settings.save();
    }
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/settings', auth, async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings(req.body);
    } else {
      Object.assign(settings, req.body);
    }
    await settings.save();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/dates/:year/:month', async (req, res) => {
  try {
    const { year, month } = req.params;
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);
    const availability = await Availability.find({
      date: { $gte: startDate, $lte: endDate }
    }).sort({ date: 1 });
    res.json(availability);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/slots/:date', async (req, res) => {
  try {
    const date = new Date(req.params.date);
    date.setHours(0, 0, 0, 0);
    let availability = await Availability.findOne({ date });

    if (!availability) {
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const dayName = dayNames[date.getDay()];
      const settings = await Settings.findOne();

      if (!settings || !settings.creativeHours[dayName]?.isOpen) {
        return res.json({ isOpen: false, timeSlots: [] });
      }

      const { open, close } = settings.creativeHours[dayName];
      const timeSlots = generateTimeSlots(open, close, settings.slotInterval || 60);

      availability = new Availability({
        date,
        isOpen: true,
        timeSlots,
        slotInterval: settings.slotInterval || 60
      });
      await availability.save();
    }

    res.json(availability);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/generate', auth, [
  body('startDate').isISO8601().withMessage('Start date is required'),
  body('endDate').isISO8601().withMessage('End date is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }

    const { startDate, endDate } = req.body;
    const settings = await Settings.findOne();
    if (!settings) {
      return res.status(400).json({ message: 'Settings not configured' });
    }

    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const start = new Date(startDate);
    const end = new Date(endDate);
    const results = [];

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const date = new Date(d);
      date.setHours(0, 0, 0, 0);
      const dayName = dayNames[date.getDay()];
      const hours = settings.creativeHours[dayName];

      if (!hours.isOpen) {
        const existing = await Availability.findOne({ date });
        if (existing) {
          existing.isOpen = false;
          existing.timeSlots = [];
          await existing.save();
          results.push(existing);
        }
        continue;
      }

      const timeSlots = generateTimeSlots(hours.open, hours.close, settings.slotInterval);
      let availability = await Availability.findOne({ date });

      if (availability) {
        availability.isOpen = true;
        availability.timeSlots = timeSlots;
        availability.slotInterval = settings.slotInterval;
        await availability.save();
      } else {
        availability = new Availability({
          date,
          isOpen: true,
          timeSlots,
          slotInterval: settings.slotInterval
        });
        await availability.save();
      }
      results.push(availability);
    }

    res.json(results);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/:date', auth, async (req, res) => {
  try {
    const date = new Date(req.params.date);
    date.setHours(0, 0, 0, 0);
    let availability = await Availability.findOne({ date });
    if (!availability) return res.status(404).json({ message: 'No availability found for this date' });

    Object.assign(availability, req.body);
    await availability.save();
    res.json(availability);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
