# Tourism Backend API

Node.js and Express REST API for Local Tourism Management System.

## Features

- User authentication (JWT)
- Guide experience management
- Tourist booking system
- Revenue distribution tracking
- Review and rating system
- Admin analytics

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/register | Register new user |
| POST | /api/auth/login | Login user |
| GET | /api/experiences | List all experiences |
| GET | /api/experiences/:id | Get single experience |
| POST | /api/experiences | Create experience (guide only) |
| POST | /api/bookings | Create booking (tourist only) |
| GET | /api/bookings | Get my bookings |
| POST | /api/reviews | Submit review |
| GET | /api/analytics/revenue | Revenue analytics |

## Deployment to Render

1. Go to [render.com](https://render.com)
2. Create new Web Service
3. Connect this GitHub repository
4. Set environment variables (see .env.example)
5. Deploy

## Environment Variables

| Variable | Description |
|----------|-------------|
| DB_HOST | MySQL host from Railway |
| DB_USER | Database username |
| DB_PASSWORD | Database password |
| DB_NAME | tourism_db |
| JWT_SECRET | Secret key for tokens |
| PORT | Server port (Render sets this) |
