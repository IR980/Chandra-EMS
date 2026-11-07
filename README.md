
# Chandra Enterprises – Employee Management System

A centralized, department-wise Employee Management System for Chandra Enterprises, built using the MERN stack.

The system is designed to manage company domains, departments, employees, reporting structures, attendance, leave, payroll, and organizational operations through a centralized platform.

## Project Information

| Item | Technology / Details |
|---|---|
| Project | Chandra Enterprises EMS |
| Frontend | React.js + Vite |
| Backend | Node.js + Express.js |
| Database | MongoDB Atlas |
| Styling | Tailwind CSS v4 |
| Authentication | JWT + bcryptjs |
| State Management | Redux Toolkit |
| API Client | Axios |
| Company | Chandra Enterprises |
| Repository | chandra-ems |

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
│   ├── routes/
│   ├── scripts/
│   │   ├── seedRoles.js
│   │   ├── inspectOrganization.js
│   │   └── seedOrganization.js
│   ├── services/
│   ├── utils/
│   ├── .env
│   ├── server.js
│   └── package.json
│
├── .gitignore
└── README.md
```

*The structure above summarizes the main project directories; additional files and modules may exist.*

## Development Setup

### Backend

```powershell
cd D:\chandra-ems\server
npm install
npm run dev
```

Backend URL:

http://localhost:5000

Health API:

http://localhost:5000/api/health

### Frontend

```powershell
cd D:\chandra-ems\client
npm install
npm run dev
```

Frontend URL:

http://localhost:5173

Production build:

```powershell
npm run build
```

## Environment Variables

### Server: `server/.env`

```env
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_secret
ACCESS_TOKEN_SECRET=your_access_secret
REFRESH_TOKEN_SECRET=your_refresh_secret
```

### Client: `client/.env`

```env
VITE_API_URL=http://localhost:5000/api
```

Never commit real environment credentials.

---

# Company Organization Structure

## Business Domain

The company currently uses one centralized business domain.

| Domain | Code | Status |
|---|---|---|
| Banana Trading & Ripening | BTR | Active |

## Main Departments

| No. | Department | Code |
|---:|---|---|
| 1 | Legal | LEG |
| 2 | Marketing | MKT |
| 3 | Sales & Purchase | SALES |
| 4 | Operations | OPS |
| 5 | Accounts & Finance | ACC |
| 6 | Transport | TRN |
| 7 | Human Resources | HR |
| 8 | Security | SEC |
| 9 | Engineering | ENG |
| 10 | House Keeping | HK |
| 11 | Trainee & Research Development | TRD |

## Engineering Sub-Departments

| No. | Sub-Department | Code | Parent |
|---:|---|---|---|
| 1 | Software Engineering | SWENG | Engineering |
| 2 | Civil Engineering | CIVIL | Engineering |
| 3 | Electrical & Maintenance | ELM | Engineering |

**Organization seed verification:**

- [x] Existing BTR domain preserved.
- [x] Existing Sales & Purchase department preserved.
- [x] All 11 main departments verified.
- [x] All 3 Engineering sub-departments created.
- [x] Parent-child relationships verified.
- [x] Total of 14 departments verified.
- [x] All 14 departments active.

## Organizational Hierarchy

Expected reporting structure:

```text
Managing Director
    |
    └── Director
          |
          ├── Department Manager
          |      |
          |      └── Coordinator
          |             |
          |             └── Supervisor
          |                    |
          |                    └── Employees
          |
          └── Other Department Managers
