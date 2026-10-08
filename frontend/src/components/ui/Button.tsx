import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { cn } from '@/utils/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'outline';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-accent-600 text-white hover:bg-accent-500 border border-accent-500/60 shadow-sm disabled:bg-accent-600/50',
  secondary:
    'bg-base-750 text-base-50 hover:bg-base-700 border border-base-600/70 disabled:opacity-50',
  outline:
    'bg-transparent text-base-100 hover:bg-base-800/70 border border-base-600/70 disabled:opacity-50',
  ghost:
    'bg-transparent text-base-200 hover:bg-base-800/70 hover:text-base-50 border border-transparent disabled:opacity-40',
  danger:
    'bg-status-danger/90 text-white hover:bg-status-danger border border-status-danger/60 disabled:opacity-50',
  success:
    'bg-status-ok/90 text-white hover:bg-status-ok border border-status-ok/60 disabled:opacity-50',
};

const SIZES: Record<Size, string> = {
  sm: 'h-7 px-2.5 text-xs gap-1.5 rounded',
  md: 'h-9 px-3.5 text-sm gap-2 rounded-md',
  lg: 'h-10 px-4 text-sm gap-2 rounded-md',
};

const BASE =
  'inline-flex select-none items-center justify-center font-medium transition-colors focus-visible:outline-none disabled:cursor-not-allowed';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Shows a spinner and disables interaction. */
  loading?: boolean;
  icon?: ReactNode;
  iconRight?: ReactNode;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'secondary',
    size = 'md',
    loading = false,
    icon,
    iconRight,
    fullWidth = false,
    className,
    children,
    disabled,
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={rest.type ?? 'button'}
      disabled={disabled || loading}
      className={cn(BASE, VARIANTS[variant], SIZES[size], fullWidth && 'w-full', className)}
      {...rest}
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : icon}
      {children}
      {!loading && iconRight}
    </button>
  );
});

interface LinkButtonProps {
  to: string;
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  iconRight?: ReactNode;
  className?: string;
  children: ReactNode;
  title?: string;
}

/** Router-aware button used for navigational actions. */
export function LinkButton({
  to,
  variant = 'secondary',
  size = 'md',
  icon,
  iconRight,
  className,
  children,
  title,
}: LinkButtonProps) {
  return (
    <Link
      to={to}
      title={title}
      className={cn(BASE, VARIANTS[variant], SIZES[size], className)}
    >
      {icon}
      {children}
      {iconRight}
    </Link>
  );
}

/** Compact icon-only button used in table rows and toolbars. */
export function IconButton({
  label,
  icon,
  variant = 'ghost',
  size = 'sm',
  className,
  ...rest
}: Omit<ButtonProps, 'icon' | 'children'> & { label: string; icon: ReactNode }) {
  return (
    <Button
      variant={variant}
      size={size}
      aria-label={label}
      title={label}
      className={cn('px-2', className)}
      {...rest}
    >
      {icon}
    </Button>
  );
}
