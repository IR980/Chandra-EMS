🏢 Chandra Enterprises – Employee Management System (EMS)

A full-stack Employee Management System designed to centralize and automate employee operations across Chandra Enterprises' business domains and departments.

The platform provides employee management, organizational hierarchy, attendance tracking, leave management, payroll processing, document verification, notifications, and role-based access control through a centralized dashboard.

📌 Project Overview

Project Name: Chandra Enterprises – Employee Management System
Application Type: Full-Stack Web Application
Architecture: MERN Stack
Frontend: React.js + Vite + Tailwind CSS
Backend: Node.js + Express.js
Database: MongoDB Atlas
Authentication: JWT-Based Authentication
Status: Core Development Completed – Testing & Deployment Pending

✨ Key Features

1. Authentication & Authorization

Secure user login and authentication.

JWT-based authentication.

Password hashing using bcryptjs.

Role-Based Access Control (RBAC).

Permission-based route protection.

Protected API endpoints.

2. Organization Management

Dynamic organization management.

Domain management.

Department management.

Organizational hierarchy.

Manager and reporting relationships.

Support for adding new domains and departments dynamically.

3. Employee Management

Employee registration and onboarding.

Employee directory.

Employee profile management.

Employee information updates.

Employee status management.

Department and domain assignment.

Manager assignment and reporting hierarchy.

4. Attendance Management

Employee check-in and check-out.

Attendance tracking.

Manual attendance entry.

Attendance record updates.

Attendance approval.

Attendance history and management.

5. Leave Management

Employee leave applications.

Leave approval and rejection.

Leave policies.

Employee leave balances.

Leave management dashboard.

Leave history.

6. Payroll Management

Salary structure management.

Monthly payroll generation.

Payroll verification.

Payroll approval.

Salary payment processing.

Employee salary history.

Payroll records and management.

Automated monthly payroll scheduler.

Protection against duplicate payroll generation.

7. Document Management

Employee document submission.

Document storage and management.

Document verification.

Document approval and rejection.

Document verification dashboard.

Employee document status tracking.

8. Notification System

Real-time notifications.

Notification bell with unread count.

Centralized notification center.

Read and unread notification management.

Module-specific notification navigation.

Super Admin notifications for:

New employee registration.

Attendance activities.

Leave applications and activities.

Payroll activities.

Document submission and verification.

Socket.IO notification infrastructure.

9. Dashboard & Reports

Centralized management dashboard.

Employee and organizational information.

Attendance and leave information.

Payroll-related information.

Reports and management insights.

🛠️ Technology Stack

Frontend

Technology

Purpose

React.js

User Interface

Vite

Development and Build Tool

JavaScript

Application Logic

Tailwind CSS

Styling

React Router DOM

Routing

Redux Toolkit / Context API

State Management

Axios

API Integration

Recharts

Data Visualization

Lucide React

Icons

Backend

Technology

Purpose

Node.js

Runtime Environment

Express.js

Backend Framework

MongoDB Atlas

Database

Mongoose

ODM

JWT

Authentication

bcryptjs

Password Hashing

Socket.IO

Real-Time Notifications

node-cron

Scheduled Payroll Tasks

Additional Tools

Git and GitHub

Cloudinary

Postman

VS Code

MongoDB Atlas

Vercel

Render

🏗️ System Architecture

                 CHANDRA ENTERPRISES EMS
                           |
              +------------+------------+
              |                         |
         FRONTEND                   BACKEND
        React + Vite             Node.js + Express
              |                         |
       Tailwind CSS                REST APIs
              |                         |
       React Router              JWT Authentication
              |                         |
       Axios Integration          RBAC Middleware
              |                         |
              +------------+------------+
                           |
                     DATABASE
                           |
                     MongoDB Atlas
                           |
              +------------+------------+
              |                         |
        Employee Data              Payroll Data
        Attendance Data            Leave Data
        Document Data               Notifications
        Organization Data           User & Roles

🏢 Organizational Hierarchy

The system supports the following organizational reporting structure:

Managing Director
       |
    Director
       |
 Department Manager
       |
Department Coordinator
       |
   Supervisor
       |
    Employees

🗂️ Departments

The system is designed to support dynamic department management, including:

Legal

Marketing

Sales & Purchase

Operations

Accounts & Finance

Transport

Human Resources

Security

Engineering

Software Engineering

Civil Engineering

Electrical & Maintenance

House Keeping

Trainee & Research Development

📁 Project Structure

