

import React, { useState, useEffect, useRef } from 'react';
import { Settings, Book, MessageSquare, Plus, Pencil, Trash2, LayoutGrid, Github, Menu, PanelLeftClose, PanelLeftOpen, Maximize, Minimize, CloudUpload, CloudDownload } from 'lucide-react';
import { Preset, Session, SessionPreset, AppSettings, SystemTemplate, ImageTemplate, DEFAULT_MODELS, DEFAULT_IMAGE_MODELS } from './types';
import { SettingsModal } from './components/SettingsModal';
import { PresetManager } from './components/PresetManager';
import { ChatInterface } from './components/ChatInterface';
import { uploadToWebDav, downloadFromWebDav } from './services/webdavService';
import { getImageFromCache, deleteImageFromCache } from './services/imageDb';

// --- INITIAL MOCK DATA ---

const INITIAL_TEMPLATES: SystemTemplate[] = [
    {
        id: 'st1',
        title: 'Strict Roleplay',
        content: `RULES:
1. Stay in character at all times. Do not break the fourth wall.
2. If the user speaks a different language, respond as if you only understand your character's language, or guide them back gently.
3. Be concise. Avoid long lectures.`
    },
    {
        id: 'st2',
        title: 'Friendly Tutor (Corrections)',
        content: `ROLE:
You are a friendly language tutor. 
1. Maintain the conversation naturally.
2. Implicitly correct mistakes in your response (Recast).
3. Do not stop the flow to explain grammar unless asked.`
    },
    {
        id: 'st3',
        title: 'Professional Service',
        content: `TONE:
Professional, polite, efficient. Use formal address (e.g. Sie in German, Vous in French).
Focus on solving the user's problem immediately.`
    }
];

const INITIAL_IMAGE_TEMPLATES: ImageTemplate[] = [
    {
        id: 'it1',
        title: 'Cyberpunk City',
        prompt: 'Futuristic city with neon lights, rain, wet streets, cyberpunk aesthetic, cinematic lighting, high contrast.'
    },
    {
        id: 'it2',
        title: 'Cozy Interior',
        prompt: 'Warm, cozy interior, soft lighting, detailed textures, photorealistic, depth of field, wooden furniture.'
    },
    {
        id: 'it3',
        title: 'Anime Style',
        prompt: 'Anime art style, vibrant colors, detailed background, studio ghibli inspired, 2D animation style.'
    }
];

const INITIAL_MAIN_PRESETS: Preset[] = [
  { 
      id: 'mp1', 
      title: 'German Supermarket', 
      type: 'main', 
      systemTemplateId: 'st3', // Uses "Professional Service" template
      systemPrompt: 'You are a cashier at a German supermarket (Edeka). Ask for a loyalty card (DeutschlandCard). Speak only German.',
      sharedPrompt: 'The user is a customer buying groceries at a checkout counter in Berlin. It is rush hour.',
      ttsConfig: { enabled: true, voiceName: 'Fenrir', autoPlay: true },
      backgroundImageConfig: {
          enabled: true,
          imageTemplateId: 'it2',
          useSharedContext: true,
          specificPrompt: 'A supermarket checkout counter, German products on belt, cashier view.'
      }
  },
  { 
      id: 'mp2', 
      title: 'Job Interview (English)', 
      type: 'main', 
      systemTemplateId: 'st1', // Uses "Strict Roleplay"
      systemPrompt: 'You are a hiring manager at a tech company. Conduct a behavioral interview. Ask follow-up questions. Maintain a slightly intimidating tone.',
      sharedPrompt: 'The user is applying for a Senior Frontend Developer role. This is the second round of interviews.',
      ttsConfig: { enabled: true, voiceName: 'Zephyr', autoPlay: false }
  },
];

const INITIAL_AUX_PRESETS: Preset[] = [
  { id: 'ap1', title: 'Grammar Coach', type: 'aux', systemPrompt: 'Analyze the user\'s last message in the context of the main conversation. Point out grammar mistakes and suggest corrections. Keep it brief.' },
  { id: 'ap2', title: 'Vocabulary Expander', type: 'aux', systemPrompt: 'Suggest 3 advanced synonyms for key words used in the conversation context. Explain nuance.' },
  { id: 'ap3', title: 'Cultural Insight', type: 'aux', systemPrompt: 'Does the conversation context (ScenarioContext) reveal any cultural norms or etiquette? Explain them to the user.' },
];

