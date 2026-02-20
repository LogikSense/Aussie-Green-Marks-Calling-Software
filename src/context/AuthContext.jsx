import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || '';

const AuthContext = createContext(null);

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || null);
  const [loading, setLoading] = useState(true);

  const persist = useCallback((newToken, newUser) => {
    if (newToken) {
      localStorage.setItem(TOKEN_KEY, newToken);
      setToken(newToken);
    } else {
      localStorage.removeItem(TOKEN_KEY);
      setToken(null);
    }
    if (newUser != null) {
      localStorage.setItem(USER_KEY, JSON.stringify(newUser));
      setUser(newUser);
    } else {
      localStorage.removeItem(USER_KEY);
      setUser(null);
    }
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.detail || 'Login failed');
    }
    const { access_token } = await res.json();
    const meRes = await fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const meData = meRes.ok ? await meRes.json() : null;
    persist(access_token, meData);
    return meData;
  }, [persist]);

  const register = useCallback(async (email, password, fullName) => {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, full_name: fullName || null }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.detail || 'Registration failed');
    }
    const { access_token } = await res.json();
    const meRes = await fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const meData = meRes.ok ? await meRes.json() : null;
    persist(access_token, meData);
    return meData;
  }, [persist]);

  const logout = useCallback(() => {
    persist(null, null);
  }, [persist]);

  const getAuthHeaders = useCallback(() => {
    const t = token || localStorage.getItem(TOKEN_KEY);
    return t ? { Authorization: `Bearer ${t}` } : {};
  }, [token]);

  useEffect(() => {
    const t = localStorage.getItem(TOKEN_KEY);
    if (!t) {
      setLoading(false);
      return;
    }
    fetch(`${API_BASE}/auth/me`, { headers: { Authorization: `Bearer ${t}` } })
      .then((res) => {
        if (res.ok) return res.json();
        persist(null, null);
        return null;
      })
      .then((data) => {
        if (data) {
          setUser(data);
          setToken(t);
        }
      })
      .catch(() => persist(null, null))
      .finally(() => setLoading(false));
  }, []);

  const value = {
    user,
    token,
    loading,
    isAuthenticated: !!token,
    login,
    register,
    logout,
    getAuthHeaders,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
