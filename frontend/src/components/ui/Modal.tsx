/**
 * Modal - Tailwind Elements modal wrapper with medical theme
 */

export interface ModalProps {
  id: string;
  title: string;
  children: React.ReactNode;
  isOpen: boolean;
  onClose: () => void;
  footer?: React.ReactNode;
}

/**
 * Utility function to merge class names
 */
function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * Modal component wrapper around Tailwind Elements
 * Provides type safety and medical theme defaults
 */
export function Modal({ 
  id, 
  title, 
  children, 
  isOpen, 
  onClose, 
  footer 
}: ModalProps): JSX.Element {
  if (!isOpen) return <></>;
  
  return (
    <div
      id={id}
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-[10000]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${id}-title`}
    >
      <div
        className="bg-medical-dark-primary border border-medical-dark-border rounded-medical p-4 max-w-md w-[90%] max-h-[80vh] overflow-y-auto shadow-medical"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-3">
          <h3 id={`${id}-title`} className="m-0 text-medical-text-primary text-lg font-semibold">
            {title}
          </h3>
          <button
            onClick={onClose}
            className="text-medical-text-secondary hover:text-medical-text-primary text-2xl leading-none p-1"
            aria-label="Close modal"
          >
            ×
          </button>
        </div>
        
        <div className="mb-4 text-medical-text-primary">
          {children}
        </div>
        
        {footer && (
          <div className="flex gap-2 justify-end">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Modal Trigger - Button that opens a modal
 */
export interface ModalTriggerProps {
  targetId: string;
  children: React.ReactNode;
  className?: string;
}

export function ModalTrigger({ targetId, children, className }: ModalTriggerProps): JSX.Element {
  return (
    <button
      className={cn('medical-button', className)}
      data-te-toggle="modal"
      data-te-target={`#${targetId}`}
      type="button"
    >
      {children}
    </button>
  );
}

