
import React, { useEffect, useRef, useState } from 'react';
import { Send, Bot, User, Trash2, Plus, RefreshCw, Copy, Layers, Volume2, Loader2, StopCircle, X, Zap, TriangleAlert, MessageSquare, Briefcase } from 'lucide-react';
import { Message, Session, Preset, AppSettings, AuxTab, SystemTemplate } from '../types';
import { streamChat, generateAuxiliaryResponse, generateSpeech } from '../services/geminiService';

interface ChatInterfaceProps {
  session: Session;
  updateSession: (updated: Session) => void;
  auxPresets: Preset[];
  systemTemplates: SystemTemplate[];
  settings: AppSettings;
  mainPreset?: Preset;
}

const MessageBubble: React.FC<{ 
    msg: Message; 
    onPlayTTS: (text: string, id: string) => void;
    isPlaying: boolean;
    isLoadingTTS: boolean;
    isLastInGroup?: boolean;
}> = ({ msg, onPlayTTS, isPlaying, isLoadingTTS, isLastInGroup = true }) => {
    const isAuto = msg.isAutoTrigger;
    const opacityClass = (isAuto && !isLastInGroup) ? 'opacity-50 hover:opacity-100 transition-opacity' : 'opacity-100';

    return (
      <div className={`flex gap-3 mb-4 group ${msg.role === 'user' ? 'flex-row-reverse' : ''} ${opacityClass}`}>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm ${
            msg.role === 'user' 
            ? (msg.isAutoTrigger ? 'bg-amber-600' : 'bg-indigo-600') 
            : 'bg-emerald-600'
        }`}>
            {msg.role === 'user' ? (
                msg.isAutoTrigger ? <Zap size={16} className="text-white fill-white" /> : <User size={16} className="text-white" />
            ) : <Bot size={16} className="text-white" />}
        </div>
        
        <div className={`flex flex-col max-w-[85%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            {msg.isAutoTrigger && msg.role === 'user' && (
                 <div className="text-[10px] text-amber-600 dark:text-amber-500 mb-1 uppercase tracking-wider font-bold">Auto Trigger</div>
            )}
            <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap break-words shadow-sm border ${
                msg.role === 'user' 
                ? (msg.isAutoTrigger ? 'bg-slate-50 dark:bg-dark-900/50 border-amber-200 dark:border-amber-900/30 text-slate-600 dark:text-slate-400 italic' : 'bg-indigo-600 border-indigo-500 text-white')
                : 'bg-slate-50 dark:bg-dark-900 border-slate-200 dark:border-dark-800 text-slate-800 dark:text-slate-200'
            } ${msg.role === 'user' ? 'rounded-tr-none' : 'rounded-tl-none'}`}>
                {msg.text}
            </div>
            
            <div className={`flex items-center gap-2 mt-1 px-1 opacity-0 group-hover:opacity-100 transition-opacity ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <button onClick={() => onPlayTTS(msg.text, msg.id)} disabled={isLoadingTTS} className={`p-1.5 rounded-md transition-colors ${isPlaying ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 hover:text-indigo-500'}`}>
                    {isLoadingTTS ? <Loader2 size={14} className="animate-spin" /> : isPlaying ? <Volume2 size={14} className="animate-pulse" /> : <Volume2 size={14} />}
                </button>
            </div>
        </div>
      </div>
    );
};

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ session, updateSession, auxPresets, systemTemplates, settings, mainPreset }) => {
  const [inputMain, setInputMain] = useState('');
  const [inputAux, setInputAux] = useState('');
  const [isGeneratingMain, setIsGeneratingMain] = useState(false);
  const [isGeneratingAux, setIsGeneratingAux] = useState(false);
  const [mobileView, setMobileView] = useState<'main' | 'aux'>('main');
  const [auxGeneratingIds, setAuxGeneratingIds] = useState<Set<string>>(new Set());
  const [showAuxAdder, setShowAuxAdder] = useState(false);

  const mainEndRef = useRef<HTMLDivElement>(null);
  const auxEndRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const audioCache = useRef<Map<string, AudioBuffer>>(new Map());
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const [loadingTTSId, setLoadingTTSId] = useState<string | null>(null);

  const sessionRef = useRef(session);
  useEffect(() => { sessionRef.current = session; }, [session]);

  const scrollToBottom = (ref: React.RefObject<HTMLDivElement>) => ref.current?.scrollIntoView({ behavior: 'smooth' });
  useEffect(() => scrollToBottom(mainEndRef), [session.mainMessages, mobileView]);
  useEffect(() => scrollToBottom(auxEndRef), [session.auxTabs, session.activeAuxTabId, mobileView]);

  const handleTTS = async (text: string, msgId: string, voiceName?: string) => {
      if (audioSourceRef.current) { try { audioSourceRef.current.stop(); } catch(e){} audioSourceRef.current = null; }
      if (playingMessageId === msgId) { setPlayingMessageId(null); return; }
      setLoadingTTSId(msgId);
      try {
          if (!audioContextRef.current) audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
          if (audioContextRef.current.state === 'suspended') await audioContextRef.current.resume();
          let buffer = audioCache.current.get(msgId);
          if (!buffer) {
             const voice = voiceName || mainPreset?.ttsConfig?.voiceName || 'Puck';
             buffer = await generateSpeech(settings.apiKey, text, voice, audioContextRef.current);
             audioCache.current.set(msgId, buffer);
          }
          const source = audioContextRef.current.createBufferSource();
          source.buffer = buffer;
          source.connect(audioContextRef.current.destination);
          source.onended = () => setPlayingMessageId(null);
          audioSourceRef.current = source;
          source.start();
          setPlayingMessageId(msgId);
      } catch (e) { console.error("TTS Failed", e); } finally { setLoadingTTSId(null); }
  };

  const triggerAutoAuxResponse = async (tab: AuxTab, mainHistory: Message[]) => {
      const preset = auxPresets.find(p => p.id === tab.presetId);
      if (!preset) return;
      const triggerMsgId = Date.now().toString() + Math.random().toString();
      const botMsgId = (Date.now() + 1).toString() + Math.random().toString();
      const userTriggerMsg: Message = { id: triggerMsgId, role: 'user', text: "Analyze latest response", timestamp: Date.now(), isAutoTrigger: true };
      setAuxGeneratingIds(prev => new Set(prev).add(tab.id));
      const currentTab = { ...tab, messages: [...tab.messages, userTriggerMsg] };
      updateSession({ ...sessionRef.current, auxTabs: sessionRef.current.auxTabs.map(t => t.id === tab.id ? currentTab : t) });
      let currentBotText = '';
      try {
        await generateAuxiliaryResponse(settings.apiKey, settings.model, preset.systemPrompt, mainPreset?.sharedPrompt || '', mainHistory, [], "Analyze current context.", settings.temperature, (chunk) => {
                currentBotText += chunk;
                updateSession({ ...sessionRef.current, auxTabs: sessionRef.current.auxTabs.map(t => t.id === tab.id ? { ...currentTab, messages: [...currentTab.messages, { id: botMsgId, role: 'model', text: currentBotText, timestamp: Date.now() }] } : t) });
            }
        );
      } catch (e) { console.error("Auto Trigger Error", e); } finally { setAuxGeneratingIds(prev => { const next = new Set(prev); next.delete(tab.id); return next; }); }
  };

  const sendMainMessage = async () => {
    if (!inputMain.trim() || isGeneratingMain || !settings.apiKey) return;
    const newUserMsg: Message = { id: Date.now().toString(), role: 'user', text: inputMain, timestamp: Date.now() };
    const updatedMessages = [...session.mainMessages, newUserMsg];
    updateSession({ ...session, mainMessages: updatedMessages });
    setInputMain('');
    setIsGeneratingMain(true);
    const templateContent = mainPreset?.systemTemplateId ? systemTemplates.find(t => t.id === mainPreset.systemTemplateId)?.content || '' : '';
    const privateSystem = mainPreset?.systemPrompt || 'You are a helpful assistant.';
    const sharedContext = mainPreset?.sharedPrompt || '';
    const fullSystemInstruction = `${templateContent}\n\n${privateSystem}\n\n[CONTEXT]: ${sharedContext}`;
    const botMsgId = (Date.now() + 1).toString();
    let currentBotText = '';
    try {
        const fullResponse = await streamChat(settings.apiKey, settings.model, fullSystemInstruction, updatedMessages, newUserMsg.text, settings.temperature, (chunk) => {
                currentBotText += chunk;
                updateSession({ ...sessionRef.current, mainMessages: [...updatedMessages, { id: botMsgId, role: 'model', text: currentBotText, timestamp: Date.now() }] });
            }
        );
        if (mainPreset?.ttsConfig?.autoPlay) setTimeout(() => handleTTS(fullResponse, botMsgId, mainPreset.ttsConfig?.voiceName), 100);
        if (fullResponse) {
            const finalHistory = [...updatedMessages, { id: botMsgId, role: 'model', text: fullResponse, timestamp: Date.now() }];
            session.auxTabs.filter(t => auxPresets.find(p => p.id === t.presetId)?.autoTrigger).forEach(tab => triggerAutoAuxResponse(tab, finalHistory));
        }
    } catch (e) { console.error("Main chat failed", e); } finally { setIsGeneratingMain(false); }
  };

  const sendAuxMessage = async () => {
    const activeAuxTab = session.auxTabs.find(t => t.id === session.activeAuxTabId);
    const activeAuxPreset = auxPresets.find(p => p.id === activeAuxTab?.presetId);
    if (!inputAux.trim() || isGeneratingAux || !activeAuxTab || !activeAuxPreset || !settings.apiKey) return;
    const newUserMsg: Message = { id: Date.now().toString(), role: 'user', text: inputAux, timestamp: Date.now() };
    const updatedTabMessages = [...activeAuxTab.messages, newUserMsg];
    updateSession({ ...session, auxTabs: session.auxTabs.map(t => t.id === session.activeAuxTabId ? { ...t, messages: updatedTabMessages } : t) });
    setInputAux('');
    setIsGeneratingAux(true);
    const botMsgId = (Date.now() + 1).toString();
    let currentBotText = '';
    try {
        await generateAuxiliaryResponse(settings.apiKey, settings.model, activeAuxPreset.systemPrompt, mainPreset?.sharedPrompt || '', session.mainMessages, updatedTabMessages, newUserMsg.text, settings.temperature, (chunk) => {
                currentBotText += chunk;
                updateSession({ ...sessionRef.current, auxTabs: sessionRef.current.auxTabs.map(t => t.id === session.activeAuxTabId ? { ...t, messages: [...updatedTabMessages, { id: botMsgId, role: 'model', text: currentBotText, timestamp: Date.now() }] } : t) });
            }
        );
    } catch (e) { console.error("Aux failed", e); } finally { setIsGeneratingAux(false); }
  };

  const activeAuxTab = session.auxTabs.find(t => t.id === session.activeAuxTabId);
  const activeAuxPreset = auxPresets.find(p => p.id === activeAuxTab?.presetId);

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-white dark:bg-dark-950">
        <div className="flex md:hidden border-b border-slate-200 dark:border-dark-800 bg-slate-50 dark:bg-dark-925 shrink-0">
            <button onClick={() => setMobileView('main')} className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 border-b-2 transition-colors ${mobileView === 'main' ? 'border-indigo-600 text-indigo-600 bg-indigo-50 dark:bg-indigo-900/10' : 'border-transparent text-slate-400'}`}><MessageSquare size={16} /> Chat</button>
            <button onClick={() => setMobileView('aux')} className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 border-b-2 transition-colors ${mobileView === 'aux' ? 'border-emerald-600 text-emerald-600 bg-emerald-50 dark:bg-emerald-900/10' : 'border-transparent text-slate-400'}`}><Briefcase size={16} /> Helpers</button>
        </div>

        <div className="flex-1 flex overflow-hidden relative">
            {/* LEFT PANE: MAIN */}
            <div className={`flex-col border-r border-slate-200 dark:border-dark-800 transition-all absolute inset-0 md:relative md:flex md:w-1/2 bg-white dark:bg-dark-950 ${mobileView === 'main' ? 'flex z-10' : 'hidden md:flex'}`}>
                <div className="h-14 border-b border-slate-200 dark:border-dark-800 hidden md:flex items-center px-4 bg-slate-50 dark:bg-dark-900/50 justify-between shrink-0">
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
                        <h3 className="font-semibold text-slate-700 dark:text-slate-200 truncate">{mainPreset ? mainPreset.title : 'Main'}</h3>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                    {session.mainMessages.map(m => (
                        <MessageBubble key={m.id} msg={m} onPlayTTS={handleTTS} isPlaying={playingMessageId === m.id} isLoadingTTS={loadingTTSId === m.id} />
                    ))}
                    <div ref={mainEndRef} />
                </div>
                <div className="p-4 bg-slate-50 dark:bg-dark-900 border-t border-slate-200 dark:border-dark-800 shrink-0">
                    <div className="flex gap-2 relative">
                        <input className="flex-1 bg-white dark:bg-dark-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-lg px-4 py-3 focus:ring-2 focus:ring-indigo-500/50 outline-none border border-slate-200 dark:border-dark-700 text-sm" placeholder="Message..." value={inputMain} onChange={e => setInputMain(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMainMessage()} disabled={isGeneratingMain} />
                        <button onClick={sendMainMessage} disabled={isGeneratingMain || !inputMain.trim()} className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-300 dark:disabled:bg-dark-800 text-white p-3 rounded-lg transition-colors"><Send size={20} /></button>
                    </div>
                </div>
            </div>

            {/* RIGHT PANE: AUX */}
            <div className={`flex-col bg-white dark:bg-dark-950 transition-all absolute inset-0 md:relative md:flex md:w-1/2 ${mobileView === 'aux' ? 'flex z-10' : 'hidden md:flex'}`}>
                <div className="h-14 border-b border-slate-200 dark:border-dark-800 flex items-center bg-slate-50 dark:bg-dark-900/30 overflow-x-auto custom-scrollbar shrink-0">
                    {session.auxTabs.map(tab => {
                        const isGen = auxGeneratingIds.has(tab.id);
                        const isAct = session.activeAuxTabId === tab.id;
                        return (
                            <div key={tab.id} onClick={() => updateSession({ ...session, activeAuxTabId: tab.id })} className={`group flex items-center gap-2 px-4 h-full text-sm font-medium border-r border-slate-200 dark:border-dark-800 cursor-pointer min-w-[120px] max-w-[180px] relative transition-colors ${isAct ? 'bg-white dark:bg-dark-900 text-indigo-600 dark:text-indigo-400 border-b-2 border-b-indigo-500' : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-dark-900/50'}`}>
                                <span className="truncate flex-1 flex items-center gap-2">
                                    {isGen && <Loader2 size={12} className="animate-spin" />}
                                    {auxPresets.find(p => p.id === tab.presetId)?.title || 'Tab'}
                                </span>
                                <button onClick={(e) => { e.stopPropagation(); updateSession({ ...session, auxTabs: session.auxTabs.filter(t => t.id !== tab.id), activeAuxTabId: isAct ? (session.auxTabs.length > 1 ? session.auxTabs[0].id : null) : session.activeAuxTabId }); }} className="p-1 opacity-100 md:opacity-0 group-hover:opacity-100 hover:text-red-500"><X size={12} /></button>
                            </div>
                        );
                    })}
                    <div className="relative flex items-center px-2">
                        <button onClick={() => setShowAuxAdder(!showAuxAdder)} className="p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-dark-800 text-slate-400 transition-colors"><Plus size={18} /></button>
                        {showAuxAdder && (
                            <div className="absolute top-12 left-0 w-56 bg-white dark:bg-dark-850 border border-slate-200 dark:border-dark-700 rounded-lg shadow-xl z-20">
                                {auxPresets.map(p => (
                                    <button key={p.id} onClick={() => { updateSession({ ...session, auxTabs: [...session.auxTabs, { id: Date.now().toString(), presetId: p.id, messages: [] }], activeAuxTabId: Date.now().toString() }); setShowAuxAdder(false); }} className="w-full text-left px-4 py-2 text-sm hover:bg-indigo-50 dark:hover:bg-dark-800 transition-colors border-b last:border-0 border-slate-100 dark:border-dark-800">{p.title}</button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex-1 flex flex-col bg-slate-50/50 dark:bg-dark-900/20">
                    {activeAuxTab ? (
                        <>
                            <div className="h-10 border-b border-slate-200 dark:border-dark-800 flex items-center justify-between px-4 bg-white/50 dark:bg-dark-900/30 shrink-0">
                                <div className="text-xs text-slate-400">{activeAuxPreset?.autoTrigger ? 'Auto-responds' : 'Context-aware'}</div>
                                <button onClick={() => updateSession({ ...session, auxTabs: session.auxTabs.map(t => t.id === activeAuxTab.id ? { ...t, messages: [] } : t) })} className="text-xs text-slate-400 hover:text-indigo-500 transition-colors"><RefreshCw size={12} /></button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                                {activeAuxTab.messages.map(m => (
                                    <MessageBubble key={m.id} msg={m} onPlayTTS={handleTTS} isPlaying={playingMessageId === m.id} isLoadingTTS={loadingTTSId === m.id} />
                                ))}
                                <div ref={auxEndRef} />
                            </div>
                            <div className="p-4 bg-white dark:bg-dark-900 border-t border-slate-200 dark:border-dark-800 shrink-0">
                                <div className="flex gap-2">
                                    <input className="flex-1 bg-slate-50 dark:bg-dark-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 rounded-lg px-4 py-3 focus:ring-2 focus:ring-emerald-500/50 outline-none border border-slate-200 dark:border-dark-700 text-sm" placeholder="Ask Helper..." value={inputAux} onChange={e => setInputAux(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendAuxMessage()} disabled={isGeneratingAux} />
                                    <button onClick={sendAuxMessage} disabled={isGeneratingAux || !inputAux.trim()} className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-300 dark:disabled:bg-dark-800 text-white p-3 rounded-lg"><Send size={20} /></button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 opacity-50"><Layers size={64} className="mb-4" /><p className="text-sm">Select a helper tool.</p></div>
                    )}
                </div>
            </div>
        </div>
    </div>
  );
};
