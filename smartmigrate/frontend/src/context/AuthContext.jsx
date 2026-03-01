import React, { createContext, useContext, useState } from 'react';
import { login as apiLogin } from '../api/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('sm_token'));

  const login = async (username, password) => {
    const res = await apiLogin(username, password);
    localStorage.setItem('sm_token', res.data.token);
    setToken(res.data.token);
  };

  const logout = () => {
    localStorage.removeItem('sm_token');
    setToken(null);
  };

  return (
    <AuthContext.Provider value={{ token, login, logout, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
