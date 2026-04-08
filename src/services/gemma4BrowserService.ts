import { AutoTokenizer, Gemma4ForConditionalGeneration, TextStreamer } from '@huggingface/transformers';
import { getSettings } from './settings';
import { EditSegment, AutoMagicResult } from './ai';

export interface Gemma4BrowserConfig {
  model: 'onnx-community/gemma-4-E2B-it-ONNX' | 'onnx-community/gemma-4-E4B-it-ONNX';
  device: 'webgpu' | 'wasm';
  dtype: 'fp32'; // Use fp32 for ONNX compatibility
  maxNewTokens: number;
  temperature: number;
  topP: number;
}

export interface GenerationProgress {
  status: 'loading' | 'ready' | 'generating' | 'error';
  progress: number;
  message: string;
}

export class Gemma4BrowserService {
  private model: any = null;
  private tokenizer: any = null;
  private config: Gemma4BrowserConfig;
  private isInitialized = false;
  private progressCallback?: (progress: GenerationProgress) => void;

  constructor(config: Partial<Gemma4BrowserConfig> = {}) {
    this.config = {
      model: 'onnx-community/gemma-4-E2B-it-ONNX', // Use E2B for better compatibility
      device: 'wasm', // Default to WASM for better compatibility
      dtype: 'fp32', // Use fp32 for ONNX compatibility
      maxNewTokens: 512, // Smaller for WASM mode
      temperature: 0.7,
      topP: 0.9,
      ...config
    };
  }

  /**
   * Check WebGPU support
   */
  static checkWebGPUSupport(): boolean {
    return 'gpu' in navigator && 'getAdapter' in (navigator as any).gpu;
  }

  /**
   * Initialize the model
   */
  async initialize(progressCallback?: (progress: GenerationProgress) => void): Promise<void> {
    if (this.isInitialized) return;
    
    this.progressCallback = progressCallback;
    
    try {
      this.updateProgress('loading', 0, 'Model yükleniyor...');
      
      // Check WebGPU support and fallback to WASM if needed
      if (this.config.device === 'webgpu' && !Gemma4BrowserService.checkWebGPUSupport()) {
        console.warn('WebGPU desteklenmiyor, WASM moduna geçiliyor...');
        this.config.device = 'wasm';
      }

      this.updateProgress('loading', 10, 'Tokenizer yükleniyor...');
      
      // Load tokenizer only (no processor for text-only generation)
      this.tokenizer = await AutoTokenizer.from_pretrained(this.config.model);
      
      this.updateProgress('loading', 30, 'Model yükleniyor...');
      
      // Load model with progress tracking
      this.model = await Gemma4ForConditionalGeneration.from_pretrained(this.config.model, {
        dtype: this.config.dtype,
        device: this.config.device,
        progress_callback: (info: any) => {
          if (info.status === 'progress_total') {
            const progress = 30 + (info.progress * 0.6); // 30-90%
            this.updateProgress('loading', progress, `Model yükleniyor... ${Math.round(info.progress)}%`);
          }
        },
      });

      this.updateProgress('loading', 95, 'Model başlatılıyor...');
      
      // Warm up the model
      await this.warmup();
      
      this.updateProgress('ready', 100, 'Model hazır!');
      this.isInitialized = true;
      
    } catch (error) {
      console.error('Gemma4 Browser initialization failed:', error);
      this.updateProgress('error', 0, `Model yüklenemedi: ${error}`);
      throw error;
    }
  }

  /**
   * Warm up the model
   */
  private async warmup(): Promise<void> {
    try {
      const warmupPrompt = "Hello";
      const inputs = await this.tokenizer(warmupPrompt, { return_tensors: 'pt' });
      await this.model.generate({ ...inputs, max_new_tokens: 1, do_sample: false });
    } catch (error) {
      console.warn('Model warmup failed:', error);
    }
  }

  /**
   * Update progress
   */
  private updateProgress(status: GenerationProgress['status'], progress: number, message: string): void {
    this.progressCallback?.({ status, progress, message });
  }

