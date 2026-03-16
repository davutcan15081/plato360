import { GoogleGenAI, Type } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface EditSegment {
  startTime: number;
  endTime: number;
  playbackRate: number;
  cssFilter: string;
  frameStyle: string;
}

export async function generateVideoEditScript(videoBlob: Blob, vibe: string): Promise<EditSegment[]> {
  const base64Video = await blobToBase64(videoBlob);
  const mimeType = videoBlob.type || 'video/webm';
  const duration = await getVideoDuration(videoBlob);

  const prompt = `You are an expert video editor and director. I am providing you with a video that is approximately ${duration.toFixed(2)} seconds long.
The user wants a '${vibe}' promotional edit.

CRITICAL INSTRUCTION: You MUST deeply analyze the actual visual content of the video frame by frame.
1. Identify the most interesting visual moments (e.g., best angles of the product, product reveals, dynamic movements, or interesting lighting).
2. Apply SLOW MOTION (playbackRate: 0.3 to 0.8) exactly during these interesting visual moments to highlight them.
3. Apply FAST FORWARD (playbackRate: 1.5 to 3.0) during transitions, repetitive spinning, or less interesting parts to create a dynamic "speed ramp" effect.
4. Apply color grading (cssFilter) that matches the vibe AND the specific action on screen (e.g., increase contrast during slow motion).

Return a JSON array of segments covering the entire video duration continuously from 0 to ${duration.toFixed(2)} seconds.
Each segment must have:
- startTime: start time in seconds (number)
- endTime: end time in seconds (number)
- playbackRate: speed multiplier (e.g., 0.5 for slow, 1.0 for normal, 2.0 for fast)
- cssFilter: a valid CSS filter string (e.g., 'contrast(1.2) saturate(1.5)', 'grayscale(100%)', 'sepia(50%)', or 'none')
- frameStyle: one of ['none', 'cinematic', 'polaroid', 'neon']`;

  const response = await ai.models.generateContent({
    model: 'gemini-3.1-pro-preview',
    contents: [
      {
        inlineData: {
          data: base64Video.split(',')[1],
          mimeType: mimeType,
        }
      },
      { text: prompt }
    ],
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            startTime: { type: Type.NUMBER },
            endTime: { type: Type.NUMBER },
            playbackRate: { type: Type.NUMBER },
            cssFilter: { type: Type.STRING },
            frameStyle: { type: Type.STRING }
          },
          required: ['startTime', 'endTime', 'playbackRate', 'cssFilter', 'frameStyle']
        }
      }
    }
  });

  let text = response.text;
  if (!text) throw new Error("No response from AI");
  
  // Strip markdown code blocks if present
  text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  
  try {
    return JSON.parse(text) as EditSegment[];
  } catch (e) {
    console.error("Failed to parse AI response", text);
    throw new Error("Invalid AI response format");
  }
}

function getVideoDuration(blob: Blob): Promise<number> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      window.URL.revokeObjectURL(video.src);
      let duration = video.duration;
      if (!duration || duration === Infinity) duration = 10; // Fallback for some webm blobs
      resolve(duration);
    };
    video.onerror = () => resolve(10);
    video.src = URL.createObjectURL(blob);
  });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
