import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import api from '../services/api';
import './HomePage.css';

function HomePage() {
  const [services, setServices] = useState([]);
  const [selectedServices, setSelectedServices] = useState([]);
  const [step, setStep] = useState(1);
  const [selectedDate, setSelectedDate] = useState('');
  const [availableSlots, setAvailableSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [loadingBooking, setLoadingBooking] = useState(false);
  const [bookingResult, setBookingResult] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [calendarData, setCalendarData] = useState({});
  const [formData, setFormData] = useState({ customerName: '', customerEmail: '', customerPhone: '' });

  useEffect(() => {
    api.get('/services').then(res => setServices(res.data)).catch(() => toast.error('Failed to load services'));
  }, []);

  useEffect(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth() + 1;
    api.get(`/availability/dates/${year}/${month}`)
      .then(res => {
        const data = {};
        res.data.forEach(a => {
          const key = new Date(a.date).toISOString().split('T')[0];
          data[key] = a;
        });
        setCalendarData(data);
      })
      .catch(() => {});
  }, [currentMonth]);

  const toggleService = (service) => {
    setSelectedServices(prev =>
      prev.find(s => s._id === service._id)
        ? prev.filter(s => s._id !== service._id)
        : [...prev, service]
    );
  };

  const loadSlots = async (dateStr) => {
    setSelectedDate(dateStr);
    setSelectedSlot('');
    setLoadingSlots(true);
    try {
      const res = await api.get(`/bookings/slots/${dateStr}`);
      setAvailableSlots(res.data.isOpen ? res.data.slots.filter(s => s.isAvailable) : []);
      if (!res.data.isOpen) toast.info('Salon is closed on this date');
    } catch {
      toast.error('Failed to load time slots');
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleBooking = async () => {
    if (!formData.customerName || !formData.customerEmail || !formData.customerPhone) {
      toast.warning('Please fill in all contact information');
      return;
    }
    if (!selectedDate || !selectedSlot) {
      toast.warning('Please select a date and time');
      return;
    }
    if (selectedServices.length === 0) {
      toast.warning('Please select at least one service');
      return;
    }

    setLoadingBooking(true);
    try {
      const res = await api.post('/bookings', {
        customerName: formData.customerName,
        customerEmail: formData.customerEmail,
        customerPhone: formData.customerPhone,
        services: selectedServices.map(s => s._id),
        date: selectedDate,
        timeSlot: selectedSlot
      });
      setBookingResult(res.data);
      setStep(4);
      toast.success('Booking confirmed! Redirecting to Messenger...');

      setTimeout(() => {
        if (res.data.messengerUrl) {
          window.open(res.data.messengerUrl, '_blank');
        }
      }, 2000);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Booking failed. Please try again.');
    } finally {
      setLoadingBooking(false);
    }
  };

  const totalPrice = selectedServices.reduce((sum, s) => sum + s.price, 0);
  const totalDuration = selectedServices.reduce((sum, s) => sum + s.duration, 0);

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return { firstDay, daysInMonth };
  };

  const isDateAvailable = (day) => {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date < today) return false;
    const dateStr = date.toISOString().split('T')[0];
    const cal = calendarData[dateStr];
    return cal && cal.isOpen;
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  };

  const { firstDay, daysInMonth } = getDaysInMonth(currentMonth);
  const monthName = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  if (bookingResult) {
    return (
      <div className="home-page">
        <header className="hero">
          <div className="hero-content">
            <h1>Nail It With Jockson</h1>
            <p>Your nails, our passion</p>
          </div>
        </header>
        <div className="container">
          <div className="booking-success">
            <div className="success-icon">&#10003;</div>
            <h2>Booking Confirmed!</h2>
            <div className="success-details card">
              <p><strong>Services:</strong> {selectedServices.map(s => s.name).join(', ')}</p>
              <p><strong>Date:</strong> {formatDate(selectedDate)}</p>
              <p><strong>Time:</strong> {selectedSlot}</p>
              <p><strong>Total:</strong> ₱{totalPrice}</p>
              <p><strong>Status:</strong> <span className="badge badge-success">Confirmed</span></p>
            </div>
            <p className="messenger-note">You will be redirected to Messenger shortly for booking confirmation.</p>
            <button className="btn btn-primary btn-lg" onClick={() => {
              if (bookingResult.messengerUrl) window.open(bookingResult.messengerUrl, '_blank');
            }}>
              Open Messenger
            </button>
            <button className="btn btn-outline" style={{ marginTop: 12 }} onClick={() => {
              setBookingResult(null);
              setStep(1);
              setSelectedServices([]);
              setSelectedDate('');
              setSelectedSlot('');
              setFormData({ customerName: '', customerEmail: '', customerPhone: '' });
            }}>
              Book Another Appointment
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="home-page">
      <header className="hero">
        <div className="hero-content">
          <h1>Nail It With Jockson</h1>
          <p>Your nails, our passion</p>
        </div>
      </header>

      <div className="container">
        <div className="progress-bar">
          {['Select Services', 'Choose Date & Time', 'Your Details', 'Confirm'].map((label, i) => (
            <div key={i} className={`progress-step ${step > i + 1 ? 'completed' : ''} ${step === i + 1 ? 'active' : ''}`}>
              <div className="step-number">{step > i + 1 ? '&#10003;' : i + 1}</div>
              <span>{label}</span>
            </div>
          ))}
        </div>

        {step === 1 && (
          <section className="step-section">
            <h2>Choose Your Services</h2>
            <div className="services-grid">
              {services.map(service => (
                <div
                  key={service._id}
                  className={`service-card card ${selectedServices.find(s => s._id === service._id) ? 'selected' : ''}`}
                  onClick={() => toggleService(service)}
                >
                  <div className="service-header">
                    <h3>{service.name}</h3>
                    <div className="service-check">
                      {selectedServices.find(s => s._id === service._id) ? '&#10003;' : ''}
                    </div>
                  </div>
                  <p className="service-description">{service.description}</p>
                  <div className="service-meta">
                    <span className="service-price">₱{service.price}</span>
                    <span className="service-duration">{service.duration} min</span>
                  </div>
                </div>
              ))}
            </div>
            {selectedServices.length > 0 && (
              <div className="selection-summary card">
                <div className="summary-row">
                  <span>{selectedServices.length} service(s) selected</span>
                  <span className="summary-total">Total: ₱{totalPrice} · {totalDuration} min</span>
                </div>
                <button className="btn btn-primary" onClick={() => setStep(2)}>Continue</button>
              </div>
            )}
          </section>
        )}

        {step === 2 && (
          <section className="step-section">
            <h2>Pick a Date & Time</h2>
            <div className="booking-layout">
              <div className="calendar-section card">
                <div className="calendar-header">
                  <button className="btn btn-outline btn-sm" onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}>&#8249;</button>
                  <h3>{monthName}</h3>
                  <button className="btn btn-outline btn-sm" onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}>&#8250;</button>
                </div>
                <div className="calendar-grid">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                    <div key={d} className="calendar-day-header">{d}</div>
                  ))}
                  {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} className="calendar-day empty"></div>)}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
                    const dateStr = date.toISOString().split('T')[0];
                    const available = isDateAvailable(day);
                    const isSelected = selectedDate === dateStr;
                    return (
                      <div
                        key={day}
                        className={`calendar-day ${available ? 'available' : 'unavailable'} ${isSelected ? 'selected' : ''}`}
                        onClick={() => available && loadSlots(dateStr)}
                      >
                        {day}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="time-slots-section">
                <h3>{selectedDate ? formatDate(selectedDate) : 'Select a date'}</h3>
                {loadingSlots ? (
                  <div className="loading-slots"><div className="spinner"></div></div>
                ) : selectedDate && availableSlots.length === 0 ? (
                  <p className="no-slots">No available time slots for this date</p>
                ) : (
                  <div className="time-slots-grid">
                    {availableSlots.map(slot => (
                      <button
                        key={slot.startTime}
                        className={`time-slot ${selectedSlot === slot.startTime ? 'selected' : ''}`}
                        onClick={() => setSelectedSlot(slot.startTime)}
                      >
                        {slot.startTime}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="step-actions">
              <button className="btn btn-outline" onClick={() => setStep(1)}>Back</button>
              <button
                className="btn btn-primary"
                disabled={!selectedDate || !selectedSlot}
                onClick={() => setStep(3)}
              >
                Continue
              </button>
            </div>
          </section>
        )}

        {step === 3 && (
          <section className="step-section">
            <h2>Your Information</h2>
            <div className="booking-layout">
              <div className="form-section card">
                <div className="input-group">
                  <label>Full Name</label>
                  <input
                    type="text"
                    placeholder="Juan Dela Cruz"
                    value={formData.customerName}
                    onChange={e => setFormData({ ...formData, customerName: e.target.value })}
                  />
                </div>
                <div className="input-group">
                  <label>Email Address</label>
                  <input
                    type="email"
                    placeholder="juan@email.com"
                    value={formData.customerEmail}
                    onChange={e => setFormData({ ...formData, customerEmail: e.target.value })}
                  />
                </div>
                <div className="input-group">
                  <label>Phone Number</label>
                  <input
                    type="tel"
                    placeholder="+63 912 345 6789"
                    value={formData.customerPhone}
                    onChange={e => setFormData({ ...formData, customerPhone: e.target.value })}
                  />
                </div>
              </div>
              <div className="summary-card card">
                <h3>Booking Summary</h3>
                <div className="summary-services">
                  {selectedServices.map(s => (
                    <div key={s._id} className="summary-service-item">
                      <span>{s.name}</span>
                      <span>₱{s.price}</span>
                    </div>
                  ))}
                </div>
                <div className="summary-divider"></div>
                <div className="summary-detail"><span>Date</span><span>{formatDate(selectedDate)}</span></div>
                <div className="summary-detail"><span>Time</span><span>{selectedSlot}</span></div>
                <div className="summary-detail"><span>Duration</span><span>{totalDuration} min</span></div>
                <div className="summary-divider"></div>
                <div className="summary-detail total"><span>Total</span><span>₱{totalPrice}</span></div>
              </div>
            </div>
            <div className="step-actions">
              <button className="btn btn-outline" onClick={() => setStep(2)}>Back</button>
              <button
                className="btn btn-primary btn-lg"
                disabled={loadingBooking}
                onClick={handleBooking}
              >
                {loadingBooking ? 'Booking...' : 'Confirm Booking'}
              </button>
            </div>
          </section>
        )}
      </div>

      <footer className="footer">
        <div className="container">
          <p>&copy; 2026 Nail It With Jockson. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

export default HomePage;
