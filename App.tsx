
import React, { useState, useEffect, useRef } from 'react';
import { Settings, Book, MessageSquare, Plus, Pencil, Trash2, LayoutGrid, Menu, X, Columns2 } from 'lucide-react';
import { Preset, Session, SessionPreset, AppSettings, SystemTemplate, DEFAULT_MODELS } from './types';
import { SettingsModal } from './components/SettingsModal';
import { PresetManager } from './components/PresetManager';
import { ChatInterface } from './components/ChatInterface';

const INITIAL_TEMPLATES: SystemTemplate[] = [
    {
        id: 'st1',
        title: 'Strict Roleplay',
        content: `Stay in character. Do not break fourth wall.`
    },
    {
        id: 'st2',
        title: 'Linguistic Analysis',
        content: `Focus on sentence structure and lexical choice.`
    }
];

const INITIAL_MAIN_PRESETS: Preset[] = [
  { id: 'mp1', title: 'Formal Cashier', type: 'main', systemPrompt: 'You are a formal Edeka cashier in Hamburg.', ttsConfig: { enabled: true, voiceName: 'Fenrir', autoPlay: true } },
  { id: 'mp2', title: 'Casual Local', type: 'main', systemPrompt: 'You are a friendly, casual Berlin local.', ttsConfig: { enabled: true, voiceName: 'Puck', autoPlay: false } },
];

const INITIAL_AUX_PRESETS: Preset[] = [
  { id: 'ap1', title: 'Grammar Coach', type: 'aux', autoTrigger: true, systemPrompt: 'Analyze grammar in the main conversation.' },
  { id: 'ap2', title: 'Vocabulary Coach', type: 'aux', systemPrompt: 'Suggest better words.' },
];

const INITIAL_SESSION_PRESETS: SessionPreset[] = [
    { id: 'sp1', title: 'Dual Personality Practice', mainPresetIds: ['mp1', 'mp2'], defaultAuxPresetIds: ['ap1'] }
];

const STORAGE_KEYS = { SESSIONS: 'synclingua_sessions', PRESETS: 'synclingua_presets', TEMPLATES: 'synclingua_templates', SESSION_PRESETS: 'synclingua_session_presets', SETTINGS: 'synclingua_settings', ACTIVE_SESSION: 'synclingua_active_session_id' };

