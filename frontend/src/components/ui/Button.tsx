/**
 * Button - Tailwind Elements button wrapper with medical theme
 */

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

/**
 * Utility function to merge class names
 */
function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * Button component wrapper around Tailwind Elements
 * Provides type safety and medical theme defaults
 */
export function Button({ 
  variant = 'primary', 
  size = 'md',
  className,
  children,
  ...props 
}: ButtonProps): JSX.Element {
  const baseClasses = 'medical-button';
  
  const variantClasses = {
    primary: 'bg-blue-600 border-blue-600 text-white hover:bg-blue-700 hover:border-blue-700',
    secondary: 'bg-medical-dark-button text-medical-text-primary hover:bg-medical-dark-button-hover',
    danger: 'bg-red-600 border-red-600 text-white hover:bg-red-700 hover:border-red-700',
  };
  
  const sizeClasses = {
    sm: 'text-xs px-2 py-1 min-h-[36px]',
    md: 'text-sm px-3 py-2 min-h-[44px]',
    lg: 'text-base px-4 py-3 min-h-[52px]',
  };
  
  return (
    <button
      className={cn(
        baseClasses,
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