```

The actual reporting relationship will be determined by employee assignments and authorized roles.

---

# Development Progress

## Phase 1 – Project Setup and Verification

<badge color="success">Completed</badge>

- [x] Existing project inspection
- [x] React + Vite configuration
- [x] Express backend configuration
- [x] MongoDB Atlas connection
- [x] Tailwind CSS v4 setup
- [x] Axios API client setup
- [x] Backend dependencies verified
- [x] Frontend dependencies verified
- [x] Frontend production build verified
- [x] Frontend lint check completed
- [x] Backend health endpoint verified
- [x] Frontend runtime verified
- [x] Project architecture finalized
- [x] README documentation updated

## Phase 2 – Authentication and Authorization

<badge color="warning">In Progress</badge>

### Database and Permissions

- [x] User MongoDB model
- [x] Role MongoDB model
- [x] Central permissions configuration
- [x] Default role seed script

### Password and JWT Utilities

- [x] bcryptjs password hashing utility
- [x] Password comparison utility
- [x] Password validation
- [x] JWT access token utility
- [x] JWT refresh token utility
- [x] Separate access and refresh secrets
- [x] HS256 signing algorithm
- [x] Token issuer and audience configuration
- [x] Unique refresh token identifier

### Security Configuration

- [x] Password hashing uses 12 salt rounds
- [x] Minimum password length: 8 characters
- [x] Maximum password length: 128 characters
- [x] Uppercase and lowercase validation
- [x] Number and special character validation
- [x] Access token expiry: 15 minutes
- [x] Refresh token expiry: 7 days

### Remaining Authentication Work

- [ ] Verify password utility tests
- [ ] Verify JWT utility tests
- [ ] Seed default roles in MongoDB
- [ ] Login API
- [ ] Logout API
- [ ] Refresh token API
- [ ] Refresh token rotation
- [ ] Token revocation and session management
- [ ] Forgot password
- [ ] Reset password
- [ ] Authentication frontend
- [ ] Protected routes
- [ ] Role-based access control testing
- [ ] Super Admin setup
- [ ] Complete authentication testing

### Authentication Test Commands

Run from the `server` directory:

```powershell
node scripts/testPassword.js
node scripts/testToken.js
```

### Environment Variables

```env
ACCESS_TOKEN_SECRET=your_access_secret
REFRESH_TOKEN_SECRET=your_refresh_secret
```

Security note: Refresh tokens should be stored as hashed session records. Never expose JWT secrets in frontend code.

## Phase 3 – Organization Management

<badge color="warning">Implementation and verification in progress</badge>

### Domain Management

- [x] Domain Mongoose model
- [x] Create domain API
- [x] List domains with search and pagination
- [x] Get domain by ID
- [x] Update domain
- [x] Deactivate domain
- [x] Domain permissions

### Department Management

- [x] Department Mongoose model
- [x] Create department API
- [x] List departments with search and pagination
- [x] Filter departments by domain
- [x] Get department by ID
- [x] Update department
- [x] Deactivate department
- [x] Parent department relationship
- [x] Parent-child hierarchy validation
- [x] Department manager assignment validation
- [x] Department permissions

### Organization Database Setup

- [x] Existing organization data inspected
- [x] Existing BTR domain identified
- [x] Existing Sales & Purchase department preserved
- [x] Organization seed script created
- [x] 11 main departments seeded or verified
- [x] 3 Engineering sub-departments seeded
- [x] Engineering parent-child relationships verified
- [x] Total 14 departments verified in MongoDB

### Remaining Organization Work

- [ ] Verify domain APIs
- [ ] Verify department APIs
- [ ] Verify domain and department authorization
- [ ] Domain head assignment validation
- [ ] Domain Management UI improvements
- [ ] Department Management UI verification
- [ ] Employee-based manager assignment verification
- [ ] Organization dashboard count accuracy
- [ ] Organization chart verification
- [ ] Department color and ordering consistency
- [ ] Pagination and large employee-list handling
- [ ] Designation management
- [ ] Complete organization management testing

### Organization Seed Command

Run from the `server` directory:

```powershell
node scripts/seedOrganization.js
```

The seed script is designed to preserve existing organization records and verify the expected department structure.

## Phase 4 – Employee Management

<badge color="warning">Implementation present; testing pending</badge>

### Database

- [x] Employee model
- [x] Automatic employee ID generation
- [x] Counter model
- [x] Domain relationship
- [x] Department relationship
- [x] Reporting manager relationship
- [x] Optional login account relationship

### Employee APIs

- [x] Create employee
- [x] List employees
- [x] Search employees
- [x] Filter employees
- [x] Get employee by ID
- [x] Update employee
- [x] Deactivate employee

### Testing

- [ ] Employee creation
- [ ] Employee listing
- [ ] Employee search
- [ ] Employee profile
- [ ] Employee update
- [ ] Employee deactivation
- [ ] Employee ID generation
- [ ] Department assignment
- [ ] Reporting manager assignment
- [ ] Employee authorization
- [ ] Employee data validation

## Phase 5 – Attendance Management

- [ ] Check-in and check-out
- [ ] Shift management
- [ ] Attendance calculation
- [ ] Attendance correction
- [ ] Late arrival tracking
- [ ] Overtime calculation
- [ ] Attendance reports

## Phase 6 – Leave Management

- [ ] Leave types and policies
- [ ] Leave applications
- [ ] Leave balances
- [ ] Approval workflow
- [ ] Leave history
- [ ] Leave reports

## Phase 7 – Salary and Payroll

- [ ] Salary structure
- [ ] Allowances and deductions
- [ ] Payroll calculation
- [ ] Payroll approval
- [ ] Salary slips
- [ ] Payment tracking
- [ ] Payroll reports

## Phase 8 – Dashboards and Organization Chart

- [ ] Super Admin dashboard
- [ ] Managing Director dashboard
- [ ] HR dashboard
- [ ] Department Manager dashboard
- [ ] Accounts dashboard
- [ ] Employee dashboard
- [ ] Organization chart
- [ ] Department-wise employee overview

## Phase 9 – Reports and Analytics

- [ ] Employee reports
- [ ] Attendance reports
- [ ] Payroll reports
- [ ] Department-wise reports
- [ ] Analytics charts
- [ ] PDF exports
- [ ] Excel exports

## Phase 10 – Testing, Security and Deployment

- [ ] API testing
- [ ] Frontend testing
- [ ] Permission testing
- [ ] Input validation testing
- [ ] Security testing
- [ ] Performance testing
- [ ] Production environment configuration
- [ ] Frontend deployment
- [ ] Backend deployment
- [ ] Database production verification

---

# Important Development Rules

1. Maintain the existing project architecture.
2. Use reusable React components.
3. Use REST APIs for frontend-backend communication.
4. Validate all incoming API data.
5. Protect sensitive employee and payroll information.
6. Enforce permissions on the backend.
7. Maintain audit logs for sensitive operations.
8. Never store plain-text passwords.
9. Never commit `.env` credentials.
10. Preserve historical employee, attendance and payroll records.
11. Avoid duplicate employees, domains and departments.
12. Use MongoDB references consistently.
13. Verify database changes before modifying existing records.
14. Test each feature before moving to the next development phase.

---

# Current Development Status

| Area | Status |
|---|---|
| Project setup | Completed |
| Backend and frontend verification | Completed |
| Authentication foundation | Implemented; testing pending |
| Domain and department APIs | Implemented |
| Organization seed | Completed and verified |
| Employee model and APIs | Implemented; testing pending |
| Attendance | Pending |
| Leave management | Pending |
| Payroll | Pending |
| Dashboards and reports | Pending |
| Production deployment | Pending |

**Company:** Chandra Enterprises  
**Project:** Employee Management System  
**Repository:** `chandra-ems`
