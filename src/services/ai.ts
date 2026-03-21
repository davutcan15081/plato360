import { GoogleGenAI, Type } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface EditSegment {
  startTime: number;
  endTime: number;
  playbackRate: number;
  cssFilter: string;
  frameStyle: string;
}

export interface AutoMagicResult {
  vibe: string;
  editScript: EditSegment[];
  texts: { text: string; startTime: number; endTime: number; fontFamily: string; yOffset: number }[];
}

export async function generateAutoMagicEdit(videoBlob: Blob): Promise<AutoMagicResult> {
  const base64Video = await blobToBase64(videoBlob);
  const mimeType = videoBlob.type || 'video/webm';
  const duration = await getVideoDuration(videoBlob);

  const prompt = `You are an expert video editor, director, and marketing copywriter. I am providing you with a video that is approximately ${duration.toFixed(2)} seconds long.
Analyze the video deeply frame by frame.
1. Identify the product, subject, or main action in the video.
2. Choose the BEST matching vibe for this video from this list: ['Energetic', 'Cinematic', 'Minimalist', 'Cyberpunk'].
3. Create a dynamic edit script (speed ramps, filters) that matches the chosen vibe and highlights the best moments.
4. Generate 2 to 4 short, punchy, promotional text overlays (in Turkish) that describe the product or action. Place them at the most impactful moments.

Return a JSON object with:
- vibe: The chosen vibe string.
- editScript: Array of segments covering 0 to ${duration.toFixed(2)} seconds continuously.
  - startTime, endTime, playbackRate, cssFilter, frameStyle (from ['none', 'cinematic', 'polaroid', 'neon']).
- texts: Array of text overlays.
  - text: Short promotional text in Turkish (max 4-5 words).
  - startTime: When it appears.
  - endTime: When it disappears.
  - fontFamily: Choose from ['inter', 'anton', 'caveat', 'playfair', 'space', 'bebas', 'pacifico', 'cinzel', 'marker', 'righteous', 'oswald'].
  - yOffset: Vertical position offset from center (e.g., -200 for top, 0 for center, 200 for bottom).`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
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
        type: Type.OBJECT,
        properties: {
          vibe: { type: Type.STRING },
          editScript: {
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
          },
          texts: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                text: { type: Type.STRING },
                startTime: { type: Type.NUMBER },
                endTime: { type: Type.NUMBER },
                fontFamily: { type: Type.STRING },
                yOffset: { type: Type.NUMBER }
              },
              required: ['text', 'startTime', 'endTime', 'fontFamily', 'yOffset']
            }
          }
        },
        required: ['vibe', 'editScript', 'texts']
      }
    }
  });

  let text = response.text;
  if (!text) throw new Error("No response from AI");
  
  text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  
  try {
    return JSON.parse(text) as AutoMagicResult;
  } catch (e) {
    console.error("Failed to parse AI response", text);
    throw new Error("Invalid AI response format");
  }
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
    model: 'gemini-2.5-flash',
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
    
    const handleDuration = () => {
      let duration = video.duration;
      if (duration && duration !== Infinity && !isNaN(duration)) {
        window.URL.revokeObjectURL(video.src);
        resolve(duration);
      }
    };

    video.onloadedmetadata = () => {
      handleDuration();
      // If duration is still not available, it might be a webm blob from MediaRecorder
      // We can't easily get the duration without playing it or using a library,
      // so we fallback to 10 seconds if it doesn't resolve quickly.
      setTimeout(() => {
        if (video.src) {
          window.URL.revokeObjectURL(video.src);
          resolve(10);
        }
      }, 500);
    };
    
    video.ondurationchange = handleDuration;
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
