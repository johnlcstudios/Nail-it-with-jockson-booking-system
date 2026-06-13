const sendSMS = async (to, message) => {
  if (process.env.SMS_ENABLED !== 'true') {
    console.log(`[MOCK SMS] To: ${to}\nMessage: ${message}`);
    return { success: true, mock: true, to, message };
  }

  try {
    const twilio = require('twilio');
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    const result = await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: to
    });
    return { success: true, sid: result.sid };
  } catch (error) {
    console.error('SMS error:', error);
    return { success: false, error: error.message };
  }
};

const formatBookingSMS = (booking, services) => {
  const serviceNames = services.map(s => s.name).join(', ');
  const dateStr = new Date(booking.date).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
  return `Hi ${booking.customerName}! Your booking at Nail It With Jockson is confirmed.\n\nServices: ${serviceNames}\nDate: ${dateStr}\nTime: ${booking.timeSlot}\nTotal: ₱${booking.totalPrice}\n\nSee you there! 💅`;
};

module.exports = { sendSMS, formatBookingSMS };
