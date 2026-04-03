export interface AppSettings {
  aiProvider: 'gemini' | 'anythingllm';
  anythingLlmBaseUrl: string;
  anythingLlmApiKey: string;
  anythingLlmWorkspace: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  aiProvider: 'gemini',
  anythingLlmBaseUrl: 'http://localhost:3001/api/v1',
  anythingLlmApiKey: '',
  anythingLlmWorkspace: 'plato360',
};

export function getSettings(): AppSettings {
  const stored = localStorage.getItem('spinedit_settings');
  if (stored) {
    try {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    } catch (e) {
      console.error('Failed to parse settings', e);
    }
  }
  return DEFAULT_SETTINGS;
}

export function saveSettings(settings: AppSettings) {
  localStorage.setItem('spinedit_settings', JSON.stringify(settings));
}
