import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { ToastProvider } from './components/ui/Toast'

// Auth guards
import ProtectedRoute from './components/auth/ProtectedRoute'
import RoleRoute from './components/auth/RoleRoute'

// Auth pages
import Login from './pages/auth/Login'
import Register from './pages/auth/Register'

// Admin pages
import AdminDashboard from './pages/admin/AdminDashboard'
import UserManagement from './pages/admin/UserManagement'
import UserDetail from './pages/admin/UserDetail'
import Specializations from './pages/admin/Specializations'
import AuditLog from './pages/admin/AuditLog'

// Role dashboards
import DoctorDashboard from './pages/doctor/DoctorDashboard'
import SharedReports from './pages/doctor/SharedReports'
import PatientDashboard from './pages/patient/PatientDashboard'
import TechnicianDashboard from './pages/technician/TechnicianDashboard'

// Common
import NotFound from './pages/common/NotFound'
import Unauthorized from './pages/common/Unauthorized'

// Phase 2
import SharedView from './pages/shared/SharedView'

// Phase 3A
import AdminCorrections from './pages/admin/AdminCorrections'
import AdminSuspended from './pages/admin/AdminSuspended'
import AdminArchive from './pages/admin/AdminArchive'

// Phase 3B
import AdminDisputes from './pages/admin/AdminDisputes'
import PatientActivity from './pages/patient/PatientActivity'

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/unauthorized" element={<Unauthorized />} />

              {/* Admin routes */}
              <Route path="/admin" element={
                <ProtectedRoute>
                  <RoleRoute role="ADMIN">
                    <AdminDashboard />
                  </RoleRoute>
                </ProtectedRoute>
              } />
              <Route path="/admin/users" element={
                <ProtectedRoute>
                  <RoleRoute role="ADMIN">
                    <UserManagement />
                  </RoleRoute>
                </ProtectedRoute>
              } />
              <Route path="/admin/users/:id" element={
                <ProtectedRoute>
                  <RoleRoute role="ADMIN">
                    <UserDetail />
                  </RoleRoute>
                </ProtectedRoute>
              } />
              <Route path="/admin/specializations" element={
                <ProtectedRoute>
                  <RoleRoute role="ADMIN">
                    <Specializations />
                  </RoleRoute>
                </ProtectedRoute>
              } />
              <Route path="/admin/audit" element={
                <ProtectedRoute><RoleRoute role="ADMIN"><AuditLog /></RoleRoute></ProtectedRoute>
              } />
              <Route path="/admin/corrections" element={
                <ProtectedRoute><RoleRoute role="ADMIN"><AdminCorrections /></RoleRoute></ProtectedRoute>
              } />
              <Route path="/admin/suspended" element={
                <ProtectedRoute><RoleRoute role="ADMIN"><AdminSuspended /></RoleRoute></ProtectedRoute>
              } />
              <Route path="/admin/archive" element={
                <ProtectedRoute><RoleRoute role="ADMIN"><AdminArchive /></RoleRoute></ProtectedRoute>
              } />
              <Route path="/admin/disputes" element={
                <ProtectedRoute><RoleRoute role="ADMIN"><AdminDisputes /></RoleRoute></ProtectedRoute>
              } />

              {/* Doctor routes */}
              <Route path="/doctor" element={
                <ProtectedRoute>
                  <RoleRoute role="DOCTOR">
                    <DoctorDashboard />
                  </RoleRoute>
                </ProtectedRoute>
              } />

              <Route path="/doctor/shared" element={
                <ProtectedRoute>
                  <RoleRoute role="DOCTOR">
                    <SharedReports />
                  </RoleRoute>
                </ProtectedRoute>
              } />


              <Route path="/patient" element={
                <ProtectedRoute><RoleRoute role="PATIENT"><PatientDashboard /></RoleRoute></ProtectedRoute>
              } />
              <Route path="/patient/activity" element={
                <ProtectedRoute><RoleRoute role="PATIENT"><PatientActivity /></RoleRoute></ProtectedRoute>
              } />

              {/* Technician routes */}
              <Route path="/technician" element={
                <ProtectedRoute>
                  <RoleRoute role="LAB_TECHNICIAN">
                    <TechnicianDashboard />
                  </RoleRoute>
                </ProtectedRoute>
              } />

              {/* Phase 2 — External share (no auth) */}
              <Route path="/shared/:token" element={<SharedView />} />

              {/* Root redirect */}
              <Route path="/" element={<Navigate to="/login" replace />} />

              {/* 404 */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
