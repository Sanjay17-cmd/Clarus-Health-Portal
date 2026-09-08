# 🏥 Clarus Health Portal

> **Medical Report Management & Distribution System**  
> A hospital-grade, role-based web application built with React, TypeScript, Express, and MySQL featuring a glassmorphic dark interface, granular access control, cryptographic verification tokens, dynamic QR sharing, and full audit trail capabilities.

---

## ✨ Key Features

- 🔐 **Multi-Role Authentication & Access Control**
  - **Admin**: System overview, user management, department analytics, and security audit logs.
  - **Doctor**: Search patient profiles, review medical report timelines, break-glass share token generation.
  - **Lab Technician**: Secure report document upload (PDF/Images), metadata categorization, patient linkage.
  - **Patient**: Personal medical history view, report download, time-bound access sharing, QR code generation.
- 💎 **Hospital-Grade Dark UI / UX**
  - Glassmorphic card refractions, clinical ambient glowing orbs, smooth Framer Motion micro-interactions.
- 🛡️ **Cryptographic Verification & Share Tokens**
  - Generate shareable tokens with optional expiration and PIN protection for external specialist review.
- 📝 **Comprehensive Audit Logs**
  - Full audit logging for report creations, status updates, token generations, and user access.

---

## 🛠️ Architecture & Tech Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Lucide React, Framer Motion
- **Backend:** Node.js, Express.js (RESTful API), JWT Authentication, bcryptjs password hashing
- **Database:** MySQL 8.0 (Relational schema, foreign keys, indexes, triggers, audit trails)
- **Storage:** Local file storage with Multer for PDF and diagnostic medical images

---

## 🚀 Quick Start Guide

### Prerequisites
- Node.js (v18+)
- MySQL Server (v8.0+)
- npm or yarn

### 1. Database Initialization

Import `schema.sql` into your local MySQL instance:

```bash
mysql -u root -p < schema.sql
```

*(Or on Windows PowerShell)*:
```powershell
Get-Content schema.sql | & "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root -p
```

### 2. Backend Setup

```bash
cd backend
npm install
```

Create a `.env` file in `backend/` (or copy `.env.example`):
```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=clarus_health
JWT_SECRET=your_super_secret_jwt_key
PORT=5000
```

Start backend development server:
```bash
npm run dev
```

### 3. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Visit the application at `http://localhost:5173`.

---

## 🔑 Demo Credentials

| Role | Email | Default Password |
|------|-------|------------------|
| **Admin** | `admin@clarus.health` | `admin123` |
| **Doctor** | `dr.chen@clarus.health` | `doctor123` |
| **Lab Tech** | `lab.martinez@clarus.health` | `lab123` |
| **Patient** | `emily.wilson@email.com` | `patient123` |

---

## 📁 Project Structure

```
Clarus health portal/
├── schema.sql                   # MySQL schema, indexes & seed data
├── README.md                    # Project documentation
├── backend/                     # Node.js / Express API
│   ├── config/                  # DB connection pool
│   ├── controllers/             # Auth, Users, Reports, Tokens, Audit controllers
│   ├── middleware/              # JWT auth & role validation middleware
│   ├── routes/                  # Express API endpoints
│   ├── uploads/                 # Storage for report attachments
│   ├── server.js                # Express app entry point
│   └── seed-hashes.js           # Utility script for seed passwords
└── frontend/                    # React / Vite SPA
    ├── src/
    │   ├── components/          # GlassCard, Navbar, StatCard, Badge, etc.
    │   ├── context/             # Auth Context & Provider
    │   ├── pages/               # Login & Role Dashboards (Admin, Doctor, Lab, Patient)
    │   └── services/            # Axios API client
    └── vite.config.ts
```

---

## 📄 License

Distributed under the MIT License.
