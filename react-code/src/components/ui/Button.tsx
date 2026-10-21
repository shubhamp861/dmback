import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'brand' | 'ice';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  children?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'default', size = 'md', children, disabled, ...props }, ref) => {
    const base = 'inline-flex items-center justify-center font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none whitespace-nowrap shrink-0 active:scale-[0.98] cursor-pointer';

    const variants = {
      default: 'bg-slate-900 text-white hover:bg-slate-800 shadow-xs',
      secondary: 'bg-sky-50 text-sky-950 hover:bg-sky-100 border border-sky-200/60',
      outline: 'border border-slate-200/80 bg-white/90 backdrop-blur-xs hover:bg-sky-50/60 hover:border-sky-200 text-slate-700 shadow-xs',
      ghost: 'text-slate-600 hover:bg-sky-50/70 hover:text-slate-900',
      destructive: 'bg-rose-600 text-white hover:bg-rose-700 shadow-xs',
      brand: 'bg-gradient-to-r from-sky-600 via-cyan-600 to-teal-600 hover:from-sky-500 hover:via-cyan-500 hover:to-teal-500 text-white shadow-sm shadow-cyan-600/20',
      ice: 'bg-sky-500/10 text-sky-700 border border-sky-300/60 hover:bg-sky-500/15',
    };

    const sizes = {
      sm: 'h-8 px-3 text-xs rounded-lg gap-1.5',
      md: 'h-10 px-4 text-sm rounded-xl gap-2',
      lg: 'h-12 px-6 text-base rounded-xl gap-2.5',
      icon: 'h-10 w-10 min-h-[44px] min-w-[44px] p-0 rounded-xl',
    };

    return (
      <button
        ref={ref}
        disabled={disabled}
        className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';
