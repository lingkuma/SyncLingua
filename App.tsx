
import React, { useState, useEffect, useRef } from 'react';
import { Settings, Book, MessageSquare, Plus, Pencil, Trash2, LayoutGrid, Menu, X, Sun, Moon, Monitor } from 'lucide-react';
import { Preset, Session, SessionPreset, AppSettings, SystemTemplate, DEFAULT_MODELS, ThemeMode } from './types';
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
    }
];

const INITIAL_MAIN_PRESETS: Preset[] = [
  { 
      id: 'mp1', 
      title: 'German Supermarket', 
      type: 'main', 
      systemTemplateId: 'st1',
      systemPrompt: 'You are a cashier at a German supermarket (Edeka). Ask for a loyalty card (DeutschlandCard). Speak only German.',
      sharedPrompt: 'The customer is buying groceries at a checkout counter in Berlin.',
      ttsConfig: { enabled: true, voiceName: 'Fenrir', autoPlay: true }
  }
];

const INITIAL_AUX_PRESETS: Preset[] = [
  { id: 'ap1', title: 'Grammar Coach', type: 'aux', systemPrompt: 'Analyze the user\'s last message. Point out grammar mistakes and suggest corrections. Keep it brief.' },
  { id: 'ap2', title: 'Vocabulary Expander', type: 'aux', systemPrompt: 'Suggest 3 advanced synonyms for key words used in the conversation. Explain nuance.' },
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
  const [presets, setPresets] = useState<Preset[]>(() => loadState(STORAGE_KEYS.PRESETS, [...INITIAL_MAIN_PRESETS, ...INITIAL_AUX_PRESETS]));
  const [systemTemplates, setSystemTemplates] = useState<SystemTemplate[]>(() => loadState(STORAGE_KEYS.TEMPLATES, INITIAL_TEMPLATES));
  const [sessionPresets, setSessionPresets] = useState<SessionPreset[]>(() => loadState(STORAGE_KEYS.SESSION_PRESETS, INITIAL_SESSION_PRESETS));
  
  const [settings, setSettings] = useState<AppSettings>(() => {
      const saved = loadState<AppSettings | null>(STORAGE_KEYS.SETTINGS, null);
      let envKey = '';
      try { if (typeof process !== 'undefined' && process.env && process.env.API_KEY) envKey = process.env.API_KEY; } catch(e) {}
      if (saved) return { ...saved, apiKey: saved.apiKey || envKey, theme: saved.theme || 'auto' };
      return { model: DEFAULT_MODELS[0].id, temperature: 0.7, apiKey: envKey, theme: 'auto' };
  });

  // Theme Management
  useEffect(() => {
    const applyTheme = () => {
      const root = window.document.documentElement;
      const isDark = settings.theme === 'dark' || (settings.theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      if (isDark) root.classList.add('dark');
      else root.classList.remove('dark');
    };
    applyTheme();
    if (settings.theme === 'auto') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = () => applyTheme();
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }
  }, [settings.theme]);

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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [itemToRename, setItemToRename] = useState<{id: string, title: string} | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (itemToRename && renameInputRef.current) setTimeout(() => renameInputRef.current?.focus(), 50);
  }, [itemToRename]);

  const activeSession = sessions.find(s => s.id === activeSessionId) || null;
  const activeMainPreset = activeSession?.mainPresetId ? presets.find(p => p.id === activeSession.mainPresetId) : undefined;
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
        auxTabs: template.defaultAuxPresetIds.map(apId => ({ id: Date.now().toString() + Math.random(), presetId: apId, messages: [] })),
        activeAuxTabId: null, createdAt: Date.now()
    };
    if (newSession.auxTabs.length > 0) newSession.activeAuxTabId = newSession.auxTabs[0].id;
    setSessions([newSession, ...sessions]);
    setActiveSessionId(newSession.id);
    setIsMobileMenuOpen(false);
  };

  const createEmptySession = () => {
    const newSession: Session = { id: Date.now().toString(), title: 'New Session', mainPresetId: null, mainMessages: [], auxTabs: [], activeAuxTabId: null, createdAt: Date.now() };
    setSessions([newSession, ...sessions]);
    setActiveSessionId(newSession.id);
    setIsMobileMenuOpen(false);
  }

  const updateActiveSession = (updated: Session) => setSessions(prev => prev.map(s => s.id === updated.id ? updated : s));
  const goHome = () => { setActiveSessionId(null); setIsMobileMenuOpen(false); };
  const performDelete = () => {
      if (itemToDelete) {
          setSessions(prev => prev.filter(s => s.id !== itemToDelete));
          if (activeSessionId === itemToDelete) setActiveSessionId(null);
          setItemToDelete(null);
      }
  }
  const performRename = () => {
      if (itemToRename && itemToRename.title.trim() !== "") {
          setSessions(prev => prev.map(s => s.id === itemToRename.id ? { ...s, title: itemToRename.title.trim() } : s));
          setItemToRename(null);
      }
  }

  return (
    <div className="flex h-screen w-screen bg-white dark:bg-dark-950 text-slate-900 dark:text-slate-100 font-sans overflow-hidden transition-colors">
      
      {isMobileMenuOpen && <div className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />}

      {/* SIDEBAR */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-72 bg-slate-50 dark:bg-dark-925 border-r border-slate-200 dark:border-dark-800 flex flex-col transition-transform duration-300 ease-in-out shadow-xl md:shadow-none
        md:relative md:translate-x-0 md:w-64 md:flex-shrink-0
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-4 border-b border-slate-200 dark:border-dark-800 flex items-center justify-between shrink-0">
            <div onClick={goHome} className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
                <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-600/20">
                    <MessageSquare size={18} className="text-white" />
                </div>
                <h1 className="font-bold text-lg tracking-tight">SyncLingua</h1>
            </div>
            <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden text-slate-400 hover:text-slate-600 dark:hover:text-white"><X size={24} /></button>
        </div>

        <div className="p-4 space-y-2 shrink-0">
            <button onClick={goHome} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all font-medium ${!activeSessionId ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-dark-900 hover:text-slate-900 dark:hover:text-slate-200'}`}>
                <LayoutGrid size={18} /> Dashboard
            </button>
            <button onClick={() => { setIsLibraryOpen(true); setIsMobileMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-dark-900 hover:text-slate-900 dark:hover:text-slate-200">
                <Book size={18} /> Library
            </button>
            <button onClick={createEmptySession} className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-dark-900 hover:text-slate-900 dark:hover:text-slate-200">
                <Plus size={18} /> Quick Empty
            </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 custom-scrollbar space-y-1 pt-2 border-t border-slate-200 dark:border-dark-800/50 min-h-0">
            <div className="px-4 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Recent</div>
            {sessions.map(s => (
                <div key={s.id} className={`group relative mx-2 rounded-lg transition-all border ${activeSessionId === s.id ? 'bg-white dark:bg-dark-900 border-slate-200 dark:border-dark-800 shadow-sm' : 'border-transparent hover:bg-slate-200 dark:hover:bg-dark-900 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}>
                    <div onClick={() => { setActiveSessionId(s.id); setIsMobileMenuOpen(false); }} className="p-3 pr-20 cursor-pointer select-none relative z-0">
                        <div className={`font-medium truncate text-sm ${activeSessionId === s.id ? 'text-indigo-600 dark:text-white' : 'text-current'}`}>{s.title}</div>
                        <div className="text-xs text-slate-400 mt-1 truncate">{new Date(s.createdAt).toLocaleDateString()}</div>
                    </div>
                    <div className={`absolute right-2 top-2 flex gap-1 z-10 ${activeSessionId === s.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity duration-200`}>
                        <button onClick={(e) => { e.stopPropagation(); setItemToRename({ id: s.id, title: s.title }); }} className="w-7 h-7 flex items-center justify-center bg-slate-100 dark:bg-dark-850 hover:bg-slate-200 dark:hover:bg-dark-800 rounded text-slate-400 hover:text-indigo-500 border border-slate-200 dark:border-dark-800"><Pencil size={14} /></button>
                        <button onClick={(e) => { e.stopPropagation(); setItemToDelete(s.id); }} className="w-7 h-7 flex items-center justify-center bg-slate-100 dark:bg-dark-850 hover:bg-slate-200 dark:hover:bg-dark-800 rounded text-slate-400 hover:text-red-500 border border-slate-200 dark:border-dark-800"><Trash2 size={14} /></button>
                    </div>
                </div>
            ))}
        </div>

        <div className="p-4 border-t border-slate-200 dark:border-dark-800 shrink-0">
            <button onClick={() => { setIsSettingsOpen(true); setIsMobileMenuOpen(false); }} className="flex items-center gap-3 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors w-full p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-dark-900">
                <Settings size={20} />
                <span>Settings</span>
            </button>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        <div className="md:hidden h-14 border-b border-slate-200 dark:border-dark-800 flex items-center px-4 bg-slate-50 dark:bg-dark-925 shrink-0 z-30">
            <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 -ml-2 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg"><Menu size={24} /></button>
            <div className="ml-2 font-semibold truncate">{activeSession ? activeSession.title : 'Dashboard'}</div>
        </div>

        <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
            {activeSession ? (
                <ChatInterface session={activeSession} updateSession={updateActiveSession} auxPresets={auxPresets} systemTemplates={systemTemplates} settings={settings} mainPreset={activeMainPreset} />
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-8 overflow-y-auto">
                    <div className="w-16 h-16 bg-slate-100 dark:bg-dark-900 rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-indigo-600/5">
                        <MessageSquare size={32} className="text-indigo-500" />
                    </div>
                    <h2 className="text-2xl md:text-3xl font-bold mb-3 tracking-tight text-center">SyncLingua Studio</h2>
                    <p className="max-w-md text-center mb-10 text-slate-500 text-lg">Choose a template to start a synchronized multi-model session.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 w-full max-w-5xl">
                        <button onClick={createEmptySession} className="flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-dark-900/50 border border-slate-200 dark:border-dark-800 border-dashed hover:border-indigo-500/50 hover:bg-white dark:hover:bg-dark-900 rounded-xl transition-all group h-48">
                            <div className="w-12 h-12 rounded-full bg-white dark:bg-dark-800 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform"><Plus size={24} className="text-slate-400 group-hover:text-indigo-600" /></div>
                            <h3 className="font-semibold text-slate-600 dark:text-slate-300">Empty Session</h3>
                            <p className="text-sm text-slate-400 mt-1">Start from scratch</p>
                        </button>
                        {sessionPresets.map(sp => (
                            <button key={sp.id} onClick={() => createSession(sp.id)} className="flex flex-col text-left p-6 bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-800 hover:border-indigo-500/50 hover:shadow-xl rounded-xl transition-all group h-48 relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><LayoutGrid size={64} /></div>
                                <h3 className="font-semibold text-xl text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 mb-2">{sp.title}</h3>
                                <p className="text-sm text-slate-500 line-clamp-2">Main: <span className="text-slate-700 dark:text-slate-400">{presets.find(p => p.id === sp.mainPresetId)?.title || 'Custom'}</span></p>
                                <div className="flex items-center gap-2 mt-auto text-xs font-medium text-slate-500 bg-white dark:bg-dark-950/50 p-2 rounded-lg w-fit">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>{sp.defaultAuxPresetIds.length} Active Helpers
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
      </div>

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} settings={settings} onSave={setSettings} onExportData={() => {}} onImportData={() => {}} />
      <PresetManager isOpen={isLibraryOpen} onClose={() => setIsLibraryOpen(false)} presets={presets} sessionPresets={sessionPresets} systemTemplates={systemTemplates} setPresets={setPresets} setSessionPresets={setSessionPresets} setSystemTemplates={setSystemTemplates} />

      {itemToDelete && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
              <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-xl p-6 max-w-sm w-full shadow-2xl">
                  <h3 className="text-lg font-semibold mb-2 text-slate-900 dark:text-white">Delete Conversation?</h3>
                  <p className="text-slate-500 text-sm mb-6">This action cannot be undone.</p>
                  <div className="flex justify-end gap-3">
                      <button onClick={() => setItemToDelete(null)} className="px-4 py-2 text-slate-500 hover:text-slate-800 dark:hover:text-white rounded-lg text-sm transition-colors">Cancel</button>
                      <button onClick={performDelete} className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-medium transition-colors">Delete</button>
                  </div>
              </div>
          </div>
      )}

      {itemToRename && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
              <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-xl p-6 max-w-sm w-full shadow-2xl">
                  <h3 className="text-lg font-semibold mb-4 text-slate-900 dark:text-white">Rename Session</h3>
                  <input ref={renameInputRef} type="text" value={itemToRename.title} onChange={(e) => setItemToRename({ ...itemToRename, title: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') performRename(); if (e.key === 'Escape') setItemToRename(null); }} className="w-full bg-slate-50 dark:bg-dark-800 border border-slate-200 dark:border-dark-700 rounded-lg p-3 outline-none mb-6 focus:ring-2 focus:ring-indigo-500" />
                  <div className="flex justify-end gap-3">
                      <button onClick={() => setItemToRename(null)} className="px-4 py-2 text-slate-500 hover:text-slate-800 dark:hover:text-white rounded-lg text-sm transition-colors">Cancel</button>
                      <button onClick={performRename} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors">Save</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default App;
