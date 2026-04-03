import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Settings as SettingsIcon, Save, RotateCcw, Check, X, Key, Brain, Globe, Shield, Layout, Wifi, AlertTriangle } from 'lucide-react';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { getSettings, saveSettings, resetSettings, AppSettings } from '../services/settings';
import { testAnythingLLMConnection, fetchWorkspaces, ConnectionTestResult, isMobile, platform } from '../utils/testConnection';
import { HelpCircle, Smartphone, Monitor, Info, List, RefreshCw } from 'lucide-react';

interface SettingsProps {
  onBack: () => void;
}

export function Settings({ onBack }: SettingsProps) {
  const [settings, setSettings] = useState<AppSettings>({
    geminiApiKey: '',
    anythingllmUrl: '',
    anythingllmApiKey: '',
    anythingllmWorkspace: '',
    aiProvider: 'gemini'
  });
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [showIPHelp, setShowIPHelp] = useState(false);
  const [showTroubleshoot, setShowTroubleshoot] = useState(false);
  const [availableWorkspaces, setAvailableWorkspaces] = useState<{name: string, slug: string}[]>([]);
  const [isFetchingWorkspaces, setIsFetchingWorkspaces] = useState(false);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const loadedSettings = await getSettings();
      setSettings(loadedSettings);
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const handleSettingChange = (key: keyof AppSettings, value: string) => {
    console.log(`Setting changed: ${key} = ${value}`);
    setSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
    setSaveStatus('idle');
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveSettings(settings);
      setHasChanges(false);
      setSaveStatus('success');
      try {
        await Haptics.impact({ style: ImpactStyle.Light });
      } catch (e) {}
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      console.error('Failed to save settings:', error);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    try {
      await resetSettings();
      await loadSettings();
      setShowResetConfirm(false);
      setSaveStatus('success');
      try {
        await Haptics.impact({ style: ImpactStyle.Medium });
      } catch (e) {}
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      console.error('Failed to reset settings:', error);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  const handleFetchWorkspaces = async () => {
    if (!settings.anythingllmUrl || !settings.anythingllmApiKey) {
      setWorkspaceError('Lütfen önce URL ve API Key girin.');
      setTimeout(() => setWorkspaceError(null), 3000);
      return;
    }

    setIsFetchingWorkspaces(true);
    setWorkspaceError(null);
    try {
      const workspaces = await fetchWorkspaces(settings.anythingllmUrl, settings.anythingllmApiKey);
      setAvailableWorkspaces(workspaces);
      if (workspaces.length === 0) {
        setWorkspaceError('Görünür workspace bulunamadı.');
      }
    } catch (error) {
      console.error('Failed to fetch workspaces:', error);
      setWorkspaceError('Workspace listesi alınamadı. Bağlantıyı kontrol edin.');
    } finally {
      setIsFetchingWorkspaces(false);
    }
  };

  const handleSelectWorkspace = (slug: string) => {
    handleSettingChange('anythingllmWorkspace', slug);
    setAvailableWorkspaces([]); // Listeyi kapat
  };

  const handleTestAnythingLLM = async () => {
    if (!settings.anythingllmUrl || !settings.anythingllmApiKey || !settings.anythingllmWorkspace) {
      setTestResult({
        success: false,
        message: 'Lütfen tüm AnythingLLM alanlarını doldurun.',
        provider: 'anythingllm',
        timestamp: new Date()
      });
      return;
    }

    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await testAnythingLLMConnection(
        settings.anythingllmUrl,
        settings.anythingllmApiKey,
        settings.anythingllmWorkspace
      );
      setTestResult(result);
      if (result.success) {
        try { await Haptics.impact({ style: ImpactStyle.Medium }); } catch (e) {}
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: 'Bağlantı testi başarısız oldu.',
        provider: 'anythingllm',
        timestamp: new Date()
      });
    } finally {
      setIsTesting(false);
    }
  };


  return (
    <div className="w-full h-[100dvh] bg-zinc-950 text-zinc-50 overflow-hidden font-sans">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="h-full flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800"
             style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}>
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 transition-colors active:scale-95 border border-white/5"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                <SettingsIcon size={18} className="text-white" />
              </div>
              <h1 className="text-xl font-bold">Ayarlar <span className="text-[9px] text-zinc-500 align-middle ml-1 font-mono">v1.4</span></h1>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {hasChanges && (
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 text-white font-medium flex items-center gap-2 hover:opacity-90 transition-opacity active:scale-95 disabled:opacity-50"
              >
                {isSaving ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Save size={16} />
                )}
                Kaydet
              </button>
            )}
          </div>
        </div>

        {/* Save Status */}
        <AnimatePresence>
          {saveStatus !== 'idle' && (
            <motion.div
              initial={{ opacity: 0, y: -50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -50 }}
              className={`absolute top-0 left-0 right-0 z-50 text-white p-3 text-center flex items-center justify-center gap-2 border-b border-white/10 ${
                saveStatus === 'success' ? 'bg-green-600' : 'bg-red-600'
              }`}
              style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.5rem)' }}
            >
              {saveStatus === 'success' ? <Check size={16} /> : <X size={16} />}
              <span className="text-sm font-medium">
                {saveStatus === 'success' ? 'Ayarlar kaydedildi' : 'Hata oluştu'}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Settings Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* AI Provider Selection */}
          <div className="space-y-3">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <Brain size={16} className="text-indigo-400" />
              AI Sağlayıcı
            </h2>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => handleSettingChange('aiProvider', 'gemini')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  settings.aiProvider === 'gemini'
                    ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300'
                    : 'border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:bg-zinc-800'
                }`}
              >
                <div className="font-semibold text-sm">Gemini</div>
                <div className="text-[10px] mt-0.5 opacity-70">Google</div>
              </button>
              <button
                onClick={() => handleSettingChange('aiProvider', 'anythingllm')}
                className={`p-4 rounded-xl border text-left transition-all relative overflow-hidden ${
                  settings.aiProvider === 'anythingllm'
                    ? 'border-orange-500 bg-orange-500/10 text-orange-300'
                    : 'border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:bg-zinc-800'
                }`}
              >
                <div className="font-bold text-sm">AnythingLLM</div>
                <div className="text-[10px] mt-1 opacity-70">Lokal Sunucu</div>
                {settings.aiProvider === 'anythingllm' && (
                  <motion.div layoutId="activeProvider" className="absolute inset-0 border-2 border-orange-500 rounded-xl" />
                )}
              </button>
              <button
                onClick={() => handleSettingChange('aiProvider', 'mock')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  settings.aiProvider === 'mock'
                    ? 'border-green-500 bg-green-500/10 text-green-300'
                    : 'border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:bg-zinc-800'
                }`}
              >
                <div className="font-semibold text-sm">Test</div>
                <div className="text-[10px] mt-0.5 opacity-70">Ücretsiz</div>
              </button>
            </div>
          </div>

          {/* Provider Specific Settings */}
          {settings.aiProvider === 'mock' && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Brain size={18} className="text-green-400" />
                Test Modu Ayarları
              </h2>
              <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl text-sm text-green-300 space-y-1">
                <p>• API anahtarı gerektirmez</p>
                <p>• İnternet bağlantısı gerekmez</p>
                <p>• Demo ve test için uygundur</p>
              </div>
            </div>
          )}

          {settings.aiProvider === 'gemini' && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Key size={18} className="text-yellow-400" />
                Gemini API Ayarları
              </h2>
              <div className="space-y-3">
                <label className="text-sm font-medium text-zinc-400 block">API Anahtarı</label>
                <input
                  type="password"
                  value={settings.geminiApiKey}
                  onChange={(e) => handleSettingChange('geminiApiKey', e.target.value)}
                  placeholder="AIza..."
                  className="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 placeholder-zinc-500 focus:border-indigo-500 focus:outline-none transition-colors"
                />
              </div>
            </div>
          )}

          {settings.aiProvider === 'anythingllm' && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Globe size={18} className="text-orange-400" />
                AnythingLLM Ayarları
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-zinc-400 mb-2 block">Server URL</label>
                  <input
                    type="url"
                    value={settings.anythingllmUrl}
                    onChange={(e) => handleSettingChange('anythingllmUrl', e.target.value)}
                    placeholder={isMobile ? "http://192.168.1.XX:3001" : "http://localhost:3001"}
                    className="w-full px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 placeholder-zinc-500 focus:border-orange-500 focus:outline-none transition-colors text-sm"
                  />
                  <div className="flex items-center justify-between mt-1 px-1">
                    <p className="text-[10px] text-zinc-500">
                      {isMobile ? "PC IP adresinizi kullanın (localhost çalışmaz)" : "Lokal veya uzak sunucu adresi"}
                    </p>
                    {isMobile && (
                      <div className="flex items-center gap-2 mt-1">
                        <button 
                          onClick={() => setShowIPHelp(!showIPHelp)}
                          className="text-[10px] text-orange-400 font-medium flex items-center gap-1"
                        >
                          <HelpCircle size={10} /> IP Nasıl Bulunur?
                        </button>
                        <button 
                          onClick={() => setShowTroubleshoot(!showTroubleshoot)}
                          className="text-[10px] text-red-500 font-medium flex items-center gap-1 bg-red-500/10 px-1 rounded"
                        >
                          <AlertTriangle size={10} /> Bağlantı Sorunu Çöz?
                        </button>
                      </div>
                    )}
                  </div>

                  <AnimatePresence>
                    {showTroubleshoot && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-2 p-4 bg-zinc-900 border border-red-500/20 rounded-xl text-xs space-y-3"
                      >
                        <h4 className="font-bold text-red-400 flex items-center gap-2">
                          <Wifi size={14} /> Mobil Bağlantı Sorun Giderme
                        </h4>
                        <div className="space-y-2 text-zinc-400">
                          <p>
                            <span className="text-zinc-50 font-semibold italic underline text-sm">1. Adım: IP Adresini Doğrulayın</span><br />
                            PC'nizin şu anki IP'si: <code className="bg-zinc-800 px-1 rounded text-orange-300">192.168.1.186</code><br />
                            Adresi şöyle yazın: <code className="bg-zinc-800 px-1 rounded text-orange-300">http://192.168.1.186:3001</code>
                            <br /><span className="text-[10px] text-red-400">! Fazla nokta ya da boşluk bırakmadığınızdan emin olun.</span>
                          </p>
                          <p>
                            <span className="text-zinc-50 font-semibold italic underline text-sm">2. Adım: Ağ Profilini "Özel" (Private) Yapın</span><br />
                            PC'nizde Wi-Fi ayarlarından ağınızı <span className="text-zinc-100 italic">"Genel" (Public)</span> yerine <span className="text-green-400 font-bold">"Özel" (Private)</span> olarak değiştirin. 
                            <br /><span className="text-[10px] opacity-70">Aksi takdirde Windows güvenlik duvarı telefonun PC'ye bağlanmasını engeller.</span>
                          </p>
                          <p>
                            <span className="text-zinc-50 font-semibold italic underline text-sm">3. Adım: Güvenlik Duvarı (Firewall) İzni</span><br />
                            Güvenlik duvarında <span className="text-zinc-100">3001</span> portuna giriş izni verin veya geçici olarak kapatıp tekrar deneyin.
                          </p>
                          <p>
                            <span className="text-zinc-50 font-semibold italic underline text-sm">4. Adım: Aynı Ağda Kalın</span><br />
                            Telefon ve PC aynı Wi-Fi adında (`FiberHGW_ZYA7E4_2.4GHz`) olmalıdır.
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <AnimatePresence>
                    {showIPHelp && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-2 p-3 bg-zinc-900/80 border border-zinc-800 rounded-lg text-[11px] text-zinc-400 space-y-2"
                      >
                        <p className="font-semibold text-zinc-300">Windows:</p>
                        <p>1. CMD'yi açın ve `ipconfig` yazın.<br />2. "IPv4 Address" kısmını kopyalayın (örn: 192.168.1.15).</p>
                        <p className="font-semibold text-zinc-300">Mac / Linux:</p>
                        <p>1. Terminal'e `ifconfig` veya `ip addr` yazın.<br />2. `en0` veya `eth0` adresini bulun.</p>
                        <p className="text-orange-400/80 italic">Not: Telefon ve PC aynı Wi-Fi ağında olmalıdır.</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <div>
                  <label className="text-sm font-medium text-zinc-400 mb-2 block">API Key</label>
                  <input
                    type="password"
                    value={settings.anythingllmApiKey}
                    onChange={(e) => handleSettingChange('anythingllmApiKey', e.target.value)}
                    placeholder="Bearer token"
                    className="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 placeholder-zinc-500 focus:border-orange-500 focus:outline-none transition-colors"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-zinc-400">Workspace Slug</label>
                    <button
                      onClick={handleFetchWorkspaces}
                      disabled={isFetchingWorkspaces}
                      className="text-[10px] text-orange-400 font-medium flex items-center gap-1 bg-orange-500/10 px-2 py-1 rounded-lg hover:bg-orange-500/20 transition-colors"
                    >
                      {isFetchingWorkspaces ? <RefreshCw size={10} className="animate-spin" /> : <List size={10} />}
                      Listeyi Getir
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      value={settings.anythingllmWorkspace}
                      onChange={(e) => handleSettingChange('anythingllmWorkspace', e.target.value)}
                      placeholder="my-workspace"
                      className="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 placeholder-zinc-500 focus:border-orange-500 focus:outline-none transition-colors"
                    />
                    
                    <AnimatePresence>
                      {availableWorkspaces.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 10 }}
                          className="absolute z-10 w-full mt-2 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl max-h-40 overflow-y-auto"
                        >
                          {availableWorkspaces.map((ws) => (
                            <button
                              key={ws.slug}
                              onClick={() => handleSelectWorkspace(ws.slug)}
                              className="w-full px-4 py-3 text-left hover:bg-zinc-800 transition-colors text-sm border-b border-zinc-800 last:border-0 flex justify-between items-center"
                            >
                              <span>{ws.name}</span>
                              <span className="text-[10px] text-zinc-500 font-mono">{ws.slug}</span>
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {workspaceError && (
                      <p className="text-[10px] text-red-400 mt-1 pl-1">{workspaceError}</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={handleTestAnythingLLM}
                  disabled={isTesting}
                  className="w-full py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-100 font-medium flex items-center justify-center gap-2 hover:bg-zinc-700 transition-colors active:scale-95 disabled:opacity-50"
                >
                  {isTesting ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Wifi size={16} />
                  )}
                  Bağlantıyı Test Et
                </button>
                {testResult && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className={`p-4 rounded-xl border text-sm flex gap-2 ${
                      testResult.success 
                        ? 'bg-green-500/10 border-green-500/30 text-green-400' 
                        : 'bg-red-500/10 border-red-500/30 text-red-400'
                    }`}
                  >
                    {testResult.success ? <Check size={16} className="shrink-0" /> : <AlertTriangle size={16} className="shrink-0" />}
                    <span className="whitespace-pre-line">{testResult.message}</span>
                  </motion.div>
                )}
              </div>
            </div>
          )}

          {/* Reset Section */}
          <div className="pt-6 border-t border-zinc-800">
            <button
              onClick={() => setShowResetConfirm(true)}
              className="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 font-medium hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400 transition-all active:scale-95"
            >
              <RotateCcw size={16} className="inline mr-2" />
              Ayarları Sıfırla
            </button>
          </div>
        </div>

        {/* Reset Confirmation Modal */}
        <AnimatePresence>
          {showResetConfirm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 flex items-center justify-center p-6 z-50"
              onClick={() => setShowResetConfirm(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-zinc-900 rounded-2xl p-6 max-w-sm w-full border border-zinc-800"
              >
                <h3 className="text-lg font-semibold mb-2">Ayarları Sıfırla</h3>
                <p className="text-zinc-400 text-sm mb-6">
                  Tüm ayarlar varsayılan değerlere döndürülecek.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowResetConfirm(false)}
                    className="flex-1 px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 font-medium hover:bg-zinc-700 transition-colors"
                  >
                    İptal
                  </button>
                  <button
                    onClick={handleReset}
                    className="flex-1 px-4 py-2 rounded-xl bg-red-600 text-white font-medium hover:bg-red-700 transition-colors"
                  >
                    Sıfırla
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
