# Nail It With Jockson - Booking Web App

A complete booking web application for the Nail It With Jockson salon.

## Tech Stack
- **Frontend:** React.js
- **Backend:** Node.js + Express
- **Database:** MongoDB (Mongoose)
- **Deployment:** Render.com

## Features

### Customer Side
- Browse all available nail services
- Select one or more services
- Pick an available date and time slot
- Enter contact info and confirm booking
- Redirect to Messenger after successful booking
- SMS confirmation (mock/real via Twilio)

### Admin Panel
- Dashboard with booking stats
- Manage services (CRUD + visibility toggle)
- Manage creative hours (working hours per day)
- Set slot intervals (30/45/60/90/120 min)
- Generate availability for date ranges
- View all bookings with search and filters
- Calendar view for daily booking distribution
- Mark bookings as completed or cancelled

## Default Admin Credentials
- **Username:** admin
- **Password:** JocksonNail2026!

## Local Development

```bash
# Install dependencies
npm install
cd client && npm install && cd ..

# Seed the database
node server/seed.js

# Start development
npm run dev
```

## Render.com Deployment

1. Push this repository to GitHub
2. Connect to Render.com
3. Create a new Web Service
4. Use the following settings:
   - Build Command: `cd client && npm install && npm run build && cd .. && npm install`
   - Start Command: `node server/index.js`
5. Add environment variables (see render.yaml)
6. Deploy

## Environment Variables

| Variable | Description |
|----------|-------------|
| MONGODB_URI | MongoDB connection string |
| JWT_SECRET | Secret for JWT tokens |
| ADMIN_USERNAME | Admin login username |
| ADMIN_PASSWORD | Admin login password |
| MESSENGER_PAGE_ID | Facebook Messenger page ID |
| SMS_ENABLED | Enable real SMS (true/false) |
| TWILIO_ACCOUNT_SID | Twilio account SID |
| TWILIO_AUTH_TOKEN | Twilio auth token |
| TWILIO_PHONE_NUMBER | Twilio phone number |
