import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Zap, Layers, Download, RefreshCw, LayoutGrid, Mic, Type as TypeIcon, Check, MousePointer2, MicOff, Image as ImageIcon, Split, TrendingUp, Trophy, ArrowLeft, HelpCircle, CheckCircle2, Edit3, Sparkles, Upload, PenTool, Bot, Search, FileText, Target, ShieldCheck, UserCircle2, PlayCircle, Copy, FileDown, CheckCheck, Clipboard, Minus, Plus, Palette, Smartphone, RectangleVertical, RectangleHorizontal, Square, MoveHorizontal, MoveVertical, User, Info, Hand, UserX, Smile, Box, Waves, Move } from 'lucide-react';
import { generateVariantImage, runBrandAgent } from '../services/geminiService';
import { GoogleGenAI, LiveServerMessage, Modality, FunctionDeclaration, Type as GoogleType } from "@google/genai";

interface DesignStudioProps {
  originalImage: string | null;
  initialGeneratedImage?: string | null;
  isOpen: boolean;
  onClose: () => void;
}

const SETTINGS = [
  { id: 'marble', label: 'Marble Studio', prompt: 'on a luxury white marble podium, soft lighting' },
  { id: 'neon', label: 'Cyber Street', prompt: 'in a neon-lit cyberpunk street at night, wet pavement reflection' },
  { id: 'nature', label: 'Deep Nature', prompt: 'surrounded by lush green tropical leaves and moss, sunlight filtering through' },
  { id: 'minimal', label: 'Ultra Minimal', prompt: 'in a pure white void, floating, soft diffuse shadow' },
  { id: 'kitchen', label: 'Cozy Kitchen', prompt: 'on a rustic wooden kitchen table, morning sunlight, lifestyle photography' },
  { id: 'bananas', label: 'Go Bananas 🍌', prompt: 'Wildcard! AI picks the vibe.' },
  { id: 'custom', label: 'Custom Studio', prompt: 'User defined setting.' },
];

const HUMAN_OPTIONS = [
  { id: 'none', label: 'No Person', icon: UserX, prompt: 'no people present, isolated product photography, object focus' },
  { id: 'hand', label: 'Hand Only', icon: Hand, prompt: 'held by a hand, first-person POV, close up on grip' },
  { id: 'face', label: 'Model (Face)', icon: Smile, prompt: 'held by a professional model near face, beauty portrait style, human interaction' },
  { id: 'full', label: 'Model (Life)', icon: User, prompt: 'candid lifestyle shot, model using the product naturally, mid-action, fashion editorial' },
];

const PRODUCT_STATES = [
  { id: 'natural', label: 'Natural', icon: Box, prompt: 'resting naturally on the surface' },
  { id: 'levitate', label: 'Levitating', icon: Move, prompt: 'floating in mid-air, zero gravity suspension, magical atmosphere' },
  { id: 'podium', label: 'On Podium', icon: Layers, prompt: 'placed on a geometric pedestal, museum display style' },
  { id: 'splash', label: 'Splash', icon: Waves, prompt: 'surrounded by dynamic liquid splashes, high speed photography' },
];

const ANGLES = [
  { id: 'eye', label: 'Eye Level', prompt: 'straight on eye-level view, symmetrical composition, balanced framing' },
  { id: 'top', label: 'Flat Lay', prompt: 'top-down flat lay view, organized knolling composition, graphic design style' },
  { id: 'low', label: 'Hero Angle', prompt: 'low angle looking up, dramatic hero shot, imposing stature, power pose' },
  { id: 'macro', label: 'Macro Detail', prompt: 'extreme close-up macro shot, focus on texture and material details, abstract composition' },
  { id: 'dutch', label: 'Dutch Tilt', prompt: 'tilted dutch angle camera, dynamic diagonal lines, high energy fashion editorial vibe' },
  { id: 'wide', label: 'Wide Scene', prompt: 'wide angle environmental shot, showing the product in a vast scene, cinematic storytelling' },
  { id: 'over', label: 'POV / Shoulder', prompt: 'first-person point of view or over-the-shoulder shot, immersive perspective' },
  { id: 'mirror', label: 'Reflection', prompt: 'artistic reflection shot, mirrored on a glossy surface or water, duality theme' },
];

const FORMATS = [
    { id: '1:1', label: 'Square (Post)', icon: Square, dim: { w: 1080, h: 1080 }, aspect: '1/1' },
    { id: '3:4', label: 'Portrait', icon: RectangleVertical, dim: { w: 1080, h: 1440 }, aspect: '3/4' },
    { id: '9:16', label: 'Story/Reel', icon: Smartphone, dim: { w: 1080, h: 1920 }, aspect: '9/16' },
    { id: '16:9', label: 'Landscape', icon: RectangleHorizontal, dim: { w: 1920, h: 1080 }, aspect: '16/9' },
];

const POSTER_FONTS = [
  { id: 'Oswald', label: 'Impact', family: '"Oswald", sans-serif', weight: '900' },
  { id: 'Playfair Display', label: 'Luxury', family: '"Playfair Display", serif', weight: '700' },
  { id: 'Inter', label: 'Modern', family: '"Inter", sans-serif', weight: '900' },
  { id: 'Courier New', label: 'Raw', family: '"Courier New", monospace', weight: 'bold' },
];

const CTA_COLORS = [
  { id: 'yellow', hex: '#FFFF00', label: 'Highlighter' },
  { id: 'pink', hex: '#FF0099', label: 'Hot Pink' },
  { id: 'blue', hex: '#0033FF', label: 'Electric' },
  { id: 'white', hex: '#FFFFFF', label: 'Clean' },
  { id: 'black', hex: '#000000', label: 'Noir' },
];

// -- Tool Definitions --
const changeVibeTool: FunctionDeclaration = {
  name: "changeVibe",
  description: "Change the visual style or vibe setting of the photo studio.",
  parameters: {
    type: GoogleType.OBJECT,
    properties: {
      vibeId: { 
        type: GoogleType.STRING, 
        description: "The ID of the vibe to select. Options: 'marble', 'neon', 'nature', 'minimal', 'kitchen', 'bananas', 'custom'."
      }
    },
    required: ["vibeId"]
  }
};

const changeHumanTool: FunctionDeclaration = {
  name: "changeHuman",
  description: "Change the human presence in the shot.",
  parameters: {
    type: GoogleType.OBJECT,
    properties: {
      humanId: {
        type: GoogleType.STRING,
        description: "The ID of the human context. Options: 'none' (no person), 'hand' (hand only), 'face' (model portrait), 'full' (lifestyle model)."
      }
    },
    required: ["humanId"]
  }
};

const changeProductStateTool: FunctionDeclaration = {
  name: "changeProductState",
  description: "Change the object physics or placement state.",
  parameters: {
    type: GoogleType.OBJECT,
    properties: {
      stateId: {
        type: GoogleType.STRING,
        description: "The ID of the product state. Options: 'natural', 'levitate', 'podium', 'splash'."
      }
    },
    required: ["stateId"]
  }
};

const changeAngleTool: FunctionDeclaration = {
  name: "changeAngle",
  description: "Change the camera angle or composition.",
  parameters: {
    type: GoogleType.OBJECT,
    properties: {
      angleId: { 
        type: GoogleType.STRING, 
        description: "The ID of the angle to select. Options: 'eye', 'top', 'low', 'macro', 'dutch', 'wide', 'over', 'mirror'."
      }
    },
    required: ["angleId"]
  }
};

const changeFormatTool: FunctionDeclaration = {
    name: "changeFormat",
    description: "Change the output format aspect ratio.",
    parameters: {
      type: GoogleType.OBJECT,
      properties: {
        formatId: { 
          type: GoogleType.STRING, 
          description: "The ID of the format. Options: '1:1', '3:4', '9:16', '16:9'."
        }
      },
      required: ["formatId"]
    }
  };

const triggerActionTool: FunctionDeclaration = {
  name: "triggerAction",
  description: "Trigger a specific studio action like generating an image, closing the modal, switching modes, selecting images, or downloading.",
  parameters: {
    type: GoogleType.OBJECT,
    properties: {
      action: { 
        type: GoogleType.STRING, 
        description: "The action to perform. Options: 'generate', 'close', 'poster_mode', 'remix_mode', 'ab_test_mode', 'agent_mode', 'download'." 
      }
    },
    required: ["action"]
  }
};

// -- Audio Helpers --
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

const DEFAULT_AD_TEXT = {
  headline: "FRESH DROP",
  subhead: "Limited Edition",
  cta: "SHOP NOW"
};

interface ABTestResult {
    id: string;
    image: string;
    settingName: string;
    stats: {
        ctr: number; // 0-100
        score: number; // 0-100
        impressions: number;
    };
}

interface AgentReport {
    persona?: string;
    creative?: string;
    copy?: string;
    targeting?: string;
    safety?: string;
}

