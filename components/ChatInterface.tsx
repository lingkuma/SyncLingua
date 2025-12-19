
import React, { useEffect, useRef, useState } from 'react';
import { Send, Bot, User, Trash2, Plus, RefreshCw, Copy, Layers, Volume2, Loader2, StopCircle, X, Zap, TriangleAlert, MessageSquare, Briefcase, Columns2, LayoutGrid } from 'lucide-react';
import { Message, Session, Preset, AppSettings, AuxTab, SystemTemplate } from '../types';
import { streamChat, generateAuxiliaryResponse, generateSpeech } from '../services/geminiService';

interface ChatInterfaceProps {
  session: Session;
  updateSession: (updated: Session) => void;
  auxPresets: Preset[];
  systemTemplates: SystemTemplate[];
  settings: AppSettings;
  mainPresets: Preset[];
}

const MessageBubble: React.FC<{ 
    msg: Message; 
    onPlayTTS: (text: string, id: string, voiceName?: string) => void;
    isPlaying: boolean;
    isLoadingTTS: boolean;
    isLastInGroup?: boolean; 
    voiceName?: string;
}> = ({ msg, onPlayTTS, isPlaying, isLoadingTTS, isLastInGroup = true, voiceName }) => {
    const isAuto = msg.isAutoTrigger;
    const opacityClass = (isAuto && !isLastInGroup) ? 'opacity-50 hover:opacity-100 transition-opacity' : 'opacity-100';

    return (
      <div className={`flex gap-3 mb-4 group ${msg.role === 'user' ? 'flex-row-reverse' : ''} ${opacityClass}`}>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm ${
            msg.role === 'user' 
            ? (msg.isAutoTrigger ? 'bg-amber-600' : 'bg-indigo-600') 
            : 'bg-emerald-600'
        } text-white`}>
            {msg.role === 'user' ? (
                msg.isAutoTrigger ? <Zap size={16} className="fill-white" /> : <User size={16} />
            ) : <Bot size={16} />}
        </div>
        
        <div className={`flex flex-col max-w-[85%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div className="flex items-center gap-2 mb-1">
                {msg.senderName && (
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{msg.senderName}</span>
                )}
                {msg.isAutoTrigger && msg.role === 'user' && (
                    <div className="text-[10px] text-amber-600 dark:text-amber-500 uppercase tracking-widest font-bold">Auto Analysis</div>
                )}
            </div>
            <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap break-words shadow-sm ${
                msg.role === 'user' 
                ? (msg.isAutoTrigger ? 'bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 text-slate-700 dark:text-slate-300 italic' : 'bg-indigo-600 text-white')
                : 'bg-white dark:bg-[#252525] border border-slate-200 dark:border-[#333333] text-slate-900 dark:text-slate-100'
            } ${msg.role === 'user' ? 'rounded-tr-none' : 'rounded-tl-none'}`}>
                {msg.text}
            </div>
            
            <div className={`flex items-center gap-2 mt-1 px-1 opacity-0 group-hover:opacity-100 transition-opacity ${
                 msg.role === 'user' ? 'flex-row-reverse' : ''
            }`}>
                <button 
                    onClick={() => onPlayTTS(msg.text, msg.id, voiceName)}
                    disabled={isLoadingTTS}
                    className={`p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-[#333333] transition-colors ${
                        isPlaying ? 'text-indigo-600 dark:text-indigo-400 bg-slate-100 dark:bg-[#333333]' : 'text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-300'
                    }`}
                >
                    {isLoadingTTS ? (
                        <Loader2 size={14} className="animate-spin" />
                    ) : isPlaying ? (
                        <Volume2 size={14} className="animate-pulse" />
                    ) : (
                        <Volume2 size={14} />
                    )}
                </button>
            </div>
        </div>
      </div>
    );
};

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ session, updateSession, auxPresets, systemTemplates, settings, mainPresets }) => {
  const [inputMain, setInputMain] = useState('');
  const [inputAux, setInputAux] = useState('');
  const [isGeneratingMain, setIsGeneratingMain] = useState(false);
  const [isGeneratingAux, setIsGeneratingAux] = useState(false);
  const [mobileView, setMobileView] = useState<'main' | 'aux'>('main');
  const [auxGeneratingIds, setAuxGeneratingIds] = useState<Set<string>>(new Set());
  const [showAuxAdder, setShowAuxAdder] = useState(false);

  const mainScrollRefs = useRef<{[key: string]: HTMLDivElement | null}>({});
  const auxEndRef = useRef<HTMLDivElement>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const audioCache = useRef<Map<string, AudioBuffer>>(new Map());
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const [loadingTTSId, setLoadingTTSId] = useState<string | null>(null);

  const sessionRef = useRef(session);
  useEffect(() => { sessionRef.current = session; }, [session]);

  const scrollToBottom = (id?: string) => {
    if (id && mainScrollRefs.current[id]) {
        mainScrollRefs.current[id]?.scrollIntoView({ behavior: 'smooth' });
    } else if (auxEndRef.current) {
        auxEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    mainPresets.forEach(p => scrollToBottom(p.id));
  }, [session.mainMessages, mainPresets]);

  useEffect(() => scrollToBottom(), [session.auxTabs, session.activeAuxTabId]);

  useEffect(() => {
    return () => {
        if (audioSourceRef.current) try { audioSourceRef.current.stop(); } catch(e){}
        if (audioContextRef.current) audioContextRef.current.close();
    };
  }, []);

  const handleTTS = async (text: string, msgId: string, voiceName?: string) => {
      if (audioSourceRef.current) {
          try { audioSourceRef.current.stop(); } catch(e){}
          audioSourceRef.current = null;
      }
      if (playingMessageId === msgId) { setPlayingMessageId(null); return; }

      setLoadingTTSId(msgId);
      try {
          if (!audioContextRef.current) audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 24000});
          if (audioContextRef.current.state === 'suspended') await audioContextRef.current.resume();

          let buffer = audioCache.current.get(msgId);
          if (!buffer) {
             const voice = voiceName || 'Puck';
             buffer = await generateSpeech(text, voice, audioContextRef.current);
             audioCache.current.set(msgId, buffer);
          }
          const source = audioContextRef.current.createBufferSource();
          source.buffer = buffer;
          source.connect(audioContextRef.current.destination);
          source.onended = () => setPlayingMessageId(null);
          audioSourceRef.current = source;
          source.start();
          setPlayingMessageId(msgId);
      } catch (e) {
          console.error("TTS failed", e);
      } finally {
          setLoadingTTSId(null);
      }
  };

  const triggerAutoAuxResponse = async (tab: AuxTab, mainHistory: Message[]) => {
      const preset = auxPresets.find(p => p.id === tab.presetId);
      if (!preset) return;

      const triggerMsgId = Date.now().toString() + Math.random().toString();
      const botMsgId = (Date.now() + 1).toString() + Math.random().toString();
      
      const userTriggerMsg: Message = { id: triggerMsgId, role: 'user', text: "Analyzing parallel conversation sync...", timestamp: Date.now(), isAutoTrigger: true };
      setAuxGeneratingIds(prev => new Set(prev).add(tab.id));
      
      const currentTab = { ...tab, messages: [...tab.messages, userTriggerMsg] };
      updateSession({ ...sessionRef.current, auxTabs: sessionRef.current.auxTabs.map(t => t.id === tab.id ? currentTab : t) });

      let currentBotText = '';
      try {
        await generateAuxiliaryResponse(settings.model, preset.systemPrompt, mainPresets[0]?.sharedPrompt || '', mainHistory, [], "Sync analysis based on full synchronized context.", settings.temperature, (chunk) => {
            currentBotText += chunk;
            const currentSession = sessionRef.current;
            updateSession({ ...currentSession, auxTabs: currentSession.auxTabs.map(t => t.id === tab.id ? { ...currentTab, messages: [...currentTab.messages, { id: botMsgId, role: 'model', text: currentBotText, timestamp: Date.now(), senderName: preset.title }] } : t) });
        });
      } catch (e) {
          console.error("Auto trigger error", e);
      } finally {
        setAuxGeneratingIds(prev => { const next = new Set(prev); next.delete(tab.id); return next; });
      }
  };

  const sendMainMessage = async () => {
    if (!inputMain.trim() || isGeneratingMain) return;
    if (mainPresets.length === 0) { alert("Configure Main Agents in Session Preset first."); return; }
    
    const newUserMsg: Message = { id: Date.now().toString(), role: 'user', text: inputMain, timestamp: Date.now() };
    const updatedMessages = [...session.mainMessages, newUserMsg];
    updateSession({ ...session, mainMessages: updatedMessages });
    setInputMain('');
    setIsGeneratingMain(true);

    let finishedCount = 0;
    const totalRequests = mainPresets.length;

    mainPresets.map(async (preset, idx) => {
        const botMsgId = `bot-${Date.now()}-${idx}`;
        let currentBotText = '';
        
        const templateContent = preset.systemTemplateId ? systemTemplates.find(t => t.id === preset.systemTemplateId)?.content || '' : '';
        const privateSystem = preset.systemPrompt || '';
        const sharedContext = preset.sharedPrompt || '';
        const combinedPrivate = [templateContent, privateSystem].filter(s => s.trim().length > 0).join('\n\n---\n\n');
        const fullSystemInstruction = sharedContext ? `${combinedPrivate}\n\n[CONTEXT]: ${sharedContext}` : combinedPrivate;

        try {
            const finalFullText = await streamChat(settings.model, fullSystemInstruction, updatedMessages, newUserMsg.text, settings.temperature, (chunk) => {
                currentBotText += chunk;
                updateSession({
                    ...sessionRef.current,
                    mainMessages: [...sessionRef.current.mainMessages.filter(m => m.id !== botMsgId), { id: botMsgId, role: 'model', text: currentBotText, timestamp: Date.now(), senderId: preset.id, senderName: preset.title }]
                });
            });

            if (preset.ttsConfig?.autoPlay) {
                setTimeout(() => handleTTS(finalFullText, botMsgId, preset.ttsConfig?.voiceName), 150);
            }
        } catch (e) {
            console.error(`Error for ${preset.title}`, e);
        } finally {
            finishedCount++;
            if (finishedCount === totalRequests) {
                setIsGeneratingMain(false);
                const finalMainHistory = sessionRef.current.mainMessages;
                const autoTabs = session.auxTabs.filter(t => auxPresets.find(p => p.id === t.presetId)?.autoTrigger);
                autoTabs.forEach(tab => triggerAutoAuxResponse(tab, finalMainHistory));
            }
        }
    });
  };

  const activeAuxTab = session.auxTabs.find(t => t.id === session.activeAuxTabId);
  const activeAuxPreset = auxPresets.find(p => p.id === activeAuxTab?.presetId);

  const sendAuxMessage = async () => {
    if (!inputAux.trim() || isGeneratingAux || !activeAuxTab || !activeAuxPreset) return;
    const newUserMsg: Message = { id: Date.now().toString(), role: 'user', text: inputAux, timestamp: Date.now() };
    const updatedTabMessages = [...activeAuxTab.messages, newUserMsg];
    updateSession({ ...session, auxTabs: session.auxTabs.map(t => t.id === session.activeAuxTabId ? { ...t, messages: updatedTabMessages } : t) });
    setInputAux('');
    setIsGeneratingAux(true);

    let currentBotText = '';
    const botMsgId = `aux-bot-${Date.now()}`;
    try {
        await generateAuxiliaryResponse(settings.model, activeAuxPreset.systemPrompt, mainPresets[0]?.sharedPrompt || '', session.mainMessages, updatedTabMessages, newUserMsg.text, settings.temperature, (chunk) => {
            currentBotText += chunk;
            updateSession({ ...sessionRef.current, auxTabs: sessionRef.current.auxTabs.map(t => t.id === session.activeAuxTabId ? { ...t, messages: [...updatedTabMessages, { id: botMsgId, role: 'model', text: currentBotText, timestamp: Date.now(), senderName: activeAuxPreset.title }] } : t) });
        });
    } finally { setIsGeneratingAux(false); }
  };

  const handleAddAuxTab = (presetId: string) => {
      const newTab = { id: Date.now().toString(), presetId, messages: [] };
      updateSession({ ...session, auxTabs: [...session.auxTabs, newTab], activeAuxTabId: newTab.id });
      setShowAuxAdder(false);
  };

  const handleCloseAuxTab = (tabId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const newTabs = session.auxTabs.filter(t => t.id !== tabId);
      updateSession({ ...session, auxTabs: newTabs, activeAuxTabId: session.activeAuxTabId === tabId ? (newTabs[0]?.id || null) : session.activeAuxTabId });
  };

  return (
    <div className="flex flex-col h-full w-full bg-white dark:bg-[#191919] overflow-hidden">
        <div className="flex md:hidden border-b border-slate-200 dark:border-[#2d2d2d] bg-slate-50 dark:bg-[#141414] shrink-0">
            <button onClick={() => setMobileView('main')} className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 border-b-2 transition-colors ${mobileView === 'main' ? 'border-indigo-600 text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/10' : 'border-transparent text-slate-500'}`}><MessageSquare size={16} /> Main</button>
            <button onClick={() => setMobileView('aux')} className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 border-b-2 transition-colors ${mobileView === 'aux' ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/10' : 'border-transparent text-slate-500'}`}><Briefcase size={16} /> Helpers</button>
        </div>

        <div className="flex-1 flex overflow-hidden relative">
            {/* PARALLEL MAIN VIEW */}
            <div className={`flex-col border-r border-slate-200 dark:border-[#2d2d2d] transition-all absolute inset-0 md:relative md:flex md:w-2/3 bg-slate-100/50 dark:bg-[#111] ${mobileView === 'main' ? 'flex z-10' : 'hidden md:flex'}`}>
                <div className="h-14 border-b border-slate-200 dark:border-[#2d2d2d] hidden md:flex items-center px-4 bg-white dark:bg-[#1f1f1f] justify-between shrink-0">
                    <div className="flex items-center gap-2">
                        <Columns2 size={16} className="text-indigo-600" />
                        <h3 className="font-bold text-slate-900 dark:text-slate-200 text-sm">Synchronized Dialogue Hub</h3>
                        <span className="text-[10px] px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full font-bold uppercase tracking-widest">{mainPresets.length} Agents</span>
                    </div>
                </div>

                <div className={`flex-1 overflow-x-auto overflow-y-hidden flex h-full ${mainPresets.length > 1 ? 'gap-0.5' : ''}`}>
                    {mainPresets.map((preset) => (
                        <div key={preset.id} className="min-w-[320px] flex-1 flex flex-col h-full bg-white dark:bg-[#191919] border-r border-slate-200 dark:border-[#2d2d2d] last:border-r-0 relative">
                            <div className="h-10 border-b border-slate-100 dark:border-[#2d2d2d] flex items-center px-4 bg-slate-50/50 dark:bg-[#1f1f1f]/50 shrink-0 sticky top-0 z-20 backdrop-blur-sm">
                                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest truncate">{preset.title}</span>
                                {preset.ttsConfig?.autoPlay && <Volume2 size={12} className="ml-2 text-indigo-500" />}
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                                {session.mainMessages.filter(m => m.role === 'user' || m.senderId === preset.id).map(m => (
                                    <MessageBubble 
                                        key={m.id} 
                                        msg={m} 
                                        onPlayTTS={handleTTS} 
                                        isPlaying={playingMessageId === m.id} 
                                        isLoadingTTS={loadingTTSId === m.id}
                                        voiceName={preset.ttsConfig?.voiceName}
                                    />
                                ))}
                                {/* Fix: Wrapping ref assignment in braces to return void and prevent TS type mismatch */}
                                <div ref={(el) => { mainScrollRefs.current[preset.id] = el; }} />
                            </div>
                        </div>
                    ))}
                    {mainPresets.length === 0 && (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-400"><LayoutGrid size={48} className="opacity-10 mb-4" /><p>No Main Agents Configured</p></div>
                    )}
                </div>

                <div className="p-4 bg-white dark:bg-[#191919] border-t border-slate-200 dark:border-[#2d2d2d] shrink-0">
                    <div className="max-w-4xl mx-auto flex gap-2">
                        <input className="flex-1 bg-slate-100 dark:bg-[#141414] text-slate-900 dark:text-slate-100 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-600/50 outline-none border border-slate-200 dark:border-[#333333] text-base" placeholder="Send sync command..." value={inputMain} onChange={e => setInputMain(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMainMessage()} disabled={isGeneratingMain} />
                        <button onClick={sendMainMessage} disabled={isGeneratingMain || !inputMain.trim()} className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-200 dark:disabled:bg-[#222222] text-white p-3 rounded-xl shadow-lg transition-all"><Send size={20} /></button>
                    </div>
                </div>
            </div>

            {/* AUX VIEW */}
            <div className={`flex-col bg-slate-50 dark:bg-[#141414] transition-all absolute inset-0 md:relative md:flex md:w-1/3 ${mobileView === 'aux' ? 'flex z-10' : 'hidden md:flex'}`}>
                <div className="h-14 border-b border-slate-200 dark:border-[#2d2d2d] flex items-center bg-white dark:bg-[#1f1f1f] overflow-x-auto shrink-0 px-2 relative">
                    {session.auxTabs.map(tab => (
                        <div key={tab.id} onClick={() => updateSession({ ...session, activeAuxTabId: tab.id })} className={`group flex items-center gap-2 px-3 h-10 text-[10px] font-bold uppercase tracking-wider border border-slate-200 dark:border-[#333333] rounded-lg mr-2 cursor-pointer transition-all shrink-0 ${session.activeAuxTabId === tab.id ? 'bg-indigo-600 text-white border-indigo-600' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}>
                            {auxPresets.find(p => p.id === tab.presetId)?.autoTrigger && <Zap size={10} className="fill-current text-amber-400" />}
                            <span className="truncate max-w-[80px]">{auxPresets.find(p => p.id === tab.presetId)?.title}</span>
                            <button onClick={(e) => handleCloseAuxTab(tab.id, e)} className="p-1 hover:text-red-300"><X size={10} /></button>
                        </div>
                    ))}
                    <button onClick={() => setShowAuxAdder(!showAuxAdder)} className="p-2 text-slate-400 hover:text-indigo-600 shrink-0"><Plus size={18} /></button>
                    
                    {showAuxAdder && (
                        <div className="absolute top-14 left-2 right-2 bg-white dark:bg-[#1f1f1f] border border-slate-200 dark:border-[#333333] rounded-xl shadow-xl z-50 p-2 max-h-60 overflow-y-auto">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-2 pt-1">Available Helpers</div>
                            {auxPresets.filter(p => !session.auxTabs.some(t => t.presetId === p.id)).map(p => (
                                <button key={p.id} onClick={() => handleAddAuxTab(p.id)} className="w-full text-left p-3 hover:bg-slate-50 dark:hover:bg-[#252525] rounded-lg flex items-center justify-between transition-colors">
                                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{p.title}</span>
                                    {p.autoTrigger && <Zap size={12} className="text-amber-500 fill-amber-500" />}
                                </button>
                            ))}
                            {auxPresets.filter(p => !session.auxTabs.some(t => t.presetId === p.id)).length === 0 && (
                                <div className="p-4 text-center text-xs text-slate-500">All helpers already active</div>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex-1 flex flex-col bg-white dark:bg-[#191919]">
                    {activeAuxTab ? (
                        <>
                            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                                {activeAuxTab.messages.map(m => (
                                    <MessageBubble key={m.id} msg={m} onPlayTTS={handleTTS} isPlaying={playingMessageId === m.id} isLoadingTTS={loadingTTSId === m.id} />
                                ))}
                                <div ref={auxEndRef} />
                            </div>
                            <div className="p-4 border-t border-slate-200 dark:border-[#2d2d2d] shrink-0">
                                <div className="flex gap-2">
                                    <input className="flex-1 bg-slate-50 dark:bg-[#141414] text-slate-900 dark:text-slate-100 rounded-xl px-4 py-2 text-sm" placeholder="Aux inquiry..." value={inputAux} onChange={e => setInputAux(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendAuxMessage()} disabled={isGeneratingAux} />
                                    <button onClick={sendAuxMessage} disabled={isGeneratingAux || !inputAux.trim()} className="bg-emerald-600 text-white p-2 rounded-lg"><Send size={18} /></button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 px-8 text-center"><Briefcase size={32} className="mb-2 opacity-10" /><p className="text-xs">Select or add a helper to analyze the synchronized flow.</p></div>
                    )}
                </div>
            </div>
        </div>
    </div>
  );
};
