# Clarus Health Portal

A local, full-stack clinical information system for secure patient record management.

**Phase 4 — Final Local Integration** · No cloud services required.

---

## Architecture

```
Browser (React + Vite)
        ↓
FastAPI (Python) — JWT auth, role enforcement, file access control
        ↓
MySQL (local)  +  Local Filesystem Storage
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite 6, Vanilla CSS |
| Backend | FastAPI, SQLAlchemy, Pydantic v2 |
| Auth | JWT (python-jose) + bcrypt |
| Database | MySQL 8.x (local) |
| File storage | Local filesystem (`backend/uploads/`) |
| PDF viewer | pdfjs-dist |
| QR codes | qrcode |

---

## Project Structure

```
Clarus Health/
├── frontend/               # React + Vite SPA
│   ├── src/
│   │   ├── api/            # Axios API clients per feature
│   │   ├── components/     # Layout, UI, Reports, Auth
│   │   ├── context/        # AuthContext, ThemeContext
│   │   ├── pages/          # admin/, doctor/, patient/, technician/
│   │   └── index.css       # Complete design system (tokens, dark mode, 3D)
│   └── package.json
├── backend/                # FastAPI application
│   ├── main.py             # App entry point — all routers mounted
│   ├── core/               # Config, dependencies, exceptions
│   ├── models/             # SQLAlchemy ORM models
│   ├── schemas/            # Pydantic request/response schemas
│   ├── services/           # Business logic layer
│   ├── routers/            # HTTP route handlers
│   ├── uploads/            # Medical file storage (never served directly)
│   └── requirements.txt
├── database/
│   ├── phase1_schema.sql   # Core users, roles, specializations
│   ├── phase2_schema.sql   # Reports, files, permissions, shares
│   ├── phase3A_schema.sql  # Corrections, deletions, archive provenance
│   └── phase3B_schema.sql  # Break-Glass, disputes, access events
└── README.md
```

---

## Database Setup (Manual — SQL Only)

> ⚠️ **Never let Antigravity or any tool execute SQL against your database.**

### Prerequisites
- MySQL 8.x running locally
- A database named `clarusdb` (or configure via `.env`)

### Execute phases in order:

```bash
mysql -u root -p clarusdb < database/phase1_schema.sql
mysql -u root -p clarusdb < database/phase2_schema.sql
mysql -u root -p clarusdb < database/phase3A_schema.sql
mysql -u root -p clarusdb < database/phase3B_schema.sql
```

Or via MySQL Workbench:
1. Open connection → `clarusdb` database
2. File → Run SQL Script → select each file in order

---

## Backend Setup

### Prerequisites
- Python 3.11+

### Install

```bash
cd backend
python -m venv venv

# Windows
.\venv\Scripts\activate

# macOS/Linux
source venv/bin/activate

pip install -r requirements.txt
```

### Environment Configuration

Create `backend/.env`:

```env
SECRET_KEY=your-super-secret-jwt-key-change-this-in-production
DATABASE_URL=mysql+pymysql://root:password@localhost:3306/clarusdb
UPLOAD_DIR=uploads
ALLOWED_ORIGINS=http://localhost:5173
ACCESS_TOKEN_EXPIRE_MINUTES=60
```

### Run

```bash
cd backend
.\venv\Scripts\activate   # or source venv/bin/activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

API available at: http://localhost:8000  
Interactive docs: http://localhost:8000/docs

---

## Frontend Setup

### Prerequisites
- Node.js 18+

### Install & Run

```bash
cd frontend
npm install
npm run dev
```

App available at: http://localhost:5173

### Build (production bundle)

```bash
npm run build
```

---

## Role Accounts & Testing

There is **no seed data**. All users are created through the application.

### First-Time Setup

1. Start backend + frontend
2. Go to http://localhost:5173/register
3. Register an **Admin** account — first admin may need to be manually set in MySQL:
   ```sql
   UPDATE users SET role='ADMIN', status='ACTIVE' WHERE email='admin@example.com';
   ```
