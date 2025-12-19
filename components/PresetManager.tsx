
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
    
    // Ensure TTS Config object exists if we are in main mode
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
            systemTemplateId: editingPreset.systemTemplateId, // Save template link
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
              mainPresetId: editingSessionPreset.mainPresetId || null,
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

      if (activeTab === 'session') setEditingSessionPreset({});
      else if (activeTab === 'template') setEditingTemplate({});
      else setEditingPreset({ type: activeTab as 'main' | 'aux' });
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-5xl h-[90vh] flex flex-col shadow-2xl">
        <div className="flex justify-between items-center p-4 border-b border-slate-700 bg-slate-800/50 rounded-t-xl">
          <h2 className="text-xl font-semibold text-slate-100">Library Manager</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={20} /></button>
        </div>

        <div className="flex border-b border-slate-700 overflow-x-auto">
            {[
                { id: 'template', label: 'Base Templates', icon: LayoutTemplate },
                { id: 'main', label: 'Main Scenarios', icon: Lock },
                { id: 'aux', label: 'Auxiliary Tools', icon: Zap },
                { id: 'session', label: 'Session Presets', icon: Globe }
            ].map(tab => {
                const Icon = tab.icon;
                return (
                    <button
                        key={tab.id}
                        onClick={() => { setActiveTab(tab.id as any); setEditingPreset(null); setEditingSessionPreset(null); setEditingTemplate(null); }}
                        className={`px-5 py-3 font-medium text-sm transition-colors uppercase tracking-wider flex items-center gap-2 whitespace-nowrap ${
                            activeTab === tab.id
                            ? 'border-b-2 border-indigo-500 text-indigo-400 bg-slate-800/30' 
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
                        }`}
                    >
                        <Icon size={14} /> {tab.label}
                    </button>
                );
            })}
        </div>

        <div className="flex-1 overflow-hidden flex">
            {/* List Panel */}
            <div className="w-1/3 border-r border-slate-700 overflow-y-auto p-4 space-y-2 bg-slate-925">
                <button 
                    onClick={createNew}
                    className="w-full py-2 border-2 border-dashed border-slate-700 text-slate-400 hover:border-indigo-500 hover:text-indigo-400 rounded-lg flex items-center justify-center gap-2 mb-4 transition-all"
                >
                    <Plus size={16} /> Create New
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
                                className={`p-3 rounded-lg cursor-pointer border transition-all flex justify-between group ${
                                    isSelected
                                    ? 'bg-indigo-900/20 border-indigo-500/50 text-indigo-100' 
                                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600'
                                }`}
                            >
                                <div className="flex flex-col truncate">
                                    <span className="truncate font-medium flex items-center gap-2">
                                        {item.title}
                                        {activeTab === 'main' && (item as Preset).systemTemplateId && (
                                            <LayoutTemplate size={12} className="text-indigo-400" />
                                        )}
                                        {activeTab === 'aux' && (item as Preset).autoTrigger && (
                                            <Zap size={12} className="text-amber-400 fill-amber-400" />
                                        )}
                                    </span>
                                </div>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                                    className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-opacity"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        );
                    });
                })()}
            </div>

            {/* Editor Panel */}
            <div className="w-2/3 p-6 overflow-y-auto bg-slate-900/50">
                {(editingPreset || editingSessionPreset || editingTemplate) ? (
                    <div className="space-y-6 max-w-2xl mx-auto">
                        
                        {/* 1. SYSTEM TEMPLATE EDITOR */}
                        {activeTab === 'template' && (
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">Template Name</label>
                                    <input 
                                        type="text" 
                                        value={editingTemplate?.title || ''}
                                        onChange={e => setEditingTemplate(prev => ({ ...prev, title: e.target.value }))}
                                        className="w-full bg-slate-800 border border-slate-600 rounded-lg p-3 text-slate-100 focus:border-indigo-500 outline-none"
                                        placeholder="e.g., Strict Roleplay Rules"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">Base Instructions</label>
                                    <p className="text-xs text-slate-500 mb-2">These instructions will be prepended to the system prompt of any Main Preset that uses this template.</p>
                                    <textarea 
                                        value={editingTemplate?.content || ''}
                                        onChange={e => setEditingTemplate(prev => ({ ...prev, content: e.target.value }))}
                                        className="w-full h-80 bg-slate-800 border border-slate-600 rounded-lg p-3 text-slate-100 focus:border-indigo-500 outline-none font-mono text-sm leading-relaxed"
                                        placeholder="e.g. You are a strict roleplay agent. Never break character. If the user speaks English, ignore them..."
                                    />
                                </div>
                                <button 
                                    onClick={handleSaveTemplate}
                                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg flex items-center justify-center gap-2 font-medium"
                                >
                                    <Check size={18} /> Save Template
                                </button>
                            </>
                        )}

                        {/* 2. SESSION PRESET EDITOR */}
                        {activeTab === 'session' && (
                             <>
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">Template Name</label>
                                    <input 
                                        type="text" 
                                        value={editingSessionPreset?.title || ''}
                                        onChange={e => setEditingSessionPreset(prev => ({ ...prev, title: e.target.value }))}
                                        className="w-full bg-slate-800 border border-slate-600 rounded-lg p-3 text-slate-100 focus:border-indigo-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">Main Scenario (Optional)</label>
                                    <select
                                        value={editingSessionPreset?.mainPresetId || ''}
                                        onChange={e => setEditingSessionPreset(prev => ({ ...prev, mainPresetId: e.target.value || null }))}
                                        className="w-full bg-slate-800 border border-slate-600 rounded-lg p-3 text-slate-100 outline-none"
                                    >
                                        <option value="">-- None (Custom) --</option>
                                        {presets.filter(p => p.type === 'main').map(p => (
                                            <option key={p.id} value={p.id}>{p.title}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">Default Auxiliary Tools</label>
                                    <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto bg-slate-800 p-2 rounded-lg border border-slate-700">
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
                                                    className={`p-2 rounded cursor-pointer border text-sm transition-all flex items-center justify-between ${
                                                        isSelected 
                                                        ? 'bg-indigo-900/50 border-indigo-500 text-indigo-100' 
                                                        : 'bg-slate-700/30 border-transparent text-slate-400 hover:bg-slate-700'
                                                    }`}
                                                >
                                                    <span className="truncate">{p.title}</span>
                                                    {p.autoTrigger && <Zap size={12} className="text-yellow-400 fill-yellow-400" />}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                                <button 
                                    onClick={handleSaveSessionPreset}
                                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg flex items-center justify-center gap-2 font-medium mt-4"
                                >
                                    <Check size={18} /> Save Template
                                </button>
                             </>
                        )}

                        {/* 3. MAIN/AUX PRESET EDITOR */}
                        {(activeTab === 'main' || activeTab === 'aux') && (
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">Name</label>
                                    <input 
                                        type="text" 
                                        value={editingPreset?.title || ''}
                                        onChange={e => setEditingPreset(prev => ({ ...prev, title: e.target.value }))}
                                        className="w-full bg-slate-800 border border-slate-600 rounded-lg p-3 text-slate-100 focus:border-indigo-500 outline-none"
                                    />
                                </div>
                                
                                {activeTab === 'main' && (
                                    <>
                                        <div className="space-y-6">
                                            {/* Section 1: Private Configuration */}
                                            <div className="border border-indigo-500/30 rounded-xl p-4 bg-indigo-900/10">
                                                <div className="flex items-center gap-2 mb-4">
                                                    <Lock size={16} className="text-indigo-400" />
                                                    <h3 className="text-sm font-bold text-indigo-200 uppercase tracking-wider">Private Configuration</h3>
                                                </div>
                                                
                                                <div className="mb-4">
                                                    <label className="block text-xs font-semibold text-indigo-300 mb-1">
                                                        1. Base Template (Optional)
                                                    </label>
                                                    <p className="text-[10px] text-slate-400 mb-2">General behavioral rules (e.g. "Strict Teacher Mode").</p>
                                                    <select
                                                        value={editingPreset?.systemTemplateId || ''}
                                                        onChange={e => setEditingPreset(prev => ({ ...prev, systemTemplateId: e.target.value || undefined }))}
                                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-slate-200 text-sm focus:border-indigo-500 outline-none"
                                                    >
                                                        <option value="">-- No Template (Custom Only) --</option>
                                                        {systemTemplates.map(t => (
                                                            <option key={t.id} value={t.id}>{t.title}</option>
                                                        ))}
                                                    </select>
                                                </div>

                                                <div>
                                                    <label className="block text-xs font-semibold text-indigo-300 mb-1">
                                                        2. Specific Persona
                                                    </label>
                                                    <p className="text-[10px] text-slate-400 mb-2">Specific details for this character (e.g. "You are John, a baker").</p>
                                                    <textarea 
                                                        value={editingPreset?.systemPrompt || ''}
                                                        onChange={e => setEditingPreset(prev => ({ ...prev, systemPrompt: e.target.value }))}
                                                        className="w-full h-24 bg-slate-900 border border-slate-700 rounded-lg p-3 text-slate-200 focus:border-indigo-500 outline-none font-mono text-sm leading-relaxed"
                                                        placeholder="Describe the specific persona..."
                                                    />
                                                </div>
                                            </div>

                                            {/* Section 2: Public Configuration */}
                                            <div className="border border-emerald-500/30 rounded-xl p-4 bg-emerald-900/10">
                                                <div className="flex items-center gap-2 mb-4">
                                                    <Globe size={16} className="text-emerald-400" />
                                                    <h3 className="text-sm font-bold text-emerald-200 uppercase tracking-wider">Public Shared Context</h3>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-semibold text-emerald-300 mb-1">
                                                        3. Scenario Description
                                                    </label>
                                                    <p className="text-[10px] text-slate-400 mb-2">
                                                        Visible to <strong>BOTH</strong> Main AI and Aux Helpers. (e.g. "We are at a bakery").
                                                    </p>
                                                    <textarea 
                                                        value={editingPreset?.sharedPrompt || ''}
                                                        onChange={e => setEditingPreset(prev => ({ ...prev, sharedPrompt: e.target.value }))}
                                                        className="w-full h-24 bg-slate-900 border border-slate-700 rounded-lg p-3 text-slate-200 focus:border-emerald-500 outline-none font-mono text-sm leading-relaxed"
                                                        placeholder="Describe the situation..."
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                )}

                                {activeTab === 'aux' && (
                                    <div>
                                        <label className="block text-sm font-medium text-slate-400 mb-1">System Prompt</label>
                                        <textarea 
                                            value={editingPreset?.systemPrompt || ''}
                                            onChange={e => setEditingPreset(prev => ({ ...prev, systemPrompt: e.target.value }))}
                                            className="w-full h-64 bg-slate-800 border border-slate-600 rounded-lg p-3 text-slate-100 focus:border-indigo-500 outline-none font-mono text-sm leading-relaxed"
                                            placeholder="You are an expert German tutor..."
                                        />
                                    </div>
                                )}
                                
                                {activeTab === 'aux' && (
                                     <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700/50 mt-4">
                                        <div className="flex items-center gap-2 mb-2 text-indigo-400">
                                            <Zap size={16} />
                                            <span className="text-sm font-semibold uppercase tracking-wider">Auto-Response</span>
                                        </div>
                                        <div className="flex items-start gap-3 mt-3">
                                            <input 
                                                type="checkbox"
                                                id="autotrigger"
                                                checked={editingPreset?.autoTrigger || false}
                                                onChange={e => setEditingPreset(prev => ({ 
                                                    ...prev, 
                                                    autoTrigger: e.target.checked
                                                }))}
                                                className="w-5 h-5 rounded bg-slate-900 border-slate-600 mt-0.5 accent-indigo-500"
                                            />
                                            <div>
                                                <label htmlFor="autotrigger" className="text-sm font-medium text-slate-200 block">
                                                    Auto-respond to AI messages
                                                </label>
                                                <p className="text-xs text-slate-500 mt-1">
                                                    Trigger automatically when Main AI responds.
                                                </p>
                                            </div>
                                        </div>
                                     </div>
                                )}

                                {activeTab === 'main' && (
                                    <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700/50 mt-4">
                                        <div className="flex items-center gap-2 mb-3 text-indigo-400">
                                            <Volume2 size={16} />
                                            <span className="text-sm font-semibold uppercase tracking-wider">Text-to-Speech Config</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs text-slate-400 mb-1">Voice</label>
                                                <select
                                                    value={editingPreset?.ttsConfig?.voiceName || 'Puck'}
                                                    onChange={e => setEditingPreset(prev => ({ 
                                                        ...prev, 
                                                        ttsConfig: { 
                                                            enabled: prev?.ttsConfig?.enabled ?? true,
                                                            autoPlay: prev?.ttsConfig?.autoPlay ?? false,
                                                            voiceName: e.target.value
                                                        } 
                                                    }))}
                                                    className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-2 text-sm text-slate-200"
                                                >
                                                    {GEMINI_TTS_VOICES.map(v => (
                                                        <option key={v.id} value={v.id}>{v.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="flex items-center gap-2 mt-5">
                                                <input 
                                                    type="checkbox"
                                                    id="autoplay"
                                                    checked={editingPreset?.ttsConfig?.autoPlay || false}
                                                    onChange={e => setEditingPreset(prev => ({ 
                                                        ...prev, 
                                                        ttsConfig: { 
                                                            enabled: prev?.ttsConfig?.enabled ?? true,
                                                            voiceName: prev?.ttsConfig?.voiceName || 'Puck',
                                                            autoPlay: e.target.checked
                                                        } 
                                                    }))}
                                                    className="w-4 h-4 rounded bg-slate-900 border-slate-600 accent-indigo-500"
                                                />
                                                <label htmlFor="autoplay" className="text-sm text-slate-300">Auto-play Responses</label>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <button 
                                    onClick={handleSavePreset}
                                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg flex items-center justify-center gap-2 font-medium mt-6"
                                >
                                    <Check size={18} /> Save Preset
                                </button>
                            </>
                        )}
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-500">
                        <Edit2 size={48} className="mb-4 opacity-20" />
                        <p>Select an item to edit or create a new one.</p>
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};
