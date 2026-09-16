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
    const { token, ...profile } = res.data;
    setUser(profile);
    return res.data;
  };

  const register = async (userData) => {
    const res = await api.post('/users/register', userData);
    localStorage.setItem('token', res.data.token);
    const { token, ...profile } = res.data;
    setUser(profile);
    return res.data;
  };

  // แก้ user ในหน่วยความจำทันทีหลังบันทึก (เช่น ตัวละครที่แก้ในหน้าตัวละคร)
  const updateUser = (patch) => setUser(u => (u ? { ...u, ...patch } : u));

  // ดึงโปรไฟล์ล่าสุดจากเซิร์ฟเวอร์
  const refreshUser = async () => {
    try {
      const res = await api.get('/users/me');
      setUser(res.data);
      return res.data;
    } catch { return null; }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading, updateUser, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};