chandra-ems/
│
├── client/
│   ├── public/
│   ├── src/
│   │   ├── assets/
│   │   ├── components/
│   │   ├── features/
│   │   │   └── notifications/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── store/
│   │   ├── hooks/
│   │   ├── layouts/
│   │   ├── routes/
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
│
├── server/
│   ├── config/
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── services/
│   ├── utils/
│   ├── package.json
│   └── server.js
│
└── README.md

Note: This is a high-level representation of the project structure. Individual folders may contain additional files.

⚙️ Installation & Setup

Prerequisites

Install the following before starting:

Node.js (LTS recommended)

npm

MongoDB Atlas account

Git

VS Code (recommended)

1. Clone the Repository

git clone https://github.com/IR980/chandra-ems.git

cd chandra-ems

2. Setup Backend

cd server
npm install

Create a .env file inside the server directory.

PORT=5000
NODE_ENV=development

MONGO_URI=your_mongodb_atlas_connection_string

JWT_SECRET=your_secure_jwt_secret

CLIENT_URL=http://localhost:5173

Add other environment variables required by your configured integrations, such as Cloudinary and email services.

Start the backend:

npm run dev

3. Setup Frontend

Open another terminal:

cd client
npm install

Create a .env file inside the client directory:

VITE_API_URL=http://localhost:5000/api

Start the frontend:

npm run dev

4. Access the Application

Frontend: http://localhost:5173
Backend:  http://localhost:5000

Use the authentication credentials configured for your application.

🔐 Security

The application incorporates security mechanisms including:

JWT-based authentication.

Password hashing with bcryptjs.

Protected routes and APIs.

Role-Based Access Control.

Permission-based authorization.

Backend input validation.

Environment-based configuration.

Important: Never commit .env files, database credentials, JWT secrets, or other sensitive configuration to GitHub.

💰 Payroll Automation

The payroll scheduler is configured to run monthly using the Asia/Kolkata timezone.

Configuration

Value

Scheduler

node-cron

Timezone

Asia/Kolkata

Scheduled Time

2:00 AM

Scheduled Day

1st of every month

Automatic Payroll

Currently Disabled

Planned Activation

December 1, 2026

Intended First Run

November 2026 Payroll

Automatic payroll must remain disabled until the planned activation date.

🚀 Production Build

Frontend

cd client
npm run build

The production build is generated inside:

client/dist/

Backend

cd server
node --check server.js

Use the configured production start script when deploying the backend.

🌐 Deployment

The application can be deployed using:

Component

Suggested Platform

Frontend

Vercel

Backend

Render

Database

MongoDB Atlas

Media Storage

Cloudinary

Configure production environment variables and verify frontend-to-backend API connectivity before deployment.

🧪 Testing & Validation

The following areas should be tested before production release:

Authentication and authorization.

Employee registration and profile management.

Organization and department management.

Attendance and leave workflows.

Payroll calculation and approval.

Document submission and verification.

Notification delivery and navigation.

Role-based permissions.

API validation and error handling.

Production database connectivity.

📈 Development Status

Development Area

Status

Core Frontend

Completed

Backend APIs

Implemented

Authentication & RBAC

Implemented

Organization Management

Implemented

Employee Management

Implemented

Attendance Management

Implemented

Leave Management

Implemented

Payroll Management

Implemented

Document Management

Implemented

Notification System

Implemented

Frontend Production Build

Successful

End-to-End Testing

Pending

Performance Optimization

Pending

Production Deployment Verification

Pending

Final Documentation

In Progress

🔮 Future Enhancements

Advanced analytics and reporting.

Excel and PDF exports.

Automated salary slip generation.

Email and WhatsApp notifications.

Employee self-service portal improvements.

Advanced audit logs.

Performance evaluation and appraisal.

Enhanced dashboard visualizations.

Frontend code splitting and performance optimization.

👨‍💻 Project Information

Project Name: Chandra Enterprises – Employee Management System (EMS)
Organization: Chandra Enterprises
Developed By: Irshad Alam
GitHub: @IR980
GitHub Repository: Chandra EMS
Project Type: Full-Stack Enterprise Management Application
Technology Stack: MERN Stack
Purpose: Centralized Employee and Workforce Management

Developed with dedication by Irshad Alam for Chandra Enterprises.

📄 License

This project is developed for Chandra Enterprises.

All rights reserved. Unauthorized copying, distribution, or commercial use requires permission from the project owner.

Built to simplify employee management and streamline business operations at Chandra Enterprises.
