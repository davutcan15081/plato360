import { GoogleGenAI, Type } from '@google/genai';
import { getSettings, normalizeAnythingLLMUrl, saveSettings } from './settings';
import axios from 'axios';
import { buildAnythingLLMUrl, withRetry } from '../utils/testConnection';
import { createGemma4Service, validateGemma4Config } from './gemma4Service';
import { createGemma4BrowserService } from './gemma4BrowserService';
import { createVideoAnalysisService } from './videoAnalysisService';

export interface EditSegment {
  startTime: number;
  endTime: number;
  playbackRate: number;
  cssFilter: string;
  frameStyle: string;
  effect?: string;
  transition?: 'none' | 'fade' | 'slide' | 'zoom' | 'glitch' | 'wipe' | 'dissolve';
  transitionDuration?: number; // seconds, default 0.5
}

export interface AutoMagicResult {
  vibe: string;
  editScript: EditSegment[];
  texts: {
    text: string;
    startTime: number;
    endTime: number;
    fontFamily: string;
    yOffset: number;
  }[];
}

// ─── Utils ────────────────────────────────────────────────────────────────────

export function getVideoDuration(blob: Blob): Promise<number> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    (video as any).playsInline = true;
    
    let done = false;
    const finish = (d: number) => {
      if (done) return;
      done = true;
      if (video.src) {
        URL.revokeObjectURL(video.src);
        video.src = '';
      }
      resolve(d);
    };
    
    const tryResolve = () => {
      const d = video.duration;
      if (d && d !== Infinity && !isNaN(d)) finish(d);
    };
    
    video.onloadedmetadata = tryResolve;
    video.ondurationchange = tryResolve;
    video.onerror = () => {
      console.warn("getVideoDuration error, defaulting to 10s");
      finish(10);
    };
    
    // Increased timeout to 5s for slower devices/formats
    setTimeout(() => {
      if (!done) {
        console.warn("getVideoDuration timeout, defaulting to 10s");
        finish(10);
      }
    }, 5000);
    
    video.src = URL.createObjectURL(blob);
  });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onloadend = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

function validateGemini(s: any) {
  if ((!s.geminiApiKeys || s.geminiApiKeys.length === 0) && !process.env.GEMINI_API_KEY)
    throw new Error('Gemini API anahtarı yapılandırılmamış.');
}

function validateGemma4(s: any) {
  // Browser-based Gemma4 doesn't require server configuration
  // Just check if model is selected
  if (!s.gemma4Model) {
    throw new Error('Gemma4 model seçilmemiş.');
  }
}

function validateVideoAnalysis(s: any) {
  // Video analysis works out of the box with Transformers.js
  // No additional configuration needed
  return true;
}

async function getRotatedGeminiKey(): Promise<string> {
  const settings = await getSettings();
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY') return process.env.GEMINI_API_KEY;
  
  const keys = settings.geminiApiKeys.filter(k => k && k.trim().length > 10);
  if (keys.length === 0) throw new Error('Geçerli bir Gemini API anahtarı bulunamadı.');
  
  if (keys.length === 1) return keys[0];

  // Rotate
  const nextIndex = (settings.lastGeminiKeyIndex + 1) % keys.length;
  await saveSettings({ lastGeminiKeyIndex: nextIndex });
  
  console.log(`[Gemini] Rotating keys. Using key index ${nextIndex + 1}/${keys.length}`);
  return keys[nextIndex];
}

/**
 * AnythingLLM'e istek atar. Workspace endpoint'ini kullanır.
 * Önce /workspace/{slug}/chat, hata alırsa /openai/chat/completions dener.
 */
