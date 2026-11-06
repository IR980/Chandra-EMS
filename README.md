
# Chandra Enterprises – Employee Management System

A centralized Employee Management System for Chandra Enterprises, built using the MERN stack.

## Project Information

- Project: Chandra Enterprises EMS
- Frontend: React.js + Vite
- Backend: Node.js + Express.js
- Database: MongoDB Atlas
- Styling: Tailwind CSS v4
- Authentication: JWT + bcryptjs
- State Management: Redux Toolkit
- API Client: Axios

## Project Structure

```text
chandra-ems/
├── client/
│   ├── public/
│   ├── src/
│   │   ├── assets/
│   │   ├── components/
│   │   ├── features/
│   │   ├── pages/
│   │   ├── services/
│   │   │   └── api.js
│   │   ├── store/
│   │   ├── App.jsx
│   │   ├── index.css
│   │   └── main.jsx
│   ├── .env
│   └── package.json
│
├── server/
│   ├── config/
│   │   ├── db.js
│   │   └── permissions.js
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   │   ├── user.model.js
│   │   └── role.model.js
│   ├── routes/
│   ├── scripts/
│   │   └── seedRoles.js
│   ├── services/
│   ├── utils/
│   ├── .env
│   ├── server.js
│   └── package.json
│
├── .gitignore
└── README.md
```

## Development Setup

### Backend

```bash
cd server
npm install
npm run dev
```

Backend URL:

http://localhost:5000

Health API:

http://localhost:5000/api/health

### Frontend

```bash
cd client
npm install
npm run dev
```

Frontend URL:

http://localhost:5173

Production build:

```bash
npm run build
```

## Environment Variables

### Server: server/.env

```env
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_secret
```

### Client: client/.env

```env
VITE_API_URL=http://localhost:5000/api
```

Never commit real environment credentials.

---

# Development Progress

## Phase 1 – Project Setup

- [x] Existing project inspection
- [x] React + Vite configuration
- [x] Express backend configuration
- [x] MongoDB Atlas connection
- [x] Tailwind CSS v4 setup
- [x] Axios API client setup
- [ ] Final production build verification

## Phase 2 – Authentication and Authorization

- [x] User MongoDB model
- [x] Role MongoDB model
- [x] Central permissions configuration
- [x] Default role seed script
- [ ] Verify model imports
- [ ] Seed default roles in MongoDB
- [ ] Password hashing
- [ ] Login and logout APIs
- [ ] JWT access and refresh tokens
- [ ] Token revocation
- [ ] Forgot and reset password
- [ ] Authentication frontend
- [ ] Protected routes
- [ ] Role-based access control
- [ ] Super Admin setup
- [ ] Authentication testing

## Phase 3 – Organization Management

- [ ] Business domain management
- [ ] Department management
- [ ] Sub-department management
- [ ] Designation management
- [ ] Reporting hierarchy
- [ ] Manager assignment

## Phase 4 – Employee Management

- [ ] Employee model
- [ ] Employee registration
- [ ] Employee profiles
- [ ] Employee search and filters
- [ ] Document management
- [ ] Employee transfers and archival

## Phase 5 – Attendance Management

- [ ] Check-in and check-out
- [ ] Shift management
- [ ] Attendance calculation
- [ ] Attendance correction
- [ ] Attendance reports

## Phase 6 – Leave Management

- [ ] Leave applications
- [ ] Leave balances
- [ ] Approval workflow
- [ ] Leave reports

## Phase 7 – Salary and Payroll

- [ ] Salary structure
- [ ] Payroll calculation
- [ ] Payroll approval
- [ ] Salary slips
- [ ] Payment tracking

## Phase 8 – Dashboards

- [ ] Super Admin dashboard
- [ ] Managing Director dashboard
- [ ] HR dashboard
- [ ] Department Manager dashboard
- [ ] Accounts dashboard
- [ ] Employee dashboard

## Phase 9 – Reports and Analytics

- [ ] Employee reports
- [ ] Attendance reports
- [ ] Payroll reports
- [ ] Analytics charts
- [ ] PDF and Excel exports

## Phase 10 – Testing and Deployment

- [ ] API testing
- [ ] Frontend testing
- [ ] Permission testing
- [ ] Security testing
- [ ] Production deployment

## Important Development Rules

1. Maintain existing project architecture.
2. Use reusable React components.
3. Use REST APIs for frontend-backend communication.
4. Validate all incoming API data.
5. Protect sensitive employee and payroll information.
6. Enforce permissions on the backend.
7. Maintain audit logs for sensitive operations.
8. Never store plain-text passwords.
9. Never commit `.env` credentials.
10. Preserve historical employee, attendance and payroll records.

---



### Step 4 – Password Hashing and JWT Utilities

**Status: Implementation completed; tests pending.**

Files created:

```text
server/
├── utils/
│   ├── password.util.js
│   └── token.util.js
│
└── scripts/
    ├── seedRoles.js
    ├── testPassword.js
    └── testToken.js
```

#### Password Security

- bcryptjs password hashing.
- Salt rounds: 12.
- Password comparison.
- Password validation.
- Minimum 8 characters.
- Maximum 128 characters.
- Uppercase and lowercase requirements.
- Number requirement.
- Special character requirement.

#### JWT Authentication

- Access token expiry: 15 minutes.
- Refresh token expiry: 7 days.
- Separate access and refresh secrets.
- HS256 signing algorithm.
- Token issuer: chandra-ems.
- Token audience: chandra-ems-api.
- Unique refresh token identifier.
- Access and refresh token verification.

#### Environment Variables

```env
ACCESS_TOKEN_SECRET=your_access_secret
REFRESH_TOKEN_SECRET=your_refresh_secret
```

#### Testing

```bash
node scripts/testPassword.js
node scripts/testToken.js
```

#### Security Notes

- Never store plain-text passwords.
- Never expose JWT secrets in frontend code.
- Refresh tokens must be stored as hashed session records.
- Refresh token rotation and revocation will be implemented in the session management step.


**Company:** Chandra Enterprises  
**Project:** Employee Management System  
**Repository:** chandra-ems
