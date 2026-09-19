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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    status: 'loading',
    user: null,
    seller: null,
  });

  const fetchMe = useCallback(async () => {
    const token = getSessionToken();
    if (!token) {
      setState({ status: 'guest', user: null, seller: null });
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
      setState({ status: 'guest', user: null, seller: null });
    }
  }, []);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  useEffect(() => {
    const unsubscribe = subscribeToSessionChanges(() => {
      fetchMe();
    });

    const handleExpired = () => {
      clearSessionToken();
      setState({ status: 'guest', user: null, seller: null });
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
