
import React, { useRef, useState } from 'react';
import { X, Settings as SettingsIcon, Download, Upload, Key, Eye, EyeOff, Sun, Moon, Monitor } from 'lucide-react';
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
  const [showKey, setShowKey] = useState(false);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onImportData(e.target.files[0]);
    }
    // Reset value so same file can be selected again if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar transition-colors duration-200">
        <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-neutral-800 sticky top-0 bg-white dark:bg-neutral-900 z-10">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <SettingsIcon size={20} /> Settings
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 space-y-8">
          
           {/* Theme Selection */}
           <div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Monitor size={14} className="text-indigo-500" /> Appearance
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'auto', label: 'Auto', icon: Monitor },
                { id: 'light', label: 'Light', icon: Sun },
                { id: 'dark', label: 'Dark', icon: Moon },
              ].map((theme) => {
                const Icon = theme.icon;
                const isActive = settings.theme === theme.id;
                return (
                  <button
                    key={theme.id}
                    onClick={() => onSave({ ...settings, theme: theme.id as any })}
                    className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all ${
                      isActive 
                        ? 'bg-indigo-50 border-indigo-500 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-500 dark:text-indigo-400' 
                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100 dark:bg-neutral-850 dark:border-neutral-700 dark:text-gray-400 dark:hover:bg-neutral-800'
                    }`}
                  >
                    <Icon size={20} className="mb-1" />
                    <span className="text-xs font-medium">{theme.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="border-t border-gray-200 dark:border-neutral-800"></div>

          {/* API Info */}
          <div>
             <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Key size={14} className="text-emerald-500" /> API Connection
             </h3>
             <div className="bg-gray-50 dark:bg-neutral-850 p-4 rounded-lg border border-gray-200 dark:border-neutral-800">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Google AI API Key</label>
                <div className="relative">
                    <input 
                        type={showKey ? "text" : "password"}
                        value={settings.apiKey}
                        onChange={(e) => onSave({ ...settings, apiKey: e.target.value })}
                        placeholder="AIzaSy..."
                        className="w-full bg-white dark:bg-neutral-900 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-neutral-700 rounded-lg p-3 pr-10 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm font-mono"
                    />
                    <button 
                        type="button"
                        onClick={() => setShowKey(!showKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                    >
                        {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                    Enter your Google Gemini API Key. It is stored locally in your browser.
                </p>
                {settings.apiKey && (
                    <div className="flex items-center gap-2 mt-3 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                        Key Configured
                    </div>
                )}
             </div>
          </div>

          <div className="border-t border-gray-200 dark:border-neutral-800"></div>

          {/* Data Management Section */}
          <div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Download size={14} className="text-indigo-500" /> Data Backup
            </h3>
            <div className="bg-gray-50 dark:bg-neutral-850 border border-gray-200 dark:border-neutral-800 border-dashed rounded-xl p-4">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                Save your sessions and presets to a local file to prevent data loss when clearing cache or updating the app.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={onExportData}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 dark:bg-neutral-700 dark:hover:bg-neutral-600 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-lg flex items-center justify-center gap-2 text-sm font-medium transition-colors"
                >
                  <Download size={16} /> Export JSON
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 text-sm font-medium transition-colors"
                >
                  <Upload size={16} /> Import JSON
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

          <div className="border-t border-gray-200 dark:border-neutral-800"></div>

          {/* Model Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">AI Model</label>
            <select
              value={settings.model}
              onChange={(e) => onSave({ ...settings, model: e.target.value })}
              className="w-full bg-gray-50 dark:bg-neutral-850 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-neutral-700 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm"
            >
              {DEFAULT_MODELS.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          {/* Temperature */}
          <div>
            <div className="flex justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Temperature</label>
                <span className="text-sm text-gray-500 dark:text-gray-400">{settings.temperature}</span>
            </div>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={settings.temperature}
              onChange={(e) => onSave({ ...settings, temperature: parseFloat(e.target.value) })}
              className="w-full h-2 bg-gray-200 dark:bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                Lower values for factual/deterministic output, higher for creativity.
            </p>
          </div>
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-neutral-800 flex justify-end bg-white dark:bg-neutral-900 sticky bottom-0">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-900 hover:bg-gray-800 dark:bg-gray-100 dark:hover:bg-white text-white dark:text-gray-900 rounded-lg transition-colors font-semibold text-sm"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
