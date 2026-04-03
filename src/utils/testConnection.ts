import { Capacitor } from '@capacitor/core';
import { Network } from '@capacitor/network';
import { isLocalhost, normalizeAnythingLLMUrl } from '../services/settings';

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  provider: 'gemini' | 'anythingllm' | 'mock';
  timestamp: Date;
  details?: {
    isLocalhost?: boolean;
    networkStatus?: string;
    retryCount?: number;
    resolvedUrl?: string;
  };
}

const isMobile = Capacitor.isNativePlatform();
const platform = Capacitor.getPlatform(); // 'ios' | 'android' | 'web'

/**
 * AnythingLLM URL builder.
 *
 * Baz URL: http://192.168.1.5:3001
 * Sunucu mount noktası: /api  (Swagger docs: "Servers: /api")
 *
 * Sonuç örnekleri:
 *   buildAnythingLLMUrl(base, 'auth')                      → .../api/v1/auth
 *   buildAnythingLLMUrl(base, '/auth')                     → .../api/v1/auth
 *   buildAnythingLLMUrl(base, 'workspace/plato360/chat')   → .../api/v1/workspace/plato360/chat
 *   buildAnythingLLMUrl(base, '/v1/workspace/plato360/chat')→ .../api/v1/workspace/plato360/chat  (de-dup)
 */
export function buildAnythingLLMUrl(baseUrl: string, apiPath: string): string {
  // Baz URL'den olası /api/v1, /api, /v1 suffix'lerini sil
  const root = normalizeAnythingLLMUrl(baseUrl)
    .replace(/\/+$/, '')
    .replace(/\/api\/v1\/?$/, '')
    .replace(/\/api\/?$/, '')
    .replace(/\/v1\/?$/, '');

  // Path'i normalleştir: baştaki slash ve /v1 prefix'ini kaldır
  const normalizedPath = apiPath
    .replace(/^\/+/, '')          // baştaki slash
    .replace(/^v1\/+/, '');       // v1/ prefix (varsa)

  return `${root}/api/v1/${normalizedPath}`;
}

export async function fetchWorkspaces(
  baseUrl: string,
  apiKey: string,
): Promise<{ name: string; slug: string }[]> {
  const normalizedUrl = normalizeAnythingLLMUrl(baseUrl);
  const url = buildAnythingLLMUrl(normalizedUrl, 'workspaces');
  const { default: axios } = await import('axios');

  const response = await axios.get(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
    },
    timeout: 15_000,
  });

  if (response.data && Array.isArray(response.data.workspaces)) {
    return response.data.workspaces.map((ws: any) => ({
      name: ws.name || ws.slug,
      slug: ws.slug,
    }));
  }
  return [];
}

