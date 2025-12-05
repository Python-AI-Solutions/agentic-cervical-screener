/**
 * Badge - Tailwind Elements badge wrapper with medical theme
 */

export interface BadgeProps {
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  className?: string;
}

/**
 * Utility function to merge class names
 */
function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * Badge component wrapper around Tailwind Elements
 * Provides type safety and medical theme defaults
 */
export function Badge({ 
  variant = 'default', 
  size = 'md',
  children,
  className 
}: BadgeProps): JSX.Element {
  const baseClasses = 'pill inline-flex items-center justify-center font-medium';
  
  const variantClasses = {
    default: 'bg-medical-dark-button text-medical-text-primary border-medical-dark-border',
    primary: 'bg-blue-600 text-white border-blue-600',
    success: 'bg-green-600 text-white border-green-600',
    warning: 'bg-yellow-600 text-white border-yellow-600',
    danger: 'bg-red-600 text-white border-red-600',
  };
  
  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0.5',
    md: 'text-xs px-2 py-1',
    lg: 'text-sm px-2.5 py-1.5',
  };
  
  return (
    <span
      className={cn(
        baseClasses,
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
    >
      {children}
    </span>
  );
}

