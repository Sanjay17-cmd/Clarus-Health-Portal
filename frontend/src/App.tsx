import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Login from './pages/Login';
import DashboardShell from './components/layout/DashboardShell';
import AdminDashboard from './pages/admin/AdminDashboard';
import DoctorWorkspace from './pages/doctor/DoctorWorkspace';
import LabTechDashboard from './pages/lab/LabTechDashboard';
import PatientPortal from './pages/patient/PatientPortal';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center canvas-bg">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-3 border-azure-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium text-slate-500">Loading session...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function RoleDashboard() {
  const { user } = useAuth();

  switch (user?.role) {
    case 'Admin':
      return <AdminDashboard />;
    case 'Doctor':
      return <DoctorWorkspace />;
    case 'LabTechnician':
      return <LabTechDashboard />;
    case 'Patient':
      return <PatientPortal />;
    default:
      return <Navigate to="/login" replace />;
  }
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <DashboardShell>
              <RoleDashboard />
            </DashboardShell>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
