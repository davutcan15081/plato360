import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Settings as SettingsIcon, X, Save } from 'lucide-react';
import { getSettings, saveSettings, AppSettings } from '../utils/settings';

interface SettingsProps {
  onClose: () => void;
}

export function Settings({ onClose }: SettingsProps) {
  const [settings, setSettings] = useState<AppSettings>(getSettings());
  const [saved, setSaved] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setSettings(prev => ({ ...prev, [name]: value }));
    setSaved(false);
  };

  const handleSave = () => {
    saveSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="absolute inset-0 z-50 bg-zinc-950 flex flex-col p-6 overflow-y-auto"
    >
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <SettingsIcon size={24} className="text-indigo-400" />
          Ayarlar
        </h2>
        <button 
          onClick={onClose}
          className="p-2 bg-zinc-900 rounded-full hover:bg-zinc-800 transition-colors"
        >
          <X size={20} />
        </button>
      </div>

      <div className="space-y-6 max-w-md mx-auto w-full">
        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-400">Yapay Zeka Sağlayıcısı</label>
          <select 
            name="aiProvider"
            value={settings.aiProvider}
            onChange={handleChange}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-zinc-100 focus:outline-none focus:border-indigo-500 transition-colors"
          >
            <option value="gemini">Google Gemini (Varsayılan)</option>
            <option value="anythingllm">AnythingLLM</option>
          </select>
        </div>

        {settings.aiProvider === 'anythingllm' && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="space-y-4 p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl"
          >
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-400">AnythingLLM Base URL</label>
              <input 
                type="text"
                name="anythingLlmBaseUrl"
                value={settings.anythingLlmBaseUrl}
                onChange={handleChange}
                placeholder="http://localhost:3001/api/v1"
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-zinc-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-400">AnythingLLM API Key</label>
              <input 
                type="password"
                name="anythingLlmApiKey"
                value={settings.anythingLlmApiKey}
                onChange={handleChange}
                placeholder="API Key"
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-zinc-100 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-400">Çalışma Alanı (Workspace) Adı</label>
              <input 
                type="text"
                name="anythingLlmWorkspace"
                value={settings.anythingLlmWorkspace}
                onChange={handleChange}
                placeholder="plato360"
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-zinc-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <p className="text-xs text-zinc-500 mt-2">
              Not: AnythingLLM video dosyalarını doğrudan analiz edemez. Sadece video süresine göre bir düzenleme metni oluşturur.
            </p>
          </motion.div>
        )}

        <button 
          onClick={handleSave}
          className="w-full py-4 mt-8 rounded-xl bg-indigo-600 text-white font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 transition-colors"
        >
          <Save size={20} />
          {saved ? 'Kaydedildi!' : 'Ayarları Kaydet'}
        </button>
      </div>
    </motion.div>
  );
}