const INITIAL_SESSION_PRESETS: SessionPreset[] = [
    { id: 'sp1', title: 'German Practice', mainPresetId: 'mp1', defaultAuxPresetIds: ['ap1', 'ap2'] }
];

const STORAGE_KEYS = {
    SESSIONS: 'synclingua_sessions',
    PRESETS: 'synclingua_presets',
    TEMPLATES: 'synclingua_templates',
    IMAGE_TEMPLATES: 'synclingua_image_templates',
    SESSION_PRESETS: 'synclingua_session_presets',
    SETTINGS: 'synclingua_settings',
    ACTIVE_SESSION: 'synclingua_active_session_id'
};

const App: React.FC = () => {
  // Persistence Helpers
  const loadState = <T,>(key: string, defaultVal: T): T => {
      try {
          const saved = localStorage.getItem(key);
          if (saved) return JSON.parse(saved);
      } catch (e) {
          console.warn(`Failed to load ${key}`, e);
      }
      return defaultVal;
  };

  // State
  const [sessions, setSessions] = useState<Session[]>(() => loadState(STORAGE_KEYS.SESSIONS, []));
  const [activeSessionId, setActiveSessionId] = useState<string | null>(() => loadState(STORAGE_KEYS.ACTIVE_SESSION, null));
  
  const [presets, setPresets] = useState<Preset[]>(() => 
      loadState(STORAGE_KEYS.PRESETS, [...INITIAL_MAIN_PRESETS, ...INITIAL_AUX_PRESETS])
  );
  
  const [systemTemplates, setSystemTemplates] = useState<SystemTemplate[]>(() => 
    loadState(STORAGE_KEYS.TEMPLATES, INITIAL_TEMPLATES)
  );

  const [imageTemplates, setImageTemplates] = useState<ImageTemplate[]>(() => 
    loadState(STORAGE_KEYS.IMAGE_TEMPLATES, INITIAL_IMAGE_TEMPLATES)
  );

  const [sessionPresets, setSessionPresets] = useState<SessionPreset[]>(() => 
      loadState(STORAGE_KEYS.SESSION_PRESETS, INITIAL_SESSION_PRESETS)
  );
  
  const [settings, setSettings] = useState<AppSettings>(() => {
      const saved = loadState<AppSettings | null>(STORAGE_KEYS.SETTINGS, null);
      let envKey = '';
      try {
        if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
            envKey = process.env.API_KEY;
        }
      } catch(e) {}

      if (saved) {
          return {
              ...saved,
              apiKey: saved.apiKey || envKey,
              imageModel: saved.imageModel || DEFAULT_IMAGE_MODELS[0].id,
              theme: saved.theme || 'auto' 
          };
      }
      return { 
          model: DEFAULT_MODELS[0].id, 
          imageModel: DEFAULT_IMAGE_MODELS[0].id,
          temperature: 0.7, 
          apiKey: envKey,
          theme: 'auto'
      };
  });

  // Theme Effect
  useEffect(() => {
    const root = window.document.documentElement;
    const applyTheme = (theme: 'auto' | 'light' | 'dark') => {
        if (theme === 'dark') {
            root.classList.add('dark');
        } else if (theme === 'light') {
            root.classList.remove('dark');
        } else {
            // Auto
            if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
                root.classList.add('dark');
            } else {
                root.classList.remove('dark');
            }
        }
    };

    applyTheme(settings.theme);

    // Listen for system changes if auto
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
        if (settings.theme === 'auto') applyTheme('auto');
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);

  }, [settings.theme]);


  // Persistence Effects
  useEffect(() => { 
      // Strip images before saving to localStorage to avoid quota limits
      const lightSessions = sessions.map(s => ({ ...s, backgroundImageUrl: undefined }));
      localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(lightSessions)); 
  }, [sessions]);

  useEffect(() => { 
      if (activeSessionId) localStorage.setItem(STORAGE_KEYS.ACTIVE_SESSION, JSON.stringify(activeSessionId));
      else localStorage.removeItem(STORAGE_KEYS.ACTIVE_SESSION);
  }, [activeSessionId]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.PRESETS, JSON.stringify(presets)); }, [presets]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.TEMPLATES, JSON.stringify(systemTemplates)); }, [systemTemplates]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.IMAGE_TEMPLATES, JSON.stringify(imageTemplates)); }, [imageTemplates]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.SESSION_PRESETS, JSON.stringify(sessionPresets)); }, [sessionPresets]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings)); }, [settings]);

  // Load Background Image from IndexedDB when session changes
  useEffect(() => {
    const loadBackground = async () => {
        if (!activeSessionId) return;
        
        // Don't reload if we already have it in state
        const currentSession = sessions.find(s => s.id === activeSessionId);
        if (currentSession?.backgroundImageUrl) return;

        try {
            const cachedImage = await getImageFromCache(activeSessionId);
            if (cachedImage) {
                setSessions(prev => prev.map(s => 
                    s.id === activeSessionId 
                    ? { ...s, backgroundImageUrl: cachedImage } 
                    : s
                ));
            }
        } catch (e) {
            console.error("Failed to load background image from cache", e);
        }
    };
    
    loadBackground();
  }, [activeSessionId]);

  // Modals & UI State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false); 
  const [isSyncing, setIsSyncing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const toggleFullscreen = () => {
      if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(err => {
              console.error(`Error attempting to enable fullscreen: ${err.message}`);
          });
          setIsFullscreen(true);
      } else {
          if (document.exitFullscreen) {
              document.exitFullscreen();
              setIsFullscreen(false);
          }
      }
  };

  useEffect(() => {
      const handleFullscreenChange = () => {
          setIsFullscreen(!!document.fullscreenElement);
      };
      document.addEventListener('fullscreenchange', handleFullscreenChange);
      return () => {
          document.removeEventListener('fullscreenchange', handleFullscreenChange);
      };
  }, []);
  
  // Custom Confirmation/Input Modal State
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [itemToRename, setItemToRename] = useState<{id: string, title: string} | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (itemToRename && renameInputRef.current) {
        setTimeout(() => renameInputRef.current?.focus(), 50);
    }
  }, [itemToRename]);

  // Active Session Logic
  const activeSession = sessions.find(s => s.id === activeSessionId) || null;
  const activeMainPreset = activeSession?.mainPresetId 
    ? presets.find(p => p.id === activeSession.mainPresetId) 
    : undefined;

  const auxPresets = presets.filter(p => p.type === 'aux');

  // Actions
  const createSession = (sessionPresetId: string) => {
    const template = sessionPresets.find(sp => sp.id === sessionPresetId);
    if (!template) return;

    // Check if main preset has a background config to preload (optional, logic currently relies on chat progression)
    const newSession: Session = {
        id: Date.now().toString(),
        title: template.title,
        mainPresetId: template.mainPresetId,
        mainMessages: [],
        auxTabs: template.defaultAuxPresetIds.map(apId => ({
            id: Date.now().toString() + Math.random(),
            presetId: apId,
            messages: []
        })),
        activeAuxTabId: null, 
        createdAt: Date.now()
    };
    
    if (newSession.auxTabs.length > 0) {
        newSession.activeAuxTabId = newSession.auxTabs[0].id;
    }

    setSessions([newSession, ...sessions]);
    setActiveSessionId(newSession.id);
    setIsSidebarOpen(false); 
  };

  const createEmptySession = () => {
      const newSession: Session = {
        id: Date.now().toString(),
        title: 'New Session',
        mainPresetId: null,
        mainMessages: [],
        auxTabs: [],
        activeAuxTabId: null,
        createdAt: Date.now()
    };
    setSessions([newSession, ...sessions]);
    setActiveSessionId(newSession.id);
    setIsSidebarOpen(false); 
  }

  const updateActiveSession = (updated: Session) => {
    setSessions(prev => prev.map(s => s.id === updated.id ? updated : s));
  };

  const goHome = () => {
      setActiveSessionId(null);
      setIsSidebarOpen(false);
  }

  const promptDeleteSession = (e: React.MouseEvent, id: string) => {
      e.preventDefault();
      e.stopPropagation();
      setItemToDelete(id);
  }

  const performDelete = async () => {
      if (itemToDelete) {
          // Cleanup image cache
          try {
              await deleteImageFromCache(itemToDelete);
          } catch(e) { console.warn("Failed to delete cached image", e); }

          setSessions(prev => prev.filter(s => s.id !== itemToDelete));
          if (activeSessionId === itemToDelete) setActiveSessionId(null);
          setItemToDelete(null);
      }
  }

  const promptRenameSession = (e: React.MouseEvent, id: string) => {
      e.preventDefault();
      e.stopPropagation();
      const session = sessions.find(s => s.id === id);
      if (session) {
          setItemToRename({ id, title: session.title });
      }
  }

  const performRename = () => {
      if (itemToRename && itemToRename.title.trim() !== "") {
          setSessions(prev => prev.map(s => s.id === itemToRename.id ? { ...s, title: itemToRename.title.trim() } : s));
          setItemToRename(null);
      }
  }

  // Import / Export Handlers
  const prepareBackupData = () => {
      // Strip images from backup
      const lightSessions = sessions.map(s => ({ ...s, backgroundImageUrl: undefined }));
      
      return {
          version: 3,
          timestamp: Date.now(),
          data: {
              sessions: lightSessions,
              presets,
              systemTemplates,
              imageTemplates,
              sessionPresets,
              settings
          }
      };
  }

  const handleExportData = () => {
    const backupData = prepareBackupData();
    const jsonString = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `synclingua-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const restoreFromData = (parsed: any) => {
    if (!parsed.data) {
        throw new Error("Invalid format: missing data field");
    }

    const { sessions: newSessions, presets: newPresets, sessionPresets: newSP, settings: newSettings, systemTemplates: newTemplates, imageTemplates: newImageTemplates } = parsed.data;

    // Update state with imported data
    if (Array.isArray(newSessions)) setSessions(newSessions);
    if (Array.isArray(newPresets)) setPresets(newPresets);
    if (Array.isArray(newSP)) setSessionPresets(newSP);
    if (Array.isArray(newTemplates)) setSystemTemplates(newTemplates);
    if (Array.isArray(newImageTemplates)) setImageTemplates(newImageTemplates);
    if (newSettings) setSettings(newSettings);

    // Reset active session to null to avoid ID mismatches
    setActiveSessionId(null);
  }

  const handleImportData = (file: File) => {
      const reader = new FileReader();
      reader.onload = (e) => {
          try {
              const content = e.target?.result as string;
              const parsed = JSON.parse(content);
              restoreFromData(parsed);
              setIsSettingsOpen(false);
              alert("Import successful! All data has been restored.");
          } catch (err) {
              console.error("Import failed:", err);
              alert("Failed to import data. Please ensure the file is a valid SyncLingua JSON backup.");
          }
      };
      reader.readAsText(file);
  };

  // --- CLOUD SYNC HANDLERS ---
  const handleCloudUpload = async () => {
      if (!settings.webdav) return;
      setIsSyncing(true);
      try {
          const data = prepareBackupData();
          await uploadToWebDav(settings.webdav, JSON.stringify(data));
          alert("Successfully uploaded backup to Cloud!");
      } catch (e: any) {
          console.error("Upload Error:", e);
          alert(`Upload Failed: ${e.message}`);
      } finally {
          setIsSyncing(false);
      }
  };

  const handleCloudDownload = async () => {
      if (!settings.webdav) return;
      setIsSyncing(true);
      try {
          const jsonString = await downloadFromWebDav(settings.webdav);
          const parsed = JSON.parse(jsonString);
          restoreFromData(parsed);
          alert("Successfully restored data from Cloud!");
          setIsSettingsOpen(false);
      } catch (e: any) {
          console.error("Download Error:", e);
          alert(`Download Failed: ${e.message}`);
      } finally {
          setIsSyncing(false);
      }
  };

  return (
    // Global Background Container
    <div 
        className="flex h-screen w-screen bg-white dark:bg-neutral-950 text-gray-900 dark:text-gray-100 font-sans bg-cover bg-center transition-all duration-1000 ease-in-out"
        style={{
            backgroundImage: activeSession?.backgroundImageUrl ? `url(${activeSession.backgroundImageUrl})` : 'none'
        }}
    >
      {/* Overlay to darken background slightly for text readability, NO BLUR as requested */}
      <div className={`absolute inset-0 z-0 pointer-events-none transition-opacity duration-1000 ${activeSession?.backgroundImageUrl ? 'bg-black/30' : 'opacity-0'}`}></div>



      {/* MOBILE OVERLAY */}
        {isSidebarOpen && (
            <div 
               className="md:hidden fixed inset-0 bg-black/50 z-40"
               onClick={() => setIsSidebarOpen(false)}
            ></div>
        )}

      {/* SIDEBAR - FULLY TRANSPARENT */}
      <div className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-white/10 dark:border-white/5 bg-transparent transform transition-all duration-300 ease-in-out overflow-hidden ${
            isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } ${
            isSidebarCollapsed ? 'md:w-0 md:border-none md:translate-x-0' : 'md:w-64 md:translate-x-0 md:relative'
        } md:inset-auto md:z-10 md:flex-shrink-0`}>
        
        {/* Inner Container to prevent squashing content during collapse */}
        <div className="w-64 flex flex-col h-full min-w-[16rem]">
            {/* Header */}
            <div className="p-4 border-b border-white/10 dark:border-white/5 flex items-center justify-between h-14 md:h-auto">
                <div 
                    onClick={goHome}
                    className="flex items-center gap-2 cursor-pointer hover:bg-white/10 dark:hover:bg-black/20 transition-colors p-1 rounded-lg -ml-1 pr-3"
                    title="Go to Dashboard"
                >
                    <div className="w-8 h-8 bg-indigo-600/90 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-900/20 backdrop-blur-sm">
                        <MessageSquare size={18} className="text-white" />
                    </div>
                    <h1 className="font-bold text-lg tracking-tight text-gray-900 dark:text-gray-100 drop-shadow-sm">SyncLingua</h1>
                </div>
                {/* Action Buttons */}
                <div className="flex items-center gap-1">
                    <button 
                        onClick={toggleFullscreen}
                        className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white p-1 rounded-md hover:bg-white/20 dark:hover:bg-black/20 transition-colors"
                        title={isFullscreen ? "退出全屏" : "全屏模式"}
                    >
                        {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
                    </button>
                    <button 
                        onClick={() => setIsSidebarCollapsed(true)} 
                        className="hidden md:flex text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white p-1 rounded-md hover:bg-white/20 dark:hover:bg-black/20 transition-colors"
                        title="Collapse Sidebar"
                    >
                        <PanelLeftClose size={18} />
                    </button>
                </div>
            </div>

            {/* Navigation */}
            <div className="p-4 space-y-2">
                <button 
                    onClick={goHome}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all font-medium ${
                        !activeSessionId 
                        ? 'bg-indigo-600/90 text-white shadow-lg shadow-indigo-900/20 backdrop-blur-sm' 
                        : 'text-gray-600 dark:text-gray-300 hover:bg-white/10 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white'
                    }`}
                >
                    <LayoutGrid size={18} /> Dashboard
                </button>

                <button 
                    onClick={() => { setIsLibraryOpen(true); setIsSidebarOpen(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all font-medium text-gray-600 dark:text-gray-300 hover:bg-white/10 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white"
                >
                    <Book size={18} /> Library
                </button>

                <button
                    onClick={createEmptySession}
                    className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all font-medium text-gray-600 dark:text-gray-300 hover:bg-white/10 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white"
                >
                    <Plus size={18} /> Quick Empty
                </button>

                <div className="flex gap-2 mt-1">
                    <button
                        onClick={handleCloudUpload}
                        disabled={isSyncing || !settings.webdav}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition-all font-medium text-sm text-gray-600 dark:text-gray-300 hover:bg-white/10 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <CloudUpload size={16} /> Push
                    </button>
                    <button
                        onClick={handleCloudDownload}
                        disabled={isSyncing || !settings.webdav}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition-all font-medium text-sm text-gray-600 dark:text-gray-300 hover:bg-white/10 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <CloudDownload size={16} /> Pull
                    </button>
                </div>
            </div>

            {/* Session List */}
            <div className="flex-1 overflow-y-auto px-2 custom-scrollbar space-y-1 pt-2 border-t border-white/10 dark:border-white/5">
                <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Recent</div>
                {sessions.map(s => (
                    <div 
                        key={s.id}
                        className={`group relative mx-2 rounded-lg transition-all border ${
                            activeSessionId === s.id 
                            ? 'bg-white/20 dark:bg-black/40 border-white/20 dark:border-white/10 shadow-sm backdrop-blur-sm' 
                            : 'border-transparent hover:bg-white/10 dark:hover:bg-white/5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                        }`}
                    >
                        {/* Main Click Target for Selection */}
                        <div 
                            onClick={() => { setActiveSessionId(s.id); setIsSidebarOpen(false); }}
                            className="p-3 pr-20 cursor-pointer select-none relative z-0" 
                        >
                            <div className={`font-medium truncate text-sm ${activeSessionId === s.id ? 'text-indigo-700 dark:text-white' : 'text-current'}`}>
                                {s.title}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">
                                {new Date(s.createdAt).toLocaleDateString()}
                            </div>
                        </div>
                        
                        {/* Action Buttons */}
                        <div 
                            className={`absolute right-2 top-2 flex gap-1 z-10 ${
                                activeSessionId === s.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                            } transition-opacity duration-200`}
                        >
                            <button 
                                type="button"
                                onClick={(e) => promptRenameSession(e, s.id)} 
                                className="flex items-center justify-center w-7 h-7 bg-white/40 dark:bg-black/40 hover:bg-white/80 dark:hover:bg-neutral-700/80 rounded text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors shadow-sm border border-transparent hover:border-white/20 cursor-pointer pointer-events-auto"
                                title="Rename"
                            >
                                <Pencil size={14} />
                            </button>
                            <button 
                                type="button"
                                onClick={(e) => promptDeleteSession(e, s.id)} 
                                className="flex items-center justify-center w-7 h-7 bg-white/40 dark:bg-black/40 hover:bg-white/80 dark:hover:bg-neutral-700/80 rounded text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors shadow-sm border border-transparent hover:border-white/20 cursor-pointer pointer-events-auto"
                                title="Delete"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    </div>
                ))}
                {sessions.length === 0 && (
                    <div className="p-4 text-center text-gray-500 dark:text-gray-600 text-xs italic">
                        No history. Start a new session from Dashboard.
                    </div>
                )}
            </div>

            {/* Footer Settings */}
            <div className="p-4 border-t border-white/10 dark:border-white/5">
                <button 
                    onClick={() => { setIsSettingsOpen(true); setIsSidebarOpen(false); }}
                    className="flex items-center gap-3 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors w-full p-2 rounded-lg hover:bg-white/10 dark:hover:bg-white/5"
                >
                    <Settings size={20} />
                    <span>Settings</span>
                </button>
            </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative z-10 pt-0 md:pt-0 transition-all duration-300">
        {activeSession ? (
            <ChatInterface 
                session={activeSession}
                updateSession={updateActiveSession}
                auxPresets={auxPresets}
                systemTemplates={systemTemplates}
                imageTemplates={imageTemplates}
                settings={settings}
                mainPreset={activeMainPreset}
                isSidebarOpen={isSidebarOpen}
                isSidebarCollapsed={isSidebarCollapsed}
                onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
                onExpandSidebar={() => setIsSidebarCollapsed(false)}
            />
        ) : (
            // DASHBOARD VIEW - TRANSPARENT
            <div className="flex-1 flex flex-col items-center justify-center p-8 overflow-y-auto bg-transparent relative">
                {/* Expand Sidebar Button - Mobile: show when sidebar is closed, Desktop: show when sidebar is collapsed */}
                {(!isSidebarOpen || isSidebarCollapsed) && (
                    <button 
                        onClick={() => {
                            if (!isSidebarOpen) {
                                setIsSidebarOpen(true);
                            } else {
                                setIsSidebarCollapsed(false);
                            }
                        }}
                        className="absolute top-4 left-4 p-2 rounded-lg hover:bg-white/20 dark:hover:bg-black/20 text-gray-500 dark:text-gray-300 transition-colors z-20"
                        title="展开侧栏"
                    >
                        <PanelLeftOpen size={20} />
                    </button>
                )}
                
                <div className="w-16 h-16 bg-white dark:bg-neutral-900 rounded-2xl flex items-center justify-center mb-6 shadow-xl dark:shadow-indigo-900/10 border border-gray-100 dark:border-neutral-800">
                    <MessageSquare size={32} className="text-indigo-600 dark:text-indigo-500" />
                </div>
                <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-200 mb-3 tracking-tight drop-shadow-md">SyncLingua Studio</h2>
                <p className="max-w-md text-center mb-10 text-gray-600 dark:text-gray-300 text-lg drop-shadow-sm">
                    Choose a template to start a new synchronized multi-model session.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 w-full max-w-5xl">
                    {/* New Empty Card */}
                    <button 
                         onClick={createEmptySession}
                         className="flex flex-col items-center justify-center p-6 bg-white/10 dark:bg-black/30 backdrop-blur-sm border border-white/20 dark:border-white/10 border-dashed hover:border-indigo-500/50 hover:bg-white/20 dark:hover:bg-black/50 rounded-xl transition-all group h-48"
                    >
                        <div className="w-12 h-12 rounded-full bg-white/80 dark:bg-neutral-800/80 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform shadow-sm">
                            <Plus size={24} className="text-gray-400 dark:text-gray-400 group-hover:text-indigo-500 dark:group-hover:text-indigo-400" />
                        </div>
                        <h3 className="font-semibold text-gray-800 dark:text-gray-200">Empty Session</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Start from scratch</p>
                    </button>

                    {/* Presets */}
                    {sessionPresets.map(sp => (
                        <button 
                            key={sp.id}
                            onClick={() => createSession(sp.id)}
                            className="flex flex-col text-left p-6 bg-white/10 dark:bg-black/30 backdrop-blur-sm border border-white/20 dark:border-white/10 hover:border-indigo-500/50 hover:bg-white/20 dark:hover:bg-black/50 hover:shadow-xl dark:hover:shadow-indigo-900/10 rounded-xl transition-all group h-48 relative overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 p-4 opacity-5 dark:opacity-10 group-hover:opacity-10 dark:group-hover:opacity-20 transition-opacity">
                                <LayoutGrid size={64} className="text-indigo-900 dark:text-white" />
                            </div>
                            <h3 className="font-semibold text-xl text-gray-900 dark:text-gray-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 mb-2 drop-shadow-sm">{sp.title}</h3>
                            <div className="flex-1">
                                <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
                                    Main: <span className="text-gray-500 dark:text-gray-400">{presets.find(p => p.id === sp.mainPresetId)?.title || 'Custom'}</span>
                                </p>
                            </div>
                            <div className="flex items-center gap-2 mt-4 text-xs font-medium text-gray-700 dark:text-gray-300 bg-white/20 dark:bg-black/20 p-2 rounded-lg w-fit">
                                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                {sp.defaultAuxPresetIds.length} Active Helpers
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        )}
      </div>

      {/* MODALS */}
      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSave={setSettings}
        onExportData={handleExportData}
        onImportData={handleImportData}
        onCloudUpload={handleCloudUpload}
        onCloudDownload={handleCloudDownload}
        isSyncing={isSyncing}
      />

      <PresetManager
        isOpen={isLibraryOpen}
        onClose={() => setIsLibraryOpen(false)}
        presets={presets}
        sessionPresets={sessionPresets}
        systemTemplates={systemTemplates}
        imageTemplates={imageTemplates}
        setPresets={setPresets}
        setSessionPresets={setSessionPresets}
        setSystemTemplates={setSystemTemplates}
        setImageTemplates={setImageTemplates}
      />

      {/* DELETE CONFIRMATION MODAL */}
      {itemToDelete && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
              <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-xl p-6 max-w-sm w-full shadow-2xl scale-100">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Delete Conversation?</h3>
                  <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">This action cannot be undone.</p>
                  <div className="flex justify-end gap-3">
                      <button 
                          onClick={() => setItemToDelete(null)}
                          className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg text-sm transition-colors"
                      >
                          Cancel
                      </button>
                      <button 
                          onClick={performDelete}
                          className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-medium transition-colors"
                      >
                          Delete
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* RENAME MODAL */}
      {itemToRename && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
              <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-xl p-6 max-w-sm w-full shadow-2xl scale-100">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Rename Session</h3>
                  <input
                      ref={renameInputRef}
                      type="text"
                      value={itemToRename.title}
                      onChange={(e) => setItemToRename({ ...itemToRename, title: e.target.value })}
                      onKeyDown={(e) => {
                          if (e.key === 'Enter') performRename();
                          if (e.key === 'Escape') setItemToRename(null);
                      }}
                      className="w-full bg-gray-50 dark:bg-neutral-800 border border-gray-300 dark:border-neutral-600 rounded-lg p-3 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none mb-6"
                      placeholder="Enter new name..."
                  />
                  <div className="flex justify-end gap-3">
                      <button 
                          onClick={() => setItemToRename(null)}
                          className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg text-sm transition-colors"
                      >
                          Cancel
                      </button>
                      <button 
                          onClick={performRename}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors"
                      >
                          Save
                      </button>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};

export default App;