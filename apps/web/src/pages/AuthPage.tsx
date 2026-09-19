import { useState, useEffect, useId, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { UserRole } from '@carvision/shared';
import { useAuth } from '../auth/useAuth';
import { ApiRequestError } from '../lib/api';
import { Segmented } from '../components/ui/Segmented';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';
import { RoleCard } from '../components/auth/RoleCard';
import { LoginField } from '../components/auth/LoginField';
import { PasswordField } from '../components/auth/PasswordField';
import { SellerFields } from '../components/auth/SellerFields';
import { haptic, notifyHaptic } from '../lib/haptics';

type Tab = 'register' | 'login';

export function AuthPage() {
  const nameId = useId();
  const { login: doLogin, register: doRegister, status, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [tab, setTab] = useState<Tab>(() => {
    try {
      return localStorage.getItem('carvision_seen_auth') ? 'login' : 'register';
    } catch {
      return 'register';
    }
  });

  const [role, setRole] = useState<UserRole>('user');
  const [roleError, setRoleError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [businessName, setBusinessName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [retryAfter, setRetryAfter] = useState<number | null>(null);

  useEffect(() => {
    if (status !== 'loading' && status !== 'guest' && user) {
      const from = (location.state as { from?: string })?.from;
      navigate(from || (user.role === 'seller' ? '/seller' : '/'), { replace: true });
    }
  }, [status, user, navigate, location]);

  useEffect(() => {
    if (!retryAfter || retryAfter <= 0) {
      setRetryAfter(null);
      return;
    }
    const timer = setInterval(() => {
      setRetryAfter((prev) => {
        if (!prev || prev <= 1) {
          clearInterval(timer);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [retryAfter]);

  const handleTabChange = (newTab: Tab) => {
    setTab(newTab);
    setGlobalError(null);
    setFieldErrors({});
    try {
      localStorage.setItem('carvision_seen_auth', 'true');
    } catch {}
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setGlobalError(null);
    setFieldErrors({});
    setRoleError(null);

    if (tab === 'register') {
      const errs: Record<string, string> = {};
      if (!name.trim() || name.trim().length < 2) {
        errs.name = 'Ismingizni kiriting (2–60 belgi)';
      }
      if (!login) {
        errs.login = 'Loginni kiriting';
      }
      if (!password || password.length < 8) {
        errs.password = 'Parol kamida 8 ta belgi boʻlishi kerak';
      }
      if (password !== confirmPassword) {
        errs.confirmPassword = 'Parollar mos kelmadi';
      }

      if (role === 'seller') {
        if (!businessName.trim() || businessName.trim().length < 2) {
          errs.business_name = 'Servis nomini kiriting';
        }
        if (!phone.trim() || !/^\+998\d{9}$/.test(phone.replace(/\s+/g, ''))) {
          errs.phone = 'Telefon raqamini kiriting (+998 XX XXX XX XX)';
        }
      }

      if (Object.keys(errs).length > 0) {
        setFieldErrors(errs);
        notifyHaptic('warning');
        return;
      }
    } else {
      if (!login || !password) {
        setGlobalError('Login va parolni kiriting');
        notifyHaptic('warning');
        return;
      }
    }

    setSubmitting(true);

    try {
      if (tab === 'register') {
        await doRegister({
          role,
          name: name.trim(),
          login: login.trim(),
          password,
          business_name: role === 'seller' ? businessName.trim() : undefined,
          phone: role === 'seller' ? phone.trim() : undefined,
          address: role === 'seller' ? address.trim() : undefined,
        });
      } else {
        await doLogin({
          login: login.trim(),
          password,
        });
      }
      haptic('heavy');
      notifyHaptic('success');
    } catch (err: any) {
      notifyHaptic('error');
      if (err instanceof ApiRequestError) {
        if (err.fields) {
          setFieldErrors(err.fields);
        }
        if (err.retryAfter) {
          setRetryAfter(err.retryAfter);
        }
        setGlobalError(err.message);
      } else {
        setGlobalError(err?.message || 'Ulanishda xatolik. Qaytadan urinib koʻring.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="min-h-dvh w-full bg-bg text-text flex items-center justify-center relative overflow-x-hidden selection:bg-accent selection:text-white">
      {/* Background Subtle Gradient Blobs */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-accent/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-[1120px] mx-auto min-h-dvh lg:min-h-0 lg:my-8 lg:rounded-3xl lg:border lg:border-border lg:bg-surface lg:shadow-2xl lg:overflow-hidden grid grid-cols-1 lg:grid-cols-12 relative z-10">
        
        {/* Desktop Left Brand Side Panel */}
        <div className="hidden lg:flex lg:col-span-5 bg-gradient-to-br from-surface to-surface-2 border-r border-border p-10 flex-col justify-between relative overflow-hidden">
          <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-accent/15 rounded-full blur-2xl pointer-events-none" />
          
          <div>
            <div className="flex items-center gap-3 mb-12">
              <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-accent/30">
                CV
              </div>
              <span className="t-h1 font-bold tracking-[0.2em] text-text">CARVISION</span>
            </div>

            <h2 className="t-hero font-bold tracking-tight text-text mb-4 leading-tight">
              AI Car Customization <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent to-blue-400">
                + Tuning Parts
              </span>
            </h2>

            <p className="t-body text-text-muted leading-relaxed mb-8">
              Avtomobilingiz rasmini yuklang, AI tuning oʻzgarishlarini vizual koʻring va real ehtiyot qismlarni marketplace orqali sotib oling.
            </p>
          </div>

          <div className="space-y-4 pt-6 border-t border-border">
            <div className="flex items-center gap-3 text-text-muted t-caption">
              <Icon name="check" className="w-4 h-4 text-accent shrink-0 stroke-[2.5]" />
              <span>Avtomobil rakurslari boʻyicha AI visualizer</span>
            </div>
            <div className="flex items-center gap-3 text-text-muted t-caption">
              <Icon name="check" className="w-4 h-4 text-accent shrink-0 stroke-[2.5]" />
              <span>Mos tuning qismlar va marketplace buyurtma</span>
            </div>
            <div className="flex items-center gap-3 text-text-muted t-caption">
              <Icon name="check" className="w-4 h-4 text-accent shrink-0 stroke-[2.5]" />
              <span>Avto-servis egalari uchun mahsulotlar boshqaruvi</span>
            </div>
          </div>
        </div>

        {/* Main Form Area */}
        <div className="col-span-1 lg:col-span-7 p-6 sm:p-8 lg:p-12 flex flex-col justify-center max-w-[480px] lg:max-w-none mx-auto w-full">
          
          {/* Mobile Logo Line */}
          <div className="flex lg:hidden items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center text-white font-bold text-xl shadow-md">
              CV
            </div>
            <span className="t-h2 font-bold tracking-[0.2em] text-text">CARVISION</span>
          </div>

          <div className="mb-6">
            <h1 className="t-display font-bold tracking-tight text-text mb-2">
              {tab === 'register' ? 'Akkaunt yaratish' : 'Xush kelibsiz'}
            </h1>
            <p className="t-body text-text-muted">
              {tab === 'register'
                ? 'CarVision imkoniyatlaridan foydalanish uchun roʻyxatdan oʻting.'
                : 'Davom etish uchun akkauntingizga kiring.'}
            </p>
          </div>

          {/* Segmented Control */}
          <div className="mb-6">
            <Segmented
              ariaLabel="Akkaunt harakatlari"
              options={[
                { id: 'register', label: 'Roʻyxatdan oʻtish' },
                { id: 'login', label: 'Kirish' },
              ]}
              value={tab}
              onChange={handleTabChange}
            />
          </div>

          {/* Form */}
          <form noValidate onSubmit={handleSubmit} className="space-y-4">
            
            {/* Global Error Alert */}
            {globalError && (
              <div
                role="alert"
                className="p-4 rounded-xl border border-danger/30 bg-danger/10 text-danger t-caption flex items-start gap-3 animate-fadeIn"
              >
                <Icon name="alert" className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold">{globalError}</p>
                  {retryAfter && (
                    <p className="mt-1 text-danger/80">
                      Qayta urinish vaqti:{' '}
                      <span className="font-mono font-bold">{formatTime(retryAfter)}</span>
                    </p>
                  )}
                </div>
              </div>
            )}

            {tab === 'register' && (
              <>
                {/* Role Selection Group */}
                <div className="mb-6">
                  <label className="block t-h2 font-semibold text-text mb-3">Siz kimsiz?</label>
                  <div role="radiogroup" aria-label="Akkaunt turi" className="space-y-3">
                    <RoleCard role="user" selected={role === 'user'} onSelect={setRole} />
                    <RoleCard role="seller" selected={role === 'seller'} onSelect={setRole} />
                  </div>
                  {roleError && <p className="t-caption text-danger mt-2">{roleError}</p>}
                </div>

                <div className="w-full">
                  <label htmlFor={nameId} className="block text-sm font-medium text-text mb-2 select-none">
                    Ismingiz <span className="text-danger">*</span>
                  </label>
                  <input
                    id={nameId}
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="masalan: Sardor"
                    autoComplete="name"
                    aria-invalid={Boolean(fieldErrors.name)}
                    className={`h-12 w-full px-4 text-base rounded-xl border bg-surface text-text placeholder:text-text-subtle transition-all duration-200 outline-none ${
                      fieldErrors.name
                        ? 'border-danger focus:border-danger focus:ring-1 focus:ring-danger'
                        : 'border-border focus:border-accent focus:ring-1 focus:ring-accent'
                    }`}
                  />
                  {fieldErrors.name && (
                    <p className="text-xs text-danger mt-2 flex items-center gap-1.5 animate-fadeIn">
                      <Icon name="alert" className="w-3.5 h-3.5 shrink-0" />
                      <span>{fieldErrors.name}</span>
                    </p>
                  )}
                </div>
              </>
            )}

            <LoginField
              value={login}
              onChange={setLogin}
              error={fieldErrors.login}
              checkAvailability={tab === 'register'}
            />

            <PasswordField
              label="Parol *"
              value={password}
              onChange={setPassword}
              error={fieldErrors.password}
              showStrength={tab === 'register'}
              login={login}
              autoComplete={tab === 'register' ? 'new-password' : 'current-password'}
            />

            {tab === 'register' && (
              <>
                <PasswordField
                  label="Parolni takrorlang *"
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  error={fieldErrors.confirmPassword}
                  autoComplete="new-password"
                />

                {/* Password Recovery Warning Banner */}
                <div className="p-3.5 rounded-xl border border-warning/30 bg-warning/10 text-warning t-caption flex items-start gap-2.5 mt-4">
                  <Icon name="alert" className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    Parolni tiklash imkoni hozircha yoʻq. Parolingizni xavfsiz joyda saqlang.
                  </span>
                </div>

                {/* Seller Extra Fields */}
                <SellerFields
                  visible={role === 'seller'}
                  businessName={businessName}
                  onBusinessNameChange={setBusinessName}
                  phone={phone}
                  onPhoneChange={setPhone}
                  address={address}
                  onAddressChange={setAddress}
                  errors={fieldErrors}
                />
              </>
            )}

            {/* Submit Button */}
            <div className="pt-2">
              <Button
                type="submit"
                size="lg"
                fullWidth
                loading={submitting}
                disabled={Boolean(retryAfter)}
              >
                {tab === 'register' ? 'Roʻyxatdan oʻtish' : 'Kirish'}
              </Button>
            </div>
          </form>

          {/* Bottom Switch Link */}
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => handleTabChange(tab === 'register' ? 'login' : 'register')}
              className="t-caption text-text-muted hover:text-text transition-colors min-h-[44px] inline-flex items-center justify-center px-2"
            >
              {tab === 'register' ? (
                <>
                  Akkauntingiz bormi?{' '}
                  <span className="text-accent-soft font-semibold ml-1 hover:underline">Kirish</span>
                </>
              ) : (
                <>
                  Akkauntingiz yoʻqmi?{' '}
                  <span className="text-accent-soft font-semibold ml-1 hover:underline">
                    Roʻyxatdan oʻtish
                  </span>
                </>
              )}
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}