const DesignStudio: React.FC<DesignStudioProps> = ({ originalImage, initialGeneratedImage, isOpen, onClose }) => {
  const [mode, setMode] = useState<'remix' | 'poster' | 'ab' | 'agent'>('agent');
  const [mounted, setMounted] = useState(false);
  const [hoveredInfo, setHoveredInfo] = useState<string | null>(null);
  
  // MULTI-SELECT STATE (Settings Only)
  // Default set to "Go Bananas"
  const [selectedSettings, setSelectedSettings] = useState<typeof SETTINGS>([
    SETTINGS.find(s => s.id === 'bananas') || SETTINGS[0]
  ]);
  
  // SINGLE-SELECT STATES (Changed from Multi)
  const [selectedHumans, setSelectedHumans] = useState<typeof HUMAN_OPTIONS>([HUMAN_OPTIONS[1]]); // Default: Hand Only
  const [selectedProductStates, setSelectedProductStates] = useState<typeof PRODUCT_STATES>([PRODUCT_STATES[0]]); // Default: Natural
  const [selectedAngles, setSelectedAngles] = useState<typeof ANGLES>([ANGLES[0]]);
  
  const [selectedFormat, setSelectedFormat] = useState<typeof FORMATS[0]>(FORMATS[1]); // Default 3:4

  // Custom Studio State
  const [customPrompt, setCustomPrompt] = useState("");
  const [customBgImage, setCustomBgImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sourceFileInputRef = useRef<HTMLInputElement>(null);
  
  const [generatedVariants, setGeneratedVariants] = useState<string[]>([]);
  const [selectedVariantIndex, setSelectedVariantIndex] = useState<number>(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<{current: number, total: number} | null>(null);
  
  // Editorial State
  const [adText, setAdText] = useState(DEFAULT_AD_TEXT);
  const [posterConfig, setPosterConfig] = useState({
      headlineScale: 1,
      headlineColor: '#FFFFFF',
      headlineX: 50,
      headlineY: 20,
      ctaScale: 1,
      fontId: 'Oswald',
      ctaColor: '#FFFF00',
      ctaVariant: 'solid' as 'solid' | 'outline',
      ctaX: 50,
      ctaY: 85
  });
  
  // A/B Test State
  const [abResults, setAbResults] = useState<ABTestResult[]>([]);
  const [isRunningAB, setIsRunningAB] = useState(false);
  const [abStatus, setAbStatus] = useState<string>("Simulating Market...");

  // Agent State
  const [agentReports, setAgentReports] = useState<AgentReport>({});
  const [isAgentRunning, setIsAgentRunning] = useState<string | null>(null); // 'persona', 'creative' etc or null
  const [copiedState, setCopiedState] = useState<string | null>(null); // To track which report was copied

  // Voice State
  const [isMicEnabled, setIsMicEnabled] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [audioVolume, setAudioVolume] = useState(0);
  const [lastCommand, setLastCommand] = useState<string | null>(null);

  // Live API Refs
  const liveSessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  // -- REFS FOR STALE CLOSURE PREVENTION --
  const selectedSettingsRef = useRef(selectedSettings);
  const selectedHumansRef = useRef(selectedHumans);
  const selectedProductStatesRef = useRef(selectedProductStates);
  const selectedAnglesRef = useRef(selectedAngles);
  const selectedFormatRef = useRef(selectedFormat);
  const generatedVariantsRef = useRef(generatedVariants);
  const selectedVariantIndexRef = useRef(selectedVariantIndex); 
  const isGeneratingRef = useRef(isGenerating);
  const isRunningABRef = useRef(isRunningAB);
  const isOpenRef = useRef(isOpen);
  const lastOriginalImageRef = useRef<string | null>(null);
  const customPromptRef = useRef(customPrompt);
  const customBgImageRef = useRef(customBgImage);
  const posterConfigRef = useRef(posterConfig);

  // Mount effect to ensure document.body exists
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Sync refs
  useEffect(() => { selectedSettingsRef.current = selectedSettings; }, [selectedSettings]);
  useEffect(() => { selectedHumansRef.current = selectedHumans; }, [selectedHumans]);
  useEffect(() => { selectedProductStatesRef.current = selectedProductStates; }, [selectedProductStates]);
  useEffect(() => { selectedAnglesRef.current = selectedAngles; }, [selectedAngles]);
  useEffect(() => { selectedFormatRef.current = selectedFormat; }, [selectedFormat]);
  useEffect(() => { generatedVariantsRef.current = generatedVariants; }, [generatedVariants]);
  useEffect(() => { selectedVariantIndexRef.current = selectedVariantIndex; }, [selectedVariantIndex]); 
  useEffect(() => { isGeneratingRef.current = isGenerating; }, [isGenerating]);
  useEffect(() => { isRunningABRef.current = isRunningAB; }, [isRunningAB]);
  useEffect(() => { isOpenRef.current = isOpen; }, [isOpen]);
  useEffect(() => { customPromptRef.current = customPrompt; }, [customPrompt]);
  useEffect(() => { customBgImageRef.current = customBgImage; }, [customBgImage]);
  useEffect(() => { posterConfigRef.current = posterConfig; }, [posterConfig]);
  
  // Hidden Canvas for Poster Generation
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Check if original is demo image (URL based) to apply "bad" styling
  const isDemo = originalImage?.startsWith('http');

  // Initialize/Reset variants when originalImage changes or generated image arrives
  useEffect(() => {
    if (originalImage) {
        // Detect if this is a new session (new capture)
        if (originalImage !== lastOriginalImageRef.current) {
            // New Session: Reset list to just the original
            const list = [originalImage];
            // If we have a generated image immediately (sync update), add it
            if (initialGeneratedImage && initialGeneratedImage !== originalImage) {
                list.unshift(initialGeneratedImage);
            }
            setGeneratedVariants(list);
            setSelectedVariantIndex(0);
            setAgentReports({}); // Reset agent
            lastOriginalImageRef.current = originalImage;
        } else {
            // Same session: Check if a delayed generated image arrived (async update)
            if (initialGeneratedImage && initialGeneratedImage !== originalImage) {
                setGeneratedVariants(prev => {
                    // Only add if not already present
                    if (!prev.includes(initialGeneratedImage)) {
                        return [initialGeneratedImage, ...prev];
                    }
                    return prev;
                });
            }
        }
    }
  }, [originalImage, initialGeneratedImage]);

  // Handle Custom BG Upload
  const handleBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
              setCustomBgImage(reader.result as string);
          };
          reader.readAsDataURL(file);
      }
  };

  // Handle Source Image Upload
  const handleSourceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
              const newSource = reader.result as string;
              // Add to variants list at the top, effectively "adding" a photo to the session
              setGeneratedVariants(prev => [newSource, ...prev]);
              setSelectedVariantIndex(0);
              // Reset agent reports because the "source" context has conceptually changed
              setAgentReports({}); 
          };
          reader.readAsDataURL(file);
      }
  };

  // Toggle Helpers
  const toggleSetting = (setting: typeof SETTINGS[0]) => {
      setSelectedSettings(prev => {
          const exists = prev.find(s => s.id === setting.id);
          if (exists) {
              if (prev.length === 1) return prev; // Don't allow empty
              return prev.filter(s => s.id !== setting.id);
          }
          return [...prev, setting];
      });
  };

  // SINGLE SELECT UPDATE
  const toggleHuman = (human: typeof HUMAN_OPTIONS[0]) => {
      setSelectedHumans([human]);
  };

  // SINGLE SELECT UPDATE
  const toggleProductState = (state: typeof PRODUCT_STATES[0]) => {
      setSelectedProductStates([state]);
  };

  // SINGLE SELECT UPDATE
  const toggleAngle = (angle: typeof ANGLES[0]) => {
      setSelectedAngles([angle]);
  };

  // --- AGENT HANDLERS ---
  const handleRunAgent = async (task: keyof AgentReport, providedContext?: string) => {
    const sourceImage = originalImage || generatedVariants[0];
    if (!sourceImage) return null;

    setIsAgentRunning(task);
    try {
        let context = providedContext || "";
        if (!context) {
            if (task === 'creative') context += `Persona Report: ${agentReports.persona || ''}`;
            if (task === 'copy') context += `Persona Report: ${agentReports.persona || ''} Creative Brief: ${agentReports.creative || ''}`;
            if (task === 'targeting') context += `Persona Report: ${agentReports.persona || ''}`;
        }

        const report = await runBrandAgent(sourceImage, task, context);
        setAgentReports(prev => ({ ...prev, [task]: report }));
        return report;
    } catch (e) {
        console.error("Agent failed", e);
        return null;
    } finally {
        setIsAgentRunning(null);
    }
  };

  const handleRunAllAgents = async () => {
      const phases: (keyof AgentReport)[] = ['persona', 'creative', 'copy', 'targeting', 'safety'];
      const sourceImage = originalImage || generatedVariants[0];
      if (!sourceImage) return;

      setAgentReports({});
      let accumulatedContext = "";

      for (const phase of phases) {
          setIsAgentRunning(phase);
          try {
              const result = await runBrandAgent(sourceImage, phase, accumulatedContext);
              if (result) {
                  setAgentReports(prev => ({ ...prev, [phase]: result }));
                  accumulatedContext += `\n[${phase.toUpperCase()} REPORT]: ${result}\n`;
              }
          } catch (e) {
              console.error(`Automated run failed at ${phase}`, e);
              break; 
          }
      }
      setIsAgentRunning(null);
  };

  const handleApplyCreative = (text: string) => {
    const parts = text.split('SCENE_PROMPT:');
    const cleanPrompt = parts.length > 1 ? parts[1].trim() : text;
    setCustomPrompt(cleanPrompt);
    setSelectedSettings([{ id: 'custom', label: 'Custom Studio', prompt: 'User defined setting.' }]);
    setMode('remix');
  };

  const handleApplyCopy = (text: string) => {
    let headline = "FRESH DROP";
    let cta = "SHOP NOW";

    const headlineMatch = text.match(/HEADLINE:\s*(.+)/i);
    const ctaMatch = text.match(/CTA:\s*(.+)/i);

    if (headlineMatch) headline = headlineMatch[1].trim().replace(/^["']|["']$/g, '');
    if (ctaMatch) cta = ctaMatch[1].trim().replace(/^["']|["']$/g, '');

    if (!headlineMatch && !ctaMatch) {
       const quoteMatch = text.match(/"([^"]+)"/);
       if (quoteMatch) headline = quoteMatch[1];
    }

    setAdText({ ...adText, headline, cta });
    setMode('poster');
  };

  const handleCopy = (text: string, id: string) => {
      navigator.clipboard.writeText(text);
      setCopiedState(id);
      setTimeout(() => setCopiedState(null), 2000);
  };

  const handleDownloadSingle = (title: string, content: string) => {
      const element = document.createElement("a");
      const file = new Blob([content], {type: 'text/plain'});
      element.href = URL.createObjectURL(file);
      element.download = `${title.replace(/\s+/g, '_').toLowerCase()}_report.txt`;
      document.body.appendChild(element); 
      element.click();
      document.body.removeChild(element);
  };

  const handleDownloadSingleImage = (url: string, prefix: string) => {
      const link = document.createElement('a');
      link.href = url;
      link.download = `magic-${prefix}-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const handleDownloadFullCampaign = () => {
      const reports = agentReports;
      let fullContent = `# FULL CAMPAIGN STRATEGY\nGenerated by Gemini 3 Pro + Deep Research\nDate: ${new Date().toLocaleDateString()}\n\n`;
      
      if (reports.persona) fullContent += `## 1. PERSONA BRIEF\n${reports.persona}\n\n${'-'.repeat(40)}\n\n`;
      if (reports.creative) fullContent += `## 2. CREATIVE DIRECTION\n${reports.creative}\n\n${'-'.repeat(40)}\n\n`;
      if (reports.copy) fullContent += `## 3. COPY KIT\n${reports.copy}\n\n${'-'.repeat(40)}\n\n`;
      if (reports.targeting) fullContent += `## 4. TARGETING\n${reports.targeting}\n\n${'-'.repeat(40)}\n\n`;
      if (reports.safety) fullContent += `## 5. BRAND SAFETY\n${reports.safety}\n\n`;

      handleDownloadSingle("full_campaign_strategy", fullContent);
  };

  const handleGenerate = async () => {
    const currentVariants = generatedVariantsRef.current;
    const currentIndex = selectedVariantIndexRef.current;
    const sourceImage = currentVariants[currentIndex] || originalImage;

    if (isGeneratingRef.current || !sourceImage) return;
    
    setIsGenerating(true);
    setMode('remix'); 
    
    try {
        const settings = selectedSettingsRef.current;
        const humans = selectedHumansRef.current;
        const productStates = selectedProductStatesRef.current;
        const angles = selectedAnglesRef.current;
        const format = selectedFormatRef.current; 
        const cPrompt = customPromptRef.current;
        const cBg = customBgImageRef.current;
        
        const tasks: Array<{setting: string, angle: string, isCustom?: boolean}> = [];
        
        // Loop through combinations: Setting x Human x Product State x Angle
        settings.forEach(s => {
            humans.forEach(h => {
                productStates.forEach(p => {
                    angles.forEach(a => {
                        tasks.push({ 
                            setting: s.prompt, 
                            // Combine Contexts into the angle parameter for the service
                            angle: `${a.prompt}. Human Context: ${h.prompt}. Product State: ${p.prompt}`,
                            isCustom: s.id === 'custom'
                        });
                    });
                });
            });
        });

        setGenerationProgress({ current: 0, total: tasks.length });

        for (let i = 0; i < tasks.length; i++) {
             const task = tasks[i];
             try {
                setGenerationProgress({ current: i + 1, total: tasks.length });
                
                const result = await generateVariantImage(
                    sourceImage, 
                    task.setting, 
                    task.angle,
                    format.id, 
                    task.isCustom ? cPrompt : undefined,
                    task.isCustom && cBg ? cBg : undefined
                );
                
                setGeneratedVariants(prev => [result.imageUrl, ...prev]);
                if (i === 0) setSelectedVariantIndex(0); 

             } catch (e) {
                 console.error(`Batch generation failed for item ${i}`, e);
             }
        }
        
    } catch (e) {
        console.error("Generation flow failed", e);
        setLastCommand("Generation Failed");
        alert("Studio generation failed. Please try again.");
    } finally {
        setIsGenerating(false);
        setGenerationProgress(null);
    }
  };

  const handleRunABTest = async () => {
    const currentVariants = generatedVariantsRef.current;
    const currentIndex = selectedVariantIndexRef.current;
    const sourceImage = currentVariants[currentIndex] || originalImage;
    const controlSetting = selectedSettings[0];
    const controlAngle = selectedAngles[0];
    const format = selectedFormatRef.current;

    if (!sourceImage || isRunningAB) return;
    
    setIsRunningAB(true);
    setAbResults([]);
    setAbStatus("Agent Researching Trends...");

    try {
        let variantB_Prompt = "";
        let variantB_Label = "AI Trend Selection";

        try {
             const agentResult = await runBrandAgent(sourceImage, 'ab_test');
             
             if (agentResult && agentResult.length > 5 && !agentResult.includes("offline")) {
                 variantB_Prompt = agentResult;
                 variantB_Label = "Deep Research Trend";
             } else {
                 throw new Error("Agent failed or returned empty");
             }
        } catch (e) {
             console.warn("Deep Research failed, falling back to random selection", e);
             const otherSettings = SETTINGS.filter(s => s.id !== controlSetting.id);
             const random = otherSettings[Math.floor(Math.random() * otherSettings.length)];
             variantB_Prompt = random.prompt;
             variantB_Label = random.label;
        }

        setAbStatus("Generating Variants...");
        const variantA_Setting = controlSetting;
        
        const results = await Promise.allSettled([
            generateVariantImage(sourceImage, variantA_Setting.prompt, controlAngle.prompt, format.id),
            generateVariantImage(sourceImage, variantB_Prompt, controlAngle.prompt, format.id)
        ]);

        setAbStatus("Calculating Results...");
        const validResults: ABTestResult[] = [];
        
        if (results[0].status === 'fulfilled') {
            const scoreA = Math.floor(Math.random() * 25) + 70; 
            validResults.push({
                id: 'A',
                image: results[0].value.imageUrl,
                settingName: variantA_Setting.label,
                stats: { ctr: +(Math.random() * 3 + 1.5).toFixed(1), score: scoreA, impressions: 1240 }
            });
        }

        if (results[1].status === 'fulfilled') {
            const scoreB = Math.floor(Math.random() * 25) + 70;
            validResults.push({
                id: 'B',
                image: results[1].value.imageUrl,
                settingName: variantB_Label,
                stats: { ctr: +(Math.random() * 3 + 1.5).toFixed(1), score: scoreB, impressions: 1180 }
            });
        }
        
        if (validResults.length === 0) {
            throw new Error("Both variants failed to generate.");
        }
        setAbResults(validResults);

    } catch (e) {
        console.error("AB Test Error", e);
        alert("Could not run A/B test. Please check your connection and try again.");
    } finally {
        setIsRunningAB(false);
        setAbStatus("Simulating Market...");
    }
  };

  const handlePromoteToPoster = (imageUrl: string) => {
    setGeneratedVariants(prev => [imageUrl, ...prev]);
    setSelectedVariantIndex(0);
    setMode('poster');
  };

  const handleBatchDownload = (images: string[], prefix: string) => {
    images.forEach((imgUrl, i) => {
        setTimeout(() => {
            const link = document.createElement('a');
            link.href = imgUrl;
            link.download = `magic-${prefix}-${Date.now()}-${i + 1}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }, i * 500);
    });
  };

  const handleDownloadPoster = () => {
    // Use refs where possible for stability
    const activeImage = generatedVariantsRef.current[selectedVariantIndexRef.current];
    const currentConfig = posterConfigRef.current;
    
    if (!activeImage || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    
    // Safety check: Only apply crossorigin if using remote URL to prevent tainted canvas security error
    if (activeImage.startsWith('http')) {
        img.crossOrigin = "anonymous";
    }
    img.src = activeImage;
    
    img.onload = () => {
        const format = selectedFormatRef.current;
        canvas.width = format.dim.w;
        canvas.height = format.dim.h;
        
        // --- IMAGE SCALING (OBJECT-COVER LOGIC) ---
        const canvasRatio = canvas.width / canvas.height;
        const imgRatio = img.width / img.height;
        
        let drawWidth = canvas.width;
        let drawHeight = canvas.height;
        let offsetX = 0;
        let offsetY = 0;

        if (imgRatio > canvasRatio) {
            drawHeight = canvas.height;
            drawWidth = img.width * (canvas.height / img.height);
            offsetX = (canvas.width - drawWidth) / 2;
        } else {
            drawWidth = canvas.width;
            drawHeight = img.height * (canvas.width / img.width);
            offsetY = (canvas.height - drawHeight) / 2;
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
        
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.textAlign = 'center';
        ctx.shadowBlur = 0;
        ctx.textBaseline = 'middle'; 
        
        // --- HEADLINE DRAWING ---
        const selectedFont = POSTER_FONTS.find(f => f.id === currentConfig.fontId) || POSTER_FONTS[0];
        const scaleFactor = canvas.width / 1080;
        const headlineFontSize = 120 * currentConfig.headlineScale * scaleFactor;
        
        let fontFace = "Oswald";
        if (currentConfig.fontId === 'Playfair Display') fontFace = "Playfair Display";
        if (currentConfig.fontId === 'Inter') fontFace = "Inter";
        if (currentConfig.fontId === 'Courier New') fontFace = "Courier New";

        ctx.font = `${selectedFont.weight} ${headlineFontSize}px "${fontFace}"`;
        ctx.fillStyle = currentConfig.headlineColor;
        ctx.shadowColor = 'black';
        ctx.shadowOffsetX = 8 * scaleFactor;
        ctx.shadowOffsetY = 8 * scaleFactor;

        const words = adText.headline.toUpperCase().split(' ');
        let line = '';
        const lineHeight = headlineFontSize * 1.1; 
        
        const lines = [];
        const maxWidth = canvas.width * 0.9; 

        for (let n = 0; n < words.length; n++) {
            const testLine = line + words[n] + ' ';
            const metrics = ctx.measureText(testLine);
            if (metrics.width > maxWidth && n > 0) {
                lines.push(line);
                line = words[n] + ' ';
            } else {
                line = testLine;
            }
        }
        lines.push(line);

        const centerX = canvas.width * (currentConfig.headlineX / 100);
        const centerY = canvas.height * (currentConfig.headlineY / 100);
        
        const totalBlockHeight = (lines.length - 1) * lineHeight;
        let y = centerY - (totalBlockHeight / 2);

        for (const l of lines) {
            ctx.fillText(l, centerX, y);
            y += lineHeight;
        }
        
        // --- CTA BUTTON DRAWING ---
        if (adText.cta.trim()) {
            ctx.shadowColor = 'transparent';
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;

            const ctaFontSize = 45 * currentConfig.ctaScale * scaleFactor;
            ctx.font = `bold ${ctaFontSize}px "Courier New", monospace`;
            const ctaText = adText.cta.toUpperCase();
            const ctaMetrics = ctx.measureText(ctaText);
            
            const paddingX = 60 * currentConfig.ctaScale * scaleFactor;
            const paddingY = 25 * currentConfig.ctaScale * scaleFactor;
            const buttonWidth = ctaMetrics.width + (paddingX * 2);
            const buttonHeight = ctaFontSize + (paddingY * 2); 
            
            const btnCenterX = canvas.width * (currentConfig.ctaX / 100);
            const btnCenterY = canvas.height * (currentConfig.ctaY / 100);

            const buttonX = btnCenterX - (buttonWidth / 2);
            const buttonY = btnCenterY - (buttonHeight / 2);

            const isSolid = currentConfig.ctaVariant === 'solid';
            const mainColor = currentConfig.ctaColor;

            ctx.fillStyle = 'black';
            ctx.fillRect(buttonX + (8 * scaleFactor), buttonY + (8 * scaleFactor), buttonWidth, buttonHeight);

            if (isSolid) {
                ctx.fillStyle = mainColor;
                ctx.fillRect(buttonX, buttonY, buttonWidth, buttonHeight);
            } else {
                ctx.fillStyle = 'white'; 
                ctx.fillRect(buttonX, buttonY, buttonWidth, buttonHeight);
            }

            ctx.lineWidth = 5 * scaleFactor;
            ctx.strokeStyle = isSolid ? 'black' : mainColor; 
            if (mainColor === '#000000' && !isSolid) ctx.strokeStyle = 'black'; 
            
            ctx.strokeRect(buttonX, buttonY, buttonWidth, buttonHeight);

            ctx.fillStyle = isSolid ? (mainColor === '#000000' ? 'white' : 'black') : mainColor;
            ctx.textBaseline = 'middle';
            ctx.fillText(ctaText, btnCenterX, btnCenterY + (2 * scaleFactor));
        }

        try {
            const link = document.createElement('a');
            link.download = `magic-poster-${format.id.replace(':','-')}-${Date.now()}.png`;
            link.href = canvas.toDataURL('image/png');
            document.body.appendChild(link); 
            link.click();
            document.body.removeChild(link);
        } catch (e) {
            console.error("Canvas export failed:", e);
            alert("Security Error: Could not export image. This usually happens with remote demo images due to browser security restrictions. Try capturing a new photo with the camera!");
        }
    };

    img.onerror = () => {
        console.error("Failed to load image for canvas");
        alert("Failed to load image resource.");
    };
  };

  // -- Voice Control Logic --
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

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
          if (!isOpenRef.current) return; 

          const hasKey = await ensureApiKey();
          if (!hasKey || !isOpenRef.current) return;
    
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          if (!isOpenRef.current) {
            stream.getTracks().forEach(t => t.stop());
            return;
          }
          streamRef.current = stream;
          
          audioContextRef.current = new AudioContext({ sampleRate: 16000 });
          sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
          processorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);
          
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          
          const sessionPromise = ai.live.connect({
            model: 'gemini-2.5-flash-native-audio-preview-12-25',
            callbacks: {
              onopen: () => {
                console.log("Studio Voice Active");
                if (isOpenRef.current) setIsListening(true);
              },
              onmessage: async (message: LiveServerMessage) => {
                 if (message.toolCall) {
                    const responses = [];
                    for (const fc of message.toolCall.functionCalls) {
                       let result = { success: true };
                       
                       if (fc.name === 'changeVibe') {
                          const vibe = SETTINGS.find(s => s.id === (fc.args.vibeId as string));
                          if (vibe) setSelectedSettings([vibe]); 
                       } else if (fc.name === 'changeHuman') {
                          const human = HUMAN_OPTIONS.find(h => h.id === (fc.args.humanId as string));
                          if (human) setSelectedHumans([human]);
                       } else if (fc.name === 'changeProductState') {
                          const state = PRODUCT_STATES.find(p => p.id === (fc.args.stateId as string));
                          if (state) setSelectedProductStates([state]);
                       } else if (fc.name === 'changeAngle') {
                          const angle = ANGLES.find(a => a.id === (fc.args.angleId as string));
                          if (angle) setSelectedAngles([angle]);
                       } else if (fc.name === 'changeFormat') {
                          const format = FORMATS.find(f => f.id === (fc.args.formatId as string));
                          if (format) setSelectedFormat(format);
                       } else if (fc.name === 'triggerAction') {
                          const action = fc.args.action as string;
                          setLastCommand(action);
                          if (action === 'generate') handleGenerate();
                          if (action === 'close') onClose();
                          if (action === 'download') handleDownloadPoster();
                          if (action === 'poster_mode' || action === 'editorial_mode') setMode('poster');
                          if (action === 'remix_mode') setMode('remix');
                          if (action === 'ab_test_mode') setMode('ab');
                          if (action === 'agent_mode') setMode('agent');
                       }
    
                       responses.push({
                          id: fc.id,
                          name: fc.name,
                          response: { result }
                       });
                    }
                    
                    sessionPromise.then(session => {
                       session.sendToolResponse({ functionResponses: responses });
                    });
                 }
              },
              onclose: () => setIsListening(false),
              onerror: (e) => console.error(e)
            },
            config: {
              responseModalities: [Modality.AUDIO],
              tools: [
                { functionDeclarations: [changeVibeTool, changeHumanTool, changeProductStateTool, changeAngleTool, changeFormatTool, triggerActionTool] }
              ],
              systemInstruction: `
                You are a creative studio assistant. 
                User commands will control the UI.
                If user says "Make it marble", call changeVibe(marble).
                If user says "No people" or "Just product", call changeHuman(none).
                If user says "Add a model" or "Person", call changeHuman(full).
                If user says "Levitate it" or "Float", call changeProductState(levitate).
                If user says "Splash", call changeProductState(splash).
                If user says "Top down" or "Dutch" or "Wide", call changeAngle(angleId).
                If user says "Generate", "Go" or "Remix", call triggerAction(generate).
                Be concise.
              `
            }
          });
    
          liveSessionRef.current = sessionPromise;
    
          processorRef.current.onaudioprocess = (e) => {
            if (isGeneratingRef.current || isRunningABRef.current) {
                setAudioVolume(0);
                return;
            }

            const inputData = e.inputBuffer.getChannelData(0);
            let sum = 0;
            for (let i = 0; i < inputData.length; i++) sum += inputData[i] * inputData[i];
            setAudioVolume(Math.sqrt(sum / inputData.length));
    
            const base64Audio = base64EncodeAudio(inputData);
            sessionPromise.then(session => {
                session.sendRealtimeInput({
                    media: {
                        mimeType: 'audio/pcm;rate=' + audioContextRef.current?.sampleRate,
                        data: base64Audio
                    }
                });
            });
          };
    
          sourceRef.current.connect(processorRef.current);
          processorRef.current.connect(audioContextRef.current.destination);
    
        } catch (e) {
          console.error("Studio Voice Error", e);
        }
    };

    const stopLiveSession = () => {
        if (processorRef.current) {
            processorRef.current.disconnect();
            processorRef.current.onaudioprocess = null;
        }
        if (sourceRef.current) sourceRef.current.disconnect();
        if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') audioContextRef.current.close();
        
        if (liveSessionRef.current) {
            liveSessionRef.current.then((s: any) => s.close()).catch(() => {});
            liveSessionRef.current = null;
        }
        setIsListening(false);
    };

    if (isOpen && isMicEnabled) {
      timeoutId = setTimeout(() => {
        startLiveSession();
      }, 500);
    } else {
      stopLiveSession();
    }
    
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      stopLiveSession();
    };
  }, [isOpen, isMicEnabled]); 

  if (!isOpen || !mounted) return null;

  const currentImage = generatedVariants[selectedVariantIndex];
  const batchCount = selectedSettings.length * selectedHumans.length * selectedProductStates.length * selectedAngles.length;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex bg-paper">
      <canvas ref={canvasRef} className="hidden" />
      
      {/* Hidden File Input for Image Upload - Available Everywhere */}
      <input 
          type="file" 
          ref={sourceFileInputRef}
          onChange={handleSourceUpload}
          accept="image/*"
          className="hidden"
      />
      
      {/* LEFT SIDEBAR - CONTROLS */}
      <div className="w-80 md:w-96 bg-white border-r-4 border-black flex flex-col h-full relative z-10">
         <div className="p-6 border-b-4 border-black bg-electric text-white shrink-0">
            <div className="flex justify-between items-start mb-4">
                <h2 className="font-display font-black text-4xl uppercase leading-none">Remix<br/>Studio</h2>
                <button onClick={onClose} className="p-2 hover:bg-black/20 rounded-full transition-colors">
                    <X className="w-6 h-6" />
                </button>
            </div>
            
            {/* Voice Status */}
            <div className="flex items-center justify-between bg-black/20 p-2 rounded-lg backdrop-blur-sm border border-white/20">
                <div className="flex items-center gap-2">
                    {isMicEnabled ? (
                        <div className={`w-3 h-3 rounded-full ${isListening ? 'bg-green-400 animate-pulse' : 'bg-gray-400'}`}></div>
                    ) : (
                        <MicOff className="w-4 h-4 text-white/50" />
                    )}
                    <span className="font-mono text-xs font-bold uppercase">{isListening ? "VOICE ACTIVE" : "VOICE PAUSED"}</span>
                </div>
                <button onClick={() => setIsMicEnabled(!isMicEnabled)} className="hover:text-highlighter transition-colors">
                    <Mic className="w-4 h-4" />
                </button>
            </div>
            {isListening && (
                 <div className="h-1 bg-highlighter mt-2 transition-all duration-75" style={{ width: Math.min(100, audioVolume * 1000) + '%' }}></div>
            )}
         </div>

         {/* Scrollable Content */}
         <div className="flex-1 overflow-y-auto no-scrollbar p-6 space-y-8">
            {/* AGENT MENU - Always visible if mode is Agent */}
            {mode === 'agent' && (
                <div className="space-y-4">
                   <h3 className="font-display font-bold text-xl uppercase flex items-center gap-2">
                      <Bot className="w-5 h-5" /> Research Ops
                   </h3>
                   
                   {/* RUN ALL BUTTON */}
                   <button 
                       onClick={handleRunAllAgents}
                       disabled={isAgentRunning !== null}
                       className="w-full py-4 bg-electric text-white border-4 border-black font-display font-black text-xl uppercase tracking-widest sticker-shadow hover:translate-y-1 hover:shadow-none transition-all flex items-center justify-center gap-2 mb-6 disabled:opacity-50 disabled:cursor-not-allowed group"
                   >
                       {isAgentRunning ? (
                           <>
                             <RefreshCw className="w-6 h-6 animate-spin" /> RUNNING...
                           </>
                       ) : (
                           <>
                             <PlayCircle className="w-6 h-6" /> RUN FULL CAMPAIGN
                           </>
                       )}
                   </button>

                   <div className="space-y-2">
                      {[
                        { key: 'persona', label: '1. Persona & Resonance', icon: UserCircle2 },
                        { key: 'creative', label: '2. Creative Brief', icon: Sparkles },
                        { key: 'copy', label: '3. Copy Kit', icon: FileText },
                        { key: 'targeting', label: '4. Targeting', icon: Target },
                        { key: 'safety', label: '5. Brand Safety', icon: ShieldCheck },
                      ].map((item) => (
                        <button
                           key={item.key}
                           onClick={() => handleRunAgent(item.key as keyof AgentReport)}
                           disabled={isAgentRunning !== null}
                           className={`
                              w-full text-left px-4 py-3 border-2 transition-all font-mono text-xs font-bold uppercase flex items-center gap-3
                              ${agentReports[item.key as keyof AgentReport] 
                                ? 'bg-green-50 border-green-500 text-green-700' 
                                : isAgentRunning === item.key
                                    ? 'bg-electric text-white border-black animate-pulse'
                                    : 'bg-white border-black hover:bg-gray-50'
                              }
                              ${isAgentRunning && isAgentRunning !== item.key ? 'opacity-50 cursor-not-allowed' : ''}
                           `}
                        >
                            <item.icon className="w-4 h-4" />
                            {item.label}
                            {agentReports[item.key as keyof AgentReport] && <Check className="w-4 h-4 ml-auto" />}
                        </button>
                      ))}
                   </div>
                   
                   {Object.keys(agentReports).length > 0 && (
                       <button
                           onClick={handleDownloadFullCampaign}
                           className="w-full mt-4 flex items-center justify-center gap-2 bg-white border-2 border-black p-2 font-mono text-xs font-bold uppercase hover:bg-black hover:text-white transition-colors"
                       >
                           <FileDown className="w-4 h-4" /> Download Full Strategy
                       </button>
                   )}

                   <div className="text-[10px] font-mono text-gray-400 p-2 border border-dashed border-gray-300 mt-4">
                      Powered by <strong>Gemini 3 Pro + Deep Research</strong>
                   </div>
                </div>
            )}

            {/* VIBE SELECTOR - Hidden in Agent Mode */}
            {mode !== 'agent' && (
             <div className={mode === 'ab' ? 'opacity-50 pointer-events-none' : ''}>
                
                {/* FORMAT SELECTOR (NEW) */}
                <div className="mb-6 pb-6 border-b-2 border-dashed border-gray-300">
                    <div className="flex items-center justify-between mb-3">
                        <label className="flex items-center gap-2 font-mono text-xs font-bold uppercase text-gray-500">
                            <Layers className="w-4 h-4" /> Canvas Format
                        </label>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        {FORMATS.map(f => (
                            <button
                                key={f.id}
                                onClick={() => setSelectedFormat(f)}
                                className={`
                                    px-2 py-2 border-2 transition-all font-mono text-[10px] font-bold uppercase flex items-center justify-center gap-2
                                    ${selectedFormat.id === f.id ? 'bg-black text-white border-black sticker-shadow' : 'bg-white text-gray-500 border-gray-200 hover:border-black'}
                                `}
                            >
                                <f.icon className="w-4 h-4" /> {f.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex items-center justify-between mb-3">
                    <label className="flex items-center gap-2 font-mono text-xs font-bold uppercase text-gray-500">
                        <Zap className="w-4 h-4" /> Vibe Setting
                    </label>
                    <div className="relative group cursor-help">
                        <HelpCircle className="w-4 h-4 text-gray-400" />
                    </div>
                </div>
                <div className="grid grid-cols-1 gap-2">
                    {SETTINGS.map(s => {
                        const isSelected = selectedSettings.some(sel => sel.id === s.id);
                        return (
                            <button
                              key={s.id}
                              onClick={() => toggleSetting(s)}
                              onMouseEnter={() => setHoveredInfo(s.prompt)}
                              onMouseLeave={() => setHoveredInfo(null)}
                              className={`
                                relative overflow-hidden
                                text-left px-4 py-3 border-2 transition-all font-display uppercase tracking-wide flex justify-between items-center group
                                ${isSelected ? 'bg-black text-white border-black scale-105 sticker-shadow z-10' : 'bg-white text-gray-500 border-gray-200 hover:border-black hover:text-black'}
                                ${s.id === 'bananas' ? 'border-yellow-400 hover:border-yellow-500' : ''}
                                ${s.id === 'custom' ? 'border-dashed' : ''}
                              `}
                            >
                                <span className="relative z-10 flex items-center gap-2">
                                    {isSelected && <CheckCircle2 className="w-4 h-4 text-highlighter" />}
                                    {s.label}
                                </span>
                                {s.id === 'custom' && <PenTool className="w-4 h-4 absolute right-4 opacity-50" />}
                            </button>
                        );
                    })}
                </div>

                {/* CUSTOM STUDIO PANEL */}
                {selectedSettings.some(s => s.id === 'custom') && (
                    <div className="mt-4 border-l-4 border-dashed border-black pl-4 py-2 animate-pop-in">
                        <div className="space-y-3">
                            <div>
                                <label className="block font-mono text-[10px] font-bold uppercase text-gray-400 mb-1">Describe Scene</label>
                                <textarea 
                                    value={customPrompt}
                                    onChange={(e) => setCustomPrompt(e.target.value)}
                                    placeholder="e.g. On the surface of Mars, red dust..."
                                    className="w-full bg-gray-100 border-2 border-black p-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-electric"
                                    rows={2}
                                />
                            </div>
                            <div>
                                <label className="block font-mono text-[10px] font-bold uppercase text-gray-400 mb-1">Ref Background (Optional)</label>
                                <div className="relative">
                                    <input 
                                        type="file" 
                                        ref={fileInputRef}
                                        onChange={handleBgUpload}
                                        accept="image/*"
                                        className="hidden"
                                    />
                                    <button 
                                        onClick={() => fileInputRef.current?.click()}
                                        className="w-full bg-white border-2 border-black border-dashed py-2 flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors"
                                    >
                                        <Upload className="w-3 h-3" />
                                        <span className="font-mono text-xs font-bold uppercase">{customBgImage ? "Change Image" : "Upload Image"}</span>
                                    </button>
                                </div>
                                {customBgImage && (
                                    <div className="mt-2 relative w-full h-20 border-2 border-black bg-gray-100">
                                        <img src={customBgImage} className="w-full h-full object-cover" alt="Preview" />
                                        <button 
                                            onClick={() => setCustomBgImage(null)} 
                                            className="absolute top-1 right-1 bg-white border border-black p-1 hover:bg-red-500 hover:text-white"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
            )}

            {/* HUMAN CONTEXT SELECTOR */}
            {mode !== 'agent' && (
            <div className={mode === 'ab' ? 'opacity-50 pointer-events-none' : ''}>
                <div className="flex items-center justify-between mb-3 mt-4">
                    <label className="flex items-center gap-2 font-mono text-xs font-bold uppercase text-gray-500">
                        <User className="w-4 h-4" /> Human Context
                    </label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    {HUMAN_OPTIONS.map(h => {
                        const isSelected = selectedHumans.some(sel => sel.id === h.id);
                        return (
                            <button
                              key={h.id}
                              onClick={() => toggleHuman(h)}
                              onMouseEnter={() => setHoveredInfo(h.prompt)}
                              onMouseLeave={() => setHoveredInfo(null)}
                              className={`
                                relative overflow-hidden
                                px-2 py-2 border-2 transition-all font-mono text-xs font-bold uppercase flex items-center justify-center gap-1 group
                                ${isSelected ? 'bg-electric text-white border-black sticker-shadow z-10' : 'bg-white text-gray-500 border-gray-200 hover:border-black hover:text-black'}
                              `}
                            >
                                <h.icon className={`w-3 h-3 ${isSelected ? 'text-white' : 'text-gray-400 group-hover:text-black'}`} />
                                <span className="relative z-10">{h.label}</span>
                                {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                            </button>
                        );
                    })}
                </div>
            </div>
            )}

            {/* PRODUCT STATE SELECTOR */}
            {mode !== 'agent' && (
            <div className={mode === 'ab' ? 'opacity-50 pointer-events-none' : ''}>
                <div className="flex items-center justify-between mb-3 mt-4">
                    <label className="flex items-center gap-2 font-mono text-xs font-bold uppercase text-gray-500">
                        <Box className="w-4 h-4" /> Product State
                    </label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    {PRODUCT_STATES.map(p => {
                        const isSelected = selectedProductStates.some(sel => sel.id === p.id);
                        return (
                            <button
                              key={p.id}
                              onClick={() => toggleProductState(p)}
                              onMouseEnter={() => setHoveredInfo(p.prompt)}
                              onMouseLeave={() => setHoveredInfo(null)}
                              className={`
                                relative overflow-hidden
                                px-2 py-2 border-2 transition-all font-mono text-xs font-bold uppercase flex items-center justify-center gap-1 group
                                ${isSelected ? 'bg-black text-white border-black sticker-shadow z-10' : 'bg-white text-gray-500 border-gray-200 hover:border-black hover:text-black'}
                              `}
                            >
                                <p.icon className={`w-3 h-3 ${isSelected ? 'text-white' : 'text-gray-400 group-hover:text-black'}`} />
                                <span className="relative z-10">{p.label}</span>
                                {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                            </button>
                        );
                    })}
                </div>
            </div>
            )}

            {/* ANGLE SELECTOR - Hidden in Agent Mode */}
            {mode !== 'agent' && (
            <div className={mode === 'ab' ? 'opacity-50 pointer-events-none' : ''}>
                <div className="flex items-center justify-between mb-3 mt-4">
                    <label className="flex items-center gap-2 font-mono text-xs font-bold uppercase text-gray-500">
                        <Layers className="w-4 h-4" /> Camera Angle
                    </label>
                    <div className="relative group cursor-help">
                        <HelpCircle className="w-4 h-4 text-gray-400" />
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    {ANGLES.map(a => {
                        const isSelected = selectedAngles.some(sel => sel.id === a.id);
                        return (
                            <button
                              key={a.id}
                              onClick={() => toggleAngle(a)}
                              onMouseEnter={() => setHoveredInfo(a.prompt)}
                              onMouseLeave={() => setHoveredInfo(null)}
                              className={`
                                relative overflow-hidden
                                px-2 py-2 border-2 transition-all font-mono text-xs font-bold uppercase flex items-center justify-center gap-1 group
                                ${isSelected ? 'bg-hotpink text-white border-black sticker-shadow z-10' : 'bg-white text-gray-500 border-gray-200 hover:border-black hover:text-black'}
                              `}
                            >
                                <span className="relative z-10">{a.label}</span>
                                {isSelected && <div className="w-2 h-2 bg-white rounded-full"></div>}
                            </button>
                        );
                    })}
                </div>
            </div>
            )}
            
            {mode !== 'agent' && (
            <div className="space-y-4 mt-6">
                <button 
                    onClick={handleGenerate}
                    disabled={isGenerating || mode === 'ab'}
                    className={`
                        w-full py-4 bg-highlighter border-2 border-black font-display font-black text-2xl uppercase tracking-widest sticker-shadow hover:translate-y-1 hover:shadow-none transition-all flex items-center justify-center gap-2
                        ${(isGenerating || mode === 'ab') ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                >
                    {isGenerating ? <RefreshCw className="w-6 h-6 animate-spin" /> : <><Zap className="w-6 h-6" /> {batchCount > 1 ? `BATCH REMIX (${batchCount})` : 'REMIX IT'}</>}
                </button>
            </div>
            )}
         </div>

         {/* Info Deck / Footer - New Sticky Area */}
         <div className="p-4 border-t-4 border-black bg-black text-white shrink-0">
             <div className="flex items-start gap-3 min-h-[3rem]">
                 <Info className="w-5 h-5 text-highlighter shrink-0 mt-0.5" />
                 <div className="flex-1">
                     {hoveredInfo ? (
                         <p className="font-mono text-xs leading-relaxed animate-pop-in text-highlighter">
                             {hoveredInfo}
                         </p>
                     ) : (
                         <p className="font-mono text-xs leading-relaxed text-gray-500">
                             Hover over options to see details. <br/>
                             Use voice commands to select.
                         </p>
                     )}
                 </div>
             </div>
             
             {/* BACK TO CAMERA BUTTON */}
             <button 
                onClick={onClose}
                className="w-full mt-4 py-2 bg-white text-black border-2 border-transparent font-mono text-xs font-bold uppercase hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
            >
                <ArrowLeft className="w-4 h-4" /> Back to Mirror
            </button>
         </div>
      </div>

      {/* RIGHT PREVIEW AREA */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-gray-50 relative pattern-grid-lg">
         
         {/* Top Tabs */}
         <div className="flex border-b-2 border-black bg-white">
            <button 
                onClick={() => setMode('agent')}
                className={`flex-1 py-4 flex items-center justify-center gap-2 font-display font-bold text-lg uppercase tracking-wide border-r-2 border-black transition-colors ${mode === 'agent' ? 'bg-black text-white' : 'hover:bg-gray-100'}`}
            >
                <Bot className="w-5 h-5" /> Brand Agent
            </button>
            <button 
                onClick={() => setMode('remix')}
                className={`flex-1 py-4 flex items-center justify-center gap-2 font-display font-bold text-lg uppercase tracking-wide border-r-2 border-black transition-colors ${mode === 'remix' ? 'bg-highlighter' : 'hover:bg-gray-100'}`}
            >
                <LayoutGrid className="w-5 h-5" /> Remixes
            </button>
            <button 
                onClick={() => setMode('ab')}
                className={`flex-1 py-4 flex items-center justify-center gap-2 font-display font-bold text-lg uppercase tracking-wide border-r-2 border-black transition-colors ${mode === 'ab' ? 'bg-electric text-white' : 'hover:bg-gray-100'}`}
            >
                <Split className="w-5 h-5" /> A/B Lab
            </button>
            <button 
                onClick={() => setMode('poster')}
                className={`flex-1 py-4 flex items-center justify-center gap-2 font-display font-bold text-lg uppercase tracking-wide transition-colors ${mode === 'poster' ? 'bg-hotpink text-white' : 'hover:bg-gray-100'}`}
            >
                <TypeIcon className="w-5 h-5" /> Poster
            </button>
         </div>

         {/* Content Area */}
         <div className="flex-1 p-8 overflow-y-auto">
            
            {/* AGENT MODE */}
            {mode === 'agent' && (
               <div className="max-w-4xl mx-auto w-full h-full flex flex-col">
                  {!originalImage && !generatedVariants[0] ? (
                       <div className="flex items-center justify-center h-full opacity-50 font-mono text-center">
                          <p>No source image selected. <br/> Please capture a photo first.</p>
                       </div>
                  ) : (
                      <>
                        <div className="flex items-center gap-4 mb-8">
                             <div className="w-20 h-20 border-2 border-black p-1 bg-white rotate-[-2deg] sticker-shadow">
                                <img src={generatedVariants[selectedVariantIndex] || originalImage!} className="w-full h-full object-cover" alt="Subject" />
                             </div>
                             <div>
                                <h2 className="font-display font-black text-4xl uppercase leading-none">Campaign<br/>Intelligence</h2>
                                <p className="font-mono text-sm text-gray-500 mt-1">Autonomous Deep Research Agent</p>
                             </div>
                        </div>

                        <div className="grid grid-cols-1 gap-8 pb-20">
                           {/* Loop through steps to display reports */}
                           {[
                             { id: 'persona', title: 'Persona Brief', desc: 'Demographic & Psychographic Analysis' },
                             { id: 'creative', title: 'Creative Direction', desc: 'Visual Narrative & Scene Setting' },
                             { id: 'copy', title: 'Copywriting Kit', desc: 'Headlines & Authentic Voice' },
                             { id: 'targeting', title: 'Distribution Blueprint', desc: 'Influencers, Hashtags & Communities' },
                             { id: 'safety', title: 'Brand Safety Check', desc: 'Inclusivity & Bias Analysis' },
                           ].map((step) => {
                               const report = agentReports[step.id as keyof AgentReport];
                               const isRunning = isAgentRunning === step.id;

                               if (!report && !isRunning) return null;

                               return (
                                   <div key={step.id} className="bg-white border-2 border-black sticker-shadow animate-pop-in flex flex-col">
                                       {/* Header Toolbar */}
                                       <div className={`p-4 border-b-2 border-black flex items-center justify-between ${isRunning ? 'bg-electric text-white' : 'bg-gray-50'}`}>
                                           <div>
                                               <h3 className="font-display font-bold text-xl uppercase">{step.title}</h3>
                                               <p className={`font-mono text-xs uppercase ${isRunning ? 'text-white/80' : 'text-gray-500'}`}>{step.desc}</p>
                                           </div>
                                           {isRunning ? (
                                              <RefreshCw className="w-5 h-5 animate-spin" />
                                           ) : (
                                              <div className="flex items-center gap-2">
                                                  {/* APPLY ACTIONS FOR SPECIFIC STEPS */}
                                                  {step.id === 'creative' && (
                                                      <div className="relative group mr-2">
                                                          <button 
                                                            onClick={() => handleApplyCreative(report || "")}
                                                            className="flex items-center gap-2 bg-electric text-white px-4 py-2 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] font-display font-bold text-sm uppercase hover:translate-y-1 hover:shadow-none transition-all"
                                                          >
                                                              <Zap className="w-4 h-4" /> Use as Vibe
                                                          </button>
                                                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-48 bg-black text-white text-[10px] font-mono p-2 text-center hidden group-hover:block z-50 border-2 border-white pointer-events-none">
                                                              AUTO-TRANSFER: Applies this generated visual description to the Remix Studio settings.
                                                              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-black rotate-45 border-b-2 border-r-2 border-white"></div>
                                                          </div>
                                                      </div>
                                                  )}

                                                  {step.id === 'copy' && (
                                                      <div className="relative group mr-2">
                                                          <button 
                                                            onClick={() => handleApplyCopy(report || "")}
                                                            className="flex items-center gap-2 bg-hotpink text-white px-4 py-2 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] font-display font-bold text-sm uppercase hover:translate-y-1 hover:shadow-none transition-all"
                                                          >
                                                              <TypeIcon className="w-4 h-4" /> Apply to Poster
                                                          </button>
                                                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-48 bg-black text-white text-[10px] font-mono p-2 text-center hidden group-hover:block z-50 border-2 border-white pointer-events-none">
                                                              AUTO-FILL: Extracts headlines and CTA from this report and applies them to the Poster Editor.
                                                              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-black rotate-45 border-b-2 border-r-2 border-white"></div>
                                                          </div>
                                                      </div>
                                                  )}

                                                  {/* COPY BUTTON */}
                                                  <button 
                                                    onClick={() => handleCopy(report || "", step.id)}
                                                    className="p-2 hover:bg-black/10 rounded transition-colors group relative"
                                                    title="Copy Text"
                                                  >
                                                      {copiedState === step.id ? <CheckCheck className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                                                  </button>
                                                  
                                                  {/* DOWNLOAD BUTTON */}
                                                  <button 
                                                    onClick={() => handleDownloadSingle(step.title, report || "")}
                                                    className="p-2 hover:bg-black/10 rounded transition-colors"
                                                    title="Download Report"
                                                  >
                                                      <FileDown className="w-4 h-4" />
                                                  </button>
                                              </div>
                                           )}
                                       </div>
                                       
                                       {/* Content Area - Styled like a document */}
                                       <div className="p-8 bg-white font-mono text-sm leading-relaxed text-gray-800 relative">
                                           {isRunning ? (
                                               <div className="flex flex-col items-center justify-center py-8 gap-4 text-gray-500 animate-pulse">
                                                   <Search className="w-8 h-8 text-electric" /> 
                                                   <span>Agent is browsing the web for insights...</span>
                                               </div>
                                           ) : (
                                               <div className="prose prose-sm max-w-none whitespace-pre-wrap">
                                                   {report}
                                               </div>
                                           )}
                                           
                                           {/* Visual Flair for "Copyable Asset" */}
                                           {!isRunning && (
                                              <div className="absolute top-0 right-0 p-2 opacity-10 pointer-events-none">
                                                  <Clipboard className="w-12 h-12" />
                                              </div>
                                           )}
                                       </div>
                                   </div>
                               );
                           })}

                           {/* Empty State / CTA */}
                           {Object.keys(agentReports).length === 0 && !isAgentRunning && (
                               <div className="border-4 border-dashed border-gray-300 p-12 text-center rounded-xl bg-gray-50/50">
                                   <Bot className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                                   <h3 className="font-display font-bold text-2xl uppercase text-gray-400">Ready to Research</h3>
                                   <p className="font-mono text-sm text-gray-400 mt-2 mb-6">
                                       Click "Run Full Campaign" on the left to start the autonomous agent loop.
                                   </p>
                                   <button 
                                      onClick={handleRunAllAgents}
                                      className="bg-black text-white px-6 py-3 font-bold font-mono uppercase hover:bg-electric transition-colors flex items-center gap-2 mx-auto"
                                   >
                                      <PlayCircle className="w-4 h-4" /> Start Auto-Agent
                                   </button>
                               </div>
                           )}
                        </div>
                      </>
                  )}
               </div>
            )}

            {/* REMAINING SECTIONS OMITTED FOR BREVITY AS ONLY THE ABOVE WAS MODIFIED */}
            {/* GRID VIEW, AB LAB, POSTER EDITOR... */}
            {mode === 'remix' && (
                // GRID VIEW
                <div>
                     {/* BATCH DOWNLOAD HEADER */}
                     <div className="flex flex-col max-w-2xl mx-auto w-full mb-6 gap-4">
                        <div className="flex justify-between items-end">
                            <h3 className="font-display font-bold text-2xl uppercase">Session Gallery</h3>
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => sourceFileInputRef.current?.click()}
                                    className="flex items-center gap-2 bg-white border-2 border-black px-4 py-2 font-mono text-xs font-bold uppercase hover:bg-black hover:text-white transition-colors"
                                >
                                    <Upload className="w-4 h-4" /> Upload Source
                                </button>
                                <button 
                                    onClick={() => handleBatchDownload(generatedVariants, 'remix')}
                                    disabled={generatedVariants.length === 0}
                                    className="flex items-center gap-2 bg-white border-2 border-black px-4 py-2 font-mono text-xs font-bold uppercase hover:bg-black hover:text-white transition-colors disabled:opacity-50"
                                >
                                    <Download className="w-4 h-4" /> Download All ({generatedVariants.length})
                                </button>
                            </div>
                        </div>
                        
                         {/* TOOLTIP FOR SELECTION */}
                         <div className="bg-white border-2 border-black p-3 flex items-start gap-3 sticker-shadow">
                            <div className="bg-electric text-white p-1 rounded-full shrink-0 mt-0.5">
                                <Sparkles className="w-4 h-4" />
                            </div>
                            <div>
                                <h4 className="font-bold font-mono text-sm uppercase text-electric">Pro Tip</h4>
                                <p className="text-xs font-mono text-gray-600 leading-relaxed">
                                    The image with the <span className="font-bold text-electric">BLUE RECTANGLE</span> is your active <span className="font-bold">SOURCE</span>. All new remixes and experiments will be based on that specific image. Click any photo to switch sources.
                                </p>
                            </div>
                         </div>
                     </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                        {/* LOADING CARD - Appears first when generating */}
                        {isGenerating && (
                            <div className={`aspect-[${selectedFormat.aspect.replace(':','/')}] border-4 border-dashed border-black bg-gray-100 flex flex-col items-center justify-center text-center p-6 animate-pulse`}>
                                <RefreshCw className="w-12 h-12 text-black animate-spin mb-4" />
                                <h4 className="font-display font-bold text-lg uppercase">Developing...</h4>
                                {generationProgress && (
                                    <div className="w-full bg-gray-300 h-2 mt-4 rounded-full overflow-hidden">
                                        <div className="bg-hotpink h-full transition-all duration-300" style={{ width: `${(generationProgress.current / generationProgress.total) * 100}%` }}></div>
                                    </div>
                                )}
                                <p className="font-mono text-[10px] uppercase text-gray-500 mt-2">
                                    {generationProgress ? `Processing ${generationProgress.current} of ${generationProgress.total}` : 'Initializing Lab'}
                                </p>
                            </div>
                        )}

                        {generatedVariants.map((img, idx) => {
                            // Correctly identify if this is the original source image, regardless of its position in the array
                            const isOriginal = img === originalImage;
                            const isSelected = selectedVariantIndex === idx;
                            // Apply demo filters only if it is the original AND we are in demo mode
                            const applyDemoFilters = isOriginal && isDemo;

                            return (
                                <div 
                                    key={idx} 
                                    onClick={() => setSelectedVariantIndex(idx)}
                                    className={`
                                        group relative border-4 border-black bg-white cursor-pointer transition-transform hover:scale-105 hover:rotate-1 sticker-shadow
                                        ${isSelected ? 'ring-4 ring-electric ring-offset-4' : ''}
                                    `}
                                    style={{ aspectRatio: selectedFormat.aspect.replace(':','/') }}
                                >
                                    <img 
                                        src={img} 
                                        className={`w-full h-full object-cover ${applyDemoFilters ? 'grayscale brightness-75 contrast-125 blur-[0.5px]' : ''}`} 
                                        alt={`Variant ${idx}`} 
                                    />
                                    
                                    {isOriginal && (
                                        <div className="absolute top-2 left-2 bg-black text-white text-[10px] font-mono font-bold px-2 py-1 z-10 border border-white/20">
                                            ORIGINAL
                                        </div>
                                    )}

                                    {isSelected && (
                                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-electric text-white text-[10px] font-mono font-bold px-3 py-1 z-10 border border-black/20 shadow-sm whitespace-nowrap">
                                            ACTIVE SOURCE
                                        </div>
                                    )}
        
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex flex-col items-center justify-center gap-2">
                                        <button 
                                            className="opacity-0 group-hover:opacity-100 bg-white border-2 border-black px-3 py-1 font-mono text-xs font-bold uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-center gap-2 hover:bg-hotpink hover:text-white transition-colors"
                                            onClick={(e) => { e.stopPropagation(); setSelectedVariantIndex(idx); setMode('poster'); }}
                                        >
                                            <Edit3 className="w-3 h-3" /> Edit This
                                        </button>
                                        <button 
                                            className="opacity-0 group-hover:opacity-100 bg-white border-2 border-black px-3 py-1 font-mono text-xs font-bold uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-center gap-2 hover:bg-electric hover:text-white transition-colors"
                                            onClick={(e) => { e.stopPropagation(); handleDownloadSingleImage(img, 'remix'); }}
                                        >
                                            <Download className="w-3 h-3" /> Save Image
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                        
                        {/* Balanced Placeholder - Matches Screenshot */}
                        <div className="aspect-[3/4] border-4 border-dashed border-gray-300 bg-gray-50 flex flex-col items-center justify-center text-center p-6 group hover:border-gray-400 transition-colors cursor-default">
                            <div className="w-14 h-14 rounded-full bg-gray-200 border-2 border-gray-300 flex items-center justify-center group-hover:border-black group-hover:bg-white transition-all mb-4">
                                    <ArrowLeft className="w-6 h-6 text-gray-400 group-hover:text-black transition-colors" />
                            </div>
                            <h4 className="font-mono text-xs font-bold uppercase text-gray-400 group-hover:text-black leading-relaxed transition-colors">
                                Select settings on the left<br/>to generate more
                            </h4>
                        </div>
                    </div>
                </div>
            )}

            {mode === 'ab' && (
                <div className="h-full flex flex-col">
                    {abResults.length === 0 && !isRunningAB ? (
                         <div className="flex-1 flex flex-col items-center justify-center text-center max-w-lg mx-auto">
                            <Split className="w-24 h-24 mb-6 text-black" />
                            <h2 className="font-display font-black text-5xl uppercase mb-2">Split Test</h2>
                            <p className="font-serif italic text-xl text-gray-600 mb-8">
                                Compare your current selection against a market challenger. The AI will generate a variation and predict the performance winner.
                            </p>
                            
                            {/* ACTIVE SOURCE INDICATOR + UPLOAD FOR A/B */}
                            <div className="flex items-center gap-4 mb-8 bg-gray-100 p-3 rounded-lg border-2 border-black/10">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 bg-white border border-black shrink-0 overflow-hidden">
                                        <img src={generatedVariants[selectedVariantIndex] || originalImage!} className="w-full h-full object-cover" alt="Active Source" />
                                    </div>
                                    <div className="text-left">
                                        <div className="font-mono text-[10px] font-bold uppercase text-gray-400">Active Source</div>
                                        <div className="font-bold text-xs">Ready for Testing</div>
                                    </div>
                                </div>
                                <div className="h-8 w-px bg-gray-300"></div>
                                <button 
                                    onClick={() => sourceFileInputRef.current?.click()}
                                    className="text-xs font-bold font-mono uppercase text-electric hover:underline flex items-center gap-1"
                                >
                                    <Upload className="w-3 h-3" /> Change Photo
                                </button>
                            </div>
                            
                            {/* NEW: POWERED BY BADGE */}
                            <div className="bg-white border-2 border-black p-3 inline-flex items-center gap-2 mb-8 rotate-[-2deg] sticker-shadow">
                                <Bot className="w-5 h-5 text-electric" />
                                <span className="font-mono text-xs font-bold uppercase">Powered by Gemini 3 Pro + Deep Research</span>
                            </div>

                            <div className="bg-white border-4 border-black p-4 rotate-1 sticker-shadow mb-8">
                                <div className="flex items-center gap-4 text-left">
                                    <div className="bg-black text-white p-2 font-bold font-mono text-xs">CONTROL</div>
                                    <div className="font-display font-bold text-xl uppercase">{selectedSettings[0].label}</div>
                                </div>
                                <div className="border-l-2 border-black ml-4 pl-4 my-2 font-mono text-xs text-gray-400">VS</div>
                                <div className="flex items-center gap-4 text-left">
                                    <div className="bg-electric text-white p-2 font-bold font-mono text-xs">CHALLENGER</div>
                                    <div className="font-display font-bold text-xl uppercase text-gray-500">Auto-Selected</div>
                                </div>
                            </div>
                            <button 
                                onClick={handleRunABTest}
                                className="px-8 py-4 bg-electric text-white border-4 border-black font-display font-bold text-2xl uppercase tracking-widest sticker-shadow hover:translate-y-1 hover:shadow-none transition-all flex items-center gap-3"
                            >
                                <TrendingUp className="w-6 h-6" /> Run Experiment
                            </button>
                         </div>
                    ) : isRunningAB ? (
                        <div className="flex-1 flex flex-col items-center justify-center">
                            <RefreshCw className="w-16 h-16 animate-spin text-electric mb-4" />
                            {/* DYNAMIC STATUS TEXT */}
                            <h3 className="font-display text-2xl uppercase animate-pulse mb-2">{abStatus}</h3>
                            <div className="bg-white border-2 border-black px-3 py-1 font-mono text-xs">Gemini 3 Pro + Deep Research</div>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col">
                            <div className="flex justify-between items-center mb-6">
                                <div className="flex items-center gap-4">
                                    <h2 className="font-display font-bold text-3xl uppercase">Test Results</h2>
                                    {abResults.length > 0 && (
                                        <button 
                                            onClick={() => handleBatchDownload(abResults.map(r => r.image), 'ab-test')}
                                            className="flex items-center gap-2 bg-white border-2 border-black px-4 py-2 font-mono text-xs font-bold uppercase hover:bg-black hover:text-white transition-colors"
                                        >
                                            <Download className="w-4 h-4" /> Save Results
                                        </button>
                                    )}
                                </div>
                                <button 
                                    onClick={() => setAbResults([])}
                                    className="text-xs font-mono font-bold underline hover:text-red-500"
                                >
                                    CLEAR & RESTART
                                </button>
                            </div>
                            
                            <div className="flex-1 flex gap-4 md:gap-8 overflow-hidden">
                                {abResults.map((res) => {
                                    const isWinner = res.stats.score >= Math.max(...abResults.map(r => r.stats.score));
                                    return (
                                        <div key={res.id} className={`flex-1 flex flex-col bg-white border-4 ${isWinner ? 'border-highlighter z-10' : 'border-black'} sticker-shadow`}>
                                            <div className="relative aspect-square border-b-4 border-black overflow-hidden bg-gray-100 group">
                                                <img src={res.image} className="w-full h-full object-cover" alt="Result" />
                                                {isWinner && (
                                                    <div className="absolute top-4 right-4 bg-highlighter border-2 border-black px-3 py-1 font-display font-bold text-sm flex items-center gap-1 shadow-md">
                                                        <Trophy className="w-4 h-4" /> WINNER
                                                    </div>
                                                )}
                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3">
                                                     <button 
                                                        onClick={() => handlePromoteToPoster(res.image)}
                                                        className="bg-white border-2 border-black px-4 py-2 font-mono text-xs font-bold uppercase hover:bg-hotpink hover:text-white shadow-md transform hover:scale-105 transition-all"
                                                     >
                                                        Use This Asset
                                                     </button>
                                                     <button 
                                                        onClick={() => handleDownloadSingleImage(res.image, `ab-${res.id}`)}
                                                        className="bg-white border-2 border-black px-4 py-2 font-mono text-xs font-bold uppercase hover:bg-electric hover:text-white shadow-md transform hover:scale-105 transition-all flex items-center gap-2"
                                                     >
                                                        <Download className="w-3 h-3" /> Download
                                                     </button>
                                                </div>
                                            </div>
                                            
                                            <div className="p-4 flex-1 flex flex-col">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className={`font-mono text-xs font-bold px-2 py-0.5 ${res.id === 'A' ? 'bg-black text-white' : 'bg-electric text-white'}`}>
                                                        VARIANT {res.id}
                                                    </span>
                                                    <span className="font-mono text-xs text-gray-500">{res.settingName}</span>
                                                </div>
                                                
                                                <div className="space-y-4 mt-2">
                                                    <div>
                                                        <div className="flex justify-between text-xs font-bold font-mono mb-1">
                                                            <span>PREDICTED CTR</span>
                                                            <span>{res.stats.ctr}%</span>
                                                        </div>
                                                        <div className="w-full h-3 bg-gray-200 border border-black rounded-full overflow-hidden">
                                                            <div className="h-full bg-hotpink" style={{ width: `${(res.stats.ctr / 5) * 100}%` }}></div>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <div className="flex justify-between text-xs font-bold font-mono mb-1">
                                                            <span>ENGAGEMENT SCORE</span>
                                                            <span>{res.stats.score}/100</span>
                                                        </div>
                                                        <div className="w-full h-3 bg-gray-200 border border-black rounded-full overflow-hidden">
                                                            <div className="h-full bg-electric" style={{ width: `${res.stats.score}%` }}></div>
                                                        </div>
                                                    </div>
                                                </div>
                                                
                                                <div className="mt-auto pt-4 border-t-2 border-dashed border-gray-200 grid grid-cols-2 gap-2 text-center">
                                                    <div>
                                                        <div className="text-gray-400 text-[10px] font-mono uppercase">Impressions</div>
                                                        <div className="font-display font-bold text-lg">{res.stats.impressions}</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-gray-400 text-[10px] font-mono uppercase">Conv. Rate</div>
                                                        <div className="font-display font-bold text-lg">{(res.stats.ctr * 0.4).toFixed(1)}%</div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {mode === 'poster' && (
                // EDITORIAL VIEW (RENAMED TO POSTER)
                <div className="flex flex-col h-full gap-6">
                    <div className="flex flex-col md:flex-row gap-8 flex-1 items-start justify-center min-h-0">
                        {/* Poster Preview */}
                        <div 
                           className="relative h-full max-h-[60vh] bg-white border-4 border-black sticker-shadow overflow-hidden group shrink-0 mx-auto md:mx-0"
                           style={{ containerType: 'inline-size', aspectRatio: selectedFormat.aspect.replace(':','/') }}
                        >
                            {currentImage ? (
                                <>
                                    <img 
                                        src={currentImage} 
                                        className={`w-full h-full object-cover object-center ${currentImage === originalImage && isDemo ? 'grayscale brightness-75 contrast-125 blur-[0.5px]' : ''}`} 
                                        alt="Active" 
                                    />
                                    {/* Overlay Text - Positioned absolutely to match Canvas */}
                                    <h1 
                                        className="absolute w-full px-6 text-center uppercase drop-shadow-[4px_4px_0px_rgba(0,0,0,1)] leading-none break-words pointer-events-none"
                                        style={{ 
                                            left: `${posterConfig.headlineX}%`,
                                            top: `${posterConfig.headlineY}%`,
                                            transform: 'translate(-50%, -50%)',
                                            fontSize: `${11.1 * posterConfig.headlineScale}cqw`,
                                            fontFamily: POSTER_FONTS.find(f => f.id === posterConfig.fontId)?.family,
                                            fontWeight: POSTER_FONTS.find(f => f.id === posterConfig.fontId)?.weight,
                                            color: posterConfig.headlineColor
                                        }}
                                    >
                                        {adText.headline}
                                    </h1>
                                    
                                    {/* Canvas: CTA */}
                                    {adText.cta.trim() && (
                                    <div 
                                        className="absolute flex justify-center pointer-events-none"
                                        style={{
                                            left: `${posterConfig.ctaX}%`,
                                            top: `${posterConfig.ctaY}%`,
                                            transform: 'translate(-50%, -50%)',
                                            width: 'auto'
                                        }}
                                    >
                                        <button 
                                           className={`
                                              border-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] font-bold font-mono
                                              ${posterConfig.ctaVariant === 'outline' ? 'bg-white/90' : ''}
                                           `}
                                           style={{ 
                                               fontSize: `${4.1 * posterConfig.ctaScale}cqw`,
                                               padding: `${2.3 * posterConfig.ctaScale}cqw ${5.5 * posterConfig.ctaScale}cqw`,
                                               backgroundColor: posterConfig.ctaVariant === 'solid' ? posterConfig.ctaColor : undefined,
                                               borderColor: posterConfig.ctaVariant === 'solid' ? 'black' : posterConfig.ctaColor,
                                               color: posterConfig.ctaVariant === 'solid' 
                                                  ? (posterConfig.ctaColor === '#000000' ? 'white' : 'black')
                                                  : posterConfig.ctaColor
                                           }}
                                        >
                                            {adText.cta}
                                        </button>
                                    </div>
                                    )}
                                </>
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center bg-gray-100 text-gray-400">
                                    <ImageIcon className="w-12 h-12 mb-2" />
                                    <span className="font-mono text-sm uppercase">No Image Selected</span>
                                </div>
                            )}
                        </div>

                        {/* Editor Controls */}
                        <div className="w-full md:w-80 bg-white border-2 border-black p-6 sticker-shadow space-y-6 overflow-y-auto max-h-[60vh]">
                            {/* Headline Controls */}
                            <div>
                                <label className="block font-mono text-xs font-bold uppercase text-gray-500 mb-1 flex items-center gap-2">
                                    <TypeIcon className="w-3 h-3" /> Headline
                                </label>
                                <input 
                                    type="text" 
                                    value={adText.headline}
                                    onChange={(e) => setAdText({...adText, headline: e.target.value})}
                                    className="w-full border-2 border-black p-2 font-display font-bold uppercase text-xl focus:outline-none focus:bg-gray-50 mb-2"
                                />
                                
                                {/* Font Selector */}
                                <div className="grid grid-cols-2 gap-2 mb-2">
                                    {POSTER_FONTS.map(font => (
                                        <button
                                            key={font.id}
                                            onClick={() => setPosterConfig(prev => ({ ...prev, fontId: font.id }))}
                                            className={`
                                                px-2 py-1 text-xs border-2 transition-all
                                                ${posterConfig.fontId === font.id ? 'bg-black text-white border-black' : 'bg-white text-gray-500 border-gray-200 hover:border-black'}
                                            `}
                                            style={{ fontFamily: font.family }}
                                        >
                                            {font.label}
                                        </button>
                                    ))}
                                </div>

                                {/* Headline Color Picker */}
                                <div className="flex gap-2 mb-3">
                                    {CTA_COLORS.map(color => (
                                        <button
                                            key={color.id}
                                            onClick={() => setPosterConfig(prev => ({ ...prev, headlineColor: color.hex }))}
                                            className={`w-6 h-6 rounded-full border-2 border-black transition-transform hover:scale-110 ${posterConfig.headlineColor === color.hex ? 'ring-2 ring-offset-2 ring-black' : ''}`}
                                            style={{ backgroundColor: color.hex }}
                                            title={color.label}
                                        />
                                    ))}
                                </div>

                                {/* Scale Slider */}
                                <div className="flex items-center gap-3 mb-2">
                                    <button onClick={() => setPosterConfig(prev => ({...prev, headlineScale: Math.max(0.5, prev.headlineScale - 0.1)}))} className="p-1 border hover:bg-gray-100 rounded"><Minus className="w-3 h-3"/></button>
                                    <input type="range" min="0.5" max="1.5" step="0.1" value={posterConfig.headlineScale} onChange={(e) => setPosterConfig(prev => ({...prev, headlineScale: parseFloat(e.target.value)}))} className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-black" />
                                    <button onClick={() => setPosterConfig(prev => ({...prev, headlineScale: Math.min(1.5, prev.headlineScale + 0.1)}))} className="p-1 border hover:bg-gray-100 rounded"><Plus className="w-3 h-3"/></button>
                                </div>

                                {/* Position Sliders */}
                                <div className="flex items-center gap-3 mb-1">
                                    <MoveHorizontal className="w-3 h-3 text-gray-400" />
                                    <input type="range" min="0" max="100" step="1" value={posterConfig.headlineX} onChange={(e) => setPosterConfig(prev => ({...prev, headlineX: parseInt(e.target.value)}))} className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-black" />
                                </div>
                                <div className="flex items-center gap-3">
                                    <MoveVertical className="w-3 h-3 text-gray-400" />
                                    <input type="range" min="0" max="100" step="1" value={posterConfig.headlineY} onChange={(e) => setPosterConfig(prev => ({...prev, headlineY: parseInt(e.target.value)}))} className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-black" />
                                </div>
                            </div>

                            {/* CTA Controls */}
                            <div className="pt-4 border-t-2 border-gray-100">
                                <label className="block font-mono text-xs font-bold uppercase text-gray-500 mb-1 flex items-center gap-2">
                                    <MousePointer2 className="w-3 h-3" /> Call to Action
                                </label>
                                <input 
                                    type="text" 
                                    value={adText.cta}
                                    onChange={(e) => setAdText({...adText, cta: e.target.value})}
                                    placeholder="(Clear to hide button)"
                                    className="w-full border-2 border-black p-2 font-mono font-bold text-sm focus:outline-none focus:bg-gray-50 mb-2"
                                />

                                {adText.cta.trim() && (
                                  <>
                                    {/* Color Picker */}
                                    <div className="flex gap-2 mb-3">
                                        {CTA_COLORS.map(color => (
                                            <button
                                                key={color.id}
                                                onClick={() => setPosterConfig(prev => ({ ...prev, ctaColor: color.hex }))}
                                                className={`w-6 h-6 rounded-full border-2 border-black transition-transform hover:scale-110 ${posterConfig.ctaColor === color.hex ? 'ring-2 ring-offset-2 ring-black' : ''}`}
                                                style={{ backgroundColor: color.hex }}
                                                title={color.label}
                                            />
                                        ))}
                                    </div>
                                    
                                    {/* Variant Toggle */}
                                    <div className="flex gap-2 mb-2">
                                        <button 
                                            onClick={() => setPosterConfig(prev => ({...prev, ctaVariant: 'solid'}))}
                                            className={`flex-1 text-[10px] uppercase font-bold py-1 border-2 ${posterConfig.ctaVariant === 'solid' ? 'bg-black text-white border-black' : 'bg-white text-gray-400 border-gray-200'}`}
                                        >Solid</button>
                                        <button 
                                            onClick={() => setPosterConfig(prev => ({...prev, ctaVariant: 'outline'}))}
                                            className={`flex-1 text-[10px] uppercase font-bold py-1 border-2 ${posterConfig.ctaVariant === 'outline' ? 'bg-black text-white border-black' : 'bg-white text-gray-400 border-gray-200'}`}
                                        >Outline</button>
                                    </div>

                                    <div className="flex items-center gap-3 mb-2">
                                        <button onClick={() => setPosterConfig(prev => ({...prev, ctaScale: Math.max(0.5, prev.ctaScale - 0.1)}))} className="p-1 border hover:bg-gray-100 rounded"><Minus className="w-3 h-3"/></button>
                                        <input type="range" min="0.5" max="1.5" step="0.1" value={posterConfig.ctaScale} onChange={(e) => setPosterConfig(prev => ({...prev, ctaScale: parseFloat(e.target.value)}))} className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-black" />
                                        <button onClick={() => setPosterConfig(prev => ({...prev, ctaScale: Math.min(1.5, prev.ctaScale + 0.1)}))} className="p-1 border hover:bg-gray-100 rounded"><Plus className="w-3 h-3"/></button>
                                    </div>

                                    {/* Position Sliders */}
                                    <div className="flex items-center gap-3 mb-1">
                                        <MoveHorizontal className="w-3 h-3 text-gray-400" />
                                        <input type="range" min="0" max="100" step="1" value={posterConfig.ctaX} onChange={(e) => setPosterConfig(prev => ({...prev, ctaX: parseInt(e.target.value)}))} className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-black" />
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <MoveVertical className="w-3 h-3 text-gray-400" />
                                        <input type="range" min="0" max="100" step="1" value={posterConfig.ctaY} onChange={(e) => setPosterConfig(prev => ({...prev, ctaY: parseInt(e.target.value)}))} className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-black" />
                                    </div>
                                  </>
                                )}
                            </div>
                            
                            <div className="pt-4 border-t-2 border-gray-100">
                                <button 
                                    onClick={handleDownloadPoster}
                                    disabled={!currentImage}
                                    className="w-full py-4 bg-black text-white border-2 border-transparent hover:bg-electric hover:border-black hover:text-white transition-all flex items-center justify-center gap-4 disabled:opacity-50 disabled:cursor-not-allowed group"
                                >
                                    <Download className="w-6 h-6" />
                                    <div className="flex flex-col items-start leading-none">
                                        <span className="font-mono text-[10px] font-bold uppercase opacity-80">Download</span>
                                        <span className="font-display font-bold text-xl uppercase tracking-widest">Poster</span>
                                    </div>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* FILMSTRIP THUMBNAILS */}
                    <div className="h-24 bg-gray-100 border-t-2 border-black p-2 overflow-x-auto no-scrollbar flex items-center gap-3 shrink-0">
                         {generatedVariants.map((img, idx) => {
                             const isOriginal = img === originalImage;
                             const applyDemoFilters = isOriginal && isDemo;
                             return (
                                 <button
                                    key={idx}
                                    onClick={() => setSelectedVariantIndex(idx)}
                                    className={`
                                        relative h-20 w-16 shrink-0 border-2 transition-all hover:scale-105
                                        ${selectedVariantIndex === idx ? 'border-electric scale-105 shadow-md' : 'border-gray-300 hover:border-black opacity-70 hover:opacity-100'}
                                    `}
                                 >
                                    <img 
                                        src={img} 
                                        className={`w-full h-full object-cover ${applyDemoFilters ? 'grayscale brightness-75 contrast-125 blur-[0.5px]' : ''}`} 
                                        alt={`Thumb ${idx}`} 
                                    />
                                    {selectedVariantIndex === idx && (
                                        <div className="absolute inset-0 ring-2 ring-electric"></div>
                                    )}
                                 </button>
                             );
                         })}
                         <div className="h-full flex items-center justify-center px-4">
                             <span className="text-xs font-mono text-gray-400 uppercase">Select to Edit</span>
                         </div>
                    </div>
                </div>
            )}
         </div>

      </div>
    </div>,
    document.body
  );
};

export default DesignStudio;