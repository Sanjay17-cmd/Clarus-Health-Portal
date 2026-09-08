import { motion, HTMLMotionProps } from 'framer-motion';
import React from 'react';

interface GlassCardProps extends HTMLMotionProps<'div'> {
  variant?: 'default' | 'sm' | 'elevated';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hover?: boolean;
  children: React.ReactNode;
}

const paddingMap = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

const variantClasses = {
  default: 'glass-card',
  sm: 'glass-card-sm',
  elevated: 'glass-card-elevated',
};

export default function GlassCard({
  variant = 'default',
  padding = 'md',
  hover = false,
  children,
  className = '',
  ...motionProps
}: GlassCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      whileHover={hover ? { y: -2, boxShadow: '0 20px 50px -10px rgba(10, 37, 64, 0.14)' } : undefined}
      className={`${variantClasses[variant]} ${paddingMap[padding]} ${className}`}
      {...motionProps}
    >
      {children}
    </motion.div>
  );
}
