import React, { createContext, useState, useEffect } from 'react';
import api from '../services/api';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check if user is logged in on mount
  useEffect(() => {
    const checkLoggedIn = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const res = await api.get('/users/me');
          setUser(res.data);
        } catch (error) {
          console.error('Authentication failed', error);
          localStorage.removeItem('token');
          setUser(null);
        }
      }
      setLoading(false);
    };

    checkLoggedIn();
  }, []);

  const login = async (username, password) => {
    const res = await api.post('/users/login', { username, password });
    localStorage.setItem('token', res.data.token);
    setUser({
      id: res.data.id,
      username: res.data.username,
      role: res.data.role,
      name: res.data.name,
    });
    return res.data;
  };

  const register = async (userData) => {
    const res = await api.post('/users/register', userData);
    localStorage.setItem('token', res.data.token);
    setUser({
      id: res.data.id,
      username: res.data.username,
      role: res.data.role,
      name: res.data.name,
    });
    return res.data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
