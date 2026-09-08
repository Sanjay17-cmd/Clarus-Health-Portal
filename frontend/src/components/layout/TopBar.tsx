import { Bell, Search } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';

const roleGreetings: Record<string, string> = {
  Admin:         'System Administration',
  Doctor:        'Clinical Workspace',
  LabTechnician: 'Laboratory Dashboard',
  Patient:       'My Health Portal',
};

export default function TopBar() {
  const { user } = useAuth();

  const now = new Date();
  const timeStr = now.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <motion.header
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.2 }}
      className="h-16 flex items-center justify-between px-8 border-b border-slate-100/60 bg-white/50 backdrop-blur-sm"
    >
      {/* Left — Title */}
      <div>
        <h2 className="text-lg font-bold text-navy-500">
          {roleGreetings[user?.role || ''] || 'Dashboard'}
        </h2>
        <p className="text-xs text-slate-400 font-medium -mt-0.5">{timeStr}</p>
      </div>

      {/* Right — Actions */}
      <div className="flex items-center gap-3">
        {/* Search bar */}
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Quick search..."
            className="pl-9 pr-4 py-2 rounded-xl bg-slate-50/80 border border-slate-100 text-sm text-slate-600 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-azure-500/20 focus:border-azure-300 transition-all w-56"
          />
        </div>

        {/* Notifications */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="relative p-2.5 rounded-xl text-slate-400 hover:text-navy-500 hover:bg-slate-100/60 transition-colors"
        >
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-azure-500 rounded-full ring-2 ring-white" />
        </motion.button>

        {/* User avatar */}
        <div className="w-9 h-9 rounded-full azure-gradient-soft flex items-center justify-center text-white font-bold text-sm shadow-md">
          {user?.full_name?.charAt(0) || '?'}
        </div>
      </div>
    </motion.header>
  );
}
