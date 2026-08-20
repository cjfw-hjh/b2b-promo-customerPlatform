import { createContext, useContext, useEffect, useState, useCallback, createElement } from 'react';
import { getSession, logout as logoutRequest } from '../api/authApi';

const SessionContext = createContext(undefined);

export function SessionProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSession()
      .then(setSession)
      .catch(() => setSession(null))
      .finally(() => setLoading(false));
  }, []);

  const logout = useCallback(async () => {
    await logoutRequest();
    setSession(null);
  }, []);

  const value = { session, loading, setSession, logout };
  return createElement(SessionContext.Provider, { value }, children);
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (ctx === undefined) {
    throw new Error('useSession은 SessionProvider 내부에서만 사용할 수 있습니다.');
  }
  return ctx;
}