  /**
   * Generate text
   */
  async generateText(prompt: string, streamCallback?: (text: string) => void): Promise<string> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      this.updateProgress('generating', 0, 'Metin üretiliyor...');
      
      const inputs = await this.tokenizer(prompt, { return_tensors: 'pt' });
      
      let fullText = '';
      
      if (streamCallback) {
        // Streaming generation
        let accumulatedText = '';
        const streamer = new TextStreamer(this.tokenizer, {
          skip_prompt: true,
          skip_special_tokens: true,
          callback_function: (text: string) => {
            accumulatedText += text;
            streamCallback(text);
          }
        });

        await this.model.generate({
          ...inputs,
          max_new_tokens: this.config.maxNewTokens,
          do_sample: true,
          temperature: this.config.temperature,
          top_p: this.config.topP,
          streamer
        });
        
        fullText = accumulatedText;
      } else {
        // Non-streaming generation
        const outputs = await this.model.generate({
          ...inputs,
          max_new_tokens: this.config.maxNewTokens,
          do_sample: true,
          temperature: this.config.temperature,
          top_p: this.config.topP,
        });

        fullText = this.tokenizer.decode(outputs[0], { skip_special_tokens: true });
      }

      this.updateProgress('ready', 100, 'Metin üretimi tamamlandı!');
      return fullText;
      
    } catch (error) {
      console.error('Text generation failed:', error);
      this.updateProgress('error', 0, `Metin üretilemedi: ${error}`);
      throw error;
    }
  }

  /**
   * Generate JSON response
   */
  async generateJson<T>(prompt: string): Promise<T> {
    const jsonPrompt = `${prompt}\n\nIMPORTANT: Respond only with valid JSON, no other text.`;
    const response = await this.generateText(jsonPrompt);
    
    try {
      return JSON.parse(response) as T;
    } catch (error) {
      console.error('JSON parse failed:', error);
      throw new Error('Geçersiz JSON formatı');
    }
  }

  /**
   * Generate video-aware AutoMagic edit result (simplified without video analysis)
   */
  async generateAutoMagicEditWithVideo(
    videoBlob: Blob,
    duration: number,
    audioBlob?: Blob
  ): Promise<AutoMagicResult> {
    try {
      // For now, use regular text generation without video analysis
      // to avoid ONNX kernel issues
      const editPrompt = `Sen profesyonel bir video editörüsün. ${duration.toFixed(1)} saniyelik bir video düzenlemesi yapıyorsun.
Bu video için en iyi edit script'i oluştur. Enerjik ve dinamik bir vibe hedefle.

JSON formatında yanıt ver:
{
  "vibe": "Energetic",
  "editScript": [
    {
      "startTime": 0,
      "endTime": ${Math.floor(duration / 2)},
      "playbackRate": 1.0,
      "cssFilter": "contrast(1.2) saturate(1.3)",
      "frameStyle": "cinematic",
      "effect": "none"
    },
    {
      "startTime": ${Math.floor(duration / 2)},
      "endTime": ${Math.floor(duration)},
      "playbackRate": 1.5,
      "cssFilter": "contrast(1.4) saturate(1.5)",
      "frameStyle": "neon",
      "effect": "none"
    }
  ],
  "texts": []
}

Kurallar:
- Energetic vibe: yüksek kontrast, parlak renkler
- playbackRate: 0.5-2.0 arası
- cssFilter: geçerli CSS filter string
- frameStyle: "none"|"cinematic"|"polaroid"|"neon"|"vintage"|"glitch"|"minimal"|"bold"|"tv"|"comic"|"glam"|"newspaper"
- effect: "none"|"snow"|"confetti"|"balloons"|"rain"|"hearts"|"stars"|"matrix"
- texts: her zaman boş ([])`;

      const response = await this.generateText(editPrompt);
      return JSON.parse(response) as AutoMagicResult;
      
    } catch (error) {
      console.error('Video-aware AutoMagic generation failed:', error);
      // Fallback to regular method
      return this.generateAutoMagicEdit(videoBlob, duration, audioBlob);
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
      "effect": "none"
    },
    {
      "startTime": ${Math.floor(duration / 2)},
      "endTime": ${Math.floor(duration)},
      "playbackRate": 1.5,
      "cssFilter": "contrast(1.4) saturate(1.5)",
      "frameStyle": "neon",
      "effect": "none"
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
- startTime ve endTime 0 ile ${duration.toFixed(1)} arasında olmalı. Segmentler ardışık ve videoyu tamamen kapsamalı.
- texts: Bu listeyi her zaman boş ([]) bırak.
- Önemli: Sahnelere göre farklı frameStyle ve effect kullanarak videoyu canlandır.

Şimdi bu video için en iyi edit script'i oluştur:`;

    try {
      return await this.generateJson<AutoMagicResult>(prompt);
    } catch (error) {
      console.error('Gemma4 Browser AutoMagic generation failed:', error);
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
    }));

    const prompt = `Sen profesyonel bir video editörüsün. "${vibe}" vibe için ${duration.toFixed(1)} saniyelik video edit script oluştur.
Sadece JSON array döndür, başka hiçbir şey yazma:

${JSON.stringify(exampleSegments, null, 2)}

Bu format örneğini kullanarak "${vibe}" vibe'ına uygun gerçek değerler üret:
- playbackRate: 0.5-2.0 arası
- cssFilter: geçerli CSS filter (örn: "contrast(1.3) saturate(1.5) brightness(1.1)")
- frameStyle: "none"|"cinematic"|"polaroid"|"neon"|"vintage"|"glitch"|"minimal"|"bold"|"tv"|"comic"|"glam"|"newspaper"
- effect: "none"|"snow"|"confetti"|"balloons"|"rain"|"hearts"|"stars"|"matrix"
- startTime/endTime: 0 ile ${duration.toFixed(1)} arasında, ardışık olmalı.
- Önemli: Farklı segmentlerde farklı çerçeveler ve efektler kullanarak etkileyici bir akış sağla.

Sadece JSON array döndür:`;

    try {
      return await this.generateJson<EditSegment[]>(prompt);
    } catch (error) {
      console.error('Gemma4 Browser script generation failed:', error);
      // Fallback response
      return exampleSegments;
    }
  }

  /**
   * Get model info
   */
  getModelInfo(): any {
    return {
      model: this.config.model,
      device: this.config.device,
      dtype: this.config.dtype,
      isInitialized: this.isInitialized,
      webGPUSupported: Gemma4BrowserService.checkWebGPUSupport()
    };
  }

  /**
   * Dispose model
   */
  dispose(): void {
    this.model = null;
    this.tokenizer = null;
    this.isInitialized = false;
  }
}