async function callAnythingLLM(
  settings: any,
  prompt: string,
  context = 'AnythingLLM',
): Promise<string> {
  const workspace = (settings.anythingllmWorkspace?.trim() || 'plato360');
  const normalizedUrl = normalizeAnythingLLMUrl(settings.anythingllmUrl);
  const headers = {
    Authorization: `Bearer ${settings.anythingllmApiKey}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  // --- 1. Önce workspace/chat endpoint'i dene ---
  const chatUrl = buildAnythingLLMUrl(normalizedUrl, `/workspace/${workspace}/chat`);
  console.log(`[${context}] POST ${chatUrl}`);

  try {
    const { result } = await withRetry(
      () =>
        axios.post(
          chatUrl,
          { message: prompt, mode: 'chat' },
          { headers, timeout: 180_000 },
        ),
      3,
      2000,
      context,
    );

    const text =
      result.data?.textResponse ??
      result.data?.text ??
      result.data?.content ??
      result.data?.message;

    if (text) return text as string;
    throw new Error('Boş textResponse');
  } catch (primaryErr) {
    console.warn(`[${context}] workspace/chat başarısız, OpenAI compat endpoint deneniyor…`, primaryErr);
  }

  // --- 2. Fallback: OpenAI compat endpoint ---
  const openaiUrl = buildAnythingLLMUrl(normalizedUrl, '/openai/chat/completions');
  console.log(`[${context}] POST ${openaiUrl}`);

  const { result: oaiResult } = await withRetry(
    () =>
      axios.post(
        openaiUrl,
        {
          model: workspace,          // AnythingLLM bunu workspace slug olarak kabul eder
          messages: [{ role: 'user', content: prompt }],
          stream: false,
        },
        { headers, timeout: 180_000 },
      ),
    3,
    2000,
    `${context}-OAI`,
  );

  const oaiText =
    oaiResult.data?.choices?.[0]?.message?.content ??
    oaiResult.data?.textResponse;

  if (!oaiText) throw new Error('AnythingLLM boş yanıt döndürdü.');
  return oaiText as string;
}

/** JSON bloğunu metinden güvenle çıkarır */
function extractJson<T>(text: string, arrayMode = false): T {
  // Markdown code fence temizle
  const clean = text
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  // Önce direkt parse dene
  try {
    return JSON.parse(clean) as T;
  } catch (_) { }

  // Regex ile ilk geçerli JSON bloğunu bul
  const pattern = arrayMode ? /\[[\s\S]*?\]/ : /\{[\s\S]*?\}/;
  const match = clean.match(pattern);
  if (match) {
    try {
      return JSON.parse(match[0]) as T;
    } catch (_) { }
  }

  // Tüm metin üzerinde son bir deneme
  throw new Error(`JSON parse başarısız. Ham yanıt: ${text.slice(0, 200)}`);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function generateAutoMagicEdit(
  videoBlob: Blob,
  duration: number,
  audioBlob?: Blob,
): Promise<AutoMagicResult> {
  const settings = await getSettings();
  if (settings.aiProvider === 'mock') return generateMockAutoMagicEdit(videoBlob);

  if (settings.aiProvider === 'gemini') {
    validateGemini(settings);
    try {
      return await generateAutoMagicEditGemini(videoBlob, duration, audioBlob, settings);
    } catch (err) {
      const m = (err as Error).message ?? '';
      if (m.includes('quota') || m.includes('429') || m.includes('RESOURCE_EXHAUSTED'))
        throw new Error("Gemini kotası aşıldı. Test Modu'nu deneyin.");
      throw err;
    }
  }

  if (settings.aiProvider === 'gemma4') {
    validateGemma4(settings);
    try {
      return await generateAutoMagicEditGemma4(videoBlob, duration, audioBlob, settings);
    } catch (err) {
      const m = (err as Error).message ?? '';
      throw new Error(`Gemma4 hatası: ${m}`);
    }
  }

  if (settings.aiProvider === 'videoanalysis') {
    validateVideoAnalysis(settings);
    try {
      const videoService = await createVideoAnalysisService();
      return await videoService.generateAutoMagicEdit(videoBlob, duration, audioBlob);
    } catch (err) {
      const m = (err as Error).message ?? '';
      throw new Error(`Video analizi hatası: ${m}`);
    }
  }

  if (settings.aiProvider === 'anythingllm') {
    return await generateAutoMagicEditAnythingLLM(videoBlob, duration, audioBlob, settings);
  }

  throw new Error('Desteklenmeyen AI sağlayıcı.');
}

export async function generateVideoEditScript(
  videoBlob: Blob,
  duration: number,
  vibe: string,
  audioBlob?: Blob,
): Promise<EditSegment[]> {
  const settings = await getSettings();

  if (settings.aiProvider === 'gemini') {
    validateGemini(settings);
    return generateVideoEditScriptGemini(videoBlob, duration, vibe, audioBlob, settings);
  }

  if (settings.aiProvider === 'gemma4') {
    validateGemma4(settings);
    return generateVideoEditScriptGemma4(videoBlob, duration, vibe, audioBlob, settings);
  }

  if (settings.aiProvider === 'videoanalysis') {
    validateVideoAnalysis(settings);
    try {
      const videoService = await createVideoAnalysisService();
      return await videoService.generateVideoEditScript(videoBlob, duration, vibe, audioBlob);
    } catch (err) {
      const m = (err as Error).message ?? '';
      throw new Error(`Video analizi hatasý: ${m}`);
    }
  }

  if (settings.aiProvider === 'anythingllm') {
    return await generateVideoEditScriptAnythingLLM(videoBlob, duration, vibe, audioBlob, settings);
  }

  throw new Error('Desteklenmeyen AI sağlayıcı.');
}

// ─── Mock ─────────────────────────────────────────────────────────────────────

async function generateMockAutoMagicEdit(videoBlob: Blob): Promise<AutoMagicResult> {
  const duration = await getVideoDuration(videoBlob);
  const vibes = ['Energetic', 'Cinematic', 'Minimalist', 'Cyberpunk'];
  const vibe = vibes[Math.floor(Math.random() * vibes.length)];
  const n = Math.max(1, Math.floor(duration / 2));
  const editScript: EditSegment[] = Array.from({ length: n }, (_, i) => ({
    startTime: i * (duration / n),
    endTime: (i + 1) * (duration / n),
    playbackRate: Math.random() > 0.5 ? 0.5 : 1.5 + Math.random(),
    cssFilter:
      vibe === 'Cinematic' ? 'contrast(1.2) saturate(0.8)' :
        vibe === 'Energetic' ? 'contrast(1.3) saturate(1.5)' :
          vibe === 'Cyberpunk' ? 'contrast(1.4) hue-rotate(180deg)' : 'grayscale(80%)',
    frameStyle: (['none', 'cinematic', 'polaroid', 'neon', 'vintage', 'glitch', 'minimal', 'bold'] as const)[
      Math.floor(Math.random() * 8)
    ],
    effect: Math.random() > 0.75
      ? (['snow', 'confetti', 'balloons'] as const)[Math.floor(Math.random() * 3)]
      : 'none',
  }));
  const texts: any[] = []; // Artık otomatik metin eklemiyoruz
  return { vibe, editScript, texts };
}

// ─── Gemini ───────────────────────────────────────────────────────────────────

async function generateAutoMagicEditGemini(
  videoBlob: Blob,
  duration: number,
  audioBlob: Blob | undefined,
  settings: any,
): Promise<AutoMagicResult> {
  const [base64Video] = await Promise.all([
    blobToBase64(videoBlob),
  ]);
  const mimeType = videoBlob.type || 'video/webm';
  const apiKey = await getRotatedGeminiKey();
  const ai = new GoogleGenAI({ apiKey });

  const prompt = `You are an expert video editor. Analyze this ${duration.toFixed(1)}s video and create an engaging edit with smooth transitions between segments.

Create 2-4 segments with varied playback rates, filters, frame styles, and effects.

For EACH segment (except the first), add a transition effect:
- transition: "none" | "fade" | "slide" | "zoom" | "glitch" | "wipe" | "dissolve"
- transitionDuration: 0.3-0.8 seconds (default 0.5)

Transition recommendations by vibe:
- Energetic: "slide", "zoom", "glitch" for high energy
- Cinematic: "dissolve", "fade" for smooth professional look
- Minimalist: "fade", "wipe" for clean transitions
- Cyberpunk: "glitch", "zoom" for tech aesthetic

First segment should always have transition: "none".
Match transitions to scene changes when possible.`;

  const contents: any[] = [{ inlineData: { data: base64Video.split(',')[1], mimeType } }];
  if (audioBlob) {
    const b64 = await blobToBase64(audioBlob);
    contents.push({ inlineData: { data: b64.split(',')[1], mimeType: audioBlob.type || 'audio/mpeg' } });
  }
  contents.push({ text: prompt });

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          vibe: { type: Type.STRING },
          editScript: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                startTime: { type: Type.NUMBER }, endTime: { type: Type.NUMBER },
                playbackRate: { type: Type.NUMBER }, cssFilter: { type: Type.STRING },
                frameStyle: { type: Type.STRING }, effect: { type: Type.STRING },
                transition: { type: Type.STRING },
                transitionDuration: { type: Type.NUMBER },
              },
              required: ['startTime', 'endTime', 'playbackRate', 'cssFilter', 'frameStyle'],
            },
          },
          texts: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                text: { type: Type.STRING }, startTime: { type: Type.NUMBER },
                endTime: { type: Type.NUMBER }, fontFamily: { type: Type.STRING },
                yOffset: { type: Type.NUMBER },
              },
              required: ['text', 'startTime', 'endTime', 'fontFamily', 'yOffset'],
            },
            description: "Bu dizi her zaman boş ([]) olmalı.",
          },
        },
        required: ['vibe', 'editScript' ],
      },
    },
  });

  const text = response.text;
  if (!text) throw new Error('Gemini boş yanıt döndürdü.');
  return extractJson<AutoMagicResult>(text);
}

async function generateVideoEditScriptGemini(
  videoBlob: Blob,
  duration: number,
  vibe: string,
  audioBlob: Blob | undefined,
  settings: any,
): Promise<EditSegment[]> {
  const [base64Video] = await Promise.all([
    blobToBase64(videoBlob),
  ]);
  const mimeType = videoBlob.type || 'video/webm';
  const apiKey = await getRotatedGeminiKey();
  const ai = new GoogleGenAI({ apiKey });

  const prompt = `You are an expert video editor. Create an edit script for a ${duration.toFixed(1)}s video with "${vibe}" vibe.

Create 2-4 segments. For EACH segment (except the first), add a transition effect:
- transition: "none" | "fade" | "slide" | "zoom" | "glitch" | "wipe" | "dissolve"
- transitionDuration: 0.3-0.8 seconds

First segment: transition must be "none".
Other segments: choose based on vibe:
- Energetic: "slide", "zoom", "glitch"
- Cinematic: "dissolve", "fade"
- Minimalist: "fade", "wipe"
- Cyberpunk: "glitch", "zoom"

Vary frameStyle and effects per segment for dynamic flow.`;

  const contents: any[] = [{ inlineData: { data: base64Video.split(',')[1], mimeType } }];
  if (audioBlob) {
    const b64 = await blobToBase64(audioBlob);
    contents.push({ inlineData: { data: b64.split(',')[1], mimeType: audioBlob.type || 'audio/mpeg' } });
  }
  contents.push({ text: prompt });

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            startTime: { type: Type.NUMBER }, endTime: { type: Type.NUMBER },
            playbackRate: { type: Type.NUMBER }, cssFilter: { type: Type.STRING },
            frameStyle: { type: Type.STRING }, effect: { type: Type.STRING },
            transition: { type: Type.STRING },
            transitionDuration: { type: Type.NUMBER },
          },
          required: ['startTime', 'endTime', 'playbackRate', 'cssFilter', 'frameStyle'],
        },
      },
    },
  });

  const text = response.text;
  if (!text) throw new Error('Gemini boş yanıt döndürdü.');
  return extractJson<EditSegment[]>(text, true);
}

// ─── AnythingLLM ──────────────────────────────────────────────────────────────

async function generateAutoMagicEditAnythingLLM(
  videoBlob: Blob,
  duration: number,
  _audioBlob: Blob | undefined,
  settings: any,
): Promise<AutoMagicResult> {
  const prompt = `Sen profesyonel bir video editörüsün. ${duration.toFixed(1)} saniyelik bir video düzenliyorsun.
Aşağıdaki JSON formatında yanıt ver. Başka hiçbir şey yazma, sadece JSON:

{
  "vibe": "Energetic",
  "editScript": [
    {
      "startTime": 0,
      "endTime": ${Math.floor(duration / 2)},
      "playbackRate": 1.0,
      "cssFilter": "contrast(1.2) saturate(1.3)",
      "frameStyle": "cinematic",
      "effect": "none",
      "transition": "none",
      "transitionDuration": 0
    },
    {
      "startTime": ${Math.floor(duration / 2)},
      "endTime": ${Math.floor(duration)},
      "playbackRate": 1.5,
      "cssFilter": "contrast(1.4) saturate(1.5)",
      "frameStyle": "neon",
      "effect": "none",
      "transition": "fade",
      "transitionDuration": 0.5
    }
  ],
  "texts": []
}

Kurallar:
- vibe: "Energetic" | "Cinematic" | "Minimalist" | "Cyberpunk"
- playbackRate: 0.5 ile 2.0 arası
- cssFilter: geçerli CSS filter string
- frameStyle: "none" | "cinematic" | "polaroid" | "neon" | "vintage" | "glitch" | "minimal" | "bold" | "tv" | "comic" | "glam" | "newspaper"
- effect: "none" | "snow" | "confetti" | "balloons" | "rain" | "hearts" | "stars" | "matrix"
- transition: "none" | "fade" | "slide" | "zoom" | "glitch" | "wipe" | "dissolve"
- transitionDuration: 0.3-0.8 saniye (varsayılan 0.5)
- startTime ve endTime 0 ile ${duration.toFixed(1)} arasında olmalı. Segmentler ardışık ve videoyu tamamen kapsamalı.
- İlk segment transition: "none" olmalı.
- Geçiş türleri için:
  * Energetic: "slide", "zoom", "glitch"
  * Cinematic: "dissolve", "fade"
  * Minimalist: "fade", "wipe"
  * Cyberpunk: "glitch", "zoom"
- texts: Bu listeyi her zaman boş ([]) bırak.
- Önemli: Sahnelere göre farklı frameStyle, effect ve transition kullanarak videoyu canlandır.

Şimdi bu video için en iyi edit script'i oluştur:`;

  try {
    const text = await callAnythingLLM(settings, prompt, 'AnythingLLM-AutoMagic');
    const result = extractJson<AutoMagicResult>(text);
    // Sanitize
    if (!result.vibe) result.vibe = 'Energetic';
    if (!result.editScript || result.editScript.length === 0) {
      result.editScript = [{ startTime: 0, endTime: duration, playbackRate: 1.0, cssFilter: 'none', frameStyle: 'none', effect: 'none' }];
    }
    // Clamping playbackRate
    result.editScript = result.editScript.map(s => ({
      ...s,
      playbackRate: Math.max(0.5, Math.min(2.0, s.playbackRate || 1.0))
    }));
    result.texts = []; // Force empty as per rules
    return result;
  } catch (e) {
    console.error('AnythingLLM AutoMagic hatası:', e);
    return {
      vibe: 'Energetic',
      editScript: [{ startTime: 0, endTime: duration, playbackRate: 1.0, cssFilter: 'none', frameStyle: 'none', effect: 'none' }],
      texts: []
    };
  }
}

async function generateVideoEditScriptAnythingLLM(
  videoBlob: Blob,
  duration: number,
  vibe: string,
  _audioBlob: Blob | undefined,
  settings: any,
): Promise<EditSegment[]> {

  const segCount = Math.max(2, Math.min(6, Math.floor(duration / 3)));
  const segDur = duration / segCount;

  const exampleSegments = Array.from({ length: segCount }, (_, i) => ({
    startTime: parseFloat((i * segDur).toFixed(2)),
    endTime: parseFloat(((i + 1) * segDur).toFixed(2)),
    playbackRate: 1.0,
    cssFilter: 'contrast(1.2) saturate(1.3)',
    frameStyle: 'cinematic',
    effect: 'none',
    transition: i === 0 ? 'none' : 'fade',
    transitionDuration: i === 0 ? 0 : 0.5,
  }));

  const prompt = `Sen profesyonel bir video editörüsün. "${vibe}" vibe için ${duration.toFixed(1)} saniyelik video edit script oluştur.
Sadece JSON array döndür, başka hiçbir şey yazma:

${JSON.stringify(exampleSegments, null, 2)}

Bu format örneğini kullanarak "${vibe}" vibe'ına uygun gerçek değerler üret:
- playbackRate: 0.5-2.0 arası
- cssFilter: geçerli CSS filter (örn: "contrast(1.3) saturate(1.5) brightness(1.1)")
- frameStyle: "none"|"cinematic"|"polaroid"|"neon"|"vintage"|"glitch"|"minimal"|"bold"|"tv"|"comic"|"glam"|"newspaper"
- effect: "none"|"snow"|"confetti"|"balloons"|"rain"|"hearts"|"stars"|"matrix"
- transition: "none"|"fade"|"slide"|"zoom"|"glitch"|"wipe"|"dissolve"
- transitionDuration: 0.3-0.8 saniye
- startTime/endTime: 0 ile ${duration.toFixed(1)} arasında, ardışık olmalı.
- İlk segment transition: "none" olmalı.
- Vibe'a göre geçiş seçimi:
  * Energetic: "slide", "zoom", "glitch"
  * Cinematic: "dissolve", "fade"
  * Minimalist: "fade", "wipe"
  * Cyberpunk: "glitch", "zoom"
- Önemli: Farklı segmentlerde farklı çerçeveler, efektler ve geçişler kullanarak etkileyici bir akış sağla.

Sadece JSON array döndür:`;

  const text = await callAnythingLLM(settings, prompt, 'AnythingLLM-Script');

  try {
    return extractJson<EditSegment[]>(text, true);
  } catch (e) {
    console.error('AnythingLLM Script parse hatası. Ham yanıt:', text.slice(0, 500));
    throw new Error('AnythingLLM geçersiz JSON formatında yanıt verdi.');
  }
}

// ─── Gemma4 ────────────────────────────────────────────────────────────────────

async function generateAutoMagicEditGemma4(
  videoBlob: Blob,
  duration: number,
  _audioBlob: Blob | undefined,
  settings: any,
): Promise<AutoMagicResult> {
  try {
    const gemma4Service = await createGemma4BrowserService();
    // Use video-aware analysis for better results
    return await gemma4Service.generateAutoMagicEditWithVideo(videoBlob, duration, _audioBlob);
  } catch (error) {
    console.error('Gemma4 Browser AutoMagic generation failed:', error);
    
    // Check if it's an ONNX kernel error and provide fallback
    if (error.message?.includes('GatherBlockQuantized') || error.message?.includes('kernel')) {
      console.warn('ONNX kernel issue detected, providing fallback response');
      return {
        vibe: 'Energetic',
        editScript: [{
          startTime: 0,
          endTime: duration,
          playbackRate: 1.0,
          cssFilter: 'contrast(1.2) saturate(1.3)',
          frameStyle: 'cinematic',
          effect: 'none'
        }],
        texts: []
      };
    }
    
    // Try regular method as fallback
    try {
      const gemma4Service = await createGemma4BrowserService();
      return await gemma4Service.generateAutoMagicEdit(videoBlob, duration, _audioBlob);
    } catch (fallbackError) {
      console.error('Gemma4 fallback also failed:', fallbackError);
      // Final fallback response
      return {
        vibe: 'Energetic',
        editScript: [{
          startTime: 0,
          endTime: duration,
          playbackRate: 1.0,
          cssFilter: 'contrast(1.2) saturate(1.3)',
          frameStyle: 'cinematic',
          effect: 'none'
        }],
        texts: []
      };
    }
  }
}

async function generateVideoEditScriptGemma4(
  videoBlob: Blob,
  duration: number,
  vibe: string,
  _audioBlob: Blob | undefined,
  settings: any,
): Promise<EditSegment[]> {
  try {
    const gemma4Service = await createGemma4BrowserService();
    return await gemma4Service.generateVideoEditScript(videoBlob, duration, vibe, _audioBlob);
  } catch (error) {
    console.error('Gemma4 Browser script generation failed:', error);
    // Fallback response
    const segCount = Math.max(2, Math.min(6, Math.floor(duration / 3)));
    const segDur = duration / segCount;
    
    return Array.from({ length: segCount }, (_, i) => ({
      startTime: parseFloat((i * segDur).toFixed(2)),
      endTime: parseFloat(((i + 1) * segDur).toFixed(2)),
      playbackRate: 1.0,
      cssFilter: 'contrast(1.2) saturate(1.3)',
      frameStyle: 'cinematic',
      effect: 'none',
    }));
  }
}