import { useEffect, useState } from 'react';
import { AuthContext } from './AuthContext';
import api from '../api/axios';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });

  // Existing users have a JWT in localStorage but no session cookie because
  // they logged in before cookie auth shipped. Exchange the JWT for a cookie
  // on app mount. Silent failure is fine — if it fails, SSE just won't work
  // and the user can re-login. Subsequent logins set the cookie directly.
  useEffect(() => {
    if (!user) return;
    api.post('/api/auth/refresh-cookie').catch(() => {
      // Cookie refresh failed (probably token expired). Don't disrupt the UX;
      // the next 401 from any API call will surface the issue naturally.
    });
  }, [user]);

  const login = (token, userData) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    // Best-effort cookie clear; ignore network errors.
    api.post('/api/auth/logout').catch(() => {});
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}