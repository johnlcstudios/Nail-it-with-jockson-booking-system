import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../services/api';
import './AdminDashboard.css';

function AdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className="admin-page">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h2>Nail It With Jockson</h2>
          <span className="badge badge-pink">Admin</span>
        </div>
        <nav className="sidebar-nav">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: '📊' },
            { id: 'bookings', label: 'Bookings', icon: '📅' },
            { id: 'calendar', label: 'Calendar', icon: '🗓' },
            { id: 'services', label: 'Services', icon: '💅' },
            { id: 'availability', label: 'Creative Hours', icon: '⏰' }
          ].map(item => (
            <button
              key={item.id}
              className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => setActiveTab(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span className="user-name">{user?.username}</span>
          <button className="btn btn-outline btn-sm" onClick={handleLogout}>Logout</button>
        </div>
      </aside>
      <main className="main-content">
        <header className="content-header">
          <h1>{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</h1>
        </header>
        <div className="content-body">
          {activeTab === 'dashboard' && <DashboardView />}
          {activeTab === 'bookings' && <BookingsView />}
          {activeTab === 'calendar' && <CalendarView />}
          {activeTab === 'services' && <ServicesView />}
          {activeTab === 'availability' && <AvailabilityView />}
        </div>
      </main>
    </div>
  );
}

function DashboardView() {
  const [stats, setStats] = useState(null);
  const [recentBookings, setRecentBookings] = useState([]);

  useEffect(() => {
    api.get('/admin/dashboard').then(res => {
      setStats(res.data.stats);
      setRecentBookings(res.data.recentBookings);
    }).catch(() => toast.error('Failed to load dashboard'));
  }, []);

  if (!stats) return <div className="loading"><div className="spinner"></div></div>;

  return (
    <div className="dashboard-view">
      <div className="stats-grid">
        {[
          { label: 'Active Bookings', value: stats.totalBookings, color: 'pink' },
          { label: "Today's Bookings", value: stats.todayBookings, color: 'teal' },
          { label: 'Completed', value: stats.completedBookings, color: 'success' },
          { label: 'Cancelled', value: stats.cancelledBookings, color: 'danger' },
          { label: 'Active Services', value: stats.totalServices, color: 'gray' }
        ].map((stat, i) => (
          <div key={i} className={`stat-card card stat-${stat.color}`}>
            <div className="stat-value">{stat.value}</div>
            <div className="stat-label">{stat.label}</div>
          </div>
        ))}
      </div>
      <div className="recent-section">
        <h3>Recent Bookings</h3>
        <div className="card">
          {recentBookings.length === 0 ? (
            <p className="empty-text">No bookings yet</p>
          ) : (
            <div className="recent-list">
              {recentBookings.map(b => (
                <div key={b._id} className="recent-item">
                  <div className="recent-info">
                    <strong>{b.customerName}</strong>
                    <span>{b.services?.map(s => s.name).join(', ')}</span>
                  </div>
                  <div className="recent-meta">
                    <span className={`badge badge-${b.status === 'confirmed' ? 'teal' : b.status === 'completed' ? 'success' : b.status === 'cancelled' ? 'danger' : 'warning'}`}>
                      {b.status}
                    </span>
                    <span className="recent-date">{new Date(b.date).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function BookingsView() {
  const [bookings, setBookings] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [filters, setFilters] = useState({ search: '', status: '', date: '', page: 1 });
  const [loading, setLoading] = useState(false);

  const loadBookings = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.search) params.set('search', filters.search);
      if (filters.status) params.set('status', filters.status);
      if (filters.date) params.set('date', filters.date);
      params.set('page', filters.page);
      params.set('limit', '15');

      const res = await api.get(`/admin/bookings?${params}`);
      setBookings(res.data.bookings);
      setPagination({ page: res.data.page, pages: res.data.pages, total: res.data.total });
    } catch {
      toast.error('Failed to load bookings');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { loadBookings(); }, [loadBookings]);

  const updateStatus = async (id, status) => {
    try {
      await api.patch(`/admin/bookings/${id}/status`, { status });
      toast.success(`Booking ${status}`);
      loadBookings();
    } catch {
      toast.error('Failed to update booking');
    }
  };

  return (
    <div className="bookings-view">
      <div className="filters-bar">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search by name or email..."
            value={filters.search}
            onChange={e => setFilters({ ...filters, search: e.target.value, page: 1 })}
          />
        </div>
        <select value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value, page: 1 })}>
          <option value="">All Status</option>
          <option value="confirmed">Confirmed</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <input
          type="date"
          value={filters.date}
          onChange={e => setFilters({ ...filters, date: e.target.value, page: 1 })}
        />
      </div>

      <div className="bookings-table-wrap card">
        {loading ? (
          <div className="loading"><div className="spinner"></div></div>
        ) : bookings.length === 0 ? (
          <p className="empty-text">No bookings found</p>
        ) : (
          <>
            <div className="table-responsive">
              <table className="bookings-table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Contact</th>
                    <th>Services</th>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Total</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map(b => (
                    <tr key={b._id}>
                      <td><strong>{b.customerName}</strong></td>
                      <td>
                        <div className="contact-cell">
                          <span>{b.customerEmail}</span>
                          <span>{b.customerPhone}</span>
                        </div>
                      </td>
                      <td>{b.services?.map(s => s.name).join(', ')}</td>
                      <td>{new Date(b.date).toLocaleDateString()}</td>
                      <td>{b.timeSlot}</td>
                      <td>₱{b.totalPrice}</td>
                      <td>
                        <span className={`badge badge-${b.status === 'confirmed' ? 'teal' : b.status === 'completed' ? 'success' : b.status === 'cancelled' ? 'danger' : 'warning'}`}>
                          {b.status}
                        </span>
                      </td>
                      <td>
                        <div className="action-buttons">
                          {b.status !== 'completed' && b.status !== 'cancelled' && (
                            <>
                              <button className="btn btn-sm btn-secondary" onClick={() => updateStatus(b._id, 'completed')}>Complete</button>
                              <button className="btn btn-sm btn-danger" onClick={() => updateStatus(b._id, 'cancelled')}>Cancel</button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="pagination">
              <span className="page-info">Page {pagination.page} of {pagination.pages} ({pagination.total} total)</span>
              <div className="page-buttons">
                <button className="btn btn-outline btn-sm" disabled={pagination.page <= 1} onClick={() => setFilters({ ...filters, page: filters.page - 1 })}>Prev</button>
                <button className="btn btn-outline btn-sm" disabled={pagination.page >= pagination.pages} onClick={() => setFilters({ ...filters, page: filters.page + 1 })}>Next</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function CalendarView() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [calendarData, setCalendarData] = useState({});
  const [selectedDay, setSelectedDay] = useState(null);

  const loadCalendar = useCallback(async () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth() + 1;
    try {
      const res = await api.get(`/admin/calendar?year=${year}&month=${month}`);
      setCalendarData(res.data);
    } catch {
      toast.error('Failed to load calendar');
    }
  }, [currentMonth]);

  useEffect(() => { loadCalendar(); }, [loadCalendar]);

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return { firstDay, daysInMonth };
  };

  const { firstDay, daysInMonth } = getDaysInMonth(currentMonth);
  const monthName = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const selectedData = selectedDay ? calendarData[selectedDay] : null;

  return (
    <div className="calendar-view">
      <div className="calendar-layout">
        <div className="calendar-panel card">
          <div className="calendar-header">
            <button className="btn btn-outline btn-sm" onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}>&#8249;</button>
            <h3>{monthName}</h3>
            <button className="btn btn-outline btn-sm" onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}>&#8250;</button>
          </div>
          <div className="admin-calendar-grid">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} className="cal-day-header">{d}</div>
            ))}
            {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} className="cal-day empty"></div>)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateStr = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day).toISOString().split('T')[0];
              const data = calendarData[dateStr];
              const isSelected = selectedDay === dateStr;
              return (
                <div
                  key={day}
                  className={`cal-day ${data ? 'has-bookings' : ''} ${isSelected ? 'selected' : ''}`}
                  onClick={() => setSelectedDay(dateStr)}
                >
                  <span className="cal-day-num">{day}</span>
                  {data && <span className="cal-day-count">{data.count}</span>}
                </div>
              );
            })}
          </div>
        </div>

        <div className="day-detail">
          {selectedData ? (
            <div className="card">
              <h3>Bookings for {new Date(selectedDay + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</h3>
              <div className="day-stats">
                <span>{selectedData.count} booking(s)</span>
                <span>Revenue: ₱{selectedData.totalRevenue}</span>
              </div>
              <div className="day-bookings">
                {selectedData.bookings.map(b => (
                  <div key={b._id} className="day-booking-item">
                    <div className="day-booking-info">
                      <strong>{b.customerName}</strong>
                      <span>{b.timeSlot} · {b.services?.map(s => s.name).join(', ')}</span>
                    </div>
                    <span className={`badge badge-${b.status === 'confirmed' ? 'teal' : 'warning'}`}>{b.status}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="card empty-calendar-detail">
              <p>{selectedDay ? 'No bookings for this date' : 'Select a date to view bookings'}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ServicesView() {
  const [services, setServices] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '', price: '', duration: '' });

  const loadServices = async () => {
    try {
      const res = await api.get('/services/all');
      setServices(res.data);
    } catch { toast.error('Failed to load services'); }
  };

  useEffect(() => { loadServices(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...formData, price: Number(formData.price), duration: Number(formData.duration) };
      if (editingService) {
        await api.put(`/services/${editingService._id}`, payload);
        toast.success('Service updated');
      } else {
        await api.post('/services', payload);
        toast.success('Service created');
      }
      setShowForm(false);
      setEditingService(null);
      setFormData({ name: '', description: '', price: '', duration: '' });
      loadServices();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save service');
    }
  };

  const handleEdit = (service) => {
    setEditingService(service);
    setFormData({ name: service.name, description: service.description, price: service.price, duration: service.duration });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this service?')) return;
    try {
      await api.delete(`/services/${id}`);
      toast.success('Service deleted');
      loadServices();
    } catch { toast.error('Failed to delete service'); }
  };

  const handleToggle = async (id) => {
    try {
      await api.patch(`/services/${id}/toggle`);
      toast.success('Service visibility toggled');
      loadServices();
    } catch { toast.error('Failed to toggle service'); }
  };

  return (
    <div className="services-view">
      <div className="view-header">
        <button className="btn btn-primary" onClick={() => { setShowForm(!showForm); setEditingService(null); setFormData({ name: '', description: '', price: '', duration: '' }); }}>
          {showForm ? 'Cancel' : '+ Add Service'}
        </button>
      </div>

      {showForm && (
        <div className="service-form card">
          <h3>{editingService ? 'Edit Service' : 'New Service'}</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="input-group">
                <label>Service Name</label>
                <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
              </div>
              <div className="input-group">
                <label>Price (₱)</label>
                <input type="number" value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} required min="0" />
              </div>
              <div className="input-group">
                <label>Duration (minutes)</label>
                <input type="number" value={formData.duration} onChange={e => setFormData({ ...formData, duration: e.target.value })} required min="15" step="15" />
              </div>
              <div className="input-group full-width">
                <label>Description</label>
                <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} required rows="3" />
              </div>
            </div>
            <button className="btn btn-primary" type="submit">{editingService ? 'Update' : 'Create'} Service</button>
          </form>
        </div>
      )}

      <div className="services-list">
        {services.map(service => (
          <div key={service._id} className={`service-list-item card ${!service.isActive ? 'inactive' : ''}`}>
            <div className="service-list-info">
              <div className="service-list-header">
                <h4>{service.name}</h4>
                <span className={`badge ${service.isActive ? 'badge-success' : 'badge-gray'}`}>
                  {service.isActive ? 'Active' : 'Hidden'}
                </span>
              </div>
              <p>{service.description}</p>
              <div className="service-list-meta">
                <span className="service-price">₱{service.price}</span>
                <span className="service-duration">{service.duration} min</span>
              </div>
            </div>
            <div className="service-list-actions">
              <button className="btn btn-outline btn-sm" onClick={() => handleToggle(service._id)}>
                {service.isActive ? 'Hide' : 'Show'}
              </button>
              <button className="btn btn-outline btn-sm" onClick={() => handleEdit(service)}>Edit</button>
              <button className="btn btn-danger btn-sm" onClick={() => handleDelete(service._id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AvailabilityView() {
  const [settings, setSettings] = useState(null);
  const [generateForm, setGenerateForm] = useState({ startDate: '', endDate: '' });

  useEffect(() => {
    api.get('/availability/settings').then(res => setSettings(res.data)).catch(() => toast.error('Failed to load settings'));
  }, []);

  const updateSettings = async (newData) => {
    try {
      const res = await api.put('/availability/settings', newData);
      setSettings(res.data);
      toast.success('Settings saved');
    } catch { toast.error('Failed to save settings'); }
  };

  const handleHoursChange = (day, field, value) => {
    const updated = { ...settings, creativeHours: { ...settings.creativeHours, [day]: { ...settings.creativeHours[day], [field]: value } } };
    setSettings(updated);
    updateSettings(updated);
  };

  const handleIntervalChange = (value) => {
    const updated = { ...settings, slotInterval: Number(value) };
    setSettings(updated);
    updateSettings(updated);
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!generateForm.startDate || !generateForm.endDate) {
      toast.warning('Please select start and end dates');
      return;
    }
    try {
      await api.post('/availability/generate', generateForm);
      toast.success('Availability generated for selected dates');
      setGenerateForm({ startDate: '', endDate: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to generate availability');
    }
  };

  if (!settings) return <div className="loading"><div className="spinner"></div></div>;

  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

  return (
    <div className="availability-view">
      <div className="availability-section">
        <h3>Creative Hours</h3>
        <p className="section-desc">Set your working hours for each day. These hours determine when customers can book appointments.</p>
        <div className="hours-grid">
          {days.map(day => (
            <div key={day} className={`hours-card card ${!settings.creativeHours[day]?.isOpen ? 'closed' : ''}`}>
              <div className="hours-header">
                <span className="day-name">{day.charAt(0).toUpperCase() + day.slice(1)}</span>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={settings.creativeHours[day]?.isOpen || false}
                    onChange={e => handleHoursChange(day, 'isOpen', e.target.checked)}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
              {settings.creativeHours[day]?.isOpen && (
                <div className="hours-times">
                  <input
                    type="time"
                    value={settings.creativeHours[day]?.open || '09:00'}
                    onChange={e => handleHoursChange(day, 'open', e.target.value)}
                  />
                  <span>to</span>
                  <input
                    type="time"
                    value={settings.creativeHours[day]?.close || '18:00'}
                    onChange={e => handleHoursChange(day, 'close', e.target.value)}
                  />
                </div>
              )}
              {!settings.creativeHours[day]?.isOpen && (
                <div className="closed-label">Closed</div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="availability-section">
        <h3>Slot Interval</h3>
        <p className="section-desc">Set the time interval between booking slots.</p>
        <div className="interval-setting card">
          <select value={settings.slotInterval} onChange={e => handleIntervalChange(e.target.value)}>
            <option value={30}>Every 30 minutes</option>
            <option value={45}>Every 45 minutes</option>
            <option value={60}>Every 60 minutes</option>
            <option value={90}>Every 90 minutes</option>
            <option value={120}>Every 2 hours</option>
          </select>
        </div>
      </div>

      <div className="availability-section">
        <h3>Generate Availability</h3>
        <p className="section-desc">Generate time slots for a date range. This will create available slots based on your creative hours.</p>
        <form className="generate-form card" onSubmit={handleGenerate}>
          <div className="form-row">
            <div className="input-group">
              <label>Start Date</label>
              <input type="date" value={generateForm.startDate} onChange={e => setGenerateForm({ ...generateForm, startDate: e.target.value })} required />
            </div>
            <div className="input-group">
              <label>End Date</label>
              <input type="date" value={generateForm.endDate} onChange={e => setGenerateForm({ ...generateForm, endDate: e.target.value })} required />
            </div>
            <button className="btn btn-primary" type="submit">Generate Slots</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AdminDashboard;
