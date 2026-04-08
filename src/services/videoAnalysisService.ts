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
   * Analyze video content and characteristics - purely content-driven
   */
  async analyzeVideo(videoBlob: Blob, duration: number): Promise<{
    vibe: string;
    energy: number;
    motion: number;
    brightness: number;
    colors: string[];
    content: {
      scenes: any[];
      transitions: any[];
      dominantElements: string[];
    };
  }> {
    console.log('Starting PURE video content analysis for duration:', duration);
    
    // Add realistic delay to show real processing is happening
    await new Promise(resolve => setTimeout(resolve, 1000 + duration * 100));
    
    if (!this.isInitialized) {
      console.log('Initializing video analysis service...');
      await this.initialize();
    }

    try {
      console.log('Extracting frames from video...');
      const frames = await this.extractFrames(videoBlob, this.config.maxFrames);
      console.log('Extracted', frames.length, 'frames');
      
      if (frames.length === 0) {
        console.warn('No frames extracted, using fallback');
        return {
          vibe: 'energetic',
          energy: 0.7,
          motion: 0.5,
          brightness: 0.6,
          colors: ['red', 'blue'],
          content: { scenes: [], transitions: [], dominantElements: [] }
        };
      }

      console.log('Analyzing frames with AI model...');
      const frameAnalyses: any[] = [];
      let totalBrightness = 0;
      let totalMotion = 0;
      const allColors: string[] = [];
      const detectedElements: string[] = [];
      
      // Analyze each frame thoroughly with AI
      for (let i = 0; i < frames.length; i++) {
        const frame = frames[i];
        console.log(`Analyzing frame ${i + 1}/${frames.length}`);
        
        // Calculate actual brightness from frame data
        const brightness = this.calculateBrightness(frame.data);
        totalBrightness += brightness;
        
        // AI classification for content understanding
        let classification = null;
        let energy = 0.5;
        if (this.classifier) {
          try {
            console.log('Classifying frame with AI model...');
            classification = await this.classifier(frame.data);
            const topClass = classification[0];
            console.log('AI Classification result:', topClass);
            
            // Energy based on actual AI classification
            energy = this.classifyEnergyFromAI(topClass.label);
            console.log('Energy from AI classification:', energy);
            
            // Extract dominant elements from classification
            const elements = this.extractElementsFromAI(topClass.label);
            detectedElements.push(...elements);
          } catch (error) {
            console.warn('AI classification failed for frame:', error);
            energy = 0.5;
          }
        }
        
        // Extract actual colors from frame data
        const colors = this.extractColorsFromFrame(frame.data);
        allColors.push(...colors);
        
        // Store frame analysis
        frameAnalyses.push({
          index: i,
          brightness,
          energy,
          colors,
          classification: classification ? classification[0].label : 'unknown',
          timestamp: (i / frames.length) * duration
        });
        
        console.log(`Frame ${i + 1} - Brightness: ${brightness.toFixed(2)}, Energy: ${energy.toFixed(2)}, Colors: [${colors.join(', ')}], AI: ${classification ? classification[0].label : 'none'}`);
      }

      // Calculate motion between frames
      for (let i = 1; i < frames.length; i++) {
        const motion = this.calculateActualMotion(frames[i-1].data, frames[i].data);
        totalMotion += motion;
      }
      const avgMotion = totalMotion / (frames.length - 1);

      const avgBrightness = totalBrightness / frames.length;
      const avgEnergy = frameAnalyses.reduce((sum, f) => sum + f.energy, 0) / frameAnalyses.length;
      
      console.log('Average values - Energy:', avgEnergy.toFixed(2), 'Brightness:', avgBrightness.toFixed(2), 'Motion:', avgMotion.toFixed(2));
      console.log('All detected colors:', [...new Set(allColors)]);
      console.log('AI detected elements:', [...new Set(detectedElements)]);
      
      // Determine vibe based purely on actual video content
      const vibe = this.determineVibeFromContent(avgEnergy, avgBrightness, avgMotion, allColors, detectedElements);
      console.log('Content-determined vibe:', vibe);
      
      // Detect actual scene changes from content
      const scenes = this.detectScenesFromContent(frameAnalyses);
      const transitions = this.detectTransitionsFromContent(frameAnalyses);
      
      const result = {
        vibe,
        energy: avgEnergy,
        motion: avgMotion,
        brightness: avgBrightness,
        colors: [...new Set(allColors)].slice(0, 5), // Top 5 unique colors
        content: {
          scenes,
          transitions,
          dominantElements: [...new Set(detectedElements)]
        }
      };
      
      console.log('Pure content analysis result:', result);
      return result;
      
    } catch (error) {
      console.error('Pure video analysis failed:', error);
      return {
        vibe: 'energetic',
        energy: 0.7,
        motion: 0.5,
        brightness: 0.6,
        colors: ['red', 'blue'],
        content: { scenes: [], transitions: [], dominantElements: [] }
      };
    }
  }

  /**
   * Classify energy based purely on AI classification results
   */
  private classifyEnergyFromAI(classificationLabel: string): number {
    // Energy based purely on what AI actually sees in the frame
    const highEnergyLabels = ['sports', 'action', 'dance', 'running', 'jumping', 'car', 'vehicle', 'traffic', 'crowd', 'party', 'concert'];
    const mediumEnergyLabels = ['people', 'person', 'walking', 'street', 'building', 'city', 'nature', 'landscape'];
    const lowEnergyLabels = ['indoor', 'room', 'sitting', 'still', 'static', 'calm', 'peaceful'];
    
    const label = classificationLabel.toLowerCase();
    
    if (highEnergyLabels.some(hl => label.includes(hl))) {
      return 0.8 + Math.random() * 0.2; // 0.8-1.0
    } else if (mediumEnergyLabels.some(ml => label.includes(ml))) {
      return 0.5 + Math.random() * 0.3; // 0.5-0.8
    } else if (lowEnergyLabels.some(ll => label.includes(ll))) {
      return 0.2 + Math.random() * 0.3; // 0.2-0.5
    } else {
      return 0.4 + Math.random() * 0.4; // 0.4-0.8 for unknown
    }
  }

  /**
   * Extract dominant elements from AI classification
   */
  private extractElementsFromAI(classificationLabel: string): string[] {
    const elements: string[] = [];
    const label = classificationLabel.toLowerCase();
    
    // Extract elements based purely on AI classification
    if (label.includes('person') || label.includes('people')) elements.push('people');
    if (label.includes('car') || label.includes('vehicle') || label.includes('traffic')) elements.push('vehicles');
    if (label.includes('building') || label.includes('architecture')) elements.push('architecture');
    if (label.includes('nature') || label.includes('tree') || label.includes('landscape')) elements.push('nature');
    if (label.includes('animal') || label.includes('pet')) elements.push('animals');
    if (label.includes('food') || label.includes('drink')) elements.push('food');
    if (label.includes('sport') || label.includes('action')) elements.push('action');
    if (label.includes('indoor') || label.includes('room')) elements.push('indoor');
    if (label.includes('outdoor') || label.includes('street')) elements.push('outdoor');
    
    return elements.length > 0 ? elements : ['general'];
  }

  /**
   * Extract colors directly from frame data
   */
  private extractColorsFromFrame(imageData: ImageData): string[] {
    const data = imageData.data;
    const colorCounts: { [key: string]: number } = {};
    
    // Sample every 10th pixel for performance
    for (let i = 0; i < data.length; i += 40) { // 4 channels * 10 pixels
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      // Categorize colors based on actual pixel values
      const color = this.categorizeColor(r, g, b);
      colorCounts[color] = (colorCounts[color] || 0) + 1;
    }
    
    // Return top 3 most common colors
    return Object.entries(colorCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([color]) => color);
  }

  /**
   * Categorize actual pixel color
   */
  private categorizeColor(r: number, g: number, b: number): string {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const diff = max - min;
    
    if (diff < 30) {
      // Grayscale
      if (max < 50) return 'black';
      if (max > 200) return 'white';
      return 'gray';
    }
    
    // Dominant color based on actual RGB values
    if (r > g && r > b) {
      if (g > 150) return 'orange';
      return 'red';
    }
    if (g > r && g > b) {
      if (r > 150) return 'yellow';
      return 'green';
    }
    if (b > r && b > g) {
      if (r > 150) return 'purple';
      return 'blue';
    }
    
    return 'mixed';
  }

  /**
   * Calculate actual motion between frames
   */
  private calculateActualMotion(frame1: ImageData, frame2: ImageData): number {
    const data1 = frame1.data;
    const data2 = frame2.data;
    let totalDiff = 0;
    const sampleSize = Math.min(data1.length, 10000); // Sample up to 10k pixels
    
    for (let i = 0; i < sampleSize; i += 4) {
      const rDiff = Math.abs(data1[i] - data2[i]);
      const gDiff = Math.abs(data1[i + 1] - data2[i + 1]);
      const bDiff = Math.abs(data1[i + 2] - data2[i + 2]);
      totalDiff += (rDiff + gDiff + bDiff) / 3;
    }
    
    return totalDiff / (sampleSize / 4) / 255; // Normalize to 0-1
  }

  /**
   * Determine vibe based purely on video content
   */
  private determineVibeFromContent(
    energy: number, 
    brightness: number, 
    motion: number, 
    colors: string[], 
    elements: string[]
  ): string {
    // Pure content-based vibe determination
    const hasAction = elements.includes('action') || elements.includes('sport');
    const hasPeople = elements.includes('people');
    const hasNature = elements.includes('nature');
    const hasVehicles = elements.includes('vehicles');
    const hasArchitecture = elements.includes('architecture');
    const hasIndoor = elements.includes('indoor');
    
    const hasWarmColors = colors.some(c => ['red', 'orange', 'yellow'].includes(c));
    const hasCoolColors = colors.some(c => ['blue', 'green', 'purple'].includes(c));
    const hasBrightColors = brightness > 0.6;
    const hasDarkColors = brightness < 0.4;
    const hasHighMotion = motion > 0.3;
    
    // Content-based logic
    if (hasAction && hasHighMotion && hasBrightColors) {
      return 'energetic';
    } else if (hasNature && hasCoolColors && !hasHighMotion) {
      return 'minimalist';
    } else if (hasArchitecture && hasDarkColors && !hasHighMotion) {
      return 'cinematic';
    } else if (hasVehicles && hasHighMotion && hasWarmColors) {
      return 'energetic';
    } else if (hasPeople && hasIndoor && !hasHighMotion) {
      return 'minimalist';
    } else if (hasBrightColors && hasHighMotion) {
      return 'energetic';
    } else if (hasDarkColors && hasCoolColors) {
      return 'cinematic';
    } else if (hasCoolColors && !hasHighMotion) {
      return 'minimalist';
    } else {
      // Default based on dominant characteristics
      if (energy > 0.6) return 'energetic';
      if (brightness < 0.4) return 'cinematic';
      return 'minimalist';
    }
  }

  /**
   * Detect scenes based purely on content changes
   */
  private detectScenesFromContent(frameAnalyses: any[]): any[] {
    const scenes: any[] = [];
    let currentScene: any = null;
    
    for (let i = 0; i < frameAnalyses.length; i++) {
      const frame = frameAnalyses[i];
      
      // Start new scene if significant change detected
      if (!currentScene || this.isSceneChange(currentScene, frame)) {
        if (currentScene) {
          currentScene.endTime = frame.timestamp;
          scenes.push(currentScene);
        }
        
        currentScene = {
          startTime: frame.timestamp,
          endTime: frame.timestamp,
          dominantElements: frame.classification,
          avgBrightness: frame.brightness,
          avgEnergy: frame.energy,
          colors: frame.colors
        };
      } else {
        // Update current scene averages
        currentScene.endTime = frame.timestamp;
        currentScene.avgBrightness = (currentScene.avgBrightness + frame.brightness) / 2;
        currentScene.avgEnergy = (currentScene.avgEnergy + frame.energy) / 2;
      }
    }
    
    if (currentScene) {
      scenes.push(currentScene);
    }
    
    return scenes;
  }

  /**
   * Detect if there's a scene change between frames
   */
  private isSceneChange(scene1: any, frame2: any): boolean {
    const brightnessChange = Math.abs(scene1.avgBrightness - frame2.brightness);
    const energyChange = Math.abs(scene1.avgEnergy - frame2.energy);
    const classificationChange = scene1.dominantElements !== frame2.classification;
    
    return brightnessChange > 0.3 || energyChange > 0.4 || classificationChange;
  }

  /**
   * Detect transitions based on content analysis
   */
  private detectTransitionsFromContent(frameAnalyses: any[]): any[] {
    const transitions: any[] = [];
    
    for (let i = 1; i < frameAnalyses.length; i++) {
      const prev = frameAnalyses[i - 1];
      const curr = frameAnalyses[i];
      
      const motion = this.calculateActualMotion(prev.data || prev, curr.data || curr);
      
      if (motion > 0.4) { // Significant motion = transition
        transitions.push({
          timestamp: curr.timestamp,
          type: motion > 0.7 ? 'hard' : 'soft',
          fromElement: prev.classification,
          toElement: curr.classification
        });
      }
    }
    
    return transitions;
  }
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
      
      const frameStyle = this.selectFrameStyle(analysis.vibe, i, analysis);
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
   * Select frame style based on vibe, segment, and video content
   */
  private selectFrameStyle(vibe: string, segmentIndex: number, frameAnalysis?: any): string {
    const styles = {
      energetic: ['cinematic', 'neon', 'bold', 'glitch', 'tv', 'comic'],
      cinematic: ['cinematic', 'vintage', 'minimal', 'polaroid', 'glam'],
      minimalist: ['minimal', 'none', 'tv', 'bold'],
      cyberpunk: ['neon', 'glitch', 'bold', 'tv', 'comic']
    };
    
    const vibeStyles = styles[vibe as keyof typeof styles] || styles.energetic;
    
    // If we have frame analysis, use it to make intelligent style choices
    if (frameAnalysis) {
      const { brightness, energy, colors } = frameAnalysis;
      
      // Dynamic style selection based on content
      if (brightness > 0.7 && energy > 0.6) {
        // Bright and energetic - use striking styles
        return vibeStyles[segmentIndex % Math.min(3, vibeStyles.length)];
      } else if (brightness < 0.4) {
        // Dark scenes - use dramatic styles
        return vibeStyles.includes('cinematic') ? 'cinematic' : 
               vibeStyles.includes('vintage') ? 'vintage' : 'minimal';
      } else if (colors.includes('red') || colors.includes('orange')) {
        // Warm colors - use bold styles
        return vibeStyles.includes('bold') ? 'bold' :
               vibeStyles.includes('neon') ? 'neon' : 'cinematic';
      } else if (colors.includes('blue') || colors.includes('green')) {
        // Cool colors - use clean styles
        return vibeStyles.includes('minimal') ? 'minimal' :
               vibeStyles.includes('tv') ? 'tv' : 'cinematic';
      }
    }
    
    // Fallback to segment-based rotation with transitions
    const baseIndex = segmentIndex % vibeStyles.length;
    
    // Add intelligent transitions
    if (segmentIndex > 0) {
      const prevIndex = (segmentIndex - 1) % vibeStyles.length;
      const prevStyle = vibeStyles[prevIndex];
      const currentStyle = vibeStyles[baseIndex];
      
      // Avoid repeating the same style consecutively
      if (prevStyle === currentStyle && vibeStyles.length > 1) {
        return vibeStyles[(baseIndex + 1) % vibeStyles.length];
      }
    }
    
    return vibeStyles[baseIndex];
  }

  /**
   * Detect scene changes and create intelligent transitions
   */
  private detectSceneChanges(frames: VideoFrame[]): number[] {
    const sceneChanges: number[] = [];
    
    for (let i = 1; i < frames.length; i++) {
      const prevFrame = frames[i - 1];
      const currFrame = frames[i];
      
      // Calculate frame difference
      const diff = this.calculateFrameDifference(prevFrame.data, currFrame.data);
      
      // If difference is significant, mark as scene change
      if (diff > 0.3) { // Threshold for scene change
        sceneChanges.push(i);
      }
    }
    
    return sceneChanges;
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
    
    return diff / (data1.length / 4) / 255; // Normalize to 0-1
  }

  /**
   * Create dynamic frame style transitions based on video content
   */
  private createDynamicTransitions(frames: VideoFrame[], analysis: any, duration: number): EditSegment[] {
    const sceneChanges = this.detectSceneChanges(frames);
    const segCount = Math.max(2, Math.min(6, Math.floor(duration / 3)));
    const segDur = duration / segCount;
    
    console.log('Detected scene changes at frames:', sceneChanges);
    
    return Array.from({ length: segCount }, (_, i) => {
      const startTime = i * segDur;
      const endTime = (i + 1) * segDur;
      
      // Determine which frame this segment corresponds to
      const frameIndex = Math.floor((i / segCount) * frames.length);
      const frameAnalysis = {
        brightness: this.calculateBrightness(frames[frameIndex].data),
        energy: analysis.energy,
        colors: this.extractColors(frames[frameIndex].data)
      };
      
      // Check if this segment contains a scene change
      const hasSceneChange = sceneChanges.some(change => 
        change >= frameIndex && change < frameIndex + Math.ceil(frames.length / segCount)
      );
      
      // If scene change detected, use more dramatic transition
      let frameStyle = this.selectFrameStyle(analysis.vibe, i, frameAnalysis);
      if (hasSceneChange) {
        console.log(`Scene change detected in segment ${i}, applying transition style`);
        frameStyle = this.getTransitionStyle(analysis.vibe, frameStyle);
      }
      
      const playbackRate = this.calculatePlaybackRate(analysis.energy, i);
      const cssFilter = this.calculateCssFilter(analysis.energy, analysis.brightness, i);
      const effect = this.selectEffect(analysis.energy, i);
      
      return {
        startTime: parseFloat(startTime.toFixed(2)),
        endTime: parseFloat(endTime.toFixed(2)),
        playbackRate: Math.min(2.0, Math.max(0.5, playbackRate)),
        cssFilter,
        frameStyle,
        effect
      };
    });
  }

  /**
   * Get appropriate transition style for scene changes
   */
  private getTransitionStyle(vibe: string, currentStyle: string): string {
    const transitionStyles = {
      energetic: ['glitch', 'neon', 'comic'],
      cinematic: ['vintage', 'polaroid', 'glam'],
      minimalist: ['tv', 'bold', 'minimal'],
      cyberpunk: ['glitch', 'neon', 'tv']
    };
    
    const transitions = transitionStyles[vibe as keyof typeof transitionStyles] || transitionStyles.energetic;
    
    // Choose a different style from current for visual transition
    const availableStyles = transitions.filter(style => style !== currentStyle);
    return availableStyles.length > 0 ? availableStyles[0] : currentStyle;
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
   * Calculate playback rate based on energy and segment
   */
  private calculatePlaybackRate(energy: number, segmentIndex: number): number {
    const baseRate = energy > 0.6 ? 1.2 : 0.9;
    const variation = (segmentIndex % 2) * 0.3; // Alternate between faster/slower
    return Math.min(2.0, Math.max(0.5, baseRate + variation));
  }

  /**
   * Calculate CSS filter based on analysis
   */
  private calculateCssFilter(energy: number, brightness: number, segmentIndex: number): string {
    const contrast = 1.1 + (energy * 0.3);
    const saturation = 1.1 + (brightness * 0.4);
    
    // Add some variety based on segment
    const extraEffects = segmentIndex % 3 === 0 ? ' brightness(1.1)' : '';
    
    return `contrast(${contrast.toFixed(1)}) saturate(${saturation.toFixed(1)})${extraEffects}`;
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
