/**
 * Toggle - Tailwind Elements toggle/switch wrapper with medical theme
 */

export interface ToggleProps {
  id?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Utility function to merge class names
 */
function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * Toggle component wrapper around Tailwind Elements
 * Provides type safety and medical theme defaults
 */
export function Toggle({ 
  id,
  checked, 
  onChange, 
  label,
  disabled = false,
  className 
}: ToggleProps): JSX.Element {
  return (
    <label className={cn('flex items-center gap-2 cursor-pointer', className)}>
      {label && (
        <span className="text-sm text-medical-text-primary">{label}</span>
      )}
      <div className="toggle-switch">
        <input
          type="checkbox"
          id={id}
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className="sr-only"
        />
        <span className="toggle-slider" />
      </div>
    </label>
  );
}

