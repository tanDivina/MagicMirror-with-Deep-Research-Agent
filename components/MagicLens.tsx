import React, { useRef, useState, useEffect } from 'react';
import { Camera, RefreshCw, Sparkles, Image as ImageIcon, Mic, X, Download, Palette, Scan, Smile, MapPin, Box, RotateCcw, Play, Settings, Zap } from 'lucide-react';
import StickerButton from './StickerButton';
import DesignStudio from './DesignStudio';
import { generateMarketingImage } from '../services/geminiService';
import { AppState, GenerationConfig, UserProfile } from '../types';
import { GoogleGenAI, LiveServerMessage, Modality, FunctionDeclaration, Type } from "@google/genai";

interface MagicLensProps {
  currentUser: UserProfile | null;
}

const DEMO_IMAGE_URL = "https://images.unsplash.com/photo-1589365278144-c9e705f843ba?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80";

// Audio Utils
function floatTo16BitPCM(output: DataView, offset: number, input: Float32Array) {
  for (let i = 0; i < input.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
}
function base64EncodeAudio(float32Array: Float32Array) {
  const arrayBuffer = new ArrayBuffer(float32Array.length * 2);
  const view = new DataView(arrayBuffer);
  floatTo16BitPCM(view, 0, float32Array);
  let binary = '';
  const bytes = new Uint8Array(arrayBuffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

const examplePrompts = [
  { label: "Beach Glam", text: "A glamorous shot for a beach photoshoot with bright sunlight." },
  { label: "Outdoor Adventure", text: "A rugged look for an outdoor adventure ad in the mountains." },
  { label: "Tech Minimalist", text: "A sleek, minimalist background for a high-end tech product." },
  { label: "Neon City", text: "A cyberpunk neon city street at night with rain reflections." },
];

// Ensure locked defaults by standard
const DEFAULT_CONFIG: GenerationConfig = {
  blackAndWhite: false,
  strictPose: true,
  keepFace: true,
  lockLocation: false,
  lockProduct: true,
};

// Tool definition
const takePhotoTool: FunctionDeclaration = {
  name: "takePhoto",
  description: "Trigger the camera shutter. Call this whenever the user asks to take a photo, shoot, capture, or says ready/go.",
  parameters: {
    type: Type.OBJECT,
    properties: {
        command: { type: Type.STRING, description: "The trigger word the user said" }
    },
    required: ["command"]
  },
};

const MagicLens: React.FC<MagicLensProps> = ({ currentUser }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // -- STATE --
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [generatedResult, setGeneratedResult] = useState<{imageUrl: string} | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  
  const [lastTranscript, setLastTranscript] = useState<string>(() => {
    return localStorage.getItem('magic_mirror_prompt') || "";
  });
  const [genConfig, setGenConfig] = useState<GenerationConfig>(() => {
    try {
        const saved = localStorage.getItem('magic_mirror_config');
        return saved ? JSON.parse(saved) : DEFAULT_CONFIG;
    } catch { return DEFAULT_CONFIG; }
  });

  const [isListening, setIsListening] = useState(false);
  const [audioVolume, setAudioVolume] = useState(0);
  const [isFlashing, setIsFlashing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showDesignStudio, setShowDesignStudio] = useState(false);

  // -- CRITICAL: REFS TO PREVENT STALE CLOSURES IN EVENT LISTENERS --
  const appStateRef = useRef(appState);
  const lastTranscriptRef = useRef(lastTranscript);
  const genConfigRef = useRef(genConfig);

  useEffect(() => { appStateRef.current = appState; }, [appState]);
  useEffect(() => { lastTranscriptRef.current = lastTranscript; }, [lastTranscript]);
  useEffect(() => { genConfigRef.current = genConfig; }, [genConfig]);

  // -- PERSISTENCE EFFECTS --
  useEffect(() => {
    localStorage.setItem('magic_mirror_prompt', lastTranscript);
  }, [lastTranscript]);
  useEffect(() => {
    localStorage.setItem('magic_mirror_config', JSON.stringify(genConfig));
  }, [genConfig]);

  // Live API Refs
  const liveSessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const captureLockRef = useRef(false);

  useEffect(() => {
    return () => {
      stopLiveSession();
    };
  }, []);

  // Attach stream to video element when state changes to CAMERA_ACTIVE
  useEffect(() => {
    if (appState === AppState.CAMERA_ACTIVE && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [appState]);

  const ensureApiKey = async (): Promise<boolean> => {
    if (window.aistudio && window.aistudio.hasSelectedApiKey && window.aistudio.openSelectKey) {
      const hasKey = await window.aistudio.hasSelectedApiKey();
      if (!hasKey) {
        await window.aistudio.openSelectKey();
        return await window.aistudio.hasSelectedApiKey();
      }
      return true;
    }
    return true;
  };

  const startLiveSession = async () => {
    try {
      if (liveSessionRef.current) return;
      const hasKey = await ensureApiKey();
      if (!hasKey) return;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContextRef.current = new AudioContext({ sampleRate: 16000 });
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
      processorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);
      
      // Prevent Feedback Loop
      const muteNode = audioContextRef.current.createGain();
      muteNode.gain.value = 0;
      processorRef.current.connect(muteNode);
      muteNode.connect(audioContextRef.current.destination);
      
      const actualSampleRate = audioContextRef.current.sampleRate;

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-25',
        callbacks: {
          onopen: () => {
            console.log("Live Session Opened & Listening");
            setIsListening(true);
            captureLockRef.current = false;
          },
          onmessage: (message: LiveServerMessage) => {
            const { serverContent, toolCall } = message;

            // 1. Tool Calls
            if (toolCall) {
                console.log("Tool Call detected:", toolCall);
                for (const fc of toolCall.functionCalls) {
                    if (fc.name === 'takePhoto' && !captureLockRef.current) {
                        console.log("📸 Voice trigger detected via Tool Call");
                        captureLockRef.current = true;
                        captureAndGenerate();
                        return; 
                    }
                }
            }

            // 2. Input Transcription
            if (serverContent?.inputTranscription) {
                const text = serverContent.inputTranscription.text;
                if (text) {
                   setLastTranscript(prev => (prev + " " + text).slice(-150).trim());
                   
                   // FAST TRIGGER
                   const lower = text.toLowerCase();
                   const triggers = ['shoot', 'capture', 'photo', 'cheese', 'snap', 'do it', 'go', 'ready', 'picture'];
                   if (triggers.some(t => lower.includes(t)) && !captureLockRef.current) {
                        console.log("📸 Fast trigger detected via Input Transcription");
                        captureLockRef.current = true;
                        captureAndGenerate();
                   }
                }
            }

            // 3. Output Transcription Fallback
            if (serverContent?.outputTranscription) {
               const text = serverContent.outputTranscription.text;
               if (text && text.includes("TRIGGER_CAPTURE") && !captureLockRef.current) {
                    captureLockRef.current = true;
                    captureAndGenerate();
               }
            }
          },
          onclose: () => {
            setIsListening(false);
          },
          onerror: (err) => {
            console.error("Live Error", err);
            setIsListening(false);
          },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {}, 
          tools: [{ functionDeclarations: [takePhotoTool] }],
          systemInstruction: `
            You are a creative director. Listen to the user. 
            RULES:
            1. If user says 'SHOOT', 'CAPTURE', 'TAKE PHOTO', 'CHEESE', 'SNAP', 'DO IT' or 'GO', call the "takePhoto" tool IMMEDIATELY.
            2. Otherwise, if the user describes a scene, reply with a refined visual prompt.
          `,
        }
      });

      liveSessionRef.current = sessionPromise;

      processorRef.current.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) sum += inputData[i] * inputData[i];
        setAudioVolume(Math.sqrt(sum / inputData.length));

        const base64Audio = base64EncodeAudio(inputData);
        if (liveSessionRef.current === sessionPromise) {
            sessionPromise.then(session => {
                if (liveSessionRef.current === sessionPromise) {
                    session.sendRealtimeInput({
                        media: { mimeType: `audio/pcm;rate=${actualSampleRate}`, data: base64Audio }
                    });
                }
            }).catch(e => console.error("Session send error", e));
        }
      };

      sourceRef.current.connect(processorRef.current);

    } catch (err) {
      console.error("Failed to start Live API", err);
    }
  };

  const stopLiveSession = () => {
    if (processorRef.current) {
        processorRef.current.disconnect();
        processorRef.current.onaudioprocess = null;
    }
    if (sourceRef.current) sourceRef.current.disconnect();
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
    }
    if (liveSessionRef.current) {
        const currentSession = liveSessionRef.current;
        currentSession.then((session: any) => {
            try { session.close(); } catch (e) { console.warn(e); }
        }).catch(() => {});
    }
    setIsListening(false);
    liveSessionRef.current = null;
  };

  const startCamera = async () => {
    try {
      const hasKey = await ensureApiKey();
      if (!hasKey) {
        alert("An API Key is required.");
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } 
      });
      streamRef.current = stream;
      setAppState(AppState.CAMERA_ACTIVE);
      startLiveSession();
    } catch (err) {
      console.error("Camera error:", err);
      alert("Please allow camera access.");
    }
  };

  const performCapture = async () => {
    // -- USE REFS TO GET CURRENT STATE --
    // This solves the stale closure issue where appState was seen as IDLE
    const currentState = appStateRef.current;
    
    // Safety check: video must be present.
    if (!videoRef.current || !canvasRef.current) return;

    // Use Refs for config/prompt to get latest typing
    const currentTranscript = lastTranscriptRef.current;
    const currentConfig = genConfigRef.current;

    setIsFlashing(true);
    setTimeout(() => setIsFlashing(false), 50);

    setAppState(AppState.CAPTURING);
    stopLiveSession(); 

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    
    if (context) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
      
      setCapturedImage(dataUrl);
      setGeneratedResult(null); // Clear previous result to prevent old data from bleeding into DesignStudio
      
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      
      setAppState(AppState.PROCESSING);

      const promptToUse = currentTranscript.trim().length > 2 ? currentTranscript : "A professional studio product shot with cinematic lighting.";

      try {
        const result = await generateMarketingImage(dataUrl, promptToUse, currentConfig);
        setGeneratedResult(result);
        setAppState(AppState.RESULT);

        try {
          const userHandle = currentUser ? currentUser.handle : "YOU";
          const historyItem = {
            id: Date.now().toString(),
            image: result.imageUrl,
            user: userHandle,
            prompt: promptToUse,
            timestamp: Date.now()
          };
          const existingHistory = JSON.parse(localStorage.getItem('magic_mirror_my_creations') || '[]');
          const newHistory = [historyItem, ...existingHistory].slice(0, 6);
          localStorage.setItem('magic_mirror_my_creations', JSON.stringify(newHistory));
          window.dispatchEvent(new Event('gallery-update'));
        } catch (storageErr) {
          console.warn("Failed to save to gallery", storageErr);
        }

      } catch (e) {
        console.error(e);
        alert("Something went wrong generating the ad.");
        setAppState(AppState.IDLE);
      }
    }
  };

  const captureAndGenerate = () => {
      const currentState = appStateRef.current;
      
      // If we are in result mode, 'shoot' acts as reset
      if (currentState === AppState.RESULT) {
          reset();
          return;
      }

      // If camera active, start countdown if not already running
      if (currentState === AppState.CAMERA_ACTIVE) {
          setCountdown(3);
      }
  };

  useEffect(() => {
    if (countdown === null) return;
    
    // Safety check: if state changes unexpectedly, cancel countdown
    if (appState !== AppState.CAMERA_ACTIVE) {
        setCountdown(null);
        return;
    }

    if (countdown > 0) {
        const t = setTimeout(() => setCountdown(countdown - 1), 1000);
        return () => clearTimeout(t);
    } else {
        // Countdown hit 0
        setCountdown(null);
        performCapture();
    }
  }, [countdown, appState]);


  const loadDemoImage = () => {
    setCapturedImage(DEMO_IMAGE_URL);
    setGeneratedResult({ imageUrl: `${DEMO_IMAGE_URL}&variant=clean` });
    setAppState(AppState.RESULT);
  };

  const reset = () => {
    setCapturedImage(null);
    setGeneratedResult(null);
    setAppState(AppState.IDLE);
    startCamera();
  };

  const handleDownload = () => {
    if (!generatedResult?.imageUrl) return;
    const link = document.createElement('a');
    link.href = generatedResult.imageUrl;
    link.download = `magic-mirror-clean-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleResetDefaults = () => {
    setGenConfig(DEFAULT_CONFIG);
    setLastTranscript("");
    localStorage.removeItem('magic_mirror_prompt');
  };

  const isDemo = capturedImage === DEMO_IMAGE_URL;
  const demoFilters = isDemo ? 'grayscale brightness-75 contrast-125 blur-[0.5px]' : '';
  const bwFilters = genConfig.blackAndWhite ? 'grayscale contrast-125' : '';

  return (
    <div className="w-full max-w-6xl relative z-10 flex flex-col md:flex-row items-center md:items-stretch justify-center gap-4 md:gap-8 mt-4">
      
      <DesignStudio 
        isOpen={showDesignStudio} 
        onClose={() => setShowDesignStudio(false)}
        originalImage={capturedImage}
        initialGeneratedImage={generatedResult?.imageUrl}
      />

      <div className="absolute top-[-20px] left-[-20px] md:top-[-40px] md:left-[-60px] w-32 h-32 md:w-64 md:h-64 bg-electric rounded-full border-4 border-black -z-10 pointer-events-none"></div>
      <div className="absolute bottom-[-20px] right-[-20px] md:bottom-[-40px] md:right-[-60px] w-32 h-32 md:w-64 md:h-64 bg-hotpink rounded-full border-4 border-black -z-10 pointer-events-none"></div>

      {showSettings && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm rounded-3xl p-4">
           <div className="bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6 max-w-sm w-full rotate-1 relative">
             <button onClick={() => setShowSettings(false)} className="absolute top-2 right-2 p-2 hover:bg-gray-100 rounded-full">
               <X className="w-6 h-6" />
             </button>
             <h3 className="font-display text-2xl mb-4 uppercase">Studio Config</h3>
             <div className="space-y-4">
               {[
                 { icon: Palette, label: "NOIR FILTER", key: 'blackAndWhite' },
                 { icon: Scan, label: "MATCH POSE", key: 'strictPose' },
                 { icon: Smile, label: "KEEP FACE", key: 'keepFace' },
                 { icon: MapPin, label: "LOCK LOCATION", key: 'lockLocation' },
                 { icon: Box, label: "LOCK PRODUCT", key: 'lockProduct' },
               ].map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                 <div className="flex items-center gap-3">
                    <item.icon className="w-5 h-5 text-black" />
                    <span className="font-bold font-mono text-sm">{item.label}</span>
                 </div>
                 <button 
                   onClick={() => setGenConfig(p => ({...p, [item.key]: !p[item.key as keyof GenerationConfig]}))}
                   className={`w-12 h-6 rounded-full border-2 border-black relative transition-colors ${genConfig[item.key as keyof GenerationConfig] ? 'bg-electric' : 'bg-gray-200'}`}
                 >
                   <div className={`absolute top-0.5 w-4 h-4 bg-white border-2 border-black rounded-full transition-all ${genConfig[item.key as keyof GenerationConfig] ? 'left-6' : 'left-0.5'}`} />
                 </button>
               </div>
               ))}
               <div className="pt-4 mt-4 border-t-2 border-black flex justify-center">
                   <button 
                     onClick={handleResetDefaults}
                     className="flex items-center gap-2 text-xs font-mono font-bold text-gray-500 hover:text-red-600 transition-colors"
                   >
                     <RotateCcw className="w-3 h-3" /> RESET DEFAULTS
                   </button>
               </div>
             </div>
           </div>
        </div>
      )}

      {/* LEFT SIDE - CAMERA/INPUT */}
      <div className="relative flex-1 aspect-[3/4] border-4 border-black sticker-shadow rotate-[-1deg] group bg-black">
        <button 
          onClick={() => setShowSettings(true)}
          className="absolute top-4 right-4 z-[60] bg-white p-2 border-2 border-black sticker-shadow hover:scale-110 transition-transform"
        >
          <Settings className="w-6 h-6" />
        </button>

        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-8 bg-highlighter/90 z-[70] rotate-[-2deg] pointer-events-none border-t border-b border-white/20 border-l border-r border-transparent shadow-md backdrop-blur-sm"></div>
        
        <div className="relative w-full h-full overflow-hidden">
            <div className={`absolute inset-0 bg-white z-[60] pointer-events-none transition-opacity duration-300 ${isFlashing ? 'opacity-100' : 'opacity-0'}`} />

            {appState === AppState.IDLE && (
                <div className="w-full h-full flex flex-col items-center justify-center text-white bg-black pattern-grid-lg">
                    <StickerButton text="START CREATOR" subtext="Camera + Voice" color="blue" onClick={startCamera} />
                </div>
            )}

            {(appState === AppState.CAMERA_ACTIVE || appState === AppState.CAPTURING) && (
                <>
                    {/* VISUAL INDICATOR: Ready Brackets + Pulse */}
                    {appState === AppState.CAMERA_ACTIVE && countdown === null && (
                       <div className="absolute inset-4 pointer-events-none z-30">
                          <div className="absolute top-2 right-2 w-3 h-3 bg-red-600 rounded-full animate-pulse shadow-[0_0_10px_rgba(255,0,0,0.8)] border border-white/50"></div>
                          {/* Top Left */}
                          <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white drop-shadow-md"></div>
                          {/* Top Right */}
                          <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white drop-shadow-md"></div>
                          {/* Bottom Left */}
                          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white drop-shadow-md"></div>
                          {/* Bottom Right */}
                          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white drop-shadow-md"></div>
                       </div>
                    )}

                    {/* COUNTDOWN OVERLAY */}
                    {countdown !== null && (
                      <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-[1px]">
                         <span className="font-display font-black text-[12rem] text-white animate-ping drop-shadow-[4px_4px_0px_rgba(0,0,0,1)]">
                             {countdown === 0 ? 'SNAP' : countdown}
                         </span>
                      </div>
                    )}

                    <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    muted 
                    className={`w-full h-full object-cover ${genConfig.blackAndWhite ? 'grayscale contrast-125' : ''}`}
                    />
                    
                    {appState === AppState.CAMERA_ACTIVE && (
                    <div className="absolute top-20 left-0 w-full px-4 flex flex-wrap gap-2 justify-center z-40 pointer-events-none">
                        {examplePrompts.map((p) => (
                        <button
                            key={p.label}
                            onClick={() => setLastTranscript(p.text)}
                            className="pointer-events-auto bg-white/90 border-2 border-black px-3 py-1 text-xs font-bold font-mono sticker-shadow hover:bg-highlighter transition-colors rotate-1"
                        >
                            {p.label}
                        </button>
                        ))}
                    </div>
                    )}

                    <div className="absolute bottom-6 left-4 right-4 z-40">
                    <div className="bg-black/50 backdrop-blur-md border-l-4 border-highlighter p-2 text-white font-mono text-sm min-h-[60px] flex items-center">
                        <div className="flex-1">
                            {isListening && (
                            <div className="flex items-center gap-2 mb-1 text-highlighter text-xs uppercase tracking-widest">
                                <Mic className="w-3 h-3 animate-pulse" /> Listening for "Shoot"...
                                <div className="h-1 bg-highlighter transition-all duration-75" style={{ width: Math.min(100, audioVolume * 500) + 'px' }}></div>
                            </div>
                            )}
                            <input 
                            type="text" 
                            value={lastTranscript}
                            onChange={(e) => setLastTranscript(e.target.value)}
                            placeholder="Describe your ad (e.g. 'Coffee on Mars')..."
                            className="w-full bg-transparent border-none outline-none text-white placeholder-white/50"
                            />
                        </div>
                    </div>
                    </div>
                </>
            )}

            {appState === AppState.PROCESSING && capturedImage && (
                <div className="w-full h-full relative">
                <img src={capturedImage} className={`w-full h-full object-cover ${bwFilters} ${demoFilters}`} alt="Captured" />
                <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-50">
                    <span className="font-display text-2xl text-white uppercase tracking-widest animate-pulse">Developing...</span>
                </div>
                </div>
            )}
            
            {appState === AppState.RESULT && capturedImage && (
                <img src={capturedImage} className={`w-full h-full object-cover ${bwFilters} ${demoFilters}`} alt="Captured Source" />
            )}
            
            <div className="absolute top-4 left-4 bg-black text-white font-mono text-xs px-2 py-1 border border-white/20 z-30">
            STEP 01: RAW
            </div>
        </div>
      </div>

      {/* CENTER - CONNECTOR AND MAIN ACTION BUTTON */}
      <div className="flex md:flex-col items-center justify-center relative z-20 py-2 md:py-0">
        <button 
            onClick={captureAndGenerate}
            disabled={appState !== AppState.CAMERA_ACTIVE && appState !== AppState.RESULT}
            className={`
                bg-white border-2 border-black p-4 rounded-full sticker-shadow z-20 transition-all duration-500 hover:scale-110 active:scale-95 cursor-pointer
                ${appState === AppState.PROCESSING ? 'scale-125 bg-electric cursor-not-allowed animate-spin' : 'rotate-12'}
                ${appState === AppState.IDLE ? 'opacity-0 pointer-events-none' : 'opacity-100'}
            `}
        >
           {appState === AppState.PROCESSING ? (
             <RefreshCw className="w-8 h-8 text-white animate-spin" />
           ) : appState === AppState.RESULT ? (
             <RotateCcw className="w-8 h-8 text-black" />
           ) : (
             <div className="relative">
                 <div className="w-8 h-8 bg-hotpink rounded-full border-2 border-black"></div>
                 <div className="absolute -top-1 -right-1 w-3 h-3 bg-highlighter rounded-full border border-black animate-pulse"></div>
             </div>
           )}
        </button>
        <div className="hidden md:block absolute top-1/2 left-[-40px] right-[-40px] h-0 border-t-4 border-black border-dashed -z-10"></div>
        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-highlighter px-2 py-0.5 border border-black text-[10px] font-mono uppercase tracking-widest rotate-[-5deg] whitespace-nowrap hidden md:block sticker-shadow">
            AI Magic
        </div>
      </div>

      {/* RIGHT SIDE - OUTPUT */}
      <div className="relative flex-1 aspect-[3/4] bg-white border-4 border-black sticker-shadow rotate-[1deg]">
         <div className="absolute top-0 right-1/2 translate-x-1/2 -translate-y-1/2 w-32 h-8 bg-hotpink/90 z-[70] rotate-[2deg] pointer-events-none border-t border-b border-white/20 border-l border-r border-transparent shadow-md backdrop-blur-sm"></div>
         <canvas ref={canvasRef} className="hidden" />
         <div className="w-full h-full overflow-hidden relative group bg-paper">
            {generatedResult ? (
              <>
                 <img src={generatedResult.imageUrl} className="w-full h-full object-cover" alt="Generated Ad" />
                 <div className="absolute bottom-4 left-0 w-full z-[100] flex justify-center gap-2 px-4 pointer-events-auto">
                    <button 
                       type="button"
                       onClick={() => setShowDesignStudio(true)}
                       className="flex-1 p-3 bg-highlighter border-2 border-black sticker-shadow hover:bg-[#E6E600] transition-colors flex items-center justify-center gap-2 font-display font-bold uppercase tracking-wide text-lg"
                       title="Remix Studio"
                    >
                       <Zap className="w-5 h-5" /> Remix Studio
                    </button>
                    <button 
                      onClick={handleDownload} 
                      className="p-3 bg-white border-2 border-black sticker-shadow hover:bg-gray-100 transition-colors"
                      title="Quick Save"
                    >
                       <Download className="w-5 h-5" />
                    </button>
                 </div>
              </>
            ) : (
              <div className="text-center p-8 opacity-40 flex flex-col items-center">
                <ImageIcon className="w-16 h-16 mx-auto mb-4 text-black" />
                <h3 className="font-display text-3xl font-bold uppercase">Your Ad Here</h3>
                <p className="font-serif italic mt-2">Waiting for magic...</p>
                <button 
                  onClick={loadDemoImage}
                  className="mt-6 px-4 py-2 bg-gray-200 border-2 border-black font-mono text-xs font-bold uppercase hover:bg-highlighter transition-colors flex items-center gap-2 sticker-shadow"
                >
                   <Play className="w-3 h-3" /> Try Demo Image
                </button>
              </div>
            )}
            <div className="absolute top-4 left-4 bg-white text-black font-mono text-xs px-2 py-1 border border-black/10 z-30">
                STEP 02: EDITORIAL
            </div>
         </div>
      </div>
    </div>
  );
};

export default MagicLens;