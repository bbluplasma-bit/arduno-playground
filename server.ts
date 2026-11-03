import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';

app.use(express.json({ limit: '10mb' }));

// Request Logger
app.use((req, res, next) => {
  if (req.url.startsWith('/api')) {
    console.log(`[API] ${req.method} ${req.url}`);
  }
  next();
});

// Spotify Token Cache
let spotifyToken: string | null = null;
let spotifyTokenExpiry = 0;

async function getSpotifyToken() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret || clientId === 'your_spotify_client_id' || clientSecret === 'your_spotify_client_secret') {
    return null;
  }

  if (spotifyToken && Date.now() < spotifyTokenExpiry) {
    return spotifyToken;
  }

  try {
    const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authHeader}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) {
      throw new Error(`Spotify token error: ${response.statusText}`);
    }

    const data: any = await response.json();
    spotifyToken = data.access_token;
    spotifyTokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
    return spotifyToken;
  } catch (error) {
    console.error('Failed to get Spotify token:', error);
    return null;
  }
}

// Spotify Config Check endpoint
app.get('/api/spotify/config-check', (req: Request, res: Response) => {
  res.json({
    hasClientId: Boolean(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_ID !== 'your_spotify_client_id'),
    hasClientSecret: Boolean(process.env.SPOTIFY_CLIENT_SECRET && process.env.SPOTIFY_CLIENT_SECRET !== 'your_spotify_client_secret'),
  });
});

// Spotify Track Metadata endpoint
app.get('/api/spotify/track/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const token = await getSpotifyToken();
    if (!token) {
      return res.status(503).json({ error: 'Spotify API not configured on server (Missing Client ID/Secret)' });
    }

    const response = await fetch(`https://api.spotify.com/v1/tracks/${id}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Track not found' });
    }

    const data = await response.json();
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Helper to get GoogleGenAI client
function getGenAIClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Health check endpoint
app.get('/api/status', (req: Request, res: Response) => {
  res.json({
    status: 'online',
    app: 'Arduino Control Studio - Ultimate Edition',
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
    time: new Date().toISOString(),
  });
});

// AI Chat endpoint (Supports Gemini & local Ollama bridge)
app.post('/api/ai/chat', async (req: Request, res: Response) => {
  try {
    const { messages, useOllama, ollamaUrl = 'http://localhost:11434', ollamaModel = 'llama3', systemPrompt } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages array is required' });
    }

    if (useOllama) {
      try {
        const ollamaRes = await fetch(`${ollamaUrl}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: ollamaModel,
            messages: [
              ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
              ...messages.map((m: any) => ({ role: m.role, content: m.content })),
            ],
            stream: false,
          }),
        });

        if (!ollamaRes.ok) {
          throw new Error(`Ollama responded with HTTP ${ollamaRes.status}: ${await ollamaRes.text()}`);
        }

        const data: any = await ollamaRes.json();
        return res.json({ text: data.message?.content || '', source: 'ollama' });
      } catch (ollamaErr: any) {
        return res.status(502).json({
          error: `Could not connect to local Ollama server at ${ollamaUrl}. Ensure Ollama is running ('ollama serve') or switch to cloud AI. Error: ${ollamaErr.message}`,
        });
      }
    }

    // Default to Gemini 3.8 Flash
    const ai = getGenAIClient();
    if (!ai) {
      return res.status(503).json({
        error: 'GEMINI_API_KEY is not configured on the server. Please check the Secrets panel in AI Studio.',
      });
    }

    // Build chat or single message contents
    const promptText = messages.map((m: any) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n\n');

    const defaultSystem = `You are the specialized AI Assistant for Arduino Control Studio - Ultimate Edition.
You specialize in Arduino microcontrollers (Uno, Mega, Nano, Leonardo, ESP32), C++ embedded code, 3D mechanical robot design, servo motor kinematics, sensor wiring, and PWM electronics.
When asked to design a robot, provide clear specifications of body parts, servos, pin allocations (PWM pins 3, 5, 6, 9, 10, 11 for Uno), electrical connections, and movement instructions.
Keep your answers accurate, well-formatted with markdown and code snippets.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: promptText,
      config: {
        systemInstruction: systemPrompt || defaultSystem,
      },
    });

    return res.json({
      text: response.text || '',
      source: 'gemini-3.8-flash',
    });
  } catch (error: any) {
    console.error('Error in /api/ai/chat:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// AI 3D Robot & Kinematics generator endpoint
app.post('/api/ai/generate-robot', async (req: Request, res: Response) => {
  try {
    const { prompt, useOllama, ollamaUrl = 'http://localhost:11434', ollamaModel = 'llama3' } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'prompt is required' });
    }

    const systemInstruction = `You are an expert mechanical engineer and Arduino robotics designer.
The user wants to generate a complete 3D mechanical robot model with attached servo motors, assigned Arduino pins, parts hierarchy, and initial calibration.
You must respond with valid JSON matching this exact structure:
{
  "name": "Robot Name",
  "description": "Short description of the mechanism",
  "parts": [
    {
      "id": "part_1",
      "name": "Torso",
      "type": "box" | "cylinder" | "sphere",
      "dimensions": [width, height, depth],
      "position": [x, y, z],
      "rotation": [rx, ry, rz],
      "color": "#hexcolor",
      "metalness": 0.3,
      "roughness": 0.6,
      "parentId": null
    }
  ],
  "servos": [
    {
      "id": "servo_1",
      "name": "Left Hip Servo",
      "model": "SG90" | "MG995",
      "pin": 9,
      "position": [x, y, z],
      "rotationAxis": "x" | "y" | "z",
      "minAngle": 0,
      "maxAngle": 180,
      "defaultAngle": 90,
      "attachedPartId": "part_2",
      "parentPartId": "part_1"
    }
  ],
  "arduinoCode": "// Complete Arduino .ino sketch code here",
  "wiringGuide": [
    "Connect Servo 1 Signal to Pin 9, VCC to 5V, GND to GND",
    "Power external servos using a 5V/6V 2A battery pack with shared GND"
  ],
  "initialSequence": [
    { "name": "Neutral Pose", "angles": { "servo_1": 90 }, "durationMs": 500 },
    { "name": "Step Forward", "angles": { "servo_1": 130 }, "durationMs": 600 }
  ]
}
Return only JSON without markdown wrappers or other commentary.`;

    if (useOllama) {
      try {
        const ollamaRes = await fetch(`${ollamaUrl}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: ollamaModel,
            prompt: `System: ${systemInstruction}\nUser request: ${prompt}\nOutput JSON:`,
            format: 'json',
            stream: false,
          }),
        });
        const data: any = await ollamaRes.json();
        const parsed = JSON.parse(data.response);
        return res.json(parsed);
      } catch (ollamaErr: any) {
        return res.status(502).json({
          error: `Ollama error: ${ollamaErr.message}`,
        });
      }
    }

    const ai = getGenAIClient();
    if (!ai) {
      return res.status(503).json({ error: 'GEMINI_API_KEY is not configured on the server.' });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    return res.json(parsed);
  } catch (error: any) {
    console.error('Error in /api/ai/generate-robot:', error);
    return res.status(500).json({ error: error.message || 'Failed to generate robot model' });
  }
});

