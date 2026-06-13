const express = require('express');
const { query, validationResult } = require('express-validator');
const Booking = require('../models/Booking');
const Service = require('../models/Service');
const Availability = require('../models/Availability');
const auth = require('../middleware/auth');

const router = express.Router();

router.get('/dashboard', auth, async (req, res) => {
  try {
    const totalBookings = await Booking.countDocuments({ status: { $in: ['pending', 'confirmed'] } });
    const completedBookings = await Booking.countDocuments({ status: 'completed' });
    const cancelledBookings = await Booking.countDocuments({ status: 'cancelled' });
    const totalServices = await Service.countDocuments({ isActive: true });
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayBookings = await Booking.countDocuments({ date: today, status: { $in: ['pending', 'confirmed'] } });

    const recentBookings = await Booking.find()
      .populate('services')
      .sort({ createdAt: -1 })
      .limit(5);

    res.json({
      stats: { totalBookings, completedBookings, cancelledBookings, totalServices, todayBookings },
      recentBookings
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/bookings', auth, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isIn(['pending', 'confirmed', 'completed', 'cancelled']),
  query('date').optional().isISO8601(),
  query('search').optional().isString(),
  query('sortBy').optional().isIn(['date', 'createdAt', 'customerName']),
  query('sortOrder').optional().isIn(['asc', 'desc'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: 'Invalid query parameters' });
    }

    const { page = 1, limit = 20, status, date, search, sortBy = 'date', sortOrder = 'desc' } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (date) {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      const nextDay = new Date(d);
      nextDay.setDate(nextDay.getDate() + 1);
      filter.date = { $gte: d, $lt: nextDay };
    }
    if (search) {
      filter.$or = [
        { customerName: { $regex: search, $options: 'i' } },
        { customerEmail: { $regex: search, $options: 'i' } }
      ];
    }

    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const bookings = await Booking.find(filter)
      .populate('services')
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Booking.countDocuments(filter);

    res.json({ bookings, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.patch('/bookings/:id/status', auth, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['pending', 'confirmed', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    const previousStatus = booking.status;
    booking.status = status;
    await booking.save();

    if (status === 'cancelled' && previousStatus !== 'cancelled') {
      const availability = await Availability.findOne({ date: booking.date });
      if (availability) {
        const slot = availability.timeSlots.find(s => s.startTime === booking.timeSlot);
        if (slot && slot.currentBookings > 0) {
          slot.currentBookings -= 1;
          slot.isAvailable = true;
          await availability.save();
        }
      }
    }

    res.json(booking);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/calendar', auth, async (req, res) => {
  try {
    const { year, month } = req.query;
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const bookings = await Booking.find({
      date: { $gte: startDate, $lte: endDate },
      status: { $in: ['pending', 'confirmed'] }
    }).populate('services');

    const calendarData = {};
    bookings.forEach(booking => {
      const dateKey = booking.date.toISOString().split('T')[0];
      if (!calendarData[dateKey]) {
        calendarData[dateKey] = { count: 0, bookings: [], totalRevenue: 0 };
      }
      calendarData[dateKey].count += 1;
      calendarData[dateKey].bookings.push(booking);
      calendarData[dateKey].totalRevenue += booking.totalPrice;
    });

    res.json(calendarData);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
