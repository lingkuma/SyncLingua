
import React, { useRef, useState } from 'react';
import { X, Settings as SettingsIcon, Download, Upload, Key, Eye, EyeOff } from 'lucide-react';
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
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
        <div className="flex justify-between items-center p-4 border-b border-slate-700 sticky top-0 bg-slate-900 z-10">
          <h2 className="text-xl font-semibold text-slate-100 flex items-center gap-2">
            <SettingsIcon size={20} /> Settings
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 space-y-8">
          
          {/* API Info */}
          <div>
             <h3 className="text-sm font-medium text-slate-200 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Key size={14} className="text-emerald-400" /> API Connection
             </h3>
             <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                <label className="block text-sm font-medium text-slate-300 mb-2">Google AI API Key</label>
                <div className="relative">
                    <input 
                        type={showKey ? "text" : "password"}
                        value={settings.apiKey}
                        onChange={(e) => onSave({ ...settings, apiKey: e.target.value })}
                        placeholder="AIzaSy..."
                        className="w-full bg-slate-900 text-slate-100 border border-slate-600 rounded-lg p-3 pr-10 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm font-mono"
                    />
                    <button 
                        type="button"
                        onClick={() => setShowKey(!showKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                    >
                        {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                </div>
                <p className="text-xs text-slate-500 mt-2">
                    Enter your Google Gemini API Key. It is stored locally in your browser.
                </p>
                {settings.apiKey && (
                    <div className="flex items-center gap-2 mt-3 text-emerald-400 text-xs font-medium">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                        Key Configured
                    </div>
                )}
             </div>
          </div>

          <div className="border-t border-slate-800"></div>

          {/* Data Management Section */}
          <div>
            <h3 className="text-sm font-medium text-slate-200 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Download size={14} className="text-indigo-400" /> Data Backup
            </h3>
            <div className="bg-slate-800/50 border border-slate-700 border-dashed rounded-xl p-4">
              <p className="text-xs text-slate-400 mb-4">
                Save your sessions and presets to a local file to prevent data loss when clearing cache or updating the app.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={onExportData}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 px-4 py-2 rounded-lg flex items-center justify-center gap-2 text-sm font-medium transition-colors"
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

          <div className="border-t border-slate-800"></div>

          {/* Model Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">AI Model</label>
            <select
              value={settings.model}
              onChange={(e) => onSave({ ...settings, model: e.target.value })}
              className="w-full bg-slate-800 text-slate-100 border border-slate-600 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm"
            >
              {DEFAULT_MODELS.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          {/* Temperature */}
          <div>
            <div className="flex justify-between mb-2">
                <label className="block text-sm font-medium text-slate-300">Temperature</label>
                <span className="text-sm text-slate-400">{settings.temperature}</span>
            </div>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={settings.temperature}
              onChange={(e) => onSave({ ...settings, temperature: parseFloat(e.target.value) })}
              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
            <p className="text-xs text-slate-500 mt-2">
                Lower values for factual/deterministic output, higher for creativity.
            </p>
          </div>
        </div>

        <div className="p-4 border-t border-slate-700 flex justify-end bg-slate-900 sticky bottom-0">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-slate-100 hover:bg-white text-slate-900 rounded-lg transition-colors font-semibold text-sm"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
