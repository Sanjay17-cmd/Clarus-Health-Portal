import { motion } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  FileText,
  Upload,
  Share2,
  Users,
  Shield,
  Activity,
  ClipboardList,
  LogOut,
  Heart,
  Stethoscope,
  FlaskConical,
  UserCircle,
} from 'lucide-react';

const roleNavigation: Record<string, Array<{ label: string; icon: React.ReactNode; path: string }>> = {
  Admin: [
    { label: 'Dashboard',  icon: <LayoutDashboard className="w-5 h-5" />, path: '/' },
    { label: 'Users',      icon: <Users className="w-5 h-5" />,           path: '/' },
    { label: 'Audit Logs', icon: <ClipboardList className="w-5 h-5" />,   path: '/' },
    { label: 'Reports',    icon: <FileText className="w-5 h-5" />,        path: '/' },
  ],
  Doctor: [
    { label: 'Workspace',     icon: <Stethoscope className="w-5 h-5" />,  path: '/' },
    { label: 'Patient Search',icon: <Users className="w-5 h-5" />,        path: '/' },
    { label: 'Reports',       icon: <FileText className="w-5 h-5" />,     path: '/' },
  ],
  LabTechnician: [
    { label: 'Dashboard',   icon: <FlaskConical className="w-5 h-5" />,   path: '/' },
    { label: 'Upload',      icon: <Upload className="w-5 h-5" />,         path: '/' },
    { label: 'My Uploads',  icon: <FileText className="w-5 h-5" />,       path: '/' },
  ],
  Patient: [
    { label: 'My Reports',   icon: <FileText className="w-5 h-5" />,      path: '/' },
    { label: 'Share',         icon: <Share2 className="w-5 h-5" />,        path: '/' },
    { label: 'Profile',      icon: <UserCircle className="w-5 h-5" />,    path: '/' },
  ],
};

const roleIcons: Record<string, React.ReactNode> = {
  Admin:         <Shield className="w-4 h-4" />,
  Doctor:        <Stethoscope className="w-4 h-4" />,
  LabTechnician: <FlaskConical className="w-4 h-4" />,
  Patient:       <Heart className="w-4 h-4" />,
};

export default function Sidebar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  if (!user) return null;

  const navItems = roleNavigation[user.role] || [];

  return (
    <motion.aside
      initial={{ x: -280 }}
      animate={{ x: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="fixed left-0 top-0 bottom-0 w-[260px] navy-gradient flex flex-col z-40"
    >
      {/* Logo */}
      <div className="px-6 py-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl azure-gradient flex items-center justify-center shadow-lg">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-white font-bold text-base tracking-tight">Clarus</h1>
            <p className="text-slate-400 text-[10px] font-medium uppercase tracking-widest">Health Portal</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
        <p className="px-4 mb-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
          Navigation
        </p>
        {navItems.map((item, idx) => {
          const isActive = idx === 0; // First item is always active in single-page dashboard
          return (
            <motion.button
              key={item.label}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05, duration: 0.3 }}
              onClick={() => navigate(item.path)}
              className={`w-full ${isActive ? 'sidebar-link-active' : 'sidebar-link'}`}
            >
              {item.icon}
              <span>{item.label}</span>
            </motion.button>
          );
        })}
      </nav>

      {/* User Info & Logout */}
      <div className="px-4 py-4 border-t border-white/10">
        <div className="flex items-center gap-3 px-3 py-2 mb-3">
          <div className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center text-white font-bold text-sm">
            {user.full_name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-semibold truncate">{user.full_name}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              {roleIcons[user.role]}
              <p className="text-slate-400 text-[11px] font-medium">{user.role}</p>
            </div>
          </div>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => { logout(); navigate('/login'); }}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-red-300 hover:text-red-200 hover:bg-red-500/15 transition-all duration-200"
        >
          <LogOut className="w-4 h-4" />
          <span>Log Out</span>
        </motion.button>
      </div>
    </motion.aside>
  );
}
