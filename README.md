<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# SpinEdit AI - 360° Product Video Editor

SpinEdit AI is a mobile-first application that allows you to shoot 360° product videos and let AI handle the editing process with various cinematic effects and styles.

## Features

- **360° Video Recording** - Capture product videos from multiple angles
- **AI-Powered Editing** - Automatic video editing with multiple vibe styles
- **Dual AI Support** - Choose between Google Gemini or AnythingLLM
- **Mobile Optimized** - Works seamlessly on mobile devices
- **Custom Audio** - Add your own background music
- **Multiple Styles** - Energetic, Cinematic, Minimalist, Cyberpunk, and Auto Magic

## AI Providers

### Google Gemini (Default)
- Fast and reliable cloud-based AI
- Requires API key from Google AI Studio
- Automatic fallback when AnythingLLM is unavailable

### AnythingLLM (Local/Private)
- Run AI locally on your own machine
- Private and secure processing
- Requires local AnythingLLM server setup

### Test Mode (Demo/Development)
- No API key required
- Works offline
- Instant results with random effects
- Perfect for testing and demonstrations

## Quick Start

### Prerequisites
- Node.js 18+
- For Gemini: Google AI Studio API key
- For AnythingLLM: Local AnythingLLM installation (optional)

### Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Run the development server:**
   ```bash
   npm run dev
   ```

3. **Open the app:**
   - Desktop: http://localhost:3000
   - Mobile: Use the network URL shown in terminal

## AI Setup

### Option 1: Google Gemini (Recommended for beginners)
1. Visit [Google AI Studio](https://aistudio.google.com/)
2. Create an API key
3. Open the app settings (gear icon )
4. Select "Google Gemini" as AI provider
5. Enter your API key
6. Save settings

### Option 2: AnythingLLM (Advanced/Local)
1. **Install AnythingLLM:**
   ```bash
   # Download from https://github.com/MintplexLabs/anything-llm
   # Follow installation instructions for your platform
   ```

2. **Setup Workspace:**
   - Start AnythingLLM server (usually runs on localhost:3001)
   - Create a workspace named "plato360"
   - Generate an API key in settings
   - **Important:** The API uses `/v1/` prefix (not `/api/`)

### Option 3: Test Mode (Easiest - No Setup Required)
1. Open the app settings (gear icon ⚙️)
2. Select "Test Modu" as AI provider
3. No configuration needed - start using immediately!

## Usage

1. **Choose a Vibe:** Select from Auto Magic, Energetic, Cinematic, Minimalist, or Cyberpunk
2. **Record Video:** Use the camera to record a 360° product video (max 10 seconds)
3. **Add Music (Optional):** Upload custom background music
4. **Process:** AI analyzes and edits your video automatically
5. **Preview:** Watch the edited video with effects and text overlays
6. **Export:** Save or share your final video

## Mobile App Build

### Android
```bash
npm run build
npx cap sync android
npx cap open android
```

### iOS
```bash
npm run build
npx cap sync ios
npx cap open ios
```

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Lint code
npm run lint
```

## Troubleshooting

### "AnythingLLM sunucusuna bağlanılamadı"
- Make sure AnythingLLM server is running on localhost:3001
- Check that workspace "plato360" exists
- Verify API key is correct
- **Important:** Ensure the API URL uses `/v1/workspace/` not `/api/workspace/`

### "Gemini API anahtarı yapılandırılmamış"
- Get API key from Google AI Studio
- Enter it in app settings
- Make sure key has proper permissions

### Video recording issues
- Grant camera permissions
- Ensure sufficient storage space
- Try shorter recordings first

## Project Structure

```
src/
├── components/
│   ├── CameraRecorder.tsx    # Video recording component
│   ├── VideoPreview.tsx      # Video preview and editing
│   └── Settings.tsx          # App settings
├── services/
│   ├── ai.ts                 # AI service (Gemini + AnythingLLM)
│   └── settings.ts           # Settings storage
└── App.tsx                   # Main application
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test on both mobile and desktop
5. Submit a pull request

## License

This project is licensed under the MIT License.
