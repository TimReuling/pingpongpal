import { useState, useEffect, useCallback } from 'react';
import type { Lang } from '@/lib/i18n';

interface AppSettings {
  targetScore: number;
  soundEnabled: boolean;
  darkMode: boolean;
  language: Lang;
}

const SETTINGS_KEY = 'pingpong-settings';

function loadSettings(): AppSettings {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return { targetScore: 10, soundEnabled: true, darkMode: false, language: 'en' };
}

export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings>(loadSettings);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    if (settings.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings]);

  const updateSetting = useCallback(<K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  return { settings, updateSetting };
}