// Arduino Code syntax analyzer / verification endpoint
app.post('/api/arduino/verify', (req: Request, res: Response) => {
  const { code } = req.body;
  if (!code || typeof code !== 'string') {
    return res.status(400).json({ valid: false, errors: ['No code provided'] });
  }

  const errors: string[] = [];
  const warnings: string[] = [];

  // Basic C++ / Arduino structural heuristics
  if (!code.includes('void setup()') && !code.includes('void setup ()')) {
    errors.push('Missing mandatory function: void setup()');
  }
  if (!code.includes('void loop()') && !code.includes('void loop ()')) {
    errors.push('Missing mandatory function: void loop()');
  }

  // Count braces
  const openBraces = (code.match(/\{/g) || []).length;
  const closeBraces = (code.match(/\}/g) || []).length;
  if (openBraces !== closeBraces) {
    errors.push(`Mismatched curly braces: ${openBraces} opening '{' vs ${closeBraces} closing '}'`);
  }

  // Check pin usage
  if (code.includes('analogRead') && !code.match(/A[0-9]/)) {
    warnings.push('analogRead() typically uses analog pins (A0, A1, etc.)');
  }

  // Memory estimation heuristic
  const lines = code.split('\n').length;
  const estimatedFlash = Math.min(32256, Math.floor(1800 + lines * 28));
  const estimatedSRAM = Math.min(2048, Math.floor(180 + lines * 3));

  return res.json({
    valid: errors.length === 0,
    errors,
    warnings,
    estimatedFlashBytes: estimatedFlash,
    flashPercent: Math.round((estimatedFlash / 32256) * 100),
    estimatedSRAMBytes: estimatedSRAM,
    sramPercent: Math.round((estimatedSRAM / 2048) * 100),
  });
});

// Global error handler for API routes
app.use((err: any, req: Request, res: Response, next: any) => {
  console.error('[Unhandled Error]', err);
  if (req.url.startsWith('/api')) {
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
  next(err);
});

// 404 handler for API routes
app.all('/api/*', (req: Request, res: Response) => {
  res.status(404).json({ error: `API route not found: ${req.method} ${req.url}` });
});

async function startServer() {
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`[Arduino Control Studio] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});

// Process-level error handling to prevent crashes
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});
