import { pipeline, env } from '@xenova/transformers';
import { getSettings } from './settings';
import { EditSegment, AutoMagicResult } from './ai';

// Configure transformers.js for mobile optimization
env.allowLocalModels = false;
env.useBrowserCache = true;
env.allowRemoteModels = true;

export interface VideoAnalysisConfig {
  model: string;
  device: 'webgpu' | 'wasm' | 'cpu';
  enableCache: boolean;
  maxFrames: number;
}

export interface VideoFrame {
  data: ImageData;
  timestamp: number;
}

export class VideoAnalysisService {
  private classifier: any = null;
  private featureExtractor: any = null;
  private config: VideoAnalysisConfig;
  private isInitialized = false;
  private frameCache = new Map<string, any>();

  constructor(config: Partial<VideoAnalysisConfig> = {}) {
    this.config = {
      model: 'Xenova/mobilevitv2-1.0-imagenet1k-192', // Mobile-optimized vision model
      device: this.detectBestDevice(),
      enableCache: true,
      maxFrames: this.isMobile() ? 3 : 5, // Fewer frames on mobile
      ...config
    };
  }

  /**
   * Detect best available device for inference
   */
  private detectBestDevice(): 'webgpu' | 'wasm' | 'cpu' {
    // Check for WebGPU support first
    if ('gpu' in navigator && 'getAdapter' in (navigator as any).gpu) {
      return 'webgpu';
    }
    // Fall back to WASM
    return 'wasm';
  }

  /**
   * Check if running on mobile
   */
  private isMobile(): boolean {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
           window.innerWidth < 768;
  }

  /**
   * Initialize the models
   */
  async initialize(progressCallback?: (progress: number, message: string) => void): Promise<void> {
    if (this.isInitialized) return;

    try {
      progressCallback?.(10, 'Model yükleniyor...');
      
      // Initialize image classification pipeline
      this.classifier = await pipeline('image-classification', this.config.model, {
        progress_callback: (info: any) => {
          if (info.status === 'progress') {
            const progress = 10 + (info.progress * 0.8); // 10-90%
            progressCallback?.(progress, `Model yükleniyor... ${Math.round(info.progress)}%`);
          }
        },
      });

      progressCallback?.(90, 'Özellik çikarici hazirlaniyor...');
      
      // Initialize feature extraction for frame analysis
      this.featureExtractor = await pipeline('image-feature-extraction', this.config.model, {});

      progressCallback?.(100, 'Video analizi hazir!');
      this.isInitialized = true;
      
    } catch (error) {
      console.error('Video analysis service initialization failed:', error);
      throw new Error('Video analizi servisi yüklenemedi');
    }
  }

  /**
   * Extract frames from video blob
   */
  private async extractFrames(videoBlob: Blob, maxFrames: number): Promise<VideoFrame[]> {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      (video as any).playsInline = true;
      
      const frames: VideoFrame[] = [];
      let frameCount = 0;
      const frameInterval = 1 / maxFrames; // Extract evenly spaced frames
      
      video.onloadedmetadata = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        
        canvas.width = 192; // Small resolution for mobile
        canvas.height = 192;
        
        const extractFrame = () => {
          if (frameCount >= maxFrames || video.currentTime >= video.duration) {
            URL.revokeObjectURL(video.src);
            resolve(frames);
            return;
          }
          
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          
          frames.push({
            data: imageData,
            timestamp: video.currentTime
          });
          
          frameCount++;
          video.currentTime = frameCount * frameInterval * video.duration;
        };
        
        video.currentTime = 0;
        video.onseeked = extractFrame;
      };
      
      video.onerror = () => {
        console.warn('Frame extraction failed, using empty frames');
        resolve([]);
      };
      