/**
 * Create Gemma4 browser service instance with current settings
 */
export async function createGemma4BrowserService(
  progressCallback?: (progress: GenerationProgress) => void
): Promise<Gemma4BrowserService> {
  const settings = await getSettings();
  
  const config: Partial<Gemma4BrowserConfig> = {
    model: settings.gemma4Model === 'gemma4:e2b' 
      ? 'onnx-community/gemma-4-E2B-it-ONNX'
      : 'onnx-community/gemma-4-E4B-it-ONNX',
    device: 'wasm', // Default to WASM for compatibility
    dtype: 'fp32' // Use fp32 for ONNX compatibility
  };

  const service = new Gemma4BrowserService(config);
  await service.initialize(progressCallback);
  
  return service;
}

/**
 * Quick browser compatibility test
 */
export function testBrowserCompatibility(): {
  webgpu: boolean;
  webgl: boolean;
  wasm: boolean;
  workers: boolean;
  indexedDB: boolean;
  recommended: boolean;
} {
  const webgpu = Gemma4BrowserService.checkWebGPUSupport();
  const webgl = !!document.createElement('canvas').getContext('webgl2');
  const wasm = typeof WebAssembly !== 'undefined' && typeof WebAssembly.validate === 'function';
  const workers = typeof Worker !== 'undefined';
  const indexedDB = 'indexedDB' in window;
  const recommended = (webgpu || wasm) && webgl && workers && indexedDB;

  return {
    webgpu,
    webgl,
    wasm,
    workers,
    indexedDB,
    recommended
  };
}
