import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api from '../services/api';

const DEFAULT = {
  loginBackground: { type: 'gradient', value: 'linear-gradient(135deg,#667eea 0%,#764ba2 100%)' },
  menuPermissions: {
    assignments:    ['STUDENT','CLASS_ADMIN','TEACHER','ADMIN','SUPER_USER'],
    calendar:       ['STUDENT','CLASS_ADMIN','TEACHER','ADMIN','SUPER_USER'],
    daily_homework: ['STUDENT','CLASS_ADMIN','TEACHER','ADMIN','SUPER_USER'],
    quiz:           ['STUDENT','CLASS_ADMIN','TEACHER','ADMIN','SUPER_USER'],
    character:      ['STUDENT','CLASS_ADMIN','TEACHER','ADMIN','SUPER_USER'],
    chat:           ['STUDENT','CLASS_ADMIN','TEACHER','ADMIN','SUPER_USER'],
    treasury:       ['STUDENT','CLASS_ADMIN','TEACHER','ADMIN','SUPER_USER'],
    rewards:        ['STUDENT','CLASS_ADMIN','TEACHER','ADMIN','SUPER_USER'],
    vocab_battle:   ['STUDENT','CLASS_ADMIN','TEACHER','ADMIN','SUPER_USER'],
    leaderboard:    ['STUDENT','CLASS_ADMIN','TEACHER','ADMIN','SUPER_USER'],
  },
};

export const SettingsContext = createContext({ settings: DEFAULT, reloadSettings: () => {} });

export const SettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState(DEFAULT);

  const reloadSettings = useCallback(async () => {
    try {
      const res = await api.get('/settings');
      setSettings(s => ({ ...s, ...res.data }));
    } catch { /* ใช้ default ถ้า API ล้มเหลว */ }
  }, []);

  useEffect(() => { reloadSettings(); }, [reloadSettings]);

  return (
    <SettingsContext.Provider value={{ settings, reloadSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => useContext(SettingsContext);