      video.src = URL.createObjectURL(videoBlob);
    });
  }

  /**
   * Analyze video content and characteristics
   */
  async analyzeVideo(videoBlob: Blob, duration: number): Promise<{
    vibe: string;
    energy: number;
    motion: number;
    brightness: number;
    colors: string[];
  }> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const frames = await this.extractFrames(videoBlob, this.config.maxFrames);
      
      if (frames.length === 0) {
        // Fallback analysis
        return {
          vibe: 'energetic',
          energy: 0.7,
          motion: 0.5,
          brightness: 0.6,
          colors: ['red', 'blue']
        };
      }

      let totalEnergy = 0;
      let totalBrightness = 0;
      const allColors: string[] = [];
      
      // Analyze each frame
      for (const frame of frames) {
        // Classify content
        const classification = await this.classifier(frame.data);
        const topClass = classification[0];
        
        // Extract features for energy analysis
        const features = await this.featureExtractor(frame.data);
        
        // Calculate brightness
        const brightness = this.calculateBrightness(frame.data);
        totalBrightness += brightness;
        
        // Determine energy based on classification
        const energy = this.classifyEnergy(topClass.label);
        totalEnergy += energy;
        
        // Extract dominant colors (simplified)
        const colors = this.extractColors(frame.data);
        allColors.push(...colors);
      }

      const avgEnergy = totalEnergy / frames.length;
      const avgBrightness = totalBrightness / frames.length;
      
      // Determine overall vibe
      const vibe = this.determineVibe(avgEnergy, avgBrightness, allColors);
      
      return {
        vibe,
        energy: avgEnergy,
        motion: this.estimateMotion(frames),
        brightness: avgBrightness,
        colors: [...new Set(allColors)].slice(0, 3) // Top 3 unique colors
      };
      
    } catch (error) {
      console.error('Video analysis failed:', error);
      // Return fallback values
      return {
        vibe: 'energetic',
        energy: 0.7,
        motion: 0.5,
        brightness: 0.6,
        colors: ['red', 'blue']
      };
    }
  }

  /**
   * Calculate average brightness of frame
   */
  private calculateBrightness(imageData: ImageData): number {
    const data = imageData.data;
    let totalBrightness = 0;
    
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      totalBrightness += (r + g + b) / 3;
    }
    
    return totalBrightness / (data.length / 4) / 255;
  }

  /**
   * Classify energy level based on content
   */
  private classifyEnergy(label: string): number {
    const highEnergyLabels = ['sports', 'action', 'dance', 'car', 'vehicle', 'animal'];
    const lowEnergyLabels = ['landscape', 'nature', 'food', 'object', 'indoor'];
    
    const lowerLabel = label.toLowerCase();
    
    if (highEnergyLabels.some(term => lowerLabel.includes(term))) {
      return 0.8 + Math.random() * 0.2;
    } else if (lowEnergyLabels.some(term => lowerLabel.includes(term))) {
      return 0.2 + Math.random() * 0.3;
    } else {
      return 0.5 + Math.random() * 0.3;
    }
  }

  /**
   * Extract dominant colors (simplified)
   */
  private extractColors(imageData: ImageData): string[] {
    const data = imageData.data;
    const colorMap = new Map<string, number>();
    
    // Sample every 10th pixel for performance
    for (let i = 0; i < data.length; i += 40) {
      const r = Math.round(data[i] / 51) * 51;
      const g = Math.round(data[i + 1] / 51) * 51;
      const b = Math.round(data[i + 2] / 51) * 51;
      
      const color = `${r},${g},${b}`;
      colorMap.set(color, (colorMap.get(color) || 0) + 1);
    }
    
    // Convert to color names (simplified)
    const sortedColors = Array.from(colorMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([rgb]) => this.rgbToColorName(rgb));
    
    return sortedColors;
  }

  /**
   * Convert RGB to simple color name
   */
  private rgbToColorName(rgb: string): string {
    const [r, g, b] = rgb.split(',').map(Number);
    
    if (r > 150 && g < 100 && b < 100) return 'red';
    if (r < 100 && g > 150 && b < 100) return 'green';
    if (r < 100 && g < 100 && b > 150) return 'blue';
    if (r > 150 && g > 150 && b < 100) return 'yellow';
    if (r > 150 && g < 100 && b > 150) return 'magenta';
    if (r < 100 && g > 150 && b > 150) return 'cyan';
    if (r > 200 && g > 200 && b > 200) return 'white';
    if (r < 50 && g < 50 && b < 50) return 'black';
    if (r > 100 && g > 100 && b > 100) return 'gray';
    
    return 'mixed';
  }

  /**
   * Estimate motion between frames
   */
  private estimateMotion(frames: VideoFrame[]): number {
    if (frames.length < 2) return 0.5;
    
    let totalMotion = 0;
    
    for (let i = 1; i < frames.length; i++) {
      const motion = this.calculateFrameDifference(frames[i-1].data, frames[i].data);
      totalMotion += motion;
    }
    
    return totalMotion / (frames.length - 1);
  }

  /**
   * Calculate difference between two frames
   */
  private calculateFrameDifference(frame1: ImageData, frame2: ImageData): number {
    const data1 = frame1.data;
    const data2 = frame2.data;
    let diff = 0;
    
    for (let i = 0; i < data1.length; i += 4) {
      const rDiff = Math.abs(data1[i] - data2[i]);
      const gDiff = Math.abs(data1[i + 1] - data2[i + 1]);
      const bDiff = Math.abs(data1[i + 2] - data2[i + 2]);
      diff += (rDiff + gDiff + bDiff) / 3;
    }
    
    return diff / (data1.length / 4) / 255;
  }

  /**
   * Determine overall vibe based on analysis
   */
  private determineVibe(energy: number, brightness: number, colors: string[]): string {
    if (energy > 0.7 && brightness > 0.6) {
      return 'energetic';
    } else if (energy < 0.4 && brightness < 0.5) {
      return 'cinematic';
    } else if (colors.includes('blue') || colors.includes('cyan')) {
      return 'minimalist';
    } else if (energy > 0.6 && colors.includes('red')) {
      return 'cyberpunk';
    } else {
      return 'energetic';
    }
  }

  /**
   * Generate AutoMagic edit based on video analysis
   */
  async generateAutoMagicEdit(
    videoBlob: Blob,
    duration: number,
    audioBlob?: Blob
  ): Promise<AutoMagicResult> {
    const analysis = await this.analyzeVideo(videoBlob, duration);
    
    // Generate edit script based on analysis
    const segCount = Math.max(2, Math.min(4, Math.floor(duration / 3)));
    const segDur = duration / segCount;
    
    const editScript = Array.from({ length: segCount }, (_, i) => {
      const startTime = i * segDur;
      const endTime = (i + 1) * segDur;
      
      // Vary effects based on analysis
      const playbackRate = analysis.energy > 0.6 ? 1.2 + (analysis.energy * 0.3) : 0.8 + (analysis.energy * 0.4);
      const contrast = 1.1 + (analysis.energy * 0.3);
      const saturation = 1.1 + (analysis.brightness * 0.4);
      
      const frameStyle = this.selectFrameStyle(analysis.vibe, i);
      const effect = this.selectEffect(analysis.energy, i);
      
      return {
        startTime: parseFloat(startTime.toFixed(2)),
        endTime: parseFloat(endTime.toFixed(2)),
        playbackRate: Math.min(2.0, Math.max(0.5, playbackRate)),
        cssFilter: `contrast(${contrast.toFixed(1)}) saturate(${saturation.toFixed(1)})`,
        frameStyle,
        effect
      };
    });

    return {
      vibe: analysis.vibe,
      editScript,
      texts: []
    };
  }

  /**
   * Select frame style based on vibe and segment
   */
  private selectFrameStyle(vibe: string, segmentIndex: number): string {
    const styles = {
      energetic: ['cinematic', 'neon', 'bold', 'glitch'],
      cinematic: ['cinematic', 'vintage', 'minimal'],
      minimalist: ['minimal', 'none', 'tv'],
      cyberpunk: ['neon', 'glitch', 'bold']
    };
    
    const vibeStyles = styles[vibe as keyof typeof styles] || styles.energetic;
    return vibeStyles[segmentIndex % vibeStyles.length];
  }

  /**
   * Select effect based on energy and segment
   */
  private selectEffect(energy: number, segmentIndex: number): string {
    if (energy > 0.7) {
      const effects = ['none', 'confetti', 'stars', 'matrix'];
      return effects[segmentIndex % effects.length];
    } else {
      return 'none';
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
    const analysis = await this.analyzeVideo(videoBlob, duration);
    
    // Override vibe if user specified
    const targetVibe = vibe || analysis.vibe;
    
    const segCount = Math.max(2, Math.min(6, Math.floor(duration / 3)));
    const segDur = duration / segCount;
    
    return Array.from({ length: segCount }, (_, i) => {
      const startTime = i * segDur;
      const endTime = (i + 1) * segDur;
      
      // Create variety in effects
      const playbackRate = 0.8 + (Math.random() * 0.6);
      const contrast = 1.1 + (Math.random() * 0.4);
      const saturation = 1.1 + (Math.random() * 0.4);
      
      return {
        startTime: parseFloat(startTime.toFixed(2)),
        endTime: parseFloat(endTime.toFixed(2)),
        playbackRate,
        cssFilter: `contrast(${contrast.toFixed(1)}) saturate(${saturation.toFixed(1)})`,
        frameStyle: this.selectFrameStyle(targetVibe, i),
        effect: this.selectEffect(analysis.energy, i)
      };
    });
  }

  /**
   * Get model info
   */
  getModelInfo(): any {
    return {
      model: this.config.model,
      device: this.config.device,
      isInitialized: this.isInitialized,
      isMobile: this.isMobile(),
      maxFrames: this.config.maxFrames
    };
  }

  /**
   * Dispose models
   */
  dispose(): void {
    this.classifier = null;
    this.featureExtractor = null;
    this.isInitialized = false;
    this.frameCache.clear();
  }
}

/**
 * Create video analysis service instance
 */
export async function createVideoAnalysisService(
  progressCallback?: (progress: number, message: string) => void
): Promise<VideoAnalysisService> {
  const service = new VideoAnalysisService();
  await service.initialize(progressCallback);
  return service;
}
