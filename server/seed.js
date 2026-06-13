const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('./models/User');
const Service = require('./models/Service');
const Settings = require('./models/Settings');

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    let admin = await User.findOne({ username: 'admin' });
    if (!admin) {
      admin = new User({
        username: 'admin',
        password: process.env.ADMIN_PASSWORD || 'JocksonNail2026!',
        role: 'admin'
      });
      await admin.save();
      console.log('Admin user created');
    }

    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings({
        salonName: 'Nail It With Jockson',
        creativeHours: {
          monday: { open: '09:00', close: '18:00', isOpen: true },
          tuesday: { open: '09:00', close: '18:00', isOpen: true },
          wednesday: { open: '09:00', close: '18:00', isOpen: true },
          thursday: { open: '09:00', close: '18:00', isOpen: true },
          friday: { open: '09:00', close: '18:00', isOpen: true },
          saturday: { open: '09:00', close: '18:00', isOpen: true },
          sunday: { open: '10:00', close: '16:00', isOpen: false }
        },
        slotInterval: 60,
        messengerPageId: '100069308407532'
      });
      await settings.save();
      console.log('Settings created');
    }

    const serviceCount = await Service.countDocuments();
    if (serviceCount === 0) {
      const services = [
        { name: 'Classic Manicure', description: 'A relaxing hand soak, nail shaping, cuticle care, hand massage, and polish application.', price: 350, duration: 45, isActive: true },
        { name: 'Classic Pedicure', description: 'A rejuvenating foot soak, nail shaping, cuticle care, foot massage, and polish application.', price: 450, duration: 60, isActive: true },
        { name: 'Gel Manicure', description: 'Long-lasting gel polish application with cuticle care and hand massage for chips-free nails up to 3 weeks.', price: 500, duration: 60, isActive: true },
        { name: 'Gel Pedicure', description: 'Premium gel polish pedicure with exfoliation, moisturizing treatment, and long-lasting color.', price: 600, duration: 75, isActive: true },
        { name: 'Acrylic Full Set', description: 'Full set of acrylic nails with your choice of shape, length, and design. Includes cuticle care.', price: 800, duration: 120, isActive: true },
        { name: 'Acrylic Fill-in', description: 'Maintenance fill for existing acrylic nails. Rebalance, reshape, and polish.', price: 500, duration: 90, isActive: true },
        { name: 'Nail Art Design', description: 'Custom nail art design including hand-painted art, rhinestones, foils, or chrome powder.', price: 200, duration: 30, isActive: true },
        { name: 'Spa Manicure', description: 'Luxury spa treatment with sugar scrub, hot towel wrap, paraffin dip, and extended massage.', price: 600, duration: 75, isActive: true },
        { name: 'Spa Pedicure', description: 'Ultimate spa pedicure with exfoliation, hot stone massage, paraffin treatment, and moisturizing mask.', price: 700, duration: 90, isActive: true },
        { name: 'Gel Removal', description: 'Safe and gentle removal of gel or acrylic nails with nourishing cuticle oil treatment.', price: 150, duration: 30, isActive: true },
        { name: 'Dip Powder Manicure', description: 'Lightweight, durable dip powder nails with vibrant color that lasts up to 4 weeks.', price: 550, duration: 60, isActive: true },
        { name: 'Kids Manicure', description: 'Fun and gentle manicure for little ones. Includes nail shaping, light massage, and fun polish colors.', price: 200, duration: 30, isActive: true }
      ];
      await Service.insertMany(services);
      console.log('Services seeded');
    }

    console.log('Seed complete!');
    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
};

seed();
