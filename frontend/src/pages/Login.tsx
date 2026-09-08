import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Mail, Lock, ArrowRight, Shield, Stethoscope, FlaskConical, Heart, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const demoCredentials = [
  { label: 'Admin',          email: 'admin@clarus.health',       password: 'admin123',   icon: <Shield className="w-4 h-4" />,       color: 'from-violet-500 to-purple-600' },
  { label: 'Doctor',         email: 'dr.chen@clarus.health',     password: 'doctor123',  icon: <Stethoscope className="w-4 h-4" />,  color: 'from-azure-500 to-blue-600' },
  { label: 'Lab Technician', email: 'lab.martinez@clarus.health', password: 'lab123',    icon: <FlaskConical className="w-4 h-4" />, color: 'from-teal-500 to-emerald-600' },
  { label: 'Patient',        email: 'emily.wilson@email.com',     password: 'patient123', icon: <Heart className="w-4 h-4" />,        color: 'from-rose-400 to-pink-500' },
];

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await login(email, password);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async (cred: typeof demoCredentials[0]) => {
    setEmail(cred.email);
    setPassword(cred.password);
    setLoading(true);
    setError('');
    try {
      await login(cred.email, cred.password);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Demo login failed. Ensure the database is seeded.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen login-bg flex items-center justify-center p-4 relative">
      {/* Decorative orbs */}
      <div className="absolute top-20 left-20 w-72 h-72 bg-azure-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-20 right-20 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="relative w-full max-w-md"
      >
        {/* Glass Login Card */}
        <div className="glass-card-elevated p-8">
          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-center mb-8"
          >
            <div className="w-16 h-16 rounded-2xl azure-gradient flex items-center justify-center mx-auto mb-4 shadow-lg shadow-azure-500/30">
              <Activity className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-navy-500 tracking-tight">Clarus Health</h1>
            <p className="text-sm text-slate-400 mt-1">Secure Medical Report Portal</p>
          </motion.div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                className="input-glass pl-11"
                autoComplete="email"
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="input-glass pl-11"
                autoComplete="current-password"
              />
            </div>

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -8, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: 'auto' }}
                  exit={{ opacity: 0, y: -8, height: 0 }}
                  className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-xs font-medium"
                >
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={loading}
              className="w-full btn-primary py-3 text-base flex items-center justify-center gap-2"
            >
              {loading ? (
                <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <>
                  Sign In
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </motion.button>
          </form>

          {/* Demo Credentials */}
          <div className="mt-8">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-100" />
              </div>
              <div className="relative flex justify-center">
                <span className="px-3 bg-white/90 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Quick Demo Access
                </span>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2">
              {demoCredentials.map((cred, idx) => (
                <motion.button
                  key={cred.label}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + idx * 0.08 }}
                  whileHover={{ scale: 1.03, y: -1 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => handleDemoLogin(cred)}
                  disabled={loading}
                  className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-slate-50/80 border border-slate-100 hover:border-slate-200 hover:bg-white transition-all duration-200 text-left group"
                >
                  <div className={`p-1.5 rounded-lg bg-gradient-to-br ${cred.color} text-white`}>
                    {cred.icon}
                  </div>
                  <span className="text-xs font-semibold text-slate-600 group-hover:text-navy-500 transition-colors">
                    {cred.label}
                  </span>
                </motion.button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-center mt-6 text-xs text-slate-400/60"
        >
          Protected by HIPAA-compliant encryption • © 2026 Clarus Health Systems
        </motion.p>
      </motion.div>
    </div>
  );
}
