import React, { useState } from 'react';
import { RobotProject } from '../types';
import {
  Sparkles,
  Send,
  Cpu,
  Bot,
  User,
  Settings,
  Layers,
  ArrowRight,
  Code,
  Zap,
  HelpCircle,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

interface AIAssistantProps {
  onLoadGeneratedRobot: (generatedData: any) => void;
  onNavigateToBuilder: () => void;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  generatedRobot?: any;
}

export const AIAssistant: React.FC<AIAssistantProps> = ({
  onLoadGeneratedRobot,
  onNavigateToBuilder,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'init_msg',
      role: 'assistant',
      content: `Hello! I am your Arduino & Robotics AI Engineer.
I can:
- **Build 3D robot models** from descriptions (e.g. *"Build me a robot with two legs and two arms. Put a servo in each leg and arm."*)
- **Assign Arduino pins** and generate wiring schematics
- **Write custom Arduino C++ sketches**
- **Generate keyframe walking or grabbing movement sequences**
- **Troubleshoot servo jitter, electrical brownouts, and baud rate errors**

How can I help you build today?`,
    },
  ]);

  const [inputPrompt, setInputPrompt] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [useOllama, setUseOllama] = useState<boolean>(false);
  const [ollamaUrl, setOllamaUrl] = useState<string>('http://localhost:11434');
  const [ollamaModel, setOllamaModel] = useState<string>('llama3');
  const [loadedRobotId, setLoadedRobotId] = useState<string | null>(null);

  const quickPrompts = [
    'Build me a robot with two legs and two arms. Put a servo in each leg and arm.',
    'Design a pan-tilt sensor turret with two SG90 servos on pins 9 and 10.',
    'Create an autonomous 4-DOF robotic arm with pick-and-place code.',
    'Explain how to wire 4 servos to Arduino Uno without brownouts.',
  ];

  const handleSendMessage = async (textToSend?: string) => {
    const prompt = (textToSend || inputPrompt).trim();
    if (!prompt || isLoading) return;

    const userMsg: ChatMessage = {
      id: Math.random().toString(36).substring(2, 9),
      role: 'user',
      content: prompt,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputPrompt('');
    setIsLoading(true);

    // Check if the prompt is requesting a robot build
    const isRobotRequest =
      prompt.toLowerCase().includes('build') ||
      prompt.toLowerCase().includes('robot') ||
      prompt.toLowerCase().includes('design') ||
      prompt.toLowerCase().includes('model');

    try {
      if (isRobotRequest) {
        // Call structured robot generator
        const res = await fetch('/api/ai/generate-robot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt,
            useOllama,
            ollamaUrl,
            ollamaModel,
          }),
        });

        const contentType = res.headers.get('content-type');
        if (!res.ok) {
          if (contentType && contentType.includes('application/json')) {
            const errData = await res.json();
            throw new Error(errData.error || `HTTP ${res.status}`);
          } else {
            throw new Error(`Server returned non-JSON error (${res.status})`);
          }
        }

        if (!contentType || !contentType.includes('application/json')) {
          throw new Error('Server did not return JSON. Please try again.');
        }

        const robotData = await res.json();
        const assistantMsg: ChatMessage = {
          id: Math.random().toString(36).substring(2, 9),
          role: 'assistant',
          content: `I've created **${robotData.name || 'Custom Robot'}**!
- **3D Parts Generated:** ${robotData.parts?.length || 0} components
- **Servos Configured:** ${robotData.servos?.length || 0} motors
- **Assigned Pins:** ${robotData.servos?.map((s: any) => `Pin ${s.pin} (${s.name})`).join(', ') || 'None'}

### Wiring Guidance:
${robotData.wiringGuide?.map((w: string) => `- ${w}`).join('\n') || 'Standard 5V/GND with external power'}

Click the button below to load this entire mechanical model, servo joints, and code into the 3D Studio!`,
          generatedRobot: robotData,
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } else {
        // Standard conversational reasoning
        const res = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [...messages, userMsg].map((m) => ({ role: m.role, content: m.content })),
            useOllama,
            ollamaUrl,
            ollamaModel,
          }),
        });

        const contentType = res.headers.get('content-type');
        if (!res.ok) {
          if (contentType && contentType.includes('application/json')) {
            const errData = await res.json();
            throw new Error(errData.error || `HTTP ${res.status}`);
          } else {
            throw new Error(`Server returned non-JSON error (${res.status})`);
          }
        }

        if (!contentType || !contentType.includes('application/json')) {
          throw new Error('Server did not return JSON. Please try again.');
        }

        const data = await res.json();
        const assistantMsg: ChatMessage = {
          id: Math.random().toString(36).substring(2, 9),
          role: 'assistant',
          content: data.text || 'No response generated.',
        };
        setMessages((prev) => [...prev, assistantMsg]);
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: Math.random().toString(36).substring(2, 9),
          role: 'assistant',
          content: `⚠️ **Generation Error**: ${err.message}`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyRobot = (robotData: any) => {
    onLoadGeneratedRobot(robotData);
    setLoadedRobotId(robotData.name);
    setTimeout(() => {
      onNavigateToBuilder();
    }, 600);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="max-w-5xl mx-auto flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[var(--border-color)]">
          <div>
            <h1 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-cyan-400" />
              Arduino & Robotics AI Studio Assistant
            </h1>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              Natural language mechanical generator, pin allocation engine, kinematics designer, and code synthesizer
            </p>
          </div>

          {/* Engine Selector: Cloud vs Ollama */}
          <div className="flex items-center gap-2 bg-[var(--bg-secondary)] p-1.5 rounded-lg border border-[var(--border-color)] text-xs">
            <button
              onClick={() => setUseOllama(false)}
              className={`px-3 py-1 rounded-md transition-colors ${
                !useOllama
                  ? 'bg-cyan-500/20 text-cyan-300 font-semibold'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Cloud Gemini 3.8
            </button>
            <button
              onClick={() => setUseOllama(true)}
              className={`px-3 py-1 rounded-md transition-colors ${
                useOllama
                  ? 'bg-purple-500/20 text-purple-300 font-semibold'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Local Ollama
            </button>
          </div>
        </div>

        {/* Ollama Config Bar (if selected) */}
        {useOllama && (
          <div className="bg-[var(--bg-secondary)] border border-purple-500/40 rounded-xl p-3 flex flex-wrap items-center gap-3 text-xs">
            <span className="text-purple-300 font-semibold">Ollama Settings:</span>
            <input
              type="text"
              value={ollamaUrl}
              onChange={(e) => setOllamaUrl(e.target.value)}
              placeholder="http://localhost:11434"
              className="bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded px-2.5 py-1 text-[var(--text-primary)] text-xs w-48 font-mono"
            />
            <input
              type="text"
              value={ollamaModel}
              onChange={(e) => setOllamaModel(e.target.value)}
              placeholder="llama3"
              className="bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded px-2.5 py-1 text-[var(--text-primary)] text-xs w-28 font-mono"
            />
            <span className="text-[11px] text-slate-500">
              Ensure Ollama is running locally with CORS enabled.
            </span>
          </div>
        )}

        {/* Quick Suggestion Pills */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-400 font-mono">QUICK IDEAS:</span>
          {quickPrompts.map((qp, i) => (
            <button
              key={i}
              onClick={() => handleSendMessage(qp)}
              className="px-2.5 py-1 bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] rounded-md border border-[var(--border-color)] text-xs transition-colors text-left"
            >
              {qp}
            </button>
          ))}
        </div>

        {/* Chat History Container */}
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl flex flex-col min-h-[460px] max-h-[580px] overflow-hidden">
          <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-4">
            {messages.map((m) => {
              const isUser = m.role === 'user';
              return (
                <div
                  key={m.id}
                  className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}
                >
                  <div
                    className={`p-2 rounded-lg shrink-0 ${
                      isUser
                        ? 'bg-cyan-600 text-slate-950'
                        : 'bg-purple-950 text-purple-300 border border-purple-800'
                    }`}
                  >
                    {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </div>

                  <div
                    className={`max-w-2xl p-4 rounded-xl text-xs leading-relaxed ${
                      isUser
                        ? 'bg-cyan-950/40 border border-cyan-800 text-cyan-100'
                        : 'bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-primary)]'
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{m.content}</div>

                    {/* If this message contains a generated 3D robot model */}
                    {m.generatedRobot && (
                      <div className="mt-4 pt-3 border-t border-[var(--border-color)] flex items-center justify-between">
                        <div className="text-[11px] text-emerald-400 flex items-center gap-1 font-mono">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Ready for 3D Viewport & Arduino Synchronization
                        </div>
                        <button
                          onClick={() => handleApplyRobot(m.generatedRobot)}
                          className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold uppercase rounded-lg text-xs flex items-center gap-1.5 shadow-md shadow-cyan-950/50"
                        >
                          <Layers className="w-3.5 h-3.5" />
                          Load into 3D Robot Builder
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {isLoading && (
              <div className="flex items-center gap-3 text-xs text-cyan-400 italic font-mono p-2">
                <Sparkles className="w-4 h-4 animate-spin" />
                Synthesizing mechanical geometry, pin allocations, and kinematics...
              </div>
            )}
          </div>

          {/* Chat Input Bar */}
          <div className="p-3 bg-[var(--bg-primary)] border-t border-[var(--border-color)] flex items-center gap-2">
            <input
              type="text"
              placeholder='e.g. "Build me a robot with two legs and two arms. Put a servo in each leg and arm."'
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSendMessage();
              }}
              className="flex-1 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-4 py-2.5 text-xs text-[var(--text-primary)] placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
            />
            <button
              onClick={() => handleSendMessage()}
              disabled={isLoading || !inputPrompt.trim()}
              className="px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-slate-950 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-cyan-950/50"
            >
              <Send className="w-4 h-4" /> Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
