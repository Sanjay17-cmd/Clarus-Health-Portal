# Clarus Health Portal — Implementation Plan

A complete Medical Report Management & Distribution System with a glassmorphic, hospital-grade UI, multi-role auth, and full CRUD workflows.

## Directory Structure

```
Clarus health portal/
├── schema.sql                    # Complete MySQL init script
├── backend/
│   ├── package.json
│   ├── .env.example
│   ├── server.js                 # Express entry point
│   ├── config/
│   │   └── db.js                 # MySQL connection pool
│   ├── middleware/
│   │   ├── auth.js               # JWT verify + role guard
│   │   └── upload.js             # Multer config for file uploads
│   ├── routes/
│   │   ├── auth.routes.js        # Login / Register / Me
│   │   ├── reports.routes.js     # CRUD + upload + download
│   │   ├── share.routes.js       # Token generation + QR + verify
│   │   ├── admin.routes.js       # Metrics, audit logs, user mgmt
│   │   └── users.routes.js       # Patient lookup (doctor use)
│   ├── controllers/
│   │   ├── auth.controller.js
│   │   ├── reports.controller.js
│   │   ├── share.controller.js
│   │   ├── admin.controller.js
│   │   └── users.controller.js
│   └── uploads/                  # Local disk storage (gitignored)
├── frontend/
│   ├── package.json
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── tsconfig.json
│   ├── tsconfig.app.json
│   ├── tsconfig.node.json
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx               # Router + auth context
│   │   ├── index.css             # Tailwind directives + custom glass styles
│   │   ├── api/
│   │   │   └── client.ts         # Axios instance with JWT interceptor
│   │   ├── context/
│   │   │   └── AuthContext.tsx    # React Context for auth state
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── Sidebar.tsx
│   │   │   │   ├── TopBar.tsx
│   │   │   │   └── DashboardShell.tsx
│   │   │   ├── ui/
│   │   │   │   ├── GlassCard.tsx
│   │   │   │   ├── Button.tsx
│   │   │   │   ├── Input.tsx
│   │   │   │   ├── Badge.tsx
│   │   │   │   ├── Modal.tsx
│   │   │   │   ├── DataTable.tsx
│   │   │   │   └── StatCard.tsx
│   │   │   └── shared/
│   │   │       ├── FileUpload.tsx
│   │   │       ├── ReportTimeline.tsx
│   │   │       ├── ShareModal.tsx
│   │   │       └── QRCodeDisplay.tsx
│   │   └── pages/
│   │       ├── Login.tsx
│   │       ├── admin/
│   │       │   └── AdminDashboard.tsx
│   │       ├── doctor/
│   │       │   └── DoctorWorkspace.tsx
│   │       ├── lab/
│   │       │   └── LabTechDashboard.tsx
│   │       └── patient/
│   │           └── PatientPortal.tsx
```

---

## Proposed Changes

### 1. Database Schema

#### [NEW] [schema.sql](file:///c:/Users/sanja/Downloads/pro/SE/Clarus%20health%20portal/schema.sql)

Complete MySQL initialization script containing:

- **`Users`** table — `id`, `email`, `password_hash`, `full_name`, `role` (ENUM: Admin, Doctor, LabTechnician, Patient), `department`, `phone`, `created_at`, `updated_at`. Indexed on `email` (unique) and `role`.
- **`MedicalReports`** table — `id`, `patient_id` (FK→Users), `uploaded_by` (FK→Users), `title`, `department`, `file_path`, `file_type`, `file_size`, `notes`, `status` (ENUM: Pending, Verified, Flagged), `created_at`. Indexed on `patient_id`, `department`, `created_at`.
- **`ShareLinks`** table — `id`, `report_id` (FK→MedicalReports), `created_by` (FK→Users), `token` (unique hash), `expires_at`, `max_views`, `current_views`, `is_active`, `created_at`. Indexed on `token`.
- **`AuditLogs`** table — `id`, `user_id` (FK→Users), `action`, `entity_type`, `entity_id`, `ip_address`, `metadata` (JSON), `created_at`. Indexed on `user_id`, `action`, `created_at`.
- Seed data: 1 admin user (password: `admin123`), 1 doctor, 1 lab tech, 2 patients, and sample reports.

