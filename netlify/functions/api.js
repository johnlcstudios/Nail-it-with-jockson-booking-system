const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// ── DB Connection ──────────────────────────────────────────────
let cached = global.mongoose;
if (!cached) cached = global.mongoose = { conn: null, promise: null };

async function connectDB() {
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    cached.promise = mongoose.connect(process.env.MONGODB_URI, { bufferCommands: false });
  }
  cached.conn = await cached.promise;
  return cached.conn;
}

// ── Models ─────────────────────────────────────────────────────
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin'], default: 'admin' }
}, { timestamps: true });
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});
userSchema.methods.comparePassword = async function(pw) {
  return bcrypt.compare(pw, this.password);
};
const User = mongoose.models.User || mongoose.model('User', userSchema);

const serviceSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, required: true },
  price: { type: Number, required: true, min: 0 },
  duration: { type: Number, required: true, min: 15 },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });
const Service = mongoose.models.Service || mongoose.model('Service', serviceSchema);

const timeSlotSubSchema = new mongoose.Schema({
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  isAvailable: { type: Boolean, default: true },
  maxBookings: { type: Number, default: 1 },
  currentBookings: { type: Number, default: 0 }
}, { _id: false });

const availabilitySchema = new mongoose.Schema({
  date: { type: Date, required: true, unique: true },
  isOpen: { type: Boolean, default: true },
  timeSlots: [timeSlotSubSchema],
  slotInterval: { type: Number, default: 60 }
}, { timestamps: true });
const Availability = mongoose.models.Availability || mongoose.model('Availability', availabilitySchema);

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
const Booking = mongoose.models.Booking || mongoose.model('Booking', bookingSchema);

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
const Settings = mongoose.models.Settings || mongoose.model('Settings', settingsSchema);

// ── Helpers ────────────────────────────────────────────────────
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
};
const JSON_HDR = { ...CORS, 'Content-Type': 'application/json' };

function json(status, data) {
  return { statusCode: status, headers: JSON_HDR, body: JSON.stringify(data) };
}

function parseBody(event) {
  if (!event.body) return {};
  try { return JSON.parse(event.body); } catch { return {}; }
}

async function requireAuth(event) {
  try {
    const token = event.headers.authorization?.replace('Bearer ', '');
    if (!token) return null;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return await User.findById(decoded.userId);
  } catch { return null; }
}

function generateTimeSlots(openTime, closeTime, interval) {
  const slots = [];
  const [oH, oM] = openTime.split(':').map(Number);
  const [cH, cM] = closeTime.split(':').map(Number);
  let cur = oH * 60 + oM;
  const end = cH * 60 + cM;
  const pad = n => String(n).padStart(2, '0');
  while (cur + interval <= end) {
    const e = cur + interval;
    slots.push({ startTime: `${pad(Math.floor(cur/60))}:${pad(cur%60)}`, endTime: `${pad(Math.floor(e/60))}:${pad(e%60)}`, isAvailable: true, maxBookings: 1, currentBookings: 0 });
    cur += interval;
  }
  return slots;
}

