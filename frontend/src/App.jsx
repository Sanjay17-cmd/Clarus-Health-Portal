import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { ToastProvider } from './components/ui/Toast'
import ProtectedRoute from './components/auth/ProtectedRoute'
import RoleRoute from './components/auth/RoleRoute'

import Login from './pages/auth/Login'
import Register from './pages/auth/Register'

import AdminDashboard from './pages/admin/AdminDashboard'
import UserManagement from './pages/admin/UserManagement'
import UserDetail from './pages/admin/UserDetail'
import Specializations from './pages/admin/Specializations'
import AuditLog from './pages/admin/AuditLog'

import DoctorDashboard from './pages/doctor/DoctorDashboard'
import SharedReports from './pages/doctor/SharedReports'
import PatientDashboard from './pages/patient/PatientDashboard'
import TechnicianDashboard from './pages/technician/TechnicianDashboard'

import NotFound from './pages/common/NotFound'
import Unauthorized from './pages/common/Unauthorized'

import SharedView from './pages/shared/SharedView'

import AdminCorrections from './pages/admin/AdminCorrections'
import AdminSuspended from './pages/admin/AdminSuspended'
import AdminArchive from './pages/admin/AdminArchive'

import AdminDisputes from './pages/admin/AdminDisputes'
import AdminApprovals from './pages/admin/AdminApprovals'
import PatientActivity from './pages/patient/PatientActivity'

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/unauthorized" element={<Unauthorized />} />

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
              <Route path="/admin/approvals" element={
                <ProtectedRoute><RoleRoute role="ADMIN"><AdminApprovals /></RoleRoute></ProtectedRoute>
              } />

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

              <Route path="/technician" element={
                <ProtectedRoute>
                  <RoleRoute role="LAB_TECHNICIAN">
                    <TechnicianDashboard />
                  </RoleRoute>
                </ProtectedRoute>
              } />

              <Route path="/shared/:token" element={<SharedView />} />

              <Route path="/" element={<Navigate to="/login" replace />} />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
