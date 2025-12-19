
import React, { useState, useEffect, useRef } from 'react';
import { Settings, Book, MessageSquare, Plus, Pencil, Trash2, LayoutGrid, Github } from 'lucide-react';
import { Preset, Session, SessionPreset, AppSettings, SystemTemplate, DEFAULT_MODELS } from './types';
import { SettingsModal } from './components/SettingsModal';
import { PresetManager } from './components/PresetManager';
import { ChatInterface } from './components/ChatInterface';

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

const INITIAL_MAIN_PRESETS: Preset[] = [
  { 
      id: 'mp1', 
      title: 'German Supermarket', 
      type: 'main', 
      systemTemplateId: 'st3', // Uses "Professional Service" template
      systemPrompt: 'You are a cashier at a German supermarket (Edeka). Ask for a loyalty card (DeutschlandCard). Speak only German.',
      sharedPrompt: 'The user is a customer buying groceries at a checkout counter in Berlin. It is rush hour.',
      ttsConfig: { enabled: true, voiceName: 'Fenrir', autoPlay: true }
  },
  { 
      id: 'mp2', 
      title: 'Job Interview (English)', 
      type: 'main', 
      systemTemplateId: 'st1', // Uses "Strict Roleplay"
      systemPrompt: 'You are a hiring manager at a tech company. Conduct a behavioral interview. Ask follow-up questions. Maintain a slightly intimidating tone.',
      sharedPrompt: 'The user is applying for a Senior Frontend Developer role. This is the second round of interviews.',
      ttsConfig: { enabled: true, voiceName: 'Puck', autoPlay: false }
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

  const [sessionPresets, setSessionPresets] = useState<SessionPreset[]>(() => 
      loadState(STORAGE_KEYS.SESSION_PRESETS, INITIAL_SESSION_PRESETS)
  );
  
  const [settings, setSettings] = useState<AppSettings>(() => {
      const saved = loadState<AppSettings | null>(STORAGE_KEYS.SETTINGS, null);
      // Fallback to process.env.API_KEY if exists, but prioritize saved user key
      // If process is undefined (browser), handle gracefully
      let envKey = '';
      try {
        if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
            envKey = process.env.API_KEY;
        }
      } catch(e) {}

      if (saved) {
          // If the user has a saved key, use it. If saved key is empty but env exists, use env.
          return {
              ...saved,
              apiKey: saved.apiKey || envKey
          };
      }
      return { 
          model: DEFAULT_MODELS[0].id, 
          temperature: 0.7, 
          apiKey: envKey 
      };
  });

  // Persistence Effects
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions)); }, [sessions]);
  useEffect(() => { 
      if (activeSessionId) localStorage.setItem(STORAGE_KEYS.ACTIVE_SESSION, JSON.stringify(activeSessionId));
      else localStorage.removeItem(STORAGE_KEYS.ACTIVE_SESSION);
  }, [activeSessionId]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.PRESETS, JSON.stringify(presets)); }, [presets]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.TEMPLATES, JSON.stringify(systemTemplates)); }, [systemTemplates]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.SESSION_PRESETS, JSON.stringify(sessionPresets)); }, [sessionPresets]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings)); }, [settings]);


  // Modals & UI State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  
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
  }

  const updateActiveSession = (updated: Session) => {
    setSessions(prev => prev.map(s => s.id === updated.id ? updated : s));
  };

  const goHome = () => setActiveSessionId(null);

  const promptDeleteSession = (e: React.MouseEvent, id: string) => {
      e.preventDefault();
      e.stopPropagation();
      setItemToDelete(id);
  }

  const performDelete = () => {
      if (itemToDelete) {
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
  const handleExportData = () => {
    const backupData = {
        version: 2, // Bump version
        timestamp: Date.now(),
        data: {
            sessions,
            presets,
            systemTemplates,
            sessionPresets,
            settings
        }
    };
    
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

  const handleImportData = (file: File) => {
      const reader = new FileReader();
      reader.onload = (e) => {
          try {
              const content = e.target?.result as string;
              const parsed = JSON.parse(content);
              
              if (!parsed.data) {
                  throw new Error("Invalid format: missing data field");
              }

              const { sessions: newSessions, presets: newPresets, sessionPresets: newSP, settings: newSettings, systemTemplates: newTemplates } = parsed.data;

              // Update state with imported data
              if (Array.isArray(newSessions)) setSessions(newSessions);
              if (Array.isArray(newPresets)) setPresets(newPresets);
              if (Array.isArray(newSP)) setSessionPresets(newSP);
              if (Array.isArray(newTemplates)) setSystemTemplates(newTemplates);
              if (newSettings) setSettings(newSettings);

              // Reset active session to null to avoid ID mismatches
              setActiveSessionId(null);
              setIsSettingsOpen(false);
              
              alert("Import successful! All data has been restored.");

          } catch (err) {
              console.error("Import failed:", err);
              alert("Failed to import data. Please ensure the file is a valid SyncLingua JSON backup.");
          }
      };
      reader.readAsText(file);
  };

  return (
    <div className="flex h-screen w-screen bg-slate-950 text-slate-100 font-sans">
      
      {/* SIDEBAR */}
      <div className="w-64 flex flex-col border-r border-slate-800 bg-slate-925 flex-shrink-0">
        {/* Header */}
        <div 
            onClick={goHome}
            className="p-4 border-b border-slate-800 flex items-center gap-2 cursor-pointer hover:bg-slate-900 transition-colors"
            title="Go to Dashboard"
        >
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-900/20">
                <MessageSquare size={18} className="text-white" />
            </div>
            <h1 className="font-bold text-lg tracking-tight text-slate-100">SyncLingua</h1>
        </div>

        {/* Navigation */}
        <div className="p-4 space-y-2">
            <button 
                onClick={goHome}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all font-medium ${
                    !activeSessionId 
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' 
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
            >
                <LayoutGrid size={18} /> Dashboard
            </button>

            <button 
                onClick={() => setIsLibraryOpen(true)}
                className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all font-medium text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            >
                <Book size={18} /> Library
            </button>

            <button
                onClick={createEmptySession}
                className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all font-medium text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            >
                <Plus size={18} /> Quick Empty
            </button>
        </div>

        {/* Session List */}
        <div className="flex-1 overflow-y-auto px-2 custom-scrollbar space-y-1 pt-2 border-t border-slate-800/50">
            <div className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Recent</div>
            {sessions.map(s => (
                <div 
                    key={s.id}
                    className={`group relative mx-2 rounded-lg transition-all border ${
                        activeSessionId === s.id 
                        ? 'bg-slate-800 border-slate-700 shadow-sm' 
                        : 'border-transparent hover:bg-slate-900 text-slate-400 hover:text-slate-200'
                    }`}
                >
                    {/* Main Click Target for Selection */}
                    <div 
                        onClick={() => setActiveSessionId(s.id)}
                        className="p-3 pr-20 cursor-pointer select-none relative z-0" 
                    >
                        <div className={`font-medium truncate text-sm ${activeSessionId === s.id ? 'text-white' : 'text-current'}`}>
                            {s.title}
                        </div>
                        <div className="text-xs text-slate-600 mt-1 truncate">
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
                            className="flex items-center justify-center w-7 h-7 bg-slate-800 hover:bg-slate-700 rounded text-slate-400 hover:text-indigo-400 transition-colors shadow-sm border border-slate-700/50 cursor-pointer pointer-events-auto"
                            title="Rename"
                        >
                            <Pencil size={14} />
                        </button>
                        <button 
                            type="button"
                            onClick={(e) => promptDeleteSession(e, s.id)} 
                            className="flex items-center justify-center w-7 h-7 bg-slate-800 hover:bg-slate-700 rounded text-slate-400 hover:text-red-400 transition-colors shadow-sm border border-slate-700/50 cursor-pointer pointer-events-auto"
                            title="Delete"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                </div>
            ))}
            {sessions.length === 0 && (
                <div className="p-4 text-center text-slate-600 text-xs italic">
                    No history. Start a new session from Dashboard.
                </div>
            )}
        </div>

        {/* Footer Settings */}
        <div className="p-4 border-t border-slate-800">
            <button 
                onClick={() => setIsSettingsOpen(true)}
                className="flex items-center gap-3 text-slate-400 hover:text-white transition-colors w-full p-2 rounded-lg hover:bg-slate-800"
            >
                <Settings size={20} />
                <span>Settings</span>
            </button>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative bg-slate-950">
        {activeSession ? (
            <ChatInterface 
                session={activeSession}
                updateSession={updateActiveSession}
                auxPresets={auxPresets}
                systemTemplates={systemTemplates}
                settings={settings}
                mainPreset={activeMainPreset}
            />
        ) : (
            // DASHBOARD VIEW
            <div className="flex-1 flex flex-col items-center justify-center p-8 overflow-y-auto">
                <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-indigo-900/10">
                    <MessageSquare size={32} className="text-indigo-500" />
                </div>
                <h2 className="text-3xl font-bold text-slate-200 mb-3 tracking-tight">SyncLingua Studio</h2>
                <p className="max-w-md text-center mb-10 text-slate-500 text-lg">
                    Choose a template to start a new synchronized multi-model session.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 w-full max-w-5xl">
                    {/* New Empty Card */}
                    <button 
                         onClick={createEmptySession}
                         className="flex flex-col items-center justify-center p-6 bg-slate-900/50 border border-slate-800 border-dashed hover:border-indigo-500/50 hover:bg-slate-900 rounded-xl transition-all group h-48"
                    >
                        <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                            <Plus size={24} className="text-slate-400 group-hover:text-indigo-400" />
                        </div>
                        <h3 className="font-semibold text-slate-300">Empty Session</h3>
                        <p className="text-sm text-slate-600 mt-1">Start from scratch</p>
                    </button>

                    {/* Presets */}
                    {sessionPresets.map(sp => (
                        <button 
                            key={sp.id}
                            onClick={() => createSession(sp.id)}
                            className="flex flex-col text-left p-6 bg-slate-900 border border-slate-800 hover:border-indigo-500/50 hover:shadow-xl hover:shadow-indigo-900/10 rounded-xl transition-all group h-48 relative overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <LayoutGrid size={64} />
                            </div>
                            <h3 className="font-semibold text-xl text-slate-200 group-hover:text-indigo-400 mb-2">{sp.title}</h3>
                            <div className="flex-1">
                                <p className="text-sm text-slate-500 line-clamp-2">
                                    Main: <span className="text-slate-400">{presets.find(p => p.id === sp.mainPresetId)?.title || 'Custom'}</span>
                                </p>
                            </div>
                            <div className="flex items-center gap-2 mt-4 text-xs font-medium text-slate-600 bg-slate-950/50 p-2 rounded-lg w-fit">
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
      />

      <PresetManager
        isOpen={isLibraryOpen}
        onClose={() => setIsLibraryOpen(false)}
        presets={presets}
        sessionPresets={sessionPresets}
        systemTemplates={systemTemplates}
        setPresets={setPresets}
        setSessionPresets={setSessionPresets}
        setSystemTemplates={setSystemTemplates}
      />

      {/* DELETE CONFIRMATION MODAL */}
      {itemToDelete && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
              <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-sm w-full shadow-2xl scale-100">
                  <h3 className="text-lg font-semibold text-white mb-2">Delete Conversation?</h3>
                  <p className="text-slate-400 text-sm mb-6">This action cannot be undone.</p>
                  <div className="flex justify-end gap-3">
                      <button 
                          onClick={() => setItemToDelete(null)}
                          className="px-4 py-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg text-sm transition-colors"
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
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
              <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-sm w-full shadow-2xl scale-100">
                  <h3 className="text-lg font-semibold text-white mb-4">Rename Session</h3>
                  <input
                      ref={renameInputRef}
                      type="text"
                      value={itemToRename.title}
                      onChange={(e) => setItemToRename({ ...itemToRename, title: e.target.value })}
                      onKeyDown={(e) => {
                          if (e.key === 'Enter') performRename();
                          if (e.key === 'Escape') setItemToRename(null);
                      }}
                      className="w-full bg-slate-800 border border-slate-600 rounded-lg p-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none mb-6"
                      placeholder="Enter new name..."
                  />
                  <div className="flex justify-end gap-3">
                      <button 
                          onClick={() => setItemToRename(null)}
                          className="px-4 py-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg text-sm transition-colors"
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
