import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import type { User, Seller, LoginInput, RegisterInput } from '@carvision/shared';
import { api, ApiRequestError } from '../lib/api';
import {
  getSessionToken,
  setSessionToken,
  clearSessionToken,
  subscribeToSessionChanges,
} from '../lib/session';
import { AUTH_ENABLED } from '../lib/config';

interface AuthState {
  status: 'loading' | 'guest' | 'user' | 'seller';
  user: User | null;
  seller: Seller | null;
}

interface AuthContextType extends AuthState {
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const GUEST_STATE: AuthState = { status: 'guest', user: null, seller: null };

/*
 * Auth o'chirilganda har qurilma uchun bitta mehmon sessiyasi. StrictMode'da effect ikki
 * marta ishlaydi — bir vaqtda ikkita mehmon yaratilmasligi uchun so'rov umumiy promise'da.
 * Ketma-ket muvaffaqiyatsizlikda (masalan backend deploy qilinmagan) cheksiz sikl bo'lmasligi
 * uchun qayta yaratish oralig'i cheklangan.
 */
let guestInFlight: Promise<AuthState> | null = null;
let lastGuestAt = 0;
const GUEST_RETRY_MS = 4000;

function ensureGuestSession(throttle = false): Promise<AuthState> {
  if (guestInFlight) return guestInFlight;
  if (throttle && Date.now() - lastGuestAt < GUEST_RETRY_MS) return Promise.resolve(GUEST_STATE);
  lastGuestAt = Date.now();

  guestInFlight = api
    .guest()
    .then((res): AuthState => {
      setSessionToken(res.token);
      return { status: 'user', user: res.user, seller: null };
    })
    .catch((): AuthState => GUEST_STATE)
    .finally(() => {
      guestInFlight = null;
    });

  return guestInFlight;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    status: 'loading',
    user: null,
    seller: null,
  });

  const fetchMe = useCallback(async () => {
    const token = getSessionToken();
    if (!token) {
      setState(AUTH_ENABLED ? GUEST_STATE : await ensureGuestSession());
      return;
    }

    try {
      const res = await api.me();
      setState({
        status: res.user.role === 'seller' ? 'seller' : 'user',
        user: res.user,
        seller: res.seller,
      });
    } catch (err) {
      clearSessionToken();
      setState(AUTH_ENABLED ? GUEST_STATE : await ensureGuestSession());
    }
  }, []);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  useEffect(() => {
    const unsubscribe = subscribeToSessionChanges(() => {
      fetchMe();
    });

    const handleExpired = (event: Event) => {
      // Allaqachon almashtirilgan (eski) tokenning kechikkan 401 javobi — e'tiborsiz
      const usedToken = (event as CustomEvent<{ token: string | null }>).detail?.token ?? null;
      if (usedToken !== getSessionToken()) return;

      clearSessionToken();
      if (AUTH_ENABLED) {
        setState(GUEST_STATE);
        return;
      }
      // Auth o'chiq: muddati tugagan mehmon sessiyasi jimgina yangisiga almashadi
      setState({ status: 'loading', user: null, seller: null });
      void ensureGuestSession(true).then(setState);
    };

    window.addEventListener('carvision:session-expired', handleExpired);

    return () => {
      unsubscribe();
      window.removeEventListener('carvision:session-expired', handleExpired);
    };
  }, [fetchMe]);

  const login = async (input: LoginInput) => {
    const res = await api.login(input);
    setSessionToken(res.token);
    setState({
      status: res.user.role === 'seller' ? 'seller' : 'user',
      user: res.user,
      seller: res.seller ?? null,
    });
  };

  const register = async (input: RegisterInput) => {
    const res = await api.register(input);
    setSessionToken(res.token);
    setState({
      status: res.user.role === 'seller' ? 'seller' : 'user',
      user: res.user,
      seller: res.seller ?? null,
    });
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch {}
    clearSessionToken();
    setState({ status: 'guest', user: null, seller: null });
  };

  const refresh = async () => {
    await fetchMe();
  };

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth AnthProvider ichida ishlatilishi kerak');
  return context;
}
