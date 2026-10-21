import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`rounded-2xl border border-sky-100/90 bg-white/90 backdrop-blur-xs p-5 md:p-6 shadow-[0_4px_24px_-4px_rgba(207,250,254,0.35)] ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Card.displayName = 'Card';

export interface StatusBadgeProps {
  status: 'active' | 'inactive' | 'pending';
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className = '' }) => {
  const configs = {
    active: {
      dot: 'bg-emerald-500',
      text: 'text-emerald-700',
      label: 'Active',
      bg: 'bg-emerald-50/90 border-emerald-200/60',
    },
    inactive: {
      dot: 'bg-slate-400',
      text: 'text-slate-600',
      label: 'Inactive',
      bg: 'bg-slate-100/90 border-slate-200/60',
    },
    pending: {
      dot: 'bg-amber-500',
      text: 'text-amber-700',
      label: 'Paused',
      bg: 'bg-amber-50/90 border-amber-200/60',
    },
  };

  const current = configs[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${current.bg} ${current.text} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${current.dot}`} aria-hidden="true" />
      {current.label}
    </span>
  );
};
