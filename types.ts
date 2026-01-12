

export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  isAutoTrigger?: boolean; // Marker for UI styling
}

export interface TTSConfig {
  enabled: boolean;
  voiceName: string;
  autoPlay: boolean; // Only applicable for Main AI responses
}

export interface SystemTemplate {
  id: string;
  title: string;
  content: string; // The reusable base instruction
}

export interface ImageTemplate {
  id: string;
  title: string;
  prompt: string; // Base style/prompt for images
}

export interface BackgroundImageConfig {
  enabled: boolean;
  imageTemplateId?: string;
  useSharedContext: boolean;
  specificPrompt: string;
}

export interface Preset {
  id: string;
  title: string;
  systemTemplateId?: string; // New: Link to a base template
  systemPrompt: string; // The "Private" instruction (Persona, Tone, etc.)
  sharedPrompt?: string; // The "Public" instruction (Scenario, Context) shared with Aux agents
  type: 'main' | 'aux';
  ttsConfig?: TTSConfig;
  backgroundImageConfig?: BackgroundImageConfig; // New: Image generation settings
  autoTrigger?: boolean; // If true, triggers automatically after Main AI response
}

export interface SessionPreset {
  id: string;
  title: string;
  mainPresetId: string | null; // Can be null if user wants to set custom prompt later
  defaultAuxPresetIds: string[];
}

export interface AuxTab {
  id: string;
  presetId: string;
  messages: Message[];
}

export interface Session {
  id: string;
  title: string;
  mainPresetId: string | null; // Can be null if user wants to set custom prompt later
  mainMessages: Message[];
  auxTabs: AuxTab[];
  activeAuxTabId: string | null;
  createdAt: number;
  backgroundImageUrl?: string; // New: Persist current background
}

export interface WebDavConfig {
  url: string;
  username: string;
  password: string;
}

export interface AppSettings {
  model: string;
  imageModel: string; // New: Model for generating images
  temperature: number;
  apiKey: string;
  theme: 'auto' | 'light' | 'dark';
  webdav?: WebDavConfig;
}

export const DEFAULT_MODELS = [
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (Fast)' },
  { id: 'gemini-3-pro-preview', name: 'Gemini 3.0 Pro (Reasoning)' },
  { id: 'gemini-3-flash-preview', name: 'Gemini 3.0 Flash (Fast & Smart)' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
  { id: 'gemini-flash-latest', name: 'Gemini Flash (Latest)' },
  { id: 'gemini-flash-lite-latest', name: 'Gemini Flash Lite (Latest)' },
  { id: 'gemini-pro-latest', name: 'Gemini Pro (Latest)' },
];

export const DEFAULT_IMAGE_MODELS = [
  { id: 'gemini-2.5-flash-image', name: 'Gemini 2.5 Flash Image' },
  { id: 'gemini-3-pro-image-preview', name: 'Gemini 3.0 Pro Image (High Quality)' },
];

export const GEMINI_TTS_VOICES = [
  { id: 'Zephyr', name: 'Zephyr (Female)' },
  { id: 'Puck', name: 'Puck (Male)' },
  { id: 'Charon', name: 'Charon (Male)' },
  { id: 'Kore', name: 'Kore (Female)' },
  { id: 'Fenrir', name: 'Fenrir (Male)' },
  { id: 'Leda', name: 'Leda (Female)' },
  { id: 'Orus', name: 'Orus (Male)' },
  { id: 'Aoede', name: 'Aoede (Female)' },
  { id: 'Callirrhoe', name: 'Callirrhoe (Female)' },
  { id: 'Autonoe', name: 'Autonoe (Female)' },
  { id: 'Enceladus', name: 'Enceladus (Male)' },
  { id: 'Iapetus', name: 'Iapetus (Male)' },
  { id: 'Umbriel', name: 'Umbriel (Male)' },
  { id: 'Algieba', name: 'Algieba (Female)' },
  { id: 'Despina', name: 'Despina (Female)' },
  { id: 'Erinome', name: 'Erinome (Female)' },
  { id: 'Algenib', name: 'Algenib (Male)' },
  { id: 'Rasalgethi', name: 'Rasalgethi (Male)' },
  { id: 'Laomedeia', name: 'Laomedeia (Female)' },
  { id: 'Achernar', name: 'Achernar (Male)' },
  { id: 'Alnilam', name: 'Alnilam (Male)' },
  { id: 'Schedar', name: 'Schedar (Male)' },
  { id: 'Gacrux', name: 'Gacrux (Male)' },
  { id: 'Pulcherrima', name: 'Pulcherrima (Female)' },
  { id: 'Achird', name: 'Achird (Female)' },
  { id: 'Zubenelgenubi', name: 'Zubenelgenubi (Male)' },
  { id: 'Vindemiatrix', name: 'Vindemiatrix (Female)' },
  { id: 'Sadachbia', name: 'Sadachbia (Female)' },
  { id: 'Sadaltager', name: 'Sadaltager (Male)' },
  { id: 'Sulafat', name: 'Sulafat (Female)' },
];