import { CheckCircle, Clock, AlertTriangle } from 'lucide-react';

interface BadgeProps {
  status: 'Verified' | 'Pending' | 'Flagged' | string;
  size?: 'sm' | 'md';
}

const badgeConfig: Record<string, { class: string; icon: React.ReactNode; label: string }> = {
  Verified: {
    class: 'badge-verified',
    icon: <CheckCircle className="w-3 h-3" />,
    label: 'Verified',
  },
  Pending: {
    class: 'badge-pending',
    icon: <Clock className="w-3 h-3" />,
    label: 'Pending',
  },
  Flagged: {
    class: 'badge-flagged',
    icon: <AlertTriangle className="w-3 h-3" />,
    label: 'Flagged',
  },
};

export default function Badge({ status, size = 'md' }: BadgeProps) {
  const config = badgeConfig[status] || {
    class: 'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-50 text-slate-600 border border-slate-200/60',
    icon: null,
    label: status,
  };

  return (
    <span className={`${config.class} ${size === 'sm' ? 'text-[10px] px-2 py-0.5' : ''}`}>
      {config.icon}
      {config.label}
    </span>
  );
}