const App: React.FC = () => {
  const loadState = <T,>(key: string, defaultVal: T): T => {
      try { const saved = localStorage.getItem(key); if (saved) return JSON.parse(saved); } catch (e) {}
      return defaultVal;
  };

  const [sessions, setSessions] = useState<Session[]>(() => loadState(STORAGE_KEYS.SESSIONS, []));
  const [activeSessionId, setActiveSessionId] = useState<string | null>(() => loadState(STORAGE_KEYS.ACTIVE_SESSION, null));
  const [presets, setPresets] = useState<Preset[]>(() => loadState(STORAGE_KEYS.PRESETS, [...INITIAL_MAIN_PRESETS, ...INITIAL_AUX_PRESETS]));
  const [systemTemplates, setSystemTemplates] = useState<SystemTemplate[]>(() => loadState(STORAGE_KEYS.TEMPLATES, INITIAL_TEMPLATES));
  const [sessionPresets, setSessionPresets] = useState<SessionPreset[]>(() => loadState(STORAGE_KEYS.SESSION_PRESETS, INITIAL_SESSION_PRESETS));
  const [settings, setSettings] = useState<AppSettings>(() => {
      const saved = loadState<AppSettings | null>(STORAGE_KEYS.SETTINGS, null);
      if (saved) return { ...saved };
      return { model: DEFAULT_MODELS[0].id, temperature: 0.7, theme: 'auto' };
  });

  useEffect(() => { localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions)); }, [sessions]);
  useEffect(() => { if (activeSessionId) localStorage.setItem(STORAGE_KEYS.ACTIVE_SESSION, JSON.stringify(activeSessionId)); else localStorage.removeItem(STORAGE_KEYS.ACTIVE_SESSION); }, [activeSessionId]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.PRESETS, JSON.stringify(presets)); }, [presets]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.TEMPLATES, JSON.stringify(systemTemplates)); }, [systemTemplates]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.SESSION_PRESETS, JSON.stringify(sessionPresets)); }, [sessionPresets]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings)); }, [settings]);

  useEffect(() => {
    const isDark = settings.theme === 'dark' || (settings.theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', isDark);
  }, [settings.theme]);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const activeSession = sessions.find(s => s.id === activeSessionId) || null;
  const activeMainPresets = activeSession ? presets.filter(p => activeSession.mainPresetIds.includes(p.id)) : [];
  const auxPresets = presets.filter(p => p.type === 'aux');

  const createSession = (sessionPresetId: string) => {
    const template = sessionPresets.find(sp => sp.id === sessionPresetId);
    if (!template) return;
    const newSession: Session = {
        id: Date.now().toString(),
        title: template.title,
        mainPresetIds: template.mainPresetIds,
        mainMessages: [],
        auxTabs: template.defaultAuxPresetIds.map(apId => ({ id: `${Date.now()}-${Math.random()}`, presetId: apId, messages: [] })),
        activeAuxTabId: template.defaultAuxPresetIds[0] || null,
        createdAt: Date.now()
    };
    setSessions([newSession, ...sessions]);
    setActiveSessionId(newSession.id);
    setIsMobileMenuOpen(false);
  };

  const createEmptySession = () => {
      const newSession: Session = { id: Date.now().toString(), title: 'Empty Workspace', mainPresetIds: [], mainMessages: [], auxTabs: [], activeAuxTabId: null, createdAt: Date.now() };
      setSessions([newSession, ...sessions]);
      setActiveSessionId(newSession.id);
  };

  return (
    <div className="flex h-screen w-screen bg-white dark:bg-[#191919] text-slate-900 dark:text-slate-100 font-sans overflow-hidden">
      <div className={`fixed inset-y-0 left-0 z-50 w-72 bg-slate-50 dark:bg-[#141414] border-r border-slate-200 dark:border-[#2d2d2d] flex flex-col transition-transform md:relative md:translate-x-0 md:w-64 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-4 border-b border-slate-200 dark:border-[#2d2d2d] flex items-center justify-between">
            <div onClick={() => setActiveSessionId(null)} className="flex items-center gap-2 cursor-pointer">
                <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center"><Columns2 size={18} className="text-white" /></div>
                <h1 className="font-bold text-lg">SyncLingua</h1>
            </div>
            <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden"><X size={20} /></button>
        </div>
        <div className="p-4 space-y-2">
            <button onClick={() => setActiveSessionId(null)} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all ${!activeSessionId ? 'bg-indigo-600 text-white' : 'hover:bg-slate-200 dark:hover:bg-[#1f1f1f]'}`}><LayoutGrid size={18} /> Hub</button>
            <button onClick={() => setIsLibraryOpen(true)} className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg hover:bg-slate-200 dark:hover:bg-[#1f1f1f]"><Book size={18} /> Library</button>
        </div>
        <div className="flex-1 overflow-y-auto px-2 space-y-1">
            <div className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sessions</div>
            {sessions.map(s => (
                <div key={s.id} onClick={() => setActiveSessionId(s.id)} className={`p-3 rounded-lg cursor-pointer transition-all ${activeSessionId === s.id ? 'bg-white dark:bg-[#1f1f1f] shadow-sm border border-slate-200 dark:border-[#333333]' : 'hover:bg-slate-100 dark:hover:bg-[#1a1a1a]'}`}>
                    <div className={`text-sm font-medium truncate ${activeSessionId === s.id ? 'text-indigo-600' : ''}`}>{s.title}</div>
                </div>
            ))}
        </div>
        <div className="p-4 border-t border-slate-200 dark:border-[#2d2d2d]">
            <button onClick={() => setIsSettingsOpen(true)} className="flex items-center gap-3 text-slate-500 hover:text-indigo-600 transition-colors w-full p-2"><Settings size={20} /> Settings</button>
        </div>
      </div>

      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {activeSession ? (
            <ChatInterface session={activeSession} updateSession={(u) => setSessions(prev => prev.map(s => s.id === u.id ? u : s))} auxPresets={auxPresets} systemTemplates={systemTemplates} settings={settings} mainPresets={activeMainPresets} />
        ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50 dark:bg-[#111]">
                <h2 className="text-3xl font-bold mb-8">Synchronized Dialogue Studio</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-5xl">
                    <button onClick={createEmptySession} className="p-6 bg-white dark:bg-[#1f1f1f] border-2 border-dashed border-slate-300 dark:border-[#333333] rounded-2xl flex flex-col items-center justify-center hover:border-indigo-500 transition-all h-48"><Plus size={32} className="mb-2 text-slate-300" /> New Empty Flow</button>
                    {sessionPresets.map(sp => (
                        <button key={sp.id} onClick={() => createSession(sp.id)} className="p-6 bg-white dark:bg-[#1f1f1f] border border-slate-200 dark:border-[#333333] rounded-2xl shadow-sm text-left hover:shadow-xl transition-all h-48 flex flex-col">
                            <h3 className="text-xl font-bold mb-auto">{sp.title}</h3>
                            <div className="text-xs text-slate-500 mt-2 flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-indigo-500"></div> {sp.mainPresetIds.length} Agents Synced</div>
                            <div className="text-xs text-slate-500 mt-1 flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> {sp.defaultAuxPresetIds.length} Passive Analyzers</div>
                        </button>
                    ))}
                </div>
            </div>
        )}
      </div>

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} settings={settings} onSave={setSettings} onExportData={() => {}} onImportData={() => {}} />
      <PresetManager isOpen={isLibraryOpen} onClose={() => setIsLibraryOpen(false)} presets={presets} sessionPresets={sessionPresets} systemTemplates={systemTemplates} setPresets={setPresets} setSessionPresets={setSessionPresets} setSystemTemplates={setSystemTemplates} />
    </div>
  );
};

export default App;
