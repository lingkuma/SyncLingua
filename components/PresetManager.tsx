
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

  const handleSave = () => {
    if (activeTab === 'template' && editingTemplate?.title) {
        if (editingTemplate.id) setSystemTemplates(systemTemplates.map(t => t.id === editingTemplate.id ? editingTemplate as SystemTemplate : t));
        else setSystemTemplates([...systemTemplates, { ...editingTemplate, id: Date.now().toString() } as SystemTemplate]);
        setEditingTemplate(null);
    } else if (activeTab === 'session' && editingSessionPreset?.title) {
        if (editingSessionPreset.id) setSessionPresets(sessionPresets.map(s => s.id === editingSessionPreset.id ? editingSessionPreset as SessionPreset : s));
        else setSessionPresets([...sessionPresets, { ...editingSessionPreset, id: Date.now().toString(), defaultAuxPresetIds: editingSessionPreset.defaultAuxPresetIds || [] } as SessionPreset]);
        setEditingSessionPreset(null);
    } else if ((activeTab === 'main' || activeTab === 'aux') && editingPreset?.title) {
        if (editingPreset.id) setPresets(presets.map(p => p.id === editingPreset.id ? editingPreset as Preset : p));
        else setPresets([...presets, { ...editingPreset, id: Date.now().toString(), type: activeTab } as Preset]);
        setEditingPreset(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-xl w-full max-w-5xl h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-dark-800 bg-slate-50 dark:bg-dark-925">
          <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Library Manager</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"><X size={20} /></button>
        </div>

        <div className="flex border-b border-slate-200 dark:border-dark-800 overflow-x-auto bg-slate-50 dark:bg-dark-925">
            {[
                { id: 'template', label: 'Templates', icon: LayoutTemplate },
                { id: 'main', label: 'Main', icon: Lock },
                { id: 'aux', label: 'Helpers', icon: Zap },
                { id: 'session', label: 'Bundles', icon: Globe }
            ].map(tab => (
                <button
                    key={tab.id}
                    onClick={() => { setActiveTab(tab.id as any); setEditingPreset(null); setEditingSessionPreset(null); setEditingTemplate(null); }}
                    className={`px-6 py-3 font-semibold text-xs uppercase tracking-widest flex items-center gap-2 border-b-2 transition-all ${activeTab === tab.id ? 'border-indigo-600 text-indigo-600 bg-white dark:bg-dark-900' : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
                >
                    <tab.icon size={14} /> {tab.label}
                </button>
            ))}
        </div>

        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
            {/* List Panel */}
            <div className="w-full md:w-1/3 border-r border-slate-200 dark:border-dark-800 overflow-y-auto p-4 space-y-2 bg-slate-50 dark:bg-dark-925">
                <button onClick={() => { setEditingPreset({}); setEditingSessionPreset({}); setEditingTemplate({}); }} className="w-full py-2 border-2 border-dashed border-slate-200 dark:border-dark-800 text-slate-400 hover:border-indigo-500 hover:text-indigo-600 rounded-lg flex items-center justify-center gap-2 mb-4 transition-all"><Plus size={16} /> Create New</button>
                {/* Simplified list render logic */}
                {(() => {
                    const items = activeTab === 'template' ? systemTemplates : (activeTab === 'session' ? sessionPresets : presets.filter(p => p.type === activeTab));
                    return items.map(item => (
                        <div key={item.id} onClick={() => { if(activeTab === 'template') setEditingTemplate(item); else if(activeTab === 'session') setEditingSessionPreset(item); else setEditingPreset(item); }} className={`p-3 rounded-lg cursor-pointer border transition-all flex justify-between group ${ (editingTemplate?.id === item.id || editingSessionPreset?.id === item.id || editingPreset?.id === item.id) ? 'bg-indigo-50 dark:bg-indigo-900/10 border-indigo-200 dark:border-indigo-500/50 text-indigo-700 dark:text-indigo-200' : 'bg-white dark:bg-dark-900 border-slate-200 dark:border-dark-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-dark-700'}`}>
                            <span className="font-medium truncate">{item.title}</span>
                            <button onClick={(e) => { e.stopPropagation(); if(activeTab === 'template') setSystemTemplates(systemTemplates.filter(t => t.id !== item.id)); else if(activeTab === 'session') setSessionPresets(sessionPresets.filter(s => s.id !== item.id)); else setPresets(presets.filter(p => p.id !== item.id)); }} className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-opacity"><Trash2 size={16} /></button>
                        </div>
                    ));
                })()}
            </div>

            {/* Editor Panel */}
            <div className="flex-1 p-6 overflow-y-auto bg-white dark:bg-dark-900">
                {(editingPreset || editingSessionPreset || editingTemplate) ? (
                    <div className="space-y-6 max-w-xl">
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-2 tracking-wider">Display Name</label>
                            <input type="text" value={editingTemplate?.title || editingSessionPreset?.title || editingPreset?.title || ''} onChange={e => {
                                if(activeTab === 'template') setEditingTemplate(p => ({...p, title: e.target.value}));
                                else if(activeTab === 'session') setEditingSessionPreset(p => ({...p, title: e.target.value}));
                                else setEditingPreset(p => ({...p, title: e.target.value}));
                            }} className="w-full bg-slate-50 dark:bg-dark-850 border border-slate-200 dark:border-dark-700 rounded-lg p-3 outline-none focus:ring-2 focus:ring-indigo-500" />
                        </div>
                        {activeTab !== 'session' && (
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-2 tracking-wider">Instructions / Prompt</label>
                                <textarea rows={10} value={editingTemplate?.content || editingPreset?.systemPrompt || ''} onChange={e => {
                                    if(activeTab === 'template') setEditingTemplate(p => ({...p, content: e.target.value}));
                                    else setEditingPreset(p => ({...p, systemPrompt: e.target.value}));
                                }} className="w-full bg-slate-50 dark:bg-dark-850 border border-slate-200 dark:border-dark-700 rounded-lg p-3 outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm" />
                            </div>
                        )}
                        {activeTab === 'main' && (
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-2 tracking-wider">Shared Scenario Context</label>
                                <textarea rows={3} value={editingPreset?.sharedPrompt || ''} onChange={e => setEditingPreset(p => ({...p, sharedPrompt: e.target.value}))} className="w-full bg-slate-50 dark:bg-dark-850 border border-slate-200 dark:border-dark-700 rounded-lg p-3 outline-none focus:ring-2 focus:ring-indigo-500 text-sm" placeholder="Public context shared with all agents..." />
                            </div>
                        )}
                        <button onClick={handleSave} className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg flex items-center justify-center gap-2 font-bold text-sm tracking-wide transition-all"><Check size={18} /> Save Changes</button>
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-20"><Edit2 size={64} /><p className="mt-4">Select an item to edit.</p></div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};
