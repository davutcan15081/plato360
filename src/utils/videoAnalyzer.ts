export interface VideoFrame {
  data: string; // base64 image
  timestamp: number;
  index: number;
}

export interface VideoAnalysisResult {
  description: string;
  scenes: Array<{
    start: number;
    end: number;
    description: string;
    vibe: string;
    objects: string[];
    actions: string[];
  }>;
  duration: number;
  frameCount: number;
}

export class VideoAnalyzer {
  private canvas: HTMLCanvasElement;
  private video: HTMLVideoElement;
  private context: CanvasRenderingContext2D;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.video = document.createElement('video');
    this.context = this.canvas.getContext('2d')!;
  }

  /**
   * Extract frames from video blob at specified intervals
   */
  async extractFrames(
    videoBlob: Blob,
    frameCount: number = 10,
    duration?: number
  ): Promise<VideoFrame[]> {
    return new Promise((resolve, reject) => {
      const videoUrl = URL.createObjectURL(videoBlob);
      this.video.src = videoUrl;
      
      this.video.onloadedmetadata = () => {
        const videoDuration = duration || this.video.duration;
        const interval = videoDuration / frameCount;
        const frames: VideoFrame[] = [];
        let extractedCount = 0;

        this.video.width = this.video.videoWidth;
        this.video.height = this.video.videoHeight;
        this.canvas.width = 640; // Standard width for analysis
        this.canvas.height = (640 / this.video.videoWidth) * this.video.videoHeight;

        const extractFrame = (timestamp: number) => {
          if (extractedCount >= frameCount) {
            URL.revokeObjectURL(videoUrl);
            resolve(frames);
            return;
          }

          this.video.currentTime = timestamp;
        };

        this.video.onseeked = () => {
          if (this.video.readyState >= 2) {
            // Draw frame to canvas
            this.context.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
            
            // Convert to base64
            const frameData = this.canvas.toDataURL('image/jpeg', 0.8);
            
            frames.push({
              data: frameData,
              timestamp: this.video.currentTime,
              index: extractedCount
            });

            extractedCount++;
            const nextTimestamp = extractedCount * interval;
            extractFrame(Math.min(nextTimestamp, videoDuration - 0.1));
          }
        };

        // Start extraction
        extractFrame(0.1); // Start slightly after 0 to avoid black frame
      };

      this.video.onerror = (error) => {
        URL.revokeObjectURL(videoUrl);
        reject(new Error('Video yüklenemedi'));
      };
    });
  }

  /**
   * Extract key frames based on scene changes (simplified version)
   */
  async extractKeyFrames(
    videoBlob: Blob,
    maxFrames: number = 8,
    duration?: number
  ): Promise<VideoFrame[]> {
    // For now, use uniform distribution. Later we can implement scene detection
    return this.extractFrames(videoBlob, maxFrames, duration);
  }

  /**
   * Get video duration without loading the full video
   */
  async getVideoDuration(videoBlob: Blob): Promise<number> {
    return new Promise((resolve, reject) => {
      const videoUrl = URL.createObjectURL(videoBlob);
      const video = document.createElement('video');
      
      video.onloadedmetadata = () => {
        URL.revokeObjectURL(videoUrl);
        resolve(video.duration);
      };
      
      video.onerror = () => {
        URL.revokeObjectURL(videoUrl);
        reject(new Error('Video süresi alınamadı'));
      };
      
      video.src = videoUrl;
    });
  }

  /**
   * Create a video thumbnail
   */
  async createThumbnail(videoBlob: Blob, time: number = 1): Promise<string> {
    return new Promise((resolve, reject) => {
      const videoUrl = URL.createObjectURL(videoBlob);
      this.video.src = videoUrl;
      
      this.video.onloadedmetadata = () => {
        this.video.currentTime = Math.min(time, this.video.duration - 0.1);
      };
      
      this.video.onseeked = () => {
        if (this.video.readyState >= 2) {
          this.canvas.width = 320;
          this.canvas.height = (320 / this.video.videoWidth) * this.video.videoHeight;
          
          this.context.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
          const thumbnail = this.canvas.toDataURL('image/jpeg', 0.8);
          
          URL.revokeObjectURL(videoUrl);
          resolve(thumbnail);
        }
      };
      
      this.video.onerror = () => {
        URL.revokeObjectURL(videoUrl);
        reject(new Error('Thumbnail oluşturulamadı'));
      };
    });
  }

  /**
   * Analyze video content patterns
   */
  async analyzeVideoPatterns(videoBlob: Blob): Promise<{
    hasMotion: boolean;
    brightness: number;
    contrast: number;
    dominantColors: string[];
  }> {
    const frames = await this.extractFrames(videoBlob, 5);
    
    // Simple analysis - could be enhanced with actual computer vision
    const brightnesses: number[] = [];
    const contrasts: number[] = [];
    
    for (const frame of frames) {
      const analysis = await this.analyzeFrame(frame.data);
      brightnesses.push(analysis.brightness);
      contrasts.push(analysis.contrast);
    }
    
    const avgBrightness = brightnesses.reduce((a, b) => a + b, 0) / brightnesses.length;
    const avgContrast = contrasts.reduce((a, b) => a + b, 0) / contrasts.length;
    
    return {
      hasMotion: true, // Simplified - could implement actual motion detection
      brightness: avgBrightness,
      contrast: avgContrast,
      dominantColors: ['#000000', '#FFFFFF'] // Simplified
    };
  }

  /**
   * Analyze a single frame
   */
  private async analyzeFrame(frameData: string): Promise<{
    brightness: number;
    contrast: number;
  }> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        this.canvas.width = img.width;
        this.canvas.height = img.height;
        this.context.drawImage(img, 0, 0);
        
        const imageData = this.context.getImageData(0, 0, this.canvas.width, this.canvas.height);
        const data = imageData.data;
        
        let brightness = 0;
        for (let i = 0; i < data.length; i += 4) {
          brightness += (data[i] + data[i + 1] + data[i + 2]) / 3;
        }
        brightness = brightness / (data.length / 4);
        
        // Simple contrast calculation
        let min = 255, max = 0;
        for (let i = 0; i < data.length; i += 4) {
          const gray = (data[i] + data[i + 1] + data[i + 2]) / 3;
          min = Math.min(min, gray);
          max = Math.max(max, gray);
        }
        const contrast = max - min;
        
        resolve({ brightness, contrast });
      };
      img.src = frameData;
    });
  }
}

/**
 * Utility function to create video analyzer instance
 */
export function createVideoAnalyzer(): VideoAnalyzer {
  return new VideoAnalyzer();
}

/**
 * Extract video frames for AI analysis
 */
export async function extractVideoFramesForAI(
  videoBlob: Blob,
  maxFrames: number = 6
): Promise<string[]> {
  const analyzer = createVideoAnalyzer();
  const frames = await analyzer.extractKeyFrames(videoBlob, maxFrames);
  return frames.map(frame => frame.data);
}
