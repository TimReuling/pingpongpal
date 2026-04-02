import { useState, useEffect, useCallback } from 'react';
import type { Lang } from '@/lib/i18n';

interface AppSettings {
  targetScore: number;
  soundEnabled: boolean;
  darkMode: boolean;
  language: Lang;
}

const SETTINGS_KEY = 'pingpong-settings';

function normalizeSettings(settings?: Partial<AppSettings> | null): AppSettings {
  return {
    targetScore: Math.max(11, Number(settings?.targetScore) || 11),
    soundEnabled: settings?.soundEnabled ?? true,
    darkMode: settings?.darkMode ?? false,
    language: settings?.language === 'nl' ? 'nl' : 'en',
  };
}

function loadSettings(): AppSettings {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) return normalizeSettings(JSON.parse(stored));
  } catch {}
  return normalizeSettings();
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
    setSettings(prev => normalizeSettings({ ...prev, [key]: value }));
  }, []);

  return { settings, updateSetting };
}