---

### 2. Backend (Node.js + Express)

#### [NEW] [package.json](file:///c:/Users/sanja/Downloads/pro/SE/Clarus%20health%20portal/backend/package.json)

Dependencies: `express`, `mysql2`, `jsonwebtoken`, `bcryptjs`, `multer`, `cors`, `dotenv`, `uuid`, `qrcode`

#### [NEW] [.env.example](file:///c:/Users/sanja/Downloads/pro/SE/Clarus%20health%20portal/backend/.env.example)

Template env vars: `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `JWT_SECRET`, `PORT`.

#### [NEW] [server.js](file:///c:/Users/sanja/Downloads/pro/SE/Clarus%20health%20portal/backend/server.js)

Express app with CORS, JSON body parser, static serving of `/uploads`, and route mounting.

#### [NEW] [config/db.js](file:///c:/Users/sanja/Downloads/pro/SE/Clarus%20health%20portal/backend/config/db.js)

MySQL2 connection pool using promise wrapper.

#### [NEW] [middleware/auth.js](file:///c:/Users/sanja/Downloads/pro/SE/Clarus%20health%20portal/backend/middleware/auth.js)

- `authenticate` — verifies JWT from `Authorization: Bearer <token>` header.
- `authorize(...roles)` — role-based guard middleware.
- Attaches `req.user = { id, email, role }`.

#### [NEW] [middleware/upload.js](file:///c:/Users/sanja/Downloads/pro/SE/Clarus%20health%20portal/backend/middleware/upload.js)

Multer disk storage config: destination `uploads/`, unique filename with timestamp, file filter for PDF/JPG/PNG, 10MB limit.

#### [NEW] Controllers & Routes

| Route File | Controller | Key Endpoints |
|---|---|---|
| `auth.routes.js` | `auth.controller.js` | `POST /api/auth/login`, `POST /api/auth/register`, `GET /api/auth/me` |
| `reports.routes.js` | `reports.controller.js` | `GET /api/reports` (filtered by role), `POST /api/reports/upload`, `GET /api/reports/:id/download`, `PATCH /api/reports/:id/status` |
| `share.routes.js` | `share.controller.js` | `POST /api/share/create`, `GET /api/share/verify/:token`, `GET /api/share/qr/:token` |
| `admin.routes.js` | `admin.controller.js` | `GET /api/admin/metrics`, `GET /api/admin/audit-logs`, `GET /api/admin/users`, `PATCH /api/admin/users/:id/role` |
| `users.routes.js` | `users.controller.js` | `GET /api/users/patients` (doctor lookup), `GET /api/users/:id` |

---

### 3. Frontend (React + TypeScript + Vite)

#### [NEW] Vite + Tailwind Setup

- `package.json` with deps: `react`, `react-router-dom`, `axios`, `framer-motion`, `lucide-react`, `qrcode.react`
- `vite.config.ts` with API proxy to `localhost:5000`
- `tailwind.config.js` with custom palette tokens (`navy`, `azure`, `teal`, `canvas`), custom shadows, custom backdrop blur
- `index.css` with Tailwind directives + custom glassmorphism utility classes

#### [NEW] Core Architecture Files

| File | Purpose |
|---|---|
| `api/client.ts` | Axios instance with base URL, JWT interceptor (reads from localStorage) |
| `context/AuthContext.tsx` | React Context providing `user`, `login()`, `logout()`, `isAuthenticated` |
| `App.tsx` | React Router with protected routes, role-based redirect logic |
| `main.tsx` | App mount with `AuthProvider` wrapper |

#### [NEW] UI Component Library (Glassmorphic Design System)

| Component | Description |
|---|---|
| `GlassCard.tsx` | White card with 85% opacity, backdrop-blur-md, multi-layered soft shadow, 1px slate border |
| `Button.tsx` | Primary (azure gradient), secondary (outline), destructive variants. Framer Motion hover/tap animations. |
| `Input.tsx` | Floating label input with glass background, focus ring in azure |
| `Badge.tsx` | Status badges: `Verified` (teal), `Pending` (amber), `Flagged` (red) |
| `Modal.tsx` | Centered overlay with backdrop-blur, glass card body, Framer Motion enter/exit |
| `DataTable.tsx` | Sortable, filterable table with glass row hover effect |
| `StatCard.tsx` | Metric display card with icon, value, label, and trend indicator |

#### [NEW] Layout Components

| Component | Description |
|---|---|
| `Sidebar.tsx` | Fixed left sidebar with navy background, role-specific navigation links, user avatar/info, logout |
| `TopBar.tsx` | Top bar with page title, breadcrumbs, notification bell, user dropdown |
| `DashboardShell.tsx` | Layout wrapper: sidebar + topbar + scrollable content area |

#### [NEW] Shared Feature Components

| Component | Description |
|---|---|
| `FileUpload.tsx` | Drag-and-drop upload zone with preview, progress bar, file type validation |
| `ReportTimeline.tsx` | Chronological vertical timeline of report events with icons and dates |
| `ShareModal.tsx` | Modal for creating share links: expiry picker, max views, copy-to-clipboard |
| `QRCodeDisplay.tsx` | QR code renderer for share tokens using `qrcode.react` |

#### [NEW] Page Components (Role-Based Dashboards)

| Page | Features |
|---|---|
| `Login.tsx` | Centered glass login card over gradient background, role selector for demo, form validation, framer-motion entrance |
| `AdminDashboard.tsx` | 4 stat cards (users, reports, shares, logs), audit log table with filters, user management table with role dropdown |
| `DoctorWorkspace.tsx` | Patient search/filter bar, patient list with report counts, report preview panel, break-glass/share-token entry modal |
| `LabTechDashboard.tsx` | File upload form with patient ID lookup, department selector, recent uploads table, upload status badges |
| `PatientPortal.tsx` | Report timeline view, download buttons, "Secure Share" button opening ShareModal, active shares list |

---

## Design Specifications (Enforced Everywhere)

- **Background**: `#F4F7FA` sterile canvas with subtle radial gradient overlay
- **Cards**: `bg-white/85 backdrop-blur-md border border-slate-100/80 shadow-[0_10px_30px_-5px_rgba(10,37,64,0.08)]`
- **Typography**: Inter font from Google Fonts, navy headings, slate-600 body text
- **Animations**: Framer Motion `fadeInUp` for cards, `scale` on buttons, `slideIn` for sidebar, `staggerChildren` for lists
- **Gradients**: Azure-to-teal gradient for primary CTA buttons and header accents
- **Icons**: Lucide React icons throughout — consistent 20px stroke width

---

## Verification Plan

### Automated Tests
```bash
# Backend smoke test
cd backend && npm install && node server.js
# Should start on port 5000 without errors

# Frontend build test
cd frontend && npm install && npm run build
# Should compile without TypeScript or build errors
```

### Manual Verification
- Run `npm run dev` for both frontend and backend
- Test login flow with seeded credentials
- Verify role-based routing (each role sees different dashboard)
- Test file upload from Lab Tech dashboard
- Test share link creation from Patient portal
- Verify glassmorphic UI matches design specifications

> [!IMPORTANT]
> **MySQL must be running locally** before starting the backend. Run `schema.sql` to initialize the database and seed data.

> [!NOTE]
> The project uses local disk storage for uploads — no cloud provider needed. The `uploads/` directory is auto-created by Multer.
