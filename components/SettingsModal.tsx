
import React, { useRef, useState } from 'react';
import { X, Settings as SettingsIcon, Download, Upload, Key, Eye, EyeOff, Sun, Moon, Monitor } from 'lucide-react';
import { AppSettings, DEFAULT_MODELS, ThemeMode } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSave: (s: AppSettings) => void;
  onExportData: () => void;
  onImportData: (file: File) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ 
  isOpen, onClose, settings, onSave, onExportData, onImportData 
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showKey, setShowKey] = useState(false);

  if (!isOpen) return null;

  const handleThemeChange = (theme: ThemeMode) => {
    onSave({ ...settings, theme });
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
        <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-dark-800 sticky top-0 bg-white dark:bg-dark-900 z-10">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <SettingsIcon size={20} /> Settings
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 space-y-8">
          {/* Theme Toggle */}
          <div>
            <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Appearance</h3>
            <div className="grid grid-cols-3 gap-2 bg-slate-100 dark:bg-dark-850 p-1 rounded-lg">
              {[
                { id: 'light', icon: Sun, label: 'Light' },
                { id: 'dark', icon: Moon, label: 'Dark' },
                { id: 'auto', icon: Monitor, label: 'Auto' }
              ].map(item => {
                const Icon = item.icon;
                const isActive = settings.theme === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleThemeChange(item.id as ThemeMode)}
                    className={`flex flex-col items-center gap-1.5 py-2 rounded-md transition-all ${
                      isActive 
                      ? 'bg-white dark:bg-dark-800 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                      : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
                  >
                    <Icon size={16} />
                    <span className="text-xs font-medium">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="border-t border-slate-100 dark:border-dark-800"></div>

          {/* API Connection */}
          <div>
             <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Key size={14} className="text-emerald-500" /> API Connection
             </h3>
             <div className="bg-slate-50 dark:bg-dark-850 p-4 rounded-lg border border-slate-200 dark:border-dark-800">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Google AI API Key</label>
                <div className="relative">
                    <input 
                        type={showKey ? "text" : "password"}
                        value={settings.apiKey}
                        onChange={(e) => onSave({ ...settings, apiKey: e.target.value })}
                        placeholder="AIzaSy..."
                        className="w-full bg-white dark:bg-dark-900 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-dark-700 rounded-lg p-3 pr-10 focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-mono"
                    />
                    <button type="button" onClick={() => setShowKey(!showKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                        {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                </div>
                <p className="text-xs text-slate-400 mt-2">Stored locally in your browser.</p>
             </div>
          </div>

          <div className="border-t border-slate-100 dark:border-dark-800"></div>

          {/* Model Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">AI Model</label>
            <select
              value={settings.model}
              onChange={(e) => onSave({ ...settings, model: e.target.value })}
              className="w-full bg-white dark:bg-dark-900 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-dark-700 rounded-lg p-3 outline-none text-sm focus:ring-2 focus:ring-indigo-500"
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
                <span className="text-sm text-slate-400">{settings.temperature}</span>
            </div>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={settings.temperature}
              onChange={(e) => onSave({ ...settings, temperature: parseFloat(e.target.value) })}
              className="w-full h-2 bg-slate-200 dark:bg-dark-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
          </div>

          <div className="border-t border-slate-100 dark:border-dark-800"></div>

          {/* Data Backup */}
          <div>
            <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">Data Backup</h3>
            <div className="flex gap-3">
              <button onClick={onExportData} className="flex-1 bg-slate-100 dark:bg-dark-850 hover:bg-slate-200 dark:hover:bg-dark-800 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-lg flex items-center justify-center gap-2 text-sm font-medium transition-colors border border-slate-200 dark:border-dark-800">
                <Download size={16} /> Export
              </button>
              <button onClick={() => fileInputRef.current?.click()} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 text-sm font-medium transition-colors">
                <Upload size={16} /> Import
              </button>
              <input type="file" ref={fileInputRef} onChange={(e) => e.target.files?.[0] && onImportData(e.target.files[0])} accept=".json" className="hidden" />
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-slate-200 dark:border-dark-800 flex justify-end bg-white dark:bg-dark-900 sticky bottom-0">
          <button onClick={onClose} className="px-6 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-lg transition-colors font-semibold text-sm">Done</button>
        </div>
      </div>
    </div>
  );
};
