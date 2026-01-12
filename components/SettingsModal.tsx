

import React, { useRef, useState } from 'react';
import { X, Settings as SettingsIcon, Download, Upload, Key, Eye, EyeOff, Sun, Moon, Monitor, Cloud, CloudUpload, CloudDownload, RefreshCw, Image as ImageIcon } from 'lucide-react';
import { AppSettings, DEFAULT_MODELS, DEFAULT_IMAGE_MODELS, WebDavConfig } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSave: (s: AppSettings) => void;
  onExportData: () => void;
  onImportData: (file: File) => void;
  onCloudUpload: () => Promise<void>;
  onCloudDownload: () => Promise<void>;
  isSyncing: boolean;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ 
  isOpen, 
  onClose, 
  settings, 
  onSave, 
  onExportData, 
  onImportData,
  onCloudUpload,
  onCloudDownload,
  isSyncing
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showKey, setShowKey] = useState(false);
  const [showDavPass, setShowDavPass] = useState(false);
  
  // Initialize custom model mode based on whether current model is in the default list
  const [isCustomModel, setIsCustomModel] = useState(() => {
    if (!settings.model) return false;
    return !DEFAULT_MODELS.some(m => m.id === settings.model);
  });

  // Local state for WebDAV to allow typing without saving entire app state on every keystroke if desired,
  // but here we sync directly with app settings for simplicity.
  
  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onImportData(e.target.files[0]);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const updateWebDav = (update: Partial<WebDavConfig>) => {
      const current = settings.webdav || { url: '', username: '', password: '' };
      onSave({ ...settings, webdav: { ...current, ...update } });
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
                {settings.apiKey && (
                    <div className="flex items-center gap-2 mt-3 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                        Key Configured
                    </div>
                )}
             </div>
          </div>

          <div className="border-t border-gray-200 dark:border-neutral-800"></div>

          {/* Cloud Sync (WebDAV) */}
          <div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Cloud size={14} className="text-sky-500" /> Cloud Sync (WebDAV)
            </h3>
            <div className="bg-gray-50 dark:bg-neutral-850 border border-gray-200 dark:border-neutral-800 rounded-xl p-4 space-y-3">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                   Sync data to any WebDAV server (Nextcloud, Koofr, etc). 
                   Files are saved to <code>/SyncLingua/handbackup/</code>.
                </p>
                <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Server URL</label>
                    <input 
                        type="text"
                        value={settings.webdav?.url || ''}
                        onChange={(e) => updateWebDav({ url: e.target.value })}
                        placeholder="https://dav.example.com/remote.php/dav/files/user/"
                        className="w-full bg-white dark:bg-neutral-900 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-neutral-700 rounded-lg p-2.5 focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none text-sm"
                    />
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Username</label>
                        <input 
                            type="text"
                            value={settings.webdav?.username || ''}
                            onChange={(e) => updateWebDav({ username: e.target.value })}
                            className="w-full bg-white dark:bg-neutral-900 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-neutral-700 rounded-lg p-2.5 focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none text-sm"
                        />
                    </div>
                    <div>
                         <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Password</label>
                         <div className="relative">
                            <input 
                                type={showDavPass ? "text" : "password"}
                                value={settings.webdav?.password || ''}
                                onChange={(e) => updateWebDav({ password: e.target.value })}
                                className="w-full bg-white dark:bg-neutral-900 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-neutral-700 rounded-lg p-2.5 pr-8 focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none text-sm"
                            />
                            <button 
                                type="button"
                                onClick={() => setShowDavPass(!showDavPass)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                                {showDavPass ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                         </div>
                    </div>
                </div>
                
                <div className="flex gap-3 mt-4 pt-2 border-t border-gray-200 dark:border-neutral-700">
                    <button
                        onClick={onCloudUpload}
                        disabled={isSyncing || !settings.webdav?.url}
                        className="flex-1 bg-sky-600 hover:bg-sky-500 disabled:bg-gray-300 dark:disabled:bg-neutral-700 text-white py-2 rounded-lg flex items-center justify-center gap-2 text-sm font-medium transition-colors"
                    >
                        {isSyncing ? <RefreshCw size={14} className="animate-spin" /> : <CloudUpload size={14} />}
                        Push
                    </button>
                    <button
                        onClick={onCloudDownload}
                        disabled={isSyncing || !settings.webdav?.url}
                        className="flex-1 bg-gray-200 hover:bg-gray-300 dark:bg-neutral-700 dark:hover:bg-neutral-600 disabled:bg-gray-100 dark:disabled:bg-neutral-800 text-gray-700 dark:text-gray-200 py-2 rounded-lg flex items-center justify-center gap-2 text-sm font-medium transition-colors"
                    >
                        {isSyncing ? <RefreshCw size={14} className="animate-spin" /> : <CloudDownload size={14} />}
                        Pull
                    </button>
                </div>
            </div>
          </div>

          <div className="border-t border-gray-200 dark:border-neutral-800"></div>

          {/* Local Data Management Section */}
          <div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Download size={14} className="text-indigo-500" /> Local Backup
            </h3>
            <div className="bg-gray-50 dark:bg-neutral-850 border border-gray-200 dark:border-neutral-800 border-dashed rounded-xl p-4">
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">AI Text Model</label>
            <div className="space-y-3">
              <select
                value={isCustomModel ? 'custom' : settings.model}
                onChange={(e) => {
                  if (e.target.value === 'custom') {
                    setIsCustomModel(true);
                  } else {
                    setIsCustomModel(false);
                    onSave({ ...settings, model: e.target.value });
                  }
                }}
                className="w-full bg-gray-50 dark:bg-neutral-850 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-neutral-700 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm"
              >
                {DEFAULT_MODELS.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
                <option value="custom">Custom Model ID...</option>
              </select>

              {isCustomModel && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                  <input
                    type="text"
                    value={settings.model}
                    onChange={(e) => onSave({ ...settings, model: e.target.value })}
                    placeholder="e.g. gemini-1.5-pro-002"
                    className="w-full bg-white dark:bg-neutral-900 text-gray-900 dark:text-gray-100 border border-indigo-300 dark:border-indigo-700 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-mono"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Enter a specific model ID supported by the Google Gemini API.
                  </p>
                </div>
              )}
            </div>

            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mt-4 mb-2">AI Image Model</label>
            <div className="space-y-3">
              <select
                value={settings.imageModel || DEFAULT_IMAGE_MODELS[0].id}
                onChange={(e) => onSave({ ...settings, imageModel: e.target.value })}
                className="w-full bg-gray-50 dark:bg-neutral-850 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-neutral-700 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm"
              >
                {DEFAULT_IMAGE_MODELS.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
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