// src/services/settings.ts
import { Preferences } from '@capacitor/preferences';

export interface AppSettings {
  geminiApiKeys: string[];
  lastGeminiKeyIndex: number;
  anythingllmUrl: string;
  anythingllmApiKey: string;
  anythingllmWorkspace: string;
  aiProvider: 'gemini' | 'mock' | 'anythingllm' | 'gemma4' | 'videoanalysis';
  gemma4BaseUrl: string;
  gemma4Model: 'gemma4:e4b' | 'gemma4:26b-a4b' | 'gemma4:e2b' | 'gemma4:31b';
}

const SETTINGS_KEY = 'app_settings';

export const defaultSettings: AppSettings = {
  geminiApiKeys: [],
  lastGeminiKeyIndex: 0,
  anythingllmUrl: '',
  anythingllmApiKey: '',
  anythingllmWorkspace: '',
  aiProvider: 'gemini',
  gemma4BaseUrl: 'http://localhost:11434',
  gemma4Model: 'gemma4:e4b'
}

import { Capacitor } from '@capacitor/core';

export function normalizeAnythingLLMUrl(url: string): string {
  if (!url) return '';
  // Trim spaces and trailing dots/slashes common in manual input
  let normalized = url.trim()
    .replace(/\.+$/, '')  // Remove trailing dots (e.g., 192.168.1.186..)
    .replace(/\/+$/, ''); // Remove trailing slashes

  // Android emülatör için localhost -> 10.0.2.2 dönüşümü
  if (Capacitor.getPlatform() === 'android' && (normalized.includes('localhost') || normalized.includes('127.0.0.1'))) {
    normalized = normalized.replace('localhost', '10.0.2.2').replace('127.0.0.1', '10.0.2.2');
  }

  if (!normalized.startsWith('http')) {
    normalized = 'http://' + normalized;
  }
  return normalized;
}

export function isLocalhost(url: string): boolean {
  return url.includes('localhost') || url.includes('127.0.0.1');
}



export async function getSettings(): Promise<AppSettings> {
  try {
    const { value } = await Preferences.get({ key: SETTINGS_KEY });
    if (value) {
      const settings = JSON.parse(value);
      return { ...defaultSettings, ...settings };
    }
    return defaultSettings;
  } catch (error) {
    console.error('Failed to load settings:', error);
    return defaultSettings;
  }
}

export async function saveSettings(settings: Partial<AppSettings>): Promise<void> {
  try {
    const currentSettings = await getSettings();

    const newSettings = { ...currentSettings, ...settings };
    await Preferences.set({
      key: SETTINGS_KEY,
      value: JSON.stringify(newSettings)
    });
  } catch (error) {
    console.error('Failed to save settings:', error);
    throw error;
  }
}

export async function resetSettings(): Promise<void> {
  try {
    await Preferences.remove({ key: SETTINGS_KEY });
  } catch (error) {
    console.error('Failed to reset settings:', error);
    throw error;
  }
}