/**
 * Üstel geri çekilmeli retry wrapper.
 * Her denemeden önce ağ durumunu kontrol eder.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 5,
  delayMs = 2000,
  context = 'operation',
): Promise<{ result: T; attempts: number }> {
  let lastError: any;

  for (let i = 0; i <= retries; i++) {
    try {
      console.log(`[${context}] Deneme ${i + 1}/${retries + 1}…`);
      const result = await fn();
      if (i > 0) console.log(`[${context}] ${i + 1}. denemede başarılı.`);
      return { result, attempts: i + 1 };
    } catch (err) {
      lastError = err;
      const status = (err as any)?.response?.status;
      const code = (err as any)?.code ?? '';

      // Yeniden denemesi anlamsız hatalar
      if (status === 401 || status === 403 || status === 404) {
        console.warn(`[${context}] Kalıcı hata (${status}), retry yok.`);
        break;
      }

      if (i < retries) {
        const waitMs = delayMs * (i + 1); // Lineer backoff (mobilde daha dengeli)
        console.warn(`[${context}] Hata (${code || status || 'unknown'}), ${waitMs}ms sonra tekrar…`);
        await new Promise((r) => setTimeout(r, waitMs));

        // Ağ kontrolü
        try {
          const netStatus = await Network.getStatus();
          if (!netStatus.connected) {
            throw new Error('📵 İnternet bağlantısı yok!');
          }
        } catch (netErr: any) {
          if (netErr.message?.includes('İnternet')) throw netErr;
          // Network plugin hatası → yoksay, devam et
        }
      }
    }
  }

  throw lastError;
}

// ─── Connection testers ───────────────────────────────────────────────────────

export async function testGeminiConnection(apiKey: string): Promise<ConnectionTestResult> {
  try {
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey });

    const { result, attempts } = await withRetry(
      () => ai.models.generateContent({ model: 'gemini-2.5-flash', contents: [{ text: 'Hi' }] }),
      2,
      1000,
      'Gemini',
    );

    return {
      success: true,
      message: `✅ Gemini API bağlantısı başarılı${attempts > 1 ? ` (${attempts} deneme)` : ''}`,
      provider: 'gemini',
      timestamp: new Date(),
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Bilinmeyen hata';
    return {
      success: false,
      message: `❌ Gemini API hatası: ${msg}`,
      provider: 'gemini',
      timestamp: new Date(),
    };
  }
}

export async function testAnythingLLMConnection(
  baseUrl: string,
  apiKey: string,
  workspace: string,
): Promise<ConnectionTestResult> {
  const effectiveWorkspace = workspace?.trim() || 'plato360';
  const normalizedUrl = normalizeAnythingLLMUrl(baseUrl);
  const localhostDetected = isLocalhost(normalizedUrl);

  let warningMessage = '';
  if (isMobile && localhostDetected) {
    warningMessage =
      '⚠️ Mobil cihazda "localhost" kendisini gösterir. ' +
      'PC IP\'nizi kullanın (örn: http://192.168.1.5:3001).\n\n';
  }

  const authUrl = buildAnythingLLMUrl(normalizedUrl, 'auth');
  const wsUrl = buildAnythingLLMUrl(normalizedUrl, `workspace/${effectiveWorkspace}`);
  const headers = { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' };

  console.log('[TestConnection] Auth URL:', authUrl);
  console.log('[TestConnection] Workspace URL:', wsUrl);

  try {
    const { default: axios } = await import('axios');

    // 1. Auth doğrulama
    const { result: authRes, attempts } = await withRetry(
      () => axios.get(authUrl, { headers, timeout: 45_000 }),
      5,
      2000,
      'Auth',
    );

    if (authRes.data?.authenticated !== true) {
      return {
        success: false,
        message: `${warningMessage}❌ API anahtarı geçersiz.`,
        provider: 'anythingllm',
        timestamp: new Date(),
        details: { isLocalhost: localhostDetected },
      };
    }

    // 2. Workspace slug doğrulama
    await withRetry(
      () => axios.get(wsUrl, { headers, timeout: 30_000 }),
      3,
      2000,
      'WorkspaceCheck',
    );

    return {
      success: true,
      message: `${warningMessage}✅ AnythingLLM bağlantısı başarılı! Workspace: "${effectiveWorkspace}"`,
      provider: 'anythingllm',
      timestamp: new Date(),
      details: {
        isLocalhost: localhostDetected,
        retryCount: attempts,
        resolvedUrl: authUrl,
      },
    };
  } catch (error: any) {
    const status = error?.response?.status;
    const code = error?.code ?? '';
    const msg = error?.message ?? '';

    let detail: string;
    let solution: string;

    if (status === 401 || status === 403) {
      detail = 'API anahtarı yetkisiz (401/403).';
      solution = 'AnythingLLM → Settings → API Keys bölümünden anahtarı kontrol edin.';
    } else if (status === 404) {
      detail = `Workspace "${effectiveWorkspace}" bulunamadı (404).`;
      solution = 'Workspace slug\'unun doğru olduğundan emin olun (küçük harf, tireli: plato360).';
    } else if (code === 'ECONNREFUSED') {
      detail = 'Bağlantı reddedildi (ECONNREFUSED).';
      solution = isMobile
        ? 'PC\'nin IP adresini kullanın (ipconfig) ve aynı Wi-Fi\'da olduğunuzdan emin olun.'
        : 'AnythingLLM\'nin çalıştığından ve URL\'nin doğru olduğundan emin olun.';
    } else if (code === 'ECONNABORTED' || msg.includes('timeout')) {
      detail = 'Bağlantı zaman aşımına uğradı.';
      solution = isMobile
        ? 'PC\'nin güvenlik duvarının 3001 portuna izin verdiğini kontrol edin.'
        : 'AnythingLLM yavaş yanıt veriyor olabilir, tekrar deneyin.';
    } else if (code === 'ERR_NETWORK' || code === 'NETWORK_ERROR') {
      detail = 'Ağ hatası.';
      solution = isMobile
        ? 'Wi-Fi bağlantınızı kontrol edin ve PC ile aynı ağda olduğunuzdan emin olun.'
        : 'İnternet bağlantınızı kontrol edin.';
    } else {
      detail = msg || 'Bilinmeyen hata';
      solution = 'URL, API Key ve Workspace slug alanlarını kontrol edin.';
    }

    return {
      success: false,
      message: `${warningMessage}❌ ${detail}\n💡 Çözüm: ${solution}`,
      provider: 'anythingllm',
      timestamp: new Date(),
      details: { isLocalhost: localhostDetected, resolvedUrl: authUrl },
    };
  }
}

export async function testMockConnection(): Promise<ConnectionTestResult> {
  return {
    success: true,
    message: 'Test Modu hazır — çevrimdışı çalışır ✓',
    provider: 'mock',
    timestamp: new Date(),
  };
}

export { isMobile, platform };