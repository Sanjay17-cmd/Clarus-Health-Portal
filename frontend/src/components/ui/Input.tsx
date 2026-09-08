import React, { useState } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  icon?: React.ReactNode;
}

export default function Input({
  label,
  error,
  icon,
  className = '',
  id,
  ...props
}: InputProps) {
  const [focused, setFocused] = useState(false);
  const inputId = id || label.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className="relative">
      <label
        htmlFor={inputId}
        className={`
          absolute left-4 transition-all duration-200 pointer-events-none z-10
          ${focused || props.value
            ? '-top-2.5 text-xs font-semibold px-1 bg-white/90 rounded'
            : 'top-3 text-sm font-medium'
          }
          ${error
            ? 'text-red-500'
            : focused
              ? 'text-azure-600'
              : 'text-slate-400'
          }
        `}
      >
        {label}
      </label>
      <div className="relative">
        {icon && (
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
            {icon}
          </span>
        )}
        <input
          id={inputId}
          className={`
            input-glass
            ${icon ? 'pl-11' : ''}
            ${error ? 'border-red-300 focus:ring-red-500/20 focus:border-red-400' : ''}
            ${className}
          `}
          onFocus={(e) => {
            setFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            props.onBlur?.(e);
          }}
          {...props}
        />
      </div>
      {error && (
        <p className="mt-1.5 text-xs font-medium text-red-500 pl-1">{error}</p>
      )}
    </div>
  );
}
