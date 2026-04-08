import axios from 'axios';
import { getSettings } from './settings';
import { EditSegment, AutoMagicResult } from './ai';

export interface Gemma4Config {
  model: 'gemma4:e4b' | 'gemma4:26b-a4b' | 'gemma4:e2b' | 'gemma4:31b';
  baseUrl?: string;
  timeout?: number;
}

export interface Gemma4Response {
  message: {
    content: string;
  };
  done: boolean;
}

export class Gemma4Service {
  private baseUrl: string;
  private config: Gemma4Config;

  constructor(config: Gemma4Config) {
    this.config = {
      baseUrl: 'http://localhost:11434',
      timeout: 180000,
      ...config
    };
    
    this.baseUrl = this.config.baseUrl!;
  }

  /**
   * Test connection to Ollama service
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/tags`, {
        timeout: 5000
      });
      return response.status === 200;
    } catch (error) {
      console.error('Gemma4 connection test failed:', error);
      return false;
    }
  }

  /**
   * Check if Gemma4 model is available
   */
  async isModelAvailable(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/tags`, {
        timeout: 10000
      });
      const models = response.data.models || [];
      return models.some((model: any) => model.name.includes('gemma4'));
    } catch (error) {
      console.error('Failed to check Gemma4 model availability:', error);
      return false;
    }
  }

  /**
   * Pull Gemma4 model if not available
   */
  async pullModel(): Promise<void> {
    try {
      console.log(`Pulling Gemma4 model: ${this.config.model}`);
      await axios.post(`${this.baseUrl}/api/pull`, {
        name: this.config.model
      }, {
        timeout: 300000 // 5 minutes timeout for pulling model
      });
      console.log('Gemma4 model pulled successfully');
    } catch (error) {
      console.error('Failed to pull Gemma4 model:', error);
      throw new Error('Gemma4 model indirme başarısız oldu. Ollama servisinin çalıştığından emin olun.');
    }
  }

  /**
   * Generate text response from Gemma4
   */
  async generateText(prompt: string): Promise<string> {
    try {
      const response = await axios.post(`${this.baseUrl}/api/chat`, {
        model: this.config.model,
        messages: [{ role: 'user', content: prompt }],
        options: {
          temperature: 0.7,
          top_p: 0.9,
          num_predict: 2048,
        }
      }, {
        timeout: this.config.timeout
      });

      return response.data.message.content;
    } catch (error) {
      console.error('Gemma4 text generation failed:', error);
      throw new Error('Gemma4 metin üretimi başarısız oldu.');
    }
  }

  /**
   * Generate JSON response from Gemma4
   */
  async generateJson<T>(prompt: string): Promise<T> {
    try {
      const response = await axios.post(`${this.baseUrl}/api/chat`, {
        model: this.config.model,
        messages: [{ role: 'user', content: prompt }],
        format: 'json',
        options: {
          temperature: 0.3,
          top_p: 0.8,
          num_predict: 2048,
        }
      }, {
        timeout: this.config.timeout
      });

      return JSON.parse(response.data.message.content) as T;
    } catch (error) {
      console.error('Gemma4 JSON generation failed:', error);
      throw new Error('Gemma4 JSON üretimi başarısız oldu.');
    }
  }

  /**
   * Generate AutoMagic edit result
   */
  async generateAutoMagicEdit(
    videoBlob: Blob,
    duration: number,
    audioBlob?: Blob
  ): Promise<AutoMagicResult> {
    const prompt = `Sen profesyonel bir video editörüsün. ${duration.toFixed(1)} saniyelik bir video analiz ediyorsun.
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
      return await this.generateJson<AutoMagicResult>(prompt);
    } catch (error) {
      console.error('Gemma4 AutoMagic generation failed:', error);
      // Fallback response
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

  /**
   * Generate video edit script
   */
  async generateVideoEditScript(
    videoBlob: Blob,
    duration: number,
    vibe: string,
    audioBlob?: Blob
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

    try {
      return await this.generateJson<EditSegment[]>(prompt);
    } catch (error) {
      console.error('Gemma4 script generation failed:', error);
      // Fallback response with proper types
      return exampleSegments.map(s => ({
        ...s,
        transition: (s.transition || 'none') as EditSegment['transition'],
        transitionDuration: s.transitionDuration || 0
      }));
    }
  }

  /**
   * Get model information
   */
  async getModelInfo(): Promise<any> {
    try {
      const response = await axios.post(`${this.baseUrl}/api/show`, {
        name: this.config.model
      }, {
        timeout: 10000
      });
      return response.data;
    } catch (error) {
      console.error('Failed to get model info:', error);
      return null;
    }
  }
}

/**
 * Create Gemma4 service instance with current settings
 */
export async function createGemma4Service(): Promise<Gemma4Service> {
  const settings = await getSettings();
  
  const config: Gemma4Config = {
    model: settings.gemma4Model || 'gemma4:e4b',
    baseUrl: settings.gemma4BaseUrl || 'http://localhost:11434',
    timeout: 180000
  };

  const service = new Gemma4Service(config);
  
  // Check if model is available, if not try to pull it
  const isAvailable = await service.isModelAvailable();
  if (!isAvailable) {
    console.log('Gemma4 model not found, attempting to pull...');
    await service.pullModel();
  }

  return service;
}

/**
 * Validate Gemma4 configuration
 */
export function validateGemma4Config(settings: any): void {
  if (!settings.gemma4BaseUrl) {
    throw new Error('Gemma4 base URL yapılandırılmamış.');
  }
  
  if (!settings.gemma4Model) {
    throw new Error('Gemma4 model seçilmemiş.');
  }
}
