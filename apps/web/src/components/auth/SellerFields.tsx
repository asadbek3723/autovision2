import { useId } from 'react';
import { Icon } from '../ui/Icon';

interface FieldInputProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  autoComplete?: string;
  type?: string;
  inputMode?: React.HTMLAttributes<HTMLElement>['inputMode'];
  error?: string;
  hint?: string;
  required?: boolean;
}

function FieldInput({
  label,
  value,
  onChange,
  placeholder,
  autoComplete,
  type = 'text',
  inputMode,
  error,
  hint,
  required,
}: FieldInputProps) {
  const id = useId();
  const errorId = `${id}-err`;
  const hintId = `${id}-hint`;

  return (
    <div className="w-full">
      <label htmlFor={id} className="block text-sm font-medium text-text mb-2 select-none">
        {label}
        {required && <span className="text-danger ml-1">*</span>}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : hint ? hintId : undefined}
        className={`h-12 w-full px-4 text-base rounded-xl border bg-surface text-text placeholder:text-text-subtle transition-all duration-200 outline-none ${
          error
            ? 'border-danger focus:border-danger focus:ring-1 focus:ring-danger'
            : 'border-border focus:border-accent focus:ring-1 focus:ring-accent'
        }`}
      />
      {error ? (
        <p id={errorId} className="text-xs text-danger mt-2 flex items-center gap-1.5 animate-fadeIn">
          <Icon name="alert" className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </p>
      ) : hint ? (
        <p id={hintId} className="text-xs text-text-subtle mt-2">{hint}</p>
      ) : null}
    </div>
  );
}

interface SellerFieldsProps {
  visible: boolean;
  businessName: string;
  onBusinessNameChange: (val: string) => void;
  phone: string;
  onPhoneChange: (val: string) => void;
  address: string;
  onAddressChange: (val: string) => void;
  errors?: Record<string, string>;
}

export function SellerFields({
  visible,
  businessName,
  onBusinessNameChange,
  phone,
  onPhoneChange,
  address,
  onAddressChange,
  errors = {},
}: SellerFieldsProps) {
  const formatPhone = (input: string) => {
    const digits = input.replace(/\D/g, '');
    let formatted = digits;
    if (digits.startsWith('998')) formatted = digits.slice(3);
    if (formatted.length > 9) formatted = formatted.slice(0, 9);

    let res = '+998';
    if (formatted.length > 0) res += ' ' + formatted.slice(0, 2);
    if (formatted.length > 2) res += ' ' + formatted.slice(2, 5);
    if (formatted.length > 5) res += ' ' + formatted.slice(5, 7);
    if (formatted.length > 7) res += ' ' + formatted.slice(7, 9);
    return res;
  };

  return (
    <div
      className={`grid transition-all duration-300 ease-out ${
        visible
          ? 'grid-rows-[1fr] opacity-100 mt-6 pt-6 border-t border-border'
          : 'grid-rows-[0fr] opacity-0 overflow-hidden'
      }`}
    >
      <div className="overflow-hidden space-y-4">
        <h3 className="text-base font-semibold text-text mb-2">Servis maʻlumotlari</h3>

        <FieldInput
          label="Servis nomi"
          required
          value={businessName}
          onChange={onBusinessNameChange}
          placeholder="masalan: Sardor Tuning Garage"
          autoComplete="organization"
          error={errors.business_name}
        />

        <FieldInput
          label="Telefon raqam"
          required
          type="tel"
          inputMode="tel"
          value={phone}
          onChange={(val) => onPhoneChange(formatPhone(val))}
          placeholder="+998 90 123 45 67"
          autoComplete="tel"
          error={errors.phone}
          hint="Mijozlar buyurtma berishda bogʻlanishlari uchun"
        />

        <FieldInput
          label="Manzil (ixtiyoriy)"
          value={address}
          onChange={onAddressChange}
          placeholder="Toshkent shahri, Chilonzor tumani"
          autoComplete="street-address"
          error={errors.address}
        />
      </div>
    </div>
  );
}
