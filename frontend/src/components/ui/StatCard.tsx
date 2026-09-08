import { motion } from 'framer-motion';
import React from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: { value: string; positive: boolean };
  color?: 'azure' | 'teal' | 'amber' | 'red' | 'navy';
  delay?: number;
}

const iconBgColors = {
  azure: 'bg-azure-50 text-azure-600',
  teal: 'bg-teal-50 text-teal-600',
  amber: 'bg-amber-50 text-amber-600',
  red: 'bg-red-50 text-red-600',
  navy: 'bg-navy-50 text-navy-600',
};

export default function StatCard({
  label,
  value,
  icon,
  trend,
  color = 'azure',
  delay = 0,
}: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="glass-card p-5 flex items-start justify-between"
    >
      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          {label}
        </span>
        <span className="text-2xl font-bold text-navy-500 mt-1">
          {value}
        </span>
        {trend && (
          <span className={`text-xs font-semibold mt-1 ${trend.positive ? 'text-teal-600' : 'text-red-500'}`}>
            {trend.positive ? '↑' : '↓'} {trend.value}
          </span>
        )}
      </div>
      <div className={`p-3 rounded-xl ${iconBgColors[color]}`}>
        {icon}
      </div>
    </motion.div>
  );
}
