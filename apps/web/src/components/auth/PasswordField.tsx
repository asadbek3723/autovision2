import { useState, useId, type InputHTMLAttributes } from 'react';
import { Icon } from '../ui/Icon';
import { StrengthMeter } from './StrengthMeter';
import { haptic } from '../../lib/haptics';

interface PasswordFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  showStrength?: boolean;
  login?: string;
}

export function PasswordField({
  label,
  value,
  onChange,
  error,
  hint,
  showStrength = false,
  login,
  autoComplete = 'current-password',
  ...props
}: PasswordFieldProps) {
  const [show, setShow] = useState(false);
  const id = useId();
  const errorId = `${id}-err`;
  const hintId = `${id}-hint`;

  const toggleShow = () => {
    haptic('light');
    setShow((prev) => !prev);
  };

  return (
    <div className="w-full">
      <label htmlFor={id} className="block t-caption font-medium text-text mb-2 select-none">
        {label}
      </label>
      <div className="relative">
        <input
          {...props}
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : hint ? hintId : undefined}
          className={`h-12 w-full px-4 pr-12 text-base rounded-xl border bg-surface text-text placeholder:text-text-subtle transition-all duration-200 outline-none ${
            error
              ? 'border-danger focus:border-danger focus:ring-1 focus:ring-danger'
              : 'border-border focus:border-accent focus:ring-1 focus:ring-accent'
          }`}
        />
        <button
          type="button"
          onClick={toggleShow}
          aria-label={show ? 'Parolni yashirish' : 'Parolni koʻrsatish'}
          aria-pressed={show}
          className="absolute right-0 top-0 h-12 w-12 flex items-center justify-center text-text-muted hover:text-text focus-visible:text-accent transition-colors outline-none"
        >
          <Icon name={show ? 'eye-off' : 'eye'} className="w-5 h-5" />
        </button>
      </div>

      {showStrength && <StrengthMeter password={value} login={login} />}

      {error ? (
        <p id={errorId} className="t-caption text-danger mt-2 flex items-center gap-1.5 animate-fadeIn">
          <Icon name="alert" className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </p>
      ) : hint ? (
        <p id={hintId} className="t-caption text-text-subtle mt-2">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