function sendSMS() { return { success: true, mock: true }; }
function formatBookingSMS(booking, services) {
  const names = services.map(s => s.name).join(', ');
  const dateStr = new Date(booking.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  return `Hi ${booking.customerName}! Your booking at Nail It With Jockson is confirmed.\n\nServices: ${names}\nDate: ${dateStr}\nTime: ${booking.timeSlot}\nTotal: ${booking.totalPrice}\n\nSee you there!`;
}

// ── Route Handler ──────────────────────────────────────────────
exports.handler = async (event) => {
  await connectDB();

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS, body: '' };
  }

  // Strip /.netlify/functions/api prefix
  const fullPath = event.path.replace(/^\/\.netlify\/functions\/api/, '') || '/';
  const method = event.httpMethod;
  const body = parseBody(event);
  const params = event.queryStringParameters || {};

  try {
    // ── AUTH ───────────────────────────────────────────────────
    if (fullPath === '/auth/login' && method === 'POST') {
      const { username, password } = body;
      if (!username || !password) return json(400, { message: 'Username and password are required' });
      const user = await User.findOne({ username });
      if (!user || !(await user.comparePassword(password))) return json(401, { message: 'Invalid username or password' });
      const token = jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
      return json(200, { token, user: { id: user._id, username: user.username, role: user.role } });
    }

    if (fullPath === '/auth/me' && method === 'GET') {
      const user = await requireAuth(event);
      if (!user) return json(401, { message: 'Authentication required' });
      return json(200, { user: { id: user._id, username: user.username, role: user.role } });
    }

    // ── SERVICES ──────────────────────────────────────────────
    if (fullPath === '/services' && method === 'GET') {
      const services = await Service.find({ isActive: true }).sort({ createdAt: -1 });
      return json(200, services);
    }

    if (fullPath === '/services/all' && method === 'GET') {
      const user = await requireAuth(event);
      if (!user) return json(401, { message: 'Authentication required' });
      const services = await Service.find().sort({ createdAt: -1 });
      return json(200, services);
    }

    if (fullPath === '/services' && method === 'POST') {
      const user = await requireAuth(event);
      if (!user) return json(401, { message: 'Authentication required' });
      const { name, description, price, duration } = body;
      if (!name || !description || !price || !duration) return json(400, { message: 'All fields are required' });
      const service = new Service({ name, description, price, duration });
      await service.save();
      return json(201, service);
    }

    const svcIdMatch = fullPath.match(/^\/services\/([^/]+)$/);
    if (svcIdMatch && method === 'PUT') {
      const user = await requireAuth(event);
      if (!user) return json(401, { message: 'Authentication required' });
      const service = await Service.findByIdAndUpdate(svcIdMatch[1], body, { new: true, runValidators: true });
      if (!service) return json(404, { message: 'Service not found' });
      return json(200, service);
    }

    const svcToggleMatch = fullPath.match(/^\/services\/([^/]+)\/toggle$/);
    if (svcToggleMatch && method === 'PATCH') {
      const user = await requireAuth(event);
      if (!user) return json(401, { message: 'Authentication required' });
      const service = await Service.findById(svcToggleMatch[1]);
      if (!service) return json(404, { message: 'Service not found' });
      service.isActive = !service.isActive;
      await service.save();
      return json(200, service);
    }

    if (svcIdMatch && method === 'DELETE') {
      const user = await requireAuth(event);
      if (!user) return json(401, { message: 'Authentication required' });
      const service = await Service.findByIdAndDelete(svcIdMatch[1]);
      if (!service) return json(404, { message: 'Service not found' });
      return json(200, { message: 'Service deleted' });
    }

    // ── AVAILABILITY ──────────────────────────────────────────
    if (fullPath === '/availability/settings' && method === 'GET') {
      const user = await requireAuth(event);
      if (!user) return json(401, { message: 'Authentication required' });
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
          }, slotInterval: 60
        });
        await settings.save();
      }
      return json(200, settings);
    }

    if (fullPath === '/availability/settings' && method === 'PUT') {
      const user = await requireAuth(event);
      if (!user) return json(401, { message: 'Authentication required' });
      let settings = await Settings.findOne();
      if (!settings) settings = new Settings(body);
      else Object.assign(settings, body);
      await settings.save();
      return json(200, settings);
    }

    const availDateMatch = fullPath.match(/^\/availability\/dates\/(\d+)\/(\d+)$/);
    if (availDateMatch && method === 'GET') {
      const [, year, month] = availDateMatch;
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);
      const availability = await Availability.find({ date: { $gte: startDate, $lte: endDate } }).sort({ date: 1 });
      return json(200, availability);
    }

    const availSlotMatch = fullPath.match(/^\/availability\/slots\/(.+)$/);
    if (availSlotMatch && method === 'GET') {
      const date = new Date(availSlotMatch[1]);
      date.setHours(0, 0, 0, 0);
      let availability = await Availability.findOne({ date });
      if (!availability) {
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const dayName = dayNames[date.getDay()];
        const settings = await Settings.findOne();
        if (!settings || !settings.creativeHours[dayName]?.isOpen) return json(200, { isOpen: false, timeSlots: [] });
        const { open, close } = settings.creativeHours[dayName];
        const timeSlots = generateTimeSlots(open, close, settings.slotInterval || 60);
        availability = new Availability({ date, isOpen: true, timeSlots, slotInterval: settings.slotInterval || 60 });
        await availability.save();
      }
      return json(200, availability);
    }

    if (fullPath === '/availability/generate' && method === 'POST') {
      const user = await requireAuth(event);
      if (!user) return json(401, { message: 'Authentication required' });
      const { startDate, endDate } = body;
      if (!startDate || !endDate) return json(400, { message: 'Start and end dates are required' });
      const settings = await Settings.findOne();
      if (!settings) return json(400, { message: 'Settings not configured' });
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
          if (existing) { existing.isOpen = false; existing.timeSlots = []; await existing.save(); results.push(existing); }
          continue;
        }
        const timeSlots = generateTimeSlots(hours.open, hours.close, settings.slotInterval);
        let availability = await Availability.findOne({ date });
        if (availability) { availability.isOpen = true; availability.timeSlots = timeSlots; availability.slotInterval = settings.slotInterval; }
        else availability = new Availability({ date, isOpen: true, timeSlots, slotInterval: settings.slotInterval });
        await availability.save();
        results.push(availability);
      }
      return json(200, results);
    }

    const availUpdateMatch = fullPath.match(/^\/availability\/(\d{4}-\d{2}-\d{2})$/);
    if (availUpdateMatch && method === 'PUT') {
      const user = await requireAuth(event);
      if (!user) return json(401, { message: 'Authentication required' });
      const date = new Date(availUpdateMatch[1]);
      date.setHours(0, 0, 0, 0);
      let availability = await Availability.findOne({ date });
      if (!availability) return json(404, { message: 'No availability found for this date' });
      Object.assign(availability, body);
      await availability.save();
      return json(200, availability);
    }

    // ── BOOKINGS ──────────────────────────────────────────────
    const bookingSlotMatch = fullPath.match(/^\/bookings\/slots\/(.+)$/);
    if (bookingSlotMatch && method === 'GET') {
      const date = new Date(bookingSlotMatch[1]);
      date.setHours(0, 0, 0, 0);
      const availability = await Availability.findOne({ date });
      if (!availability || !availability.isOpen) return json(200, { isOpen: false, slots: [] });
      const slots = availability.timeSlots.map(s => ({ ...s, isAvailable: s.isAvailable && s.currentBookings < s.maxBookings }));
      return json(200, { isOpen: true, slots, slotInterval: availability.slotInterval });
    }

    if (fullPath === '/bookings' && method === 'POST') {
      const { customerName, customerEmail, customerPhone, services: serviceIds, date, timeSlot, notes } = body;
      if (!customerName || !customerEmail || !customerPhone || !serviceIds?.length || !date || !timeSlot)
        return json(400, { message: 'All required fields must be provided' });

      const selectedServices = await Service.find({ _id: { $in: serviceIds }, isActive: true });
      if (selectedServices.length !== serviceIds.length) return json(400, { message: 'One or more selected services are unavailable' });

      const bookingDate = new Date(date);
      bookingDate.setHours(0, 0, 0, 0);

      const availability = await Availability.findOne({ date: bookingDate });
      if (!availability || !availability.isOpen) return json(400, { message: 'This date is not available for booking' });

      const slot = availability.timeSlots.find(s => s.startTime === timeSlot);
      if (!slot) return json(400, { message: 'Invalid time slot' });
      if (slot.currentBookings >= slot.maxBookings) return json(400, { message: 'This time slot is fully booked' });

      const existingBooking = await Booking.findOne({ date: bookingDate, timeSlot, status: { $in: ['pending', 'confirmed'] } });
      if (existingBooking) return json(400, { message: 'This time slot is already booked' });

      const totalPrice = selectedServices.reduce((sum, s) => sum + s.price, 0);
      const totalDuration = selectedServices.reduce((sum, s) => sum + s.duration, 0);

      const booking = new Booking({ customerName, customerEmail, customerPhone, services: serviceIds, date: bookingDate, timeSlot, totalPrice, totalDuration, notes: notes || '' });
      await booking.save();

      slot.currentBookings += 1;
      if (slot.currentBookings >= slot.maxBookings) slot.isAvailable = false;
      await availability.save();

      const smsMessage = formatBookingSMS(booking, selectedServices);
      const smsResult = sendSMS();
      if (smsResult.success) { booking.smsSent = true; await booking.save(); }

      const settings = await Settings.findOne();
      const messengerPageId = settings?.messengerPageId || process.env.MESSENGER_PAGE_ID || '100069308407532';
      const bookingSummary = {
        services: selectedServices.map(s => s.name).join(', '),
        date: new Date(date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
        time: timeSlot
      };
      const refData = encodeURIComponent(JSON.stringify(bookingSummary));
      const messengerUrl = `https://m.me/${messengerPageId}?ref=${refData}`;

      return json(201, { booking, messengerUrl, smsStatus: smsResult.mock ? 'mock' : 'sent' });
    }

    // ── ADMIN ─────────────────────────────────────────────────
    if (fullPath === '/admin/dashboard' && method === 'GET') {
      const user = await requireAuth(event);
      if (!user) return json(401, { message: 'Authentication required' });
      const totalBookings = await Booking.countDocuments({ status: { $in: ['pending', 'confirmed'] } });
      const completedBookings = await Booking.countDocuments({ status: 'completed' });
      const cancelledBookings = await Booking.countDocuments({ status: 'cancelled' });
      const totalServices = await Service.countDocuments({ isActive: true });
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const todayBookings = await Booking.countDocuments({ date: today, status: { $in: ['pending', 'confirmed'] } });
      const recentBookings = await Booking.find().populate('services').sort({ createdAt: -1 }).limit(5);
      return json(200, {
        stats: { totalBookings, completedBookings, cancelledBookings, totalServices, todayBookings },
        recentBookings
      });
    }

    if (fullPath === '/admin/bookings' && method === 'GET') {
      const user = await requireAuth(event);
      if (!user) return json(401, { message: 'Authentication required' });
      const { page = 1, limit = 20, status, date, search, sortBy = 'date', sortOrder = 'desc' } = params;
      const filter = {};
      if (status) filter.status = status;
      if (date) { const d = new Date(date); d.setHours(0,0,0,0); const nd = new Date(d); nd.setDate(nd.getDate()+1); filter.date = { $gte: d, $lt: nd }; }
      if (search) filter.$or = [{ customerName: { $regex: search, $options: 'i' } }, { customerEmail: { $regex: search, $options: 'i' } }];
      const sort = {}; sort[sortBy] = sortOrder === 'asc' ? 1 : -1;
      const bookings = await Booking.find(filter).populate('services').sort(sort).skip((parseInt(page)-1)*parseInt(limit)).limit(parseInt(limit));
      const total = await Booking.countDocuments(filter);
      return json(200, { bookings, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
    }

    const adminStatusMatch = fullPath.match(/^\/admin\/bookings\/([^/]+)\/status$/);
    if (adminStatusMatch && method === 'PATCH') {
      const user = await requireAuth(event);
      if (!user) return json(401, { message: 'Authentication required' });
      const { status } = body;
      if (!['pending', 'confirmed', 'completed', 'cancelled'].includes(status)) return json(400, { message: 'Invalid status' });
      const booking = await Booking.findById(adminStatusMatch[1]);
      if (!booking) return json(404, { message: 'Booking not found' });
      const prev = booking.status;
      booking.status = status;
      await booking.save();
      if (status === 'cancelled' && prev !== 'cancelled') {
        const availability = await Availability.findOne({ date: booking.date });
        if (availability) {
          const slot = availability.timeSlots.find(s => s.startTime === booking.timeSlot);
          if (slot && slot.currentBookings > 0) { slot.currentBookings -= 1; slot.isAvailable = true; await availability.save(); }
        }
      }
      return json(200, booking);
    }

    if (fullPath === '/admin/calendar' && method === 'GET') {
      const user = await requireAuth(event);
      if (!user) return json(401, { message: 'Authentication required' });
      const { year, month } = params;
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);
      const bookings = await Booking.find({ date: { $gte: startDate, $lte: endDate }, status: { $in: ['pending', 'confirmed'] } }).populate('services');
      const calendarData = {};
      bookings.forEach(b => {
        const key = b.date.toISOString().split('T')[0];
        if (!calendarData[key]) calendarData[key] = { count: 0, bookings: [], totalRevenue: 0 };
        calendarData[key].count += 1;
        calendarData[key].bookings.push(b);
        calendarData[key].totalRevenue += b.totalPrice;
      });
      return json(200, calendarData);
    }

    return json(404, { message: 'Not found' });
  } catch (error) {
    console.error('API error:', error);
    return json(500, { message: 'Server error' });
  }
};
