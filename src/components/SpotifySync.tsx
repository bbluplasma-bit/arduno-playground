import React, { useState, useEffect, useRef } from 'react';
import { ServoMotor } from '../types';
import { arduinoSerial } from '../services/arduinoSerial';
import {
  Music,
  Play,
  Square,
  Radio,
  Sliders,
  CheckCircle2,
  Sparkles,
  ExternalLink,
  Volume2,
  Zap,
  Activity,
  Disc,
} from 'lucide-react';

interface SpotifySyncProps {
  servos: ServoMotor[];
  onUpdateServo: (servo: ServoMotor) => void;
  activeProjectName: string;
}

interface ServoDanceBinding {
  servoId: string;
  channel: 'bass' | 'snare' | 'hihat' | 'melody' | 'idle';
  amplitude: number; // multiplier for angle range
  baseAngle: number;
}

export const SpotifySync: React.FC<SpotifySyncProps> = ({ servos, onUpdateServo, activeProjectName }) => {
  const [spotifyUrl, setSpotifyUrl] = useState<string>('https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT');
  const [trackName, setTrackName] = useState<string>('Cybernetic Symphony (ft. Synth Bot)');
  const [artistName, setArtistName] = useState<string>('Arduino Groove Crew');
  const [bpm, setBpm] = useState<number>(128);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [authToken, setAuthToken] = useState<string>('');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [danceIntensity, setDanceIntensity] = useState<number>(1.0);
  const [activeChannelPulse, setActiveChannelPulse] = useState<{ bass: boolean; snare: boolean; melody: boolean }>({
    bass: false,
    snare: false,
    melody: false,
  });
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [error, setError] = useState<string>('');

  // Servo Bindings state
  const [bindings, setBindings] = useState<Record<string, ServoDanceBinding>>(() => {
    const initial: Record<string, ServoDanceBinding> = {};
    servos.forEach((s, idx) => {
      const channels: ('bass' | 'snare' | 'hihat' | 'melody')[] = ['bass', 'snare', 'hihat', 'melody'];
      initial[s.id] = {
        servoId: s.id,
        channel: channels[idx % channels.length],
        amplitude: 45,
        baseAngle: s.currentAngle ?? 90,
      };
    });
    return initial;
  });

  // Animation loop ref for dancing
  const animFrameRef = useRef<number>(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | MediaElementAudioSourceNode | null>(null);

  // Sync bindings when servos list changes
  useEffect(() => {
    setBindings((prev) => {
      const next = { ...prev };
      servos.forEach((s, idx) => {
        if (!next[s.id]) {
          const channels: ('bass' | 'snare' | 'hihat' | 'melody')[] = ['bass', 'snare', 'hihat', 'melody'];
          next[s.id] = {
            servoId: s.id,
            channel: channels[idx % channels.length],
            amplitude: 45,
            baseAngle: s.currentAngle ?? 90,
          };
        }
      });
      return next;
    });
  }, [servos]);

  // Setup Web Audio Analyser
  const setupAudioAnalysis = () => {
    if (!audioRef.current || analyserRef.current) return;

    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    const ctx = audioCtxRef.current;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyserRef.current = analyser;

    const bufferLength = analyser.frequencyBinCount;
    dataArrayRef.current = new Uint8Array(bufferLength);

    const source = ctx.createMediaElementSource(audioRef.current);
    source.connect(analyser);
    analyser.connect(ctx.destination);
    sourceRef.current = source;
  };

  // Start / Stop Dance Beat Engine
  useEffect(() => {
    if (!isPlaying) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (audioRef.current) audioRef.current.pause();
      return;
    }

    if (audioRef.current) {
      audioRef.current.play().catch(e => console.error("Playback error:", e));
      setupAudioAnalysis();
    }

    const danceLoop = () => {
      animFrameRef.current = requestAnimationFrame(danceLoop);
      
      if (!analyserRef.current || !dataArrayRef.current) return;
      
      analyserRef.current.getByteFrequencyData(dataArrayRef.current as any);
      const data = dataArrayRef.current;

      // Extract frequency ranges
      // Bass: 0-4 (low frequencies)
      // Mid/Snare: 5-15
      // High/Melody: 16+
      const bassAvg = Array.from(data.slice(0, 4)).reduce((a, b) => a + b, 0) / 4;
      const midAvg = Array.from(data.slice(5, 15)).reduce((a, b) => a + b, 0) / 10;
      const highAvg = Array.from(data.slice(16, 40)).reduce((a, b) => a + b, 0) / 24;

      const isBassPulse = bassAvg > 180;
      const isSnarePulse = midAvg > 140;
      const isMelodyPulse = highAvg > 80;

      setActiveChannelPulse({
        bass: isBassPulse,
        snare: isSnarePulse,
        melody: isMelodyPulse,
      });

      const now = performance.now();
      const phase = (now * 0.001 * (bpm / 60) * Math.PI * 2) % (Math.PI * 2);

      servos.forEach((servo) => {
        const binding = bindings[servo.id];
        if (!binding) return;

        let intensityMult = 0;
        if (binding.channel === 'bass') intensityMult = (bassAvg / 255);
        else if (binding.channel === 'snare') intensityMult = (midAvg / 255);
        else if (binding.channel === 'melody') intensityMult = (highAvg / 255);
        else if (binding.channel === 'hihat') intensityMult = (highAvg / 255) * 0.5;

        let offset = 0;
        if (binding.channel !== 'idle') {
          // Combination of base rhythm (phase) and real-time intensity
          const rhythm = Math.sin(phase + (servo.pin * 0.5));
          offset = binding.amplitude * danceIntensity * rhythm * (0.3 + intensityMult * 0.7);
        }

        const minAngle = servo.minAngle ?? 0;
        const maxAngle = servo.maxAngle ?? 180;
        const target = Math.round(Math.max(minAngle, Math.min(maxAngle, binding.baseAngle + offset)));

        onUpdateServo({
          ...servo,
          targetAngle: target,
          currentAngle: target,
        });

        if (arduinoSerial.status === 'connected') {
          arduinoSerial.setServoAngle(servo.pin, target);
        }
      });
    };

    animFrameRef.current = requestAnimationFrame(danceLoop);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, bpm, danceIntensity, bindings, servos, onUpdateServo]);

  const [configStatus, setConfigStatus] = useState<{ hasClientId: boolean; hasClientSecret: boolean } | null>(null);

  useEffect(() => {
    const checkConfig = async () => {
      try {
        const res = await fetch('/api/spotify/config-check');
        if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
          const data = await res.json();
          setConfigStatus(data);
        }
      } catch (e) {
        console.error('Config check failed', e);
      }
    };
    checkConfig();
  }, []);

  const handleConnectSpotify = () => {
    // We'll use the Client Credentials flow on the server, so no user login is strictly required for "singing" tracks
    setAuthToken('server_side_token');
    setIsAuthModalOpen(false);
  };

  const handleParseSpotifyUrl = async (url: string) => {
    setSpotifyUrl(url);
    setError('');
    
    let trackId = '';
    if (url.includes('track/')) {
      trackId = url.split('track/')[1]?.split('?')[0];
    } else if (url.length === 22) { // Direct ID
      trackId = url;
    }

    if (trackId) {
      try {
        const response = await fetch(`/api/spotify/track/${trackId}`);
        const contentType = response.headers.get('content-type');
        
        if (!response.ok) {
          if (contentType && contentType.includes('application/json')) {
            const errData = await response.json();
            throw new Error(errData.error || `Error ${response.status}`);
          } else {
            throw new Error(`Server returned non-JSON error (${response.status})`);
          }
        }

        if (!contentType || !contentType.includes('application/json')) {
          throw new Error(`Server returned ${response.status} (${contentType || 'no content-type'}). Please check your Spotify API credentials in the Secrets panel.`);
        }

        const data = await response.json();
        setTrackName(data.name);
        setArtistName(data.artists.map((a: any) => a.name).join(', '));
        setPreviewUrl(data.preview_url);
        
        if (!data.preview_url) {
          setError('This track does not have a preview available for singing, but beat sync is still active!');
        }
      } catch (err: any) {
        console.error('Spotify Sync Fetch Error:', err);
        setError(err.message || 'Failed to sync with Spotify');
      }
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="max-w-6xl mx-auto flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[var(--border-color)]">
          <div>
            <h1 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
              <Music className="w-5 h-5 text-emerald-400" />
              Spotify Music Synchronization & Robot Dance Studio
            </h1>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              Paste any Spotify track URL, authenticate via OAuth, and map robot servo pins to real-time rhythm & beats
            </p>
          </div>

          <div className="flex items-center gap-3">
            {authToken ? (
              <span className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-950/80 border border-emerald-800 text-emerald-400 rounded-lg text-xs font-mono font-semibold">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Spotify Connected
              </span>
            ) : (
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-2 shadow-lg shadow-emerald-950"
              >
                <Disc className="w-4 h-4 animate-spin" /> Connect Spotify Account
              </button>
            )}
          </div>
        </div>

        {/* Player & URL Bar */}
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl p-5 shadow-xl flex flex-col gap-4">
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
            <div className="flex-1 relative flex flex-col gap-2">
              <div className="relative flex items-center">
                <Music className="w-4 h-4 absolute left-3 text-emerald-400 pointer-events-none" />
                <input
                  type="text"
                  value={spotifyUrl}
                  onChange={(e) => handleParseSpotifyUrl(e.target.value)}
                  placeholder="Paste Spotify Track URL (e.g. https://open.spotify.com/track/...)"
                  className="w-full bg-[#181f33] border border-[#27324c] focus:border-emerald-500 rounded-lg pl-9 pr-4 py-2.5 text-xs text-white placeholder-slate-500 outline-none font-mono"
                />
              </div>
              {error && <div className="text-[10px] text-rose-400 font-mono px-2">{error}</div>}
              {configStatus && (!configStatus.hasClientId || !configStatus.hasClientSecret) && (
                <div className="text-[10px] text-amber-400 font-mono px-2 bg-amber-950/20 py-1 rounded border border-amber-900/50">
                  ⚠️ Spotify API keys not set in Secrets. &quot;Singing&quot; feature disabled. 
                  <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noopener noreferrer" className="ml-1 underline hover:text-amber-300">Get keys here</a>
                </div>
              )}
              {previewUrl && <audio ref={audioRef} src={previewUrl} loop crossOrigin="anonymous" className="hidden" />}
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-[#181f33] px-3 py-2 rounded-lg border border-[#27324c]">
                <span className="text-xs text-slate-400 font-mono">BPM:</span>
                <input
                  type="number"
                  value={bpm}
                  onChange={(e) => setBpm(parseInt(e.target.value) || 120)}
                  className="w-14 bg-[var(--bg-primary)] text-emerald-400 font-mono text-xs px-2 py-1 rounded border border-[var(--border-color)] text-center outline-none"
                />
              </div>

              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className={`px-6 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-lg transition-all ${
                  isPlaying
                    ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950'
                    : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-950'
                }`}
              >
                {isPlaying ? <Square className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                {isPlaying ? 'Stop Dance' : 'Start Music Dance'}
              </button>
            </div>
          </div>

          {/* Now Playing Banner */}
          <div className="flex flex-col sm:flex-row items-center justify-between bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg p-3.5 gap-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center ${isPlaying ? 'animate-pulse' : ''}`}>
                <Volume2 className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <div className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <span>{trackName}</span>
                  {isPlaying && (
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 animate-pulse">
                      LIVE BEAT SYNC
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">{artistName} • Active Project: {activeProjectName}</div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-slate-400">INTENSITY:</span>
                <input
                  type="range"
                  min="0.2"
                  max="2.0"
                  step="0.1"
                  value={danceIntensity}
                  onChange={(e) => setDanceIntensity(parseFloat(e.target.value))}
                  className="w-24 accent-emerald-500 cursor-pointer"
                />
                <span className="text-xs font-mono text-emerald-400 w-8">{Math.round(danceIntensity * 100)}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Visual Beat Pulses */}
        <div className="grid grid-cols-3 gap-4">
          <div className={`p-4 rounded-xl border flex items-center justify-between transition-all ${activeChannelPulse.bass ? 'bg-emerald-950/80 border-emerald-500 shadow-lg shadow-emerald-950/50' : 'bg-[var(--bg-secondary)] border-[var(--border-color)]'}`}>
            <div>
              <div className="text-[10px] font-mono text-slate-400 uppercase">Bass / Kick Drum</div>
              <div className="text-sm font-bold text-white mt-0.5">Channel 1</div>
            </div>
            <div className={`w-3.5 h-3.5 rounded-full ${activeChannelPulse.bass ? 'bg-emerald-400 shadow-md shadow-emerald-400 animate-ping' : 'bg-slate-700'}`} />
          </div>

          <div className={`p-4 rounded-xl border flex items-center justify-between transition-all ${activeChannelPulse.snare ? 'bg-cyan-950/80 border-cyan-500 shadow-lg shadow-cyan-950/50' : 'bg-[var(--bg-secondary)] border-[var(--border-color)]'}`}>
            <div>
              <div className="text-[10px] font-mono text-slate-400 uppercase">Snare / Clap</div>
              <div className="text-sm font-bold text-white mt-0.5">Channel 2</div>
            </div>
            <div className={`w-3.5 h-3.5 rounded-full ${activeChannelPulse.snare ? 'bg-cyan-400 shadow-md shadow-cyan-400 animate-ping' : 'bg-slate-700'}`} />
          </div>

          <div className={`p-4 rounded-xl border flex items-center justify-between transition-all ${activeChannelPulse.melody ? 'bg-purple-950/80 border-purple-500 shadow-lg shadow-purple-950/50' : 'bg-[var(--bg-secondary)] border-[var(--border-color)]'}`}>
            <div>
              <div className="text-[10px] font-mono text-slate-400 uppercase">Melody / Hi-Hat</div>
              <div className="text-sm font-bold text-white mt-0.5">Channel 3</div>
            </div>
            <div className={`w-3.5 h-3.5 rounded-full ${activeChannelPulse.melody ? 'bg-purple-400 shadow-md shadow-purple-400 animate-ping' : 'bg-slate-700'}`} />
          </div>
        </div>

        {/* Servo Dance Mapping Table */}
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl p-5 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
              <Sliders className="w-4 h-4 text-emerald-400" />
              Connected Servo Motor Dance Mapping ({servos.length} Servos)
            </h2>
            <span className="text-[11px] font-mono text-slate-400">
              Assign audio rhythm channels and motion range to each servo pin
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[var(--border-color)] text-[10px] font-mono text-[var(--text-secondary)] uppercase">
                  <th className="py-2.5 px-3">Servo Name</th>
                  <th className="py-2.5 px-3">Arduino Pin</th>
                  <th className="py-2.5 px-3">Rhythm Channel</th>
                  <th className="py-2.5 px-3">Base Angle (°)</th>
                  <th className="py-2.5 px-3">Dance Amplitude (°)</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)]/60 text-xs">
                {servos.map((servo) => {
                  const binding = bindings[servo.id] || {
                    servoId: servo.id,
                    channel: 'bass',
                    amplitude: 45,
                    baseAngle: servo.currentAngle ?? 90,
                  };

                  return (
                    <tr key={servo.id} className="hover:bg-[#181f33]/50 transition-colors">
                      <td className="py-3 px-3 font-semibold text-[var(--text-primary)]">{servo.name}</td>
                      <td className="py-3 px-3 font-mono text-cyan-400">Pin {servo.pin}</td>
                      <td className="py-3 px-3">
                        <select
                          value={binding.channel}
                          onChange={(e) =>
                            setBindings({
                              ...bindings,
                              [servo.id]: { ...binding, channel: e.target.value as any },
                            })
                          }
                          className="bg-[var(--bg-primary)] text-[var(--text-primary)] font-mono text-xs px-2.5 py-1.5 rounded border border-[var(--border-color)] outline-none focus:border-emerald-500"
                        >
                          <option value="bass">Bass / Kick Drum</option>
                          <option value="snare">Snare / Clap</option>
                          <option value="hihat">Hi-Hat / Rhythm</option>
                          <option value="melody">Melody Lead</option>
                          <option value="idle">Idle / Static</option>
                        </select>
                      </td>
                      <td className="py-3 px-3">
                        <input
                          type="number"
                          value={binding.baseAngle}
                          onChange={(e) =>
                            setBindings({
                              ...bindings,
                              [servo.id]: { ...binding, baseAngle: parseInt(e.target.value) || 90 },
                            })
                          }
                          className="w-20 bg-[var(--bg-primary)] text-[var(--text-primary)] font-mono text-xs px-2 py-1 rounded border border-[var(--border-color)] outline-none"
                        />
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min="5"
                            max="90"
                            value={binding.amplitude}
                            onChange={(e) =>
                              setBindings({
                                ...bindings,
                                [servo.id]: { ...binding, amplitude: parseInt(e.target.value) || 45 },
                              })
                            }
                            className="w-28 accent-emerald-500 cursor-pointer"
                          />
                          <span className="font-mono text-emerald-400 w-8">±{binding.amplitude}°</span>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 font-mono text-[10px] border border-emerald-800">
                          Ready
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* OAuth Connection Modal */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111625] border border-[#27324c] rounded-2xl max-w-md w-full p-6 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center">
                <Disc className="w-5 h-5 text-emerald-400 animate-spin" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Connect Spotify Account</h3>
                <p className="text-xs text-slate-400">Authorize Arduino Control Studio to read track playback & audio features</p>
              </div>
            </div>

            <div className="p-4 bg-[#0c0f17] rounded-xl border border-[#27324c] text-xs text-slate-300 leading-relaxed">
              <p>This allows Arduino Control Studio to synchronize servo motor angles in real-time with Spotify playback tempo and beat analysis.</p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setIsAuthModalOpen(false)}
                className="px-4 py-2 bg-[#181f33] hover:bg-[#202945] text-slate-300 rounded-lg text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleConnectSpotify}
                className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-lg text-xs font-bold shadow-md"
              >
                Authorize Spotify
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
