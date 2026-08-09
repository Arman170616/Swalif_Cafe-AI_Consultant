import { type InputHTMLAttributes, type ReactNode, forwardRef } from 'react';

type InputFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  icon: ReactNode;
  error?: string | null;
  trailing?: ReactNode;
};

/** Icon-prefixed pill input used across the login form — a plain error string renders
 * below it (never silently swallowed) and an optional trailing slot holds the
 * password show/hide toggle. */
export const InputField = forwardRef<HTMLInputElement, InputFieldProps>(function InputField(
  { icon, error, trailing, className = '', ...props },
  ref
) {
  return (
    <div>
      <div
        className={[
          'flex items-center gap-2.5 rounded-2xl border bg-white/80 px-4 py-3 shadow-sm transition-all duration-200',
          error
            ? 'border-rose-300 focus-within:border-rose-400 focus-within:ring-2 focus-within:ring-rose-100'
            : 'border-brand-100 focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-100 focus-within:bg-white',
        ].join(' ')}
      >
        <span className="shrink-0 text-brand-400">{icon}</span>
        <input
          ref={ref}
          {...props}
          className={['w-full bg-transparent text-sm text-ink-900 placeholder:text-ink-400 outline-none', className].join(' ')}
        />
        {trailing && <span className="shrink-0">{trailing}</span>}
      </div>
      {error && <p className="mt-1.5 ps-1 text-xs font-medium text-rose-500">{error}</p>}
    </div>
  );
});
