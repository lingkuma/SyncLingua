
import React, { useState } from 'react';
import { X, Plus, Trash2, Edit2, Check, Volume2, Zap, Globe, Lock, LayoutTemplate } from 'lucide-react';
import { Preset, SessionPreset, SystemTemplate, GEMINI_TTS_VOICES } from '../types';

interface PresetManagerProps {
  isOpen: boolean;
  onClose: () => void;
  presets: Preset[];
  sessionPresets: SessionPreset[];
  systemTemplates: SystemTemplate[];
  setPresets: (p: Preset[]) => void;
  setSessionPresets: (sp: SessionPreset[]) => void;
  setSystemTemplates: (st: SystemTemplate[]) => void;
}

export const PresetManager: React.FC<PresetManagerProps> = ({ 
  isOpen, onClose, presets, sessionPresets, systemTemplates, 
  setPresets, setSessionPresets, setSystemTemplates 
}) => {
  const [activeTab, setActiveTab] = useState<'template' | 'main' | 'aux' | 'session'>('main');
  
  const [editingPreset, setEditingPreset] = useState<Partial<Preset> | null>(null);
  const [editingSessionPreset, setEditingSessionPreset] = useState<Partial<SessionPreset> | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<Partial<SystemTemplate> | null>(null);

  if (!isOpen) return null;

  const handleSavePreset = () => {
    if (!editingPreset?.title) return;
    
    const ttsConfig = editingPreset.ttsConfig || (activeTab === 'main' ? {
        enabled: true,
        voiceName: 'Puck',
        autoPlay: false
    } : undefined);

    if (editingPreset.id) {
        setPresets(presets.map(p => p.id === editingPreset.id ? { ...editingPreset, ttsConfig } as Preset : p));
    } else {
        const newPreset: Preset = {
            id: Date.now().toString(),
            title: editingPreset.title || 'New Preset',
            systemTemplateId: editingPreset.systemTemplateId,
            systemPrompt: editingPreset.systemPrompt || '',
            sharedPrompt: editingPreset.sharedPrompt || '',
            type: activeTab as 'main' | 'aux',
            ttsConfig,
            autoTrigger: editingPreset.autoTrigger
        };
        setPresets([...presets, newPreset]);
    }
    setEditingPreset(null);
  };

  const handleSaveSessionPreset = () => {
      if(!editingSessionPreset?.title) return;
      if (editingSessionPreset.id) {
          setSessionPresets(sessionPresets.map(sp => sp.id === editingSessionPreset.id ? editingSessionPreset as SessionPreset : sp));
      } else {
          const newSP: SessionPreset = {
              id: Date.now().toString(),
              title: editingSessionPreset.title || 'New Session Template',
              mainPresetIds: editingSessionPreset.mainPresetIds || [],
              defaultAuxPresetIds: editingSessionPreset.defaultAuxPresetIds || []
          };
          setSessionPresets([...sessionPresets, newSP]);
      }
      setEditingSessionPreset(null);
  }

  const handleSaveTemplate = () => {
      if(!editingTemplate?.title) return;
      if (editingTemplate.id) {
          setSystemTemplates(systemTemplates.map(t => t.id === editingTemplate.id ? editingTemplate as SystemTemplate : t));
      } else {
          const newTemplate: SystemTemplate = {
              id: Date.now().toString(),
              title: editingTemplate.title || 'New Template',
              content: editingTemplate.content || ''
          };
          setSystemTemplates([...systemTemplates, newTemplate]);
      }
      setEditingTemplate(null);
  };

  const handleDelete = (id: string) => {
    if (activeTab === 'session') {
        setSessionPresets(sessionPresets.filter(p => p.id !== id));
    } else if (activeTab === 'template') {
        setSystemTemplates(systemTemplates.filter(t => t.id !== id));
    } else {
        setPresets(presets.filter(p => p.id !== id));
    }
  };

  const createNew = () => {
      setEditingPreset(null); 
      setEditingSessionPreset(null);
      setEditingTemplate(null);

      if (activeTab === 'session') setEditingSessionPreset({ mainPresetIds: [], defaultAuxPresetIds: [] });
      else if (activeTab === 'template') setEditingTemplate({});
      else setEditingPreset({ type: activeTab as 'main' | 'aux' });
  }

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/80 flex items-center justify-center z-[100] p-4">
      <div className="bg-white dark:bg-[#1f1f1f] border border-slate-200 dark:border-[#333333] rounded-2xl w-full max-w-5xl h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-[#333333] bg-slate-50 dark:bg-[#141414]">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Library Manager</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"><X size={20} /></button>
        </div>

        <div className="flex border-b border-slate-200 dark:border-[#333333] bg-white dark:bg-[#1f1f1f] overflow-x-auto shrink-0">
            {[
                { id: 'template', label: 'Templates', icon: LayoutTemplate },
                { id: 'main', label: 'Scenarios', icon: Lock },
                { id: 'aux', label: 'Helpers', icon: Zap },
                { id: 'session', label: 'Presets', icon: Globe }
            ].map(tab => {
                const Icon = tab.icon;
                return (
                    <button
                        key={tab.id}
                        onClick={() => { setActiveTab(tab.id as any); setEditingPreset(null); setEditingSessionPreset(null); setEditingTemplate(null); }}
                        className={`px-5 py-4 font-bold text-[10px] transition-all uppercase tracking-widest flex items-center gap-2 whitespace-nowrap border-b-2 ${
                            activeTab === tab.id
                            ? 'border-indigo-600 dark:border-indigo-500 text-indigo-600 dark:text-indigo-400 bg-indigo-50/30 dark:bg-indigo-900/10' 
                            : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                        }`}
                    >
                        <Icon size={14} /> {tab.label}
                    </button>
                );
            })}
        </div>

        <div className="flex-1 overflow-hidden flex">
            {/* List Panel */}
            <div className="w-1/3 border-r border-slate-200 dark:border-[#2d2d2d] overflow-y-auto p-4 space-y-2 bg-slate-50 dark:bg-[#141414]">
                <button 
                    onClick={createNew}
                    className="w-full py-3 border-2 border-dashed border-slate-300 dark:border-[#333333] text-slate-500 dark:text-slate-500 hover:border-indigo-600 dark:hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl flex items-center justify-center gap-2 mb-4 transition-all font-bold text-xs uppercase tracking-widest"
                >
                    <Plus size={16} /> New Item
                </button>

                {(() => {
                    let items: any[] = [];
                    if (activeTab === 'template') items = systemTemplates;
                    else if (activeTab === 'session') items = sessionPresets;
                    else items = presets.filter(p => p.type === activeTab);

                    return items.map(item => {
                        let isSelected = false;
                        if (activeTab === 'template') isSelected = editingTemplate?.id === item.id;
                        else if (activeTab === 'session') isSelected = editingSessionPreset?.id === item.id;
                        else isSelected = editingPreset?.id === item.id;

                        return (
                            <div 
                                key={item.id} 
                                onClick={() => {
                                    if (activeTab === 'template') setEditingTemplate(item);
                                    else if (activeTab === 'session') setEditingSessionPreset(item);
                                    else setEditingPreset(item);
                                }}
                                className={`p-4 rounded-xl cursor-pointer border transition-all flex justify-between group shadow-sm ${
                                    isSelected
                                    ? 'bg-white dark:bg-[#252525] border-indigo-500 ring-1 ring-indigo-500 text-indigo-700 dark:text-indigo-300' 
                                    : 'bg-white dark:bg-[#1f1f1f] border-slate-200 dark:border-[#333333] text-slate-700 dark:text-slate-400 hover:border-slate-400 dark:hover:border-[#444444]'
                                }`}
                            >
                                <div className="flex flex-col truncate">
                                    <span className="truncate font-bold text-sm flex items-center gap-2">
                                        {item.title}
                                        {activeTab === 'main' && (item as Preset).systemTemplateId && (
                                            <LayoutTemplate size={12} className="text-indigo-600 dark:text-indigo-400" />
                                        )}
                                        {activeTab === 'aux' && (item as Preset).autoTrigger && (
                                            <Zap size={12} className="text-amber-500 fill-amber-500" />
                                        )}
                                    </span>
                                </div>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                                    className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-opacity"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        );
                    });
                })()}
            </div>

            {/* Editor Panel */}
            <div className="w-2/3 p-8 overflow-y-auto bg-white dark:bg-[#191919]">
                {(editingPreset || editingSessionPreset || editingTemplate) ? (
                    <div className="space-y-6 max-w-xl mx-auto">
                        
                        {/* 1. SYSTEM TEMPLATE EDITOR */}
                        {activeTab === 'template' && (
                            <>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Template Name</label>
                                    <input 
                                        type="text" 
                                        value={editingTemplate?.title || ''}
                                        onChange={e => setEditingTemplate(prev => ({ ...prev, title: e.target.value }))}
                                        className="w-full bg-slate-50 dark:bg-[#1f1f1f] border border-slate-200 dark:border-[#333333] rounded-xl p-3 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-600/20 outline-none font-medium"
                                        placeholder="e.g., Strict Roleplay Rules"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Base Instructions</label>
                                    <textarea 
                                        value={editingTemplate?.content || ''}
                                        onChange={e => setEditingTemplate(prev => ({ ...prev, content: e.target.value }))}
                                        className="w-full h-80 bg-slate-50 dark:bg-[#1f1f1f] border border-slate-200 dark:border-[#333333] rounded-xl p-4 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-600/20 outline-none font-mono text-sm leading-relaxed"
                                        placeholder="Enter behavioral rules..."
                                    />
                                </div>
                                <button 
                                    onClick={handleSaveTemplate}
                                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl flex items-center justify-center gap-2 font-bold text-sm shadow-lg shadow-indigo-600/10 transition-all"
                                >
                                    <Check size={18} /> Save Template
                                </button>
                            </>
                        )}

                        {/* 2. SESSION PRESET EDITOR */}
                        {activeTab === 'session' && (
                             <>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Preset Title</label>
                                    <input 
                                        type="text" 
                                        value={editingSessionPreset?.title || ''}
                                        onChange={e => setEditingSessionPreset(prev => ({ ...prev, title: e.target.value }))}
                                        className="w-full bg-slate-50 dark:bg-[#1f1f1f] border border-slate-200 dark:border-[#333333] rounded-xl p-3 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-600/20 outline-none font-medium"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Main Agents (Multi-Select)</label>
                                    <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto bg-slate-50 dark:bg-[#1f1f1f] p-3 rounded-xl border border-slate-200 dark:border-[#333333] custom-scrollbar">
                                        {presets.filter(p => p.type === 'main').map(p => {
                                            const isSelected = editingSessionPreset?.mainPresetIds?.includes(p.id);
                                            return (
                                                <div 
                                                    key={p.id}
                                                    onClick={() => {
                                                        const current = editingSessionPreset?.mainPresetIds || [];
                                                        const newIds = isSelected 
                                                            ? current.filter(id => id !== p.id)
                                                            : [...current, p.id];
                                                        setEditingSessionPreset(prev => ({ ...prev, mainPresetIds: newIds }));
                                                    }}
                                                    className={`p-2.5 rounded-lg cursor-pointer border text-xs font-bold transition-all ${
                                                        isSelected 
                                                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' 
                                                        : 'bg-white dark:bg-[#252525] border-slate-200 dark:border-[#333333] text-slate-500 dark:text-slate-400 hover:border-slate-300'
                                                    }`}
                                                >
                                                    <span className="truncate">{p.title}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Default Helpers</label>
                                    <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto bg-slate-50 dark:bg-[#1f1f1f] p-3 rounded-xl border border-slate-200 dark:border-[#333333] custom-scrollbar">
                                        {presets.filter(p => p.type === 'aux').map(p => {
                                            const isSelected = editingSessionPreset?.defaultAuxPresetIds?.includes(p.id);
                                            return (
                                                <div 
                                                    key={p.id}
                                                    onClick={() => {
                                                        const current = editingSessionPreset?.defaultAuxPresetIds || [];
                                                        const newIds = isSelected 
                                                            ? current.filter(id => id !== p.id)
                                                            : [...current, p.id];
                                                        setEditingSessionPreset(prev => ({ ...prev, defaultAuxPresetIds: newIds }));
                                                    }}
                                                    className={`p-2.5 rounded-lg cursor-pointer border text-xs font-bold transition-all flex items-center justify-between ${
                                                        isSelected 
                                                        ? 'bg-emerald-600 border-emerald-600 text-white shadow-md' 
                                                        : 'bg-white dark:bg-[#252525] border-slate-200 dark:border-[#333333] text-slate-500 dark:text-slate-400 hover:border-slate-300'
                                                    }`}
                                                >
                                                    <span className="truncate">{p.title}</span>
                                                    {p.autoTrigger && <Zap size={10} className={isSelected ? "text-white fill-white" : "text-amber-500 fill-amber-500"} />}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                                <button 
                                    onClick={handleSaveSessionPreset}
                                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl flex items-center justify-center gap-2 font-bold text-sm shadow-lg shadow-indigo-600/10 transition-all mt-4"
                                >
                                    <Check size={18} /> Save Preset
                                </button>
                             </>
                        )}

                        {/* 3. MAIN/AUX PRESET EDITOR */}
                        {(activeTab === 'main' || activeTab === 'aux') && (
                            <>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Display Name</label>
                                    <input 
                                        type="text" 
                                        value={editingPreset?.title || ''}
                                        onChange={e => setEditingPreset(prev => ({ ...prev, title: e.target.value }))}
                                        className="w-full bg-slate-50 dark:bg-[#1f1f1f] border border-slate-200 dark:border-[#333333] rounded-xl p-3 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-600/20 outline-none font-medium"
                                    />
                                </div>
                                
                                {activeTab === 'main' && (
                                    <div className="space-y-6">
                                        <div className="border border-indigo-200 dark:border-indigo-900/30 rounded-2xl p-5 bg-indigo-50/30 dark:bg-indigo-900/10">
                                            <div className="flex items-center gap-2 mb-4">
                                                <Lock size={16} className="text-indigo-600 dark:text-indigo-400" />
                                                <h3 className="text-xs font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-widest">Core Instructions</h3>
                                            </div>
                                            
                                            <div className="mb-4">
                                                <label className="block text-[10px] font-bold text-indigo-500 uppercase tracking-widest mb-2">Base Template</label>
                                                <select
                                                    value={editingPreset?.systemTemplateId || ''}
                                                    onChange={e => setEditingPreset(prev => ({ ...prev, systemTemplateId: e.target.value || undefined }))}
                                                    className="w-full bg-white dark:bg-[#1a1a1a] border border-indigo-200 dark:border-indigo-900/50 rounded-lg p-2.5 text-slate-900 dark:text-slate-200 text-sm outline-none font-medium"
                                                >
                                                    <option value="">-- Manual Rules --</option>
                                                    {systemTemplates.map(t => (
                                                        <option key={t.id} value={t.id}>{t.title}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div>
                                                <label className="block text-[10px] font-bold text-indigo-500 uppercase tracking-widest mb-2">Specific Persona</label>
                                                <textarea 
                                                    value={editingPreset?.systemPrompt || ''}
                                                    onChange={e => setEditingPreset(prev => ({ ...prev, systemPrompt: e.target.value }))}
                                                    className="w-full h-32 bg-white dark:bg-[#1a1a1a] border border-indigo-200 dark:border-indigo-900/50 rounded-xl p-3 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-600/20 outline-none font-mono text-sm leading-relaxed"
                                                    placeholder="Define the AI character..."
                                                />
                                            </div>
                                        </div>

                                        <div className="border border-emerald-200 dark:border-emerald-900/30 rounded-2xl p-5 bg-emerald-50/30 dark:bg-emerald-900/10">
                                            <div className="flex items-center gap-2 mb-4">
                                                <Globe size={16} className="text-emerald-600 dark:text-emerald-400" />
                                                <h3 className="text-xs font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-widest">Shared Scenario</h3>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-2">Context (Visible to all agents)</label>
                                                <textarea 
                                                    value={editingPreset?.sharedPrompt || ''}
                                                    onChange={e => setEditingPreset(prev => ({ ...prev, sharedPrompt: e.target.value }))}
                                                    className="w-full h-24 bg-white dark:bg-[#1a1a1a] border border-emerald-200 dark:border-emerald-900/50 rounded-xl p-3 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-emerald-600/20 outline-none font-mono text-sm leading-relaxed"
                                                    placeholder="Describe the environment/situation..."
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'aux' && (
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Helper Logic</label>
                                        <textarea 
                                            value={editingPreset?.systemPrompt || ''}
                                            onChange={e => setEditingPreset(prev => ({ ...prev, systemPrompt: e.target.value }))}
                                            className="w-full h-64 bg-slate-50 dark:bg-[#1f1f1f] border border-slate-200 dark:border-[#333333] rounded-xl p-4 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-600/20 outline-none font-mono text-sm leading-relaxed"
                                            placeholder="What should this helper do? (e.g. check grammar)"
                                        />
                                    </div>
                                )}
                                
                                {activeTab === 'aux' && (
                                     <div className="bg-amber-50 dark:bg-amber-900/10 p-5 rounded-2xl border border-amber-200 dark:border-amber-900/30 mt-4">
                                        <div className="flex items-center gap-2 mb-2 text-amber-700 dark:text-amber-500">
                                            <Zap size={16} className="fill-current" />
                                            <span className="text-xs font-bold uppercase tracking-widest">Auto Analysis</span>
                                        </div>
                                        <div className="flex items-start gap-4 mt-3">
                                            <input 
                                                type="checkbox"
                                                id="autotrigger"
                                                checked={editingPreset?.autoTrigger || false}
                                                onChange={e => setEditingPreset(prev => ({ ...prev, autoTrigger: e.target.checked }))}
                                                className="w-6 h-6 rounded-lg bg-white dark:bg-[#141414] border-amber-300 dark:border-amber-900/50 mt-0.5 accent-amber-500 cursor-pointer"
                                            />
                                            <div>
                                                <label htmlFor="autotrigger" className="text-sm font-bold text-amber-900 dark:text-amber-300 block cursor-pointer">
                                                    Enable Passive Analysis
                                                </label>
                                                <p className="text-xs text-amber-700/70 dark:text-amber-500/50 mt-1 font-medium">
                                                    This tool will automatically analyze every new response from the Main AI.
                                                </p>
                                            </div>
                                        </div>
                                     </div>
                                )}

                                {activeTab === 'main' && (
                                    <div className="bg-slate-50 dark:bg-[#141414] p-5 rounded-2xl border border-slate-200 dark:border-[#333333] mt-4">
                                        <div className="flex items-center gap-2 mb-4 text-slate-900 dark:text-white">
                                            <Volume2 size={16} />
                                            <span className="text-xs font-bold uppercase tracking-widest">Audio Output</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-6">
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-500 uppercase tracking-widest mb-2">Voice Talent</label>
                                                <select
                                                    value={editingPreset?.ttsConfig?.voiceName || 'Puck'}
                                                    onChange={e => setEditingPreset(prev => ({ 
                                                        ...prev, 
                                                        ttsConfig: { 
                                                            enabled: true,
                                                            autoPlay: prev?.ttsConfig?.autoPlay ?? false,
                                                            voiceName: e.target.value
                                                        } 
                                                    }))}
                                                    className="w-full bg-white dark:bg-[#252525] border border-slate-200 dark:border-[#444444] rounded-lg px-3 py-2.5 text-sm text-slate-900 dark:text-slate-200 font-medium outline-none"
                                                >
                                                    {GEMINI_TTS_VOICES.map(v => (
                                                        <option key={v.id} value={v.id}>{v.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="flex items-center gap-3 pt-6">
                                                <input 
                                                    type="checkbox"
                                                    id="autoplay"
                                                    checked={editingPreset?.ttsConfig?.autoPlay || false}
                                                    onChange={e => setEditingPreset(prev => ({ 
                                                        ...prev, 
                                                        ttsConfig: { 
                                                            enabled: true,
                                                            voiceName: prev?.ttsConfig?.voiceName || 'Puck',
                                                            autoPlay: e.target.checked
                                                        } 
                                                    }))}
                                                    className="w-6 h-6 rounded-lg bg-white dark:bg-[#252525] border-slate-300 dark:border-[#444444] accent-indigo-600 cursor-pointer"
                                                />
                                                <label htmlFor="autoplay" className="text-sm font-bold text-slate-700 dark:text-slate-300 cursor-pointer">Auto-play</label>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <button 
                                    onClick={handleSavePreset}
                                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl flex items-center justify-center gap-2 font-bold text-sm shadow-lg shadow-indigo-600/10 transition-all mt-6"
                                >
                                    <Check size={18} /> Save Preset
                                </button>
                            </>
                        )}
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400">
                        <Edit2 size={64} className="mb-6 opacity-5" />
                        <h3 className="font-bold uppercase tracking-widest text-xs">Editor Ready</h3>
                        <p className="text-xs mt-2 text-slate-500">Select an item from the left to start editing.</p>
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};
