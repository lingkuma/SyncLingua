
import React, { useRef, useState } from 'react';
import { X, Settings as SettingsIcon, Download, Upload, Sun, Moon, Monitor } from 'lucide-react';
import { AppSettings, DEFAULT_MODELS } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSave: (s: AppSettings) => void;
  onExportData: () => void;
  onImportData: (file: File) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ 
  isOpen, 
  onClose, 
  settings, 
  onSave, 
  onExportData, 
  onImportData 
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onImportData(e.target.files[0]);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const themes: {id: AppSettings['theme'], label: string, icon: typeof Sun}[] = [
    { id: 'light', label: 'Light', icon: Sun },
    { id: 'dark', label: 'Dark', icon: Moon },
    { id: 'auto', label: 'Auto', icon: Monitor },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-[100] p-4">
      <div className="bg-white dark:bg-[#1f1f1f] border border-slate-200 dark:border-[#333333] rounded-xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
        <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-[#333333] sticky top-0 bg-white dark:bg-[#1f1f1f] z-10">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <SettingsIcon size={20} className="text-indigo-600 dark:text-indigo-400" /> Settings
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 space-y-8">
          
          {/* Theme Section */}
          <div>
             <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3">Theme Preference</h3>
             <div className="flex p-1 bg-slate-100 dark:bg-[#141414] rounded-xl gap-1 border border-slate-200 dark:border-[#333333]">
                {themes.map(t => {
                    const Icon = t.icon;
                    const isActive = settings.theme === t.id;
                    return (
                        <button
                            key={t.id}
                            onClick={() => onSave({ ...settings, theme: t.id })}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                                isActive 
                                ? 'bg-white dark:bg-[#2d2d2d] text-indigo-600 dark:text-white shadow-sm ring-1 ring-slate-200 dark:ring-[#444444]' 
                                : 'text-slate-500 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                            }`}
                        >
                            <Icon size={16} /> {t.label}
                        </button>
                    );
                })}
             </div>
          </div>

          <div className="border-t border-slate-100 dark:border-[#2d2d2d]"></div>

          {/* Model Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">AI Model</label>
            <select
              value={settings.model}
              onChange={(e) => onSave({ ...settings, model: e.target.value })}
              className="w-full bg-slate-50 dark:bg-[#141414] text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-[#333333] rounded-lg p-3 focus:ring-2 focus:ring-indigo-600 dark:focus:ring-indigo-500 focus:border-transparent outline-none text-sm"
            >
              {DEFAULT_MODELS.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          {/* Temperature */}
          <div>
            <div className="flex justify-between mb-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Temperature</label>
                <span className="text-sm text-slate-500 dark:text-slate-400">{settings.temperature}</span>
            </div>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={settings.temperature}
              onChange={(e) => onSave({ ...settings, temperature: parseFloat(e.target.value) })}
              className="w-full h-2 bg-slate-200 dark:bg-[#333333] rounded-lg appearance-none cursor-pointer accent-indigo-600 dark:accent-indigo-500"
            />
          </div>

          <div className="border-t border-slate-100 dark:border-[#2d2d2d]"></div>

          {/* Data Management Section */}
          <div>
            <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <Download size={14} className="text-indigo-600 dark:text-indigo-400" /> Data Backup
            </h3>
            <div className="bg-slate-50 dark:bg-[#141414] border border-slate-200 dark:border-[#333333] border-dashed rounded-xl p-4">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                Save your sessions and presets to a local file.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={onExportData}
                  className="flex-1 bg-white dark:bg-[#252525] hover:bg-slate-100 dark:hover:bg-[#333333] text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-[#444444] px-4 py-2 rounded-lg flex items-center justify-center gap-2 text-sm font-medium transition-colors"
                >
                  <Download size={16} /> Export
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 text-sm font-medium transition-colors"
                >
                  <Upload size={16} /> Import
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".json"
                  className="hidden"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-slate-200 dark:border-[#333333] flex justify-end bg-white dark:bg-[#1f1f1f] sticky bottom-0">
          <button
            onClick={onClose}
            className="px-8 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-colors font-semibold text-sm shadow-lg shadow-indigo-600/10"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