4. Log in as Admin → User Management → Approve pending users

### Roles

| Role | Dashboard | Key Features |
|---|---|---|
| `ADMIN` | `/admin` | Users, approvals, audit, disputes, security, suspensions |
| `DOCTOR` | `/doctor` | View shared records, ZIP import, Break-Glass |
| `PATIENT` | `/patient` | Share groups, QR links, disputes, activity log |
| `LAB_TECHNICIAN` | `/technician` | Upload records, create groups, corrections |

### Testing Workflow Order

```
1. Admin registers + approves Lab Technician and Doctor
2. Patient registers + Admin approves
3. Lab Technician → Select Patient → Upload records
4. Patient → Dashboard → Share group with Doctor
5. Doctor → Dashboard → View records (via group share)
6. Patient → Generate QR/link for external sharing
7. Lab Technician → Correction workflow (select history → correct)
8. Patient → Dispute → Admin resolves
9. Doctor → Break-Glass emergency access
```

---

## Feature List

### Phase 1 — Core
- JWT authentication with bcrypt passwords
- Role-based access control (Admin/Doctor/Patient/Lab Technician)
- Admin user management and approval workflow
- Specializations management

### Phase 2 — Report System
- Report group hierarchy (Patient → Group → Record → Files)
- Lab Technician upload (PDF/PNG/JPEG, multi-file)
- Internal doctor/specialization sharing with version scope
- External QR/link sharing (view-only, no download)
- SecureViewer (PDF canvas render + image viewer with zoom)
- Notification system

### Phase 3A — Corrections & Archive
- Correction workflow (select history → new record with parent link)
- ZIP export/import with metadata.json
- Deletion request → suspension → Admin review → restore/permanent
- Admin Audit Logs

### Phase 3B — Security & Compliance
- Break-Glass emergency access (password + justification)
- Abuse detection: 4th distinct patient in 30 min → auto-suspension
- Document disputes (patient → admin review → quarantine/reassign/resolve)
- Patient activity timeline (provenance feed)

---

## Security Model

### Authentication
- JWT tokens, expiry enforced
- Suspended accounts return 403 on all endpoints
- bcrypt password hashing

### File Access
- Files **never** served as static assets
- Every request goes through auth + role check
- Admin cannot view/download file contents (enforced at API level)
- Emergency (Break-Glass) access: view only, downloads return 403
- External QR/link: view only, no download

### Data Integrity
- Corrections never overwrite originals (linked via `corrects_record_id`)
- Deletion: suspension → Admin review → either restore or permanent
- All actions logged to audit table

### Path Safety
- No filesystem paths in API responses
- ZIP import validates metadata, prevents path traversal
- Upload filenames are UUID-renamed on disk

---

## Known Limitations

- File storage is local filesystem — not replicated
- No email notifications (in-app only)
- No real-time WebSocket (notifications poll every 30s)
- PDF viewer uses canvas — very large PDFs may be slow
- No virus scanning on uploads
- No multi-tenancy

---

## Phase 5 Deployment Prerequisites

> ⚠️ **Supabase and Vercel are NOT part of Phase 4. Stop here.**

Before Phase 5 can proceed:

1. **Database**: Migrate from local MySQL → hosted MySQL (e.g. PlanetScale or Supabase Postgres)
2. **File Storage**: Replace local `uploads/` → object storage (S3, Supabase Storage)
3. **Backend**: Configure for production WSGI (Gunicorn + Uvicorn workers)
4. **Frontend**: Deploy to Vercel (update `VITE_API_URL` env var)
5. **Environment**: Set production `SECRET_KEY`, `DATABASE_URL`, `CORS` origins
6. **HTTPS**: All API calls must be HTTPS in production
7. **Email**: Integrate SMTP for real email notifications
8. **Migrations**: Replace raw SQL files with Alembic migration system
