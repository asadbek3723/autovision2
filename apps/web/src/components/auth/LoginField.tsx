import { useState, useEffect, useId, type InputHTMLAttributes } from 'react';
import { Icon } from '../ui/Icon';
import { Spinner } from '../ui/States';
import { api } from '../../lib/api';

interface LoginFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  checkAvailability?: boolean;
}

export function LoginField({
  value,
  onChange,
  error: externalError,
  checkAvailability = false,
  ...props
}: LoginFieldProps) {
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [availError, setAvailError] = useState<string | null>(null);

  const id = useId();
  const errorId = `${id}-err`;

  useEffect(() => {
    if (!checkAvailability || !value || value.length < 3) {
      setChecking(false);
      setAvailable(null);
      setAvailError(null);
      return;
    }

    const timer = setTimeout(async () => {
      setChecking(true);
      try {
        const res = await api.loginAvailable(value);
        setAvailable(res.available);
        setAvailError(res.available ? null : res.reason || 'Bu login band');
      } catch {
        setAvailable(null);
      } finally {
        setChecking(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [value, checkAvailability]);

  const handleChange = (val: string) => {
    const clean = val.toLowerCase().replace(/\s+/g, '');
    onChange(clean);
  };

  const displayError = externalError || availError;

  return (
    <div className="w-full">
      <label htmlFor={id} className="block t-caption font-medium text-text mb-2 select-none">
        Login
      </label>
      <div className="relative">
        <input
          {...props}
          id={id}
          type="text"
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoComplete="username"
          inputMode="text"
          placeholder="masalan: sardor_tuning"
          aria-invalid={Boolean(displayError)}
          aria-describedby={displayError ? errorId : undefined}
          className={`h-12 w-full px-4 pr-11 text-base rounded-xl border bg-surface text-text placeholder:text-text-subtle transition-all duration-200 outline-none ${
            displayError
              ? 'border-danger focus:border-danger focus:ring-1 focus:ring-danger'
              : available === true
              ? 'border-success focus:border-success focus:ring-1 focus:ring-success'
              : 'border-border focus:border-accent focus:ring-1 focus:ring-accent'
          }`}
        />
        <div className="absolute right-3.5 top-0 h-12 flex items-center justify-center pointer-events-none text-text-muted">
          {checking ? (
            <Spinner className="w-4 h-4 text-accent" />
          ) : available === true ? (
            <Icon name="check" className="w-4 h-4 text-success stroke-[2.5]" />
          ) : available === false || displayError ? (
            <Icon name="alert" className="w-4 h-4 text-danger" />
          ) : null}
        </div>
      </div>

      {displayError ? (
        <p id={errorId} className="t-caption text-danger mt-2 flex items-center gap-1.5 animate-fadeIn">
          <Icon name="alert" className="w-3.5 h-3.5 shrink-0" />
          <span>{displayError}</span>
        </p>
      ) : (
        <p className="t-caption text-text-subtle mt-2">
          Lotin harflari, raqam, <code className="text-text-muted font-mono">_</code> va{' '}
          <code className="text-text-muted font-mono">.</code> (3–32 belgi)
        </p>
      )}
    </div>
  );
}
