/**
 * Button primitive with a small set of intentional variants. One elevation, no gradients
 * on secondary/ghost; the primary uses a subtle accent gradient for a touch of depth.
 */
const VARIANTS = {
  primary:
    'bg-accent-600 text-white hover:bg-accent-500 disabled:bg-accent-600/50 shadow-sm',
  secondary:
    'bg-elevated text-fg border border-line hover:border-faint/50 disabled:opacity-50',
  ghost: 'text-muted hover:bg-elevated hover:text-fg disabled:opacity-50',
  danger: 'bg-rose-600 text-white hover:bg-rose-500 disabled:bg-rose-600/50',
};

const SIZES = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-9 px-4 text-sm',
  lg: 'h-10 px-5 text-sm',
};

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  loading = false,
  children,
  ...props
}) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium
        transition-colors disabled:cursor-not-allowed ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading && (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  );
}
