
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
    isLastInGroup?: boolean; // For visual grouping in aux
}> = ({ msg, onPlayTTS, isPlaying, isLoadingTTS, isLastInGroup = true }) => {
    // Determine opacity based on auto-trigger history status
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
            {msg.isAutoTrigger && msg.role === 'user' && (
                 <div className="text-[10px] text-amber-600 dark:text-amber-500 mb-1 uppercase tracking-widest font-bold">Auto Analysis</div>
            )}
            <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap break-words shadow-sm ${
                msg.role === 'user' 
                ? (msg.isAutoTrigger ? 'bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 text-slate-700 dark:text-slate-300 italic' : 'bg-indigo-600 text-white')
                : 'bg-white dark:bg-[#252525] border border-slate-200 dark:border-[#333333] text-slate-900 dark:text-slate-100'
            } ${msg.role === 'user' ? 'rounded-tr-none' : 'rounded-tl-none'}`}>
                {msg.text}
            </div>
            
            {/* Actions Line */}
            <div className={`flex items-center gap-2 mt-1 px-1 opacity-0 group-hover:opacity-100 transition-opacity ${
                 msg.role === 'user' ? 'flex-row-reverse' : ''
            }`}>
                <button 
                    onClick={() => onPlayTTS(msg.text, msg.id)}
                    disabled={isLoadingTTS}
                    className={`p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-[#333333] transition-colors ${
                        isPlaying ? 'text-indigo-600 dark:text-indigo-400 bg-slate-100 dark:bg-[#333333]' : 'text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-300'
                    }`}
                    title="Read Aloud"
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

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ session, updateSession, auxPresets, systemTemplates, settings, mainPreset }) => {
  const [inputMain, setInputMain] = useState('');
  const [inputAux, setInputAux] = useState('');
  const [isGeneratingMain, setIsGeneratingMain] = useState(false);
  const [isGeneratingAux, setIsGeneratingAux] = useState(false);
  
  // Mobile View State
  const [mobileView, setMobileView] = useState<'main' | 'aux'>('main');

  // Track individual Aux tabs generating status (for auto triggers)
  const [auxGeneratingIds, setAuxGeneratingIds] = useState<Set<string>>(new Set());

  const mainEndRef = useRef<HTMLDivElement>(null);
  const auxEndRef = useRef<HTMLDivElement>(null);

  // Audio System
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const audioCache = useRef<Map<string, AudioBuffer>>(new Map()); // ephemeral cache
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const [loadingTTSId, setLoadingTTSId] = useState<string | null>(null);

  // Maintain a ref to session for async callbacks
  const sessionRef = useRef(session);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const scrollToBottom = (ref: React.RefObject<HTMLDivElement>) => {
    ref.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => scrollToBottom(mainEndRef), [session.mainMessages, mobileView]);
  useEffect(() => scrollToBottom(auxEndRef), [session.auxTabs, session.activeAuxTabId, mobileView]);

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
        if (audioSourceRef.current) {
            audioSourceRef.current.stop();
        }
        if (audioContextRef.current) {
            audioContextRef.current.close();
        }
    };
  }, []);

  const handleTTS = async (text: string, msgId: string, voiceName?: string) => {
      // Stop current
      if (audioSourceRef.current) {
          try { audioSourceRef.current.stop(); } catch(e){}
          audioSourceRef.current = null;
      }
      
      if (playingMessageId === msgId) {
          setPlayingMessageId(null);
          return; // Toggle off
      }

      setLoadingTTSId(msgId);

      try {
          if (!audioContextRef.current) {
              audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
          }
          if (audioContextRef.current.state === 'suspended') {
              await audioContextRef.current.resume();
          }

          let buffer = audioCache.current.get(msgId);
          if (!buffer) {
             const voice = voiceName || mainPreset?.ttsConfig?.voiceName || 'Puck';
             buffer = await generateSpeech(settings.apiKey, text, voice, audioContextRef.current);
             audioCache.current.set(msgId, buffer);
          }

          const source = audioContextRef.current.createBufferSource();
          source.buffer = buffer;
          source.connect(audioContextRef.current.destination);
          
          source.onended = () => {
              setPlayingMessageId(null);
          };

          audioSourceRef.current = source;
          source.start();
          setPlayingMessageId(msgId);

      } catch (e) {
          console.error("TTS Playback failed", e);
          alert("TTS Failed: Please check your API Key in settings.");
      } finally {
          setLoadingTTSId(null);
      }
  };

  // --- Auto Trigger Logic ---
  const triggerAutoAuxResponse = async (tab: AuxTab, mainHistory: Message[]) => {
      const preset = auxPresets.find(p => p.id === tab.presetId);
      if (!preset) return;

      const triggerMsgId = Date.now().toString() + Math.random().toString();
      const botMsgId = (Date.now() + 1).toString() + Math.random().toString();
      
      const userTriggerMsg: Message = {
          id: triggerMsgId,
          role: 'user',
          text: "Analyze latest response", 
          timestamp: Date.now(),
          isAutoTrigger: true
      };

      setAuxGeneratingIds(prev => new Set(prev).add(tab.id));
      
      const currentTab = {
          ...tab,
          messages: [...tab.messages, userTriggerMsg]
      };
      
      const sessionWithTrigger = {
          ...sessionRef.current,
          auxTabs: sessionRef.current.auxTabs.map(t => t.id === tab.id ? currentTab : t)
      };
      updateSession(sessionWithTrigger);

      let currentBotText = '';

      try {
        await generateAuxiliaryResponse(
            settings.apiKey,
            settings.model,
            preset.systemPrompt,
            mainPreset?.sharedPrompt || '', 
            mainHistory,
            [], 
            "Perform your task based on the latest main conversation context.", 
            settings.temperature,
            (chunk) => {
                currentBotText += chunk;
                const streamingTab = {
                    ...currentTab,
                    messages: [...currentTab.messages, { id: botMsgId, role: 'model' as const, text: currentBotText, timestamp: Date.now() }]
                };
                
                const currentSession = sessionRef.current;
                updateSession({
                    ...currentSession,
                    auxTabs: currentSession.auxTabs.map(t => t.id === tab.id ? streamingTab : t)
                });
            }
        );
      } catch (e) {
          console.error("Auto Trigger Error", e);
           const errorTab = {
                ...currentTab,
                messages: [...currentTab.messages, { id: botMsgId, role: 'model' as const, text: "[Auto-Analysis Failed. Check API Key.]", timestamp: Date.now() }]
            };
           const currentSession = sessionRef.current;
           updateSession({
                ...currentSession,
                auxTabs: currentSession.auxTabs.map(t => t.id === tab.id ? errorTab : t)
            });
      } finally {
        setAuxGeneratingIds(prev => {
            const next = new Set(prev);
            next.delete(tab.id);
            return next;
        });
      }
  };

  // Main Chat Handlers
  const sendMainMessage = async () => {
    if (!inputMain.trim() || isGeneratingMain) return;
    if (!settings.apiKey) {
        alert("Please set your Google Gemini API Key in Settings first.");
        return;
    }
    
    const newUserMsg: Message = {
        id: Date.now().toString(),
        role: 'user',
        text: inputMain,
        timestamp: Date.now()
    };

    const updatedMessages = [...session.mainMessages, newUserMsg];
    updateSession({ ...session, mainMessages: updatedMessages });
    setInputMain('');
    setIsGeneratingMain(true);

    const templateContent = mainPreset?.systemTemplateId 
        ? systemTemplates.find(t => t.id === mainPreset.systemTemplateId)?.content || ''
        : '';

    const privateSystem = mainPreset?.systemPrompt || 'You are a helpful assistant.';
    const sharedContext = mainPreset?.sharedPrompt || '';
    const combinedPrivate = [templateContent, privateSystem]
        .filter(s => s.trim().length > 0)
        .join('\n\n---\n\n');

    const fullSystemInstruction = sharedContext 
        ? `${combinedPrivate}\n\n[CONTEXT/SCENARIO]: ${sharedContext}` 
        : combinedPrivate;

    const botMsgId = (Date.now() + 1).toString();
    
    let currentBotText = '';
    let finalFullText = '';
    
    try {
        const fullResponse = await streamChat(
            settings.apiKey,
            settings.model,
            fullSystemInstruction,
            updatedMessages, 
            newUserMsg.text,
            settings.temperature,
            (chunk) => {
                currentBotText += chunk;
                updateSession({
                    ...session,
                    mainMessages: [
                        ...updatedMessages,
                        { id: botMsgId, role: 'model' as const, text: currentBotText, timestamp: Date.now() }
                    ]
                });
            }
        );
        finalFullText = fullResponse;

        if (mainPreset?.ttsConfig?.autoPlay && fullResponse) {
             setTimeout(() => {
                 handleTTS(fullResponse, botMsgId, mainPreset.ttsConfig?.voiceName);
             }, 100);
        }

    } catch (e) {
        updateSession({
            ...session,
            mainMessages: [
                ...updatedMessages,
                { id: botMsgId, role: 'model' as const, text: "[Error generating response. Please check API Key in Settings.]", timestamp: Date.now() }
            ]
        });
    } finally {
        setIsGeneratingMain(false);
        if (finalFullText) {
            const finalMainHistory = [...updatedMessages, { id: botMsgId, role: 'model' as const, text: finalFullText, timestamp: Date.now() }];
            const autoTabs = session.auxTabs.filter(t => {
                const preset = auxPresets.find(p => p.id === t.presetId);
                return preset?.autoTrigger === true;
            });
            if (autoTabs.length > 0) {
                autoTabs.forEach(tab => triggerAutoAuxResponse(tab, finalMainHistory));
            }
        }
    }
  };

  const activeAuxTab = session.auxTabs.find(t => t.id === session.activeAuxTabId);
  const activeAuxPreset = auxPresets.find(p => p.id === activeAuxTab?.presetId);

  const sendAuxMessage = async () => {
    if (!inputAux.trim() || isGeneratingAux || !activeAuxTab || !activeAuxPreset) return;
    if (!settings.apiKey) {
        alert("Please set your Google Gemini API Key in Settings first.");
        return;
    }

    const newUserMsg: Message = {
        id: Date.now().toString(),
        role: 'user',
        text: inputAux,
        timestamp: Date.now()
    };

    const currentTabMessages = activeAuxTab.messages;
    const updatedTabMessages = [...currentTabMessages, newUserMsg];
    
    const updatedTabs = session.auxTabs.map(t => 
        t.id === session.activeAuxTabId 
        ? { ...t, messages: updatedTabMessages } 
        : t
    );

    updateSession({ ...session, auxTabs: updatedTabs });
    setInputAux('');
    setIsGeneratingAux(true);

    const botMsgId = (Date.now() + 1).toString();
    let currentBotText = '';

    try {
        await generateAuxiliaryResponse(
            settings.apiKey,
            settings.model,
            activeAuxPreset.systemPrompt,
            mainPreset?.sharedPrompt || '', 
            session.mainMessages, 
            updatedTabMessages, 
            newUserMsg.text, 
            settings.temperature,
            (chunk) => {
                currentBotText += chunk;
                const streamingTabs = session.auxTabs.map(t => 
                    t.id === session.activeAuxTabId 
                    ? { 
                        ...t, 
                        messages: [...updatedTabMessages, { id: botMsgId, role: 'model' as const, text: currentBotText, timestamp: Date.now() }] 
                      } 
                    : t
                );
                updateSession({ ...session, auxTabs: streamingTabs });
            }
        );
    } catch (e) {
         const errorTabs = session.auxTabs.map(t => 
            t.id === session.activeAuxTabId 
            ? { 
                ...t, 
                messages: [...updatedTabMessages, { id: botMsgId, role: 'model' as const, text: "[Error: Check API Key]", timestamp: Date.now() }] 
              } 
            : t
        );
        updateSession({ ...session, auxTabs: errorTabs });
    } finally {
        setIsGeneratingAux(false);
    }
  };

  const handleAddAuxTab = (presetId: string) => {
      const newTab = {
          id: Date.now().toString(),
          presetId,
          messages: []
      };
      updateSession({
          ...session,
          auxTabs: [...session.auxTabs, newTab],
          activeAuxTabId: newTab.id
      });
  };

  const handleCloseAuxTab = (tabId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const newTabs = session.auxTabs.filter(t => t.id !== tabId);
      let newActiveId = session.activeAuxTabId;
      if (session.activeAuxTabId === tabId) {
          newActiveId = newTabs.length > 0 ? newTabs[newTabs.length - 1].id : null;
      }
      updateSession({
          ...session,
          auxTabs: newTabs,
          activeAuxTabId: newActiveId
      });
  };

  const clearAuxContext = () => {
      if (!activeAuxTab) return;
      const updatedTabs = session.auxTabs.map(t => 
        t.id === activeAuxTab.id ? { ...t, messages: [] } : t
      );
      updateSession({ ...session, auxTabs: updatedTabs });
  }

  const [showAuxAdder, setShowAuxAdder] = useState(false);

  return (
    <div className="flex flex-col h-full w-full bg-white dark:bg-[#191919] overflow-hidden">
        
        {/* MOBILE TAB NAVIGATOR */}
        <div className="flex md:hidden border-b border-slate-200 dark:border-[#2d2d2d] bg-slate-50 dark:bg-[#141414] shrink-0">
            <button
                onClick={() => setMobileView('main')}
                className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 border-b-2 transition-colors ${
                    mobileView === 'main' 
                    ? 'border-indigo-600 text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/10' 
                    : 'border-transparent text-slate-500'
                }`}
            >
                <MessageSquare size={16} /> Main
            </button>
            <button
                onClick={() => setMobileView('aux')}
                className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 border-b-2 transition-colors ${
                    mobileView === 'aux' 
                    ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/10' 
                    : 'border-transparent text-slate-500'
                }`}
            >
                <Briefcase size={16} /> Helpers
            </button>
        </div>

        <div className="flex-1 flex overflow-hidden relative">
            
            {/* LEFT PANE: MAIN CHAT */}
            <div className={`
                flex-col border-r border-slate-200 dark:border-[#2d2d2d] transition-all absolute inset-0 md:relative md:flex md:w-1/2 bg-white dark:bg-[#191919]
                ${mobileView === 'main' ? 'flex z-10' : 'hidden md:flex'}
            `}>
                <div className="h-14 border-b border-slate-200 dark:border-[#2d2d2d] hidden md:flex items-center px-4 bg-slate-50/50 dark:bg-[#1f1f1f]/50 justify-between shrink-0">
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
                        <h3 className="font-bold text-slate-900 dark:text-slate-200 text-sm">
                            {mainPreset ? mainPreset.title : 'Main Conversation'}
                        </h3>
                    </div>
                    <div className="flex items-center gap-3">
                        {!settings.apiKey && (
                            <div className="flex items-center gap-1 text-amber-600 text-[10px] font-bold animate-pulse" title="API Key missing">
                                <TriangleAlert size={14} />
                                <span>No API Key</span>
                            </div>
                        )}
                        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-2 py-1 bg-white dark:bg-[#141414] rounded border border-slate-200 dark:border-[#333333]">
                            {session.mainMessages.length} MSGS
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                    {session.mainMessages.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2">
                            <Layers size={48} className="opacity-20" />
                            <p className="text-sm font-medium">Start the conversation...</p>
                        </div>
                    )}
                    {session.mainMessages.map(m => (
                        <MessageBubble 
                            key={m.id} 
                            msg={m} 
                            onPlayTTS={handleTTS}
                            isPlaying={playingMessageId === m.id}
                            isLoadingTTS={loadingTTSId === m.id}
                        />
                    ))}
                    <div ref={mainEndRef} />
                </div>

                <div className="p-4 bg-slate-50 dark:bg-[#141414] border-t border-slate-200 dark:border-[#2d2d2d] shrink-0">
                    <div className="flex gap-2 relative">
                        <input
                            className="flex-1 bg-white dark:bg-[#1f1f1f] text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-600/50 outline-none border border-slate-200 dark:border-[#333333] text-base md:text-sm"
                            placeholder={mainPreset ? `Speak as User...` : "Type a message..."}
                            value={inputMain}
                            onChange={e => setInputMain(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && sendMainMessage()}
                            disabled={isGeneratingMain}
                        />
                        <button 
                            onClick={sendMainMessage}
                            disabled={isGeneratingMain || !inputMain.trim()}
                            className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-200 dark:disabled:bg-[#222222] disabled:text-slate-400 dark:disabled:text-slate-600 text-white p-3 rounded-xl transition-all shadow-lg shadow-indigo-600/10"
                        >
                            <Send size={20} />
                        </button>
                    </div>
                </div>
            </div>

            {/* RIGHT PANE: AUX CHAT */}
            <div className={`
                flex-col bg-slate-50 dark:bg-[#141414] transition-all absolute inset-0 md:relative md:flex md:w-1/2
                ${mobileView === 'aux' ? 'flex z-10' : 'hidden md:flex'}
            `}>
                {/* AUX TABS HEADER */}
                <div className="h-14 border-b border-slate-200 dark:border-[#2d2d2d] flex items-center bg-white dark:bg-[#1f1f1f]/30 overflow-x-auto custom-scrollbar shrink-0">
                    {session.auxTabs.map(tab => {
                        const preset = auxPresets.find(p => p.id === tab.presetId);
                        const isGenerating = auxGeneratingIds.has(tab.id);
                        return (
                            <div 
                                key={tab.id}
                                onClick={() => updateSession({ ...session, activeAuxTabId: tab.id })}
                                className={`group flex items-center gap-2 px-4 h-full text-xs font-bold uppercase tracking-wider border-r border-slate-200 dark:border-[#2d2d2d] cursor-pointer min-w-[140px] max-w-[200px] select-none relative transition-all ${
                                    session.activeAuxTabId === tab.id 
                                    ? 'bg-slate-50 dark:bg-[#141414] text-emerald-600 dark:text-emerald-400 border-b-2 border-b-emerald-600 dark:border-b-emerald-400' 
                                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                                }`}
                            >
                                {preset?.autoTrigger && (
                                    <Zap size={10} className="text-amber-500 fill-amber-500 absolute top-1.5 right-1.5" />
                                )}
                                
                                <span className="truncate flex-1 flex items-center gap-2">
                                    {isGenerating && <Loader2 size={12} className="animate-spin text-emerald-500" />}
                                    {preset?.title || 'Helper'}
                                </span>
                                <button 
                                    onClick={(e) => handleCloseAuxTab(tab.id, e)}
                                    className="p-1 hover:text-red-500 transition-colors"
                                >
                                    <X size={12} />
                                </button>
                            </div>
                        );
                    })}
                    
                    <div className="relative h-full flex items-center px-2">
                        <button 
                            onClick={() => setShowAuxAdder(!showAuxAdder)}
                            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-[#2d2d2d] text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all"
                        >
                            <Plus size={18} />
                        </button>
                        
                        {showAuxAdder && (
                            <div className="absolute top-12 left-0 w-64 bg-white dark:bg-[#252525] border border-slate-200 dark:border-[#333333] rounded-xl shadow-2xl z-[60] overflow-hidden">
                                <div className="p-3 text-[10px] font-bold text-slate-500 dark:text-slate-500 uppercase tracking-widest bg-slate-50 dark:bg-[#1a1a1a] border-b border-slate-200 dark:border-[#333333]">Available Helpers</div>
                                <div className="max-h-64 overflow-y-auto custom-scrollbar">
                                    {auxPresets.map(p => (
                                        <button
                                            key={p.id}
                                            onClick={() => { handleAddAuxTab(p.id); setShowAuxAdder(false); }}
                                            className="w-full text-left px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors border-b border-slate-100 dark:border-[#333333] last:border-0 flex justify-between items-center"
                                        >
                                            {p.title}
                                            {p.autoTrigger && <Zap size={12} className="text-amber-500 fill-amber-500" />}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* AUX CHAT AREA */}
                <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-[#191919]">
                    {activeAuxTab ? (
                        <>
                            <div className="h-10 border-b border-slate-100 dark:border-[#2d2d2d] flex items-center justify-between px-4 bg-white dark:bg-[#141414] shrink-0">
                                <div className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5">
                                    {activeAuxPreset?.autoTrigger ? (
                                        <>
                                            <Zap size={12} className="text-amber-500" />
                                            <span className="text-amber-600 dark:text-amber-500">Auto Mode</span>
                                        </>
                                    ) : (
                                        <>
                                            <span className="text-emerald-500">●</span> <span className="text-slate-400">Manual Mode</span>
                                        </>
                                    )}
                                </div>
                                <button 
                                    onClick={clearAuxContext}
                                    className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-900 dark:hover:text-white px-2 py-1 rounded transition-colors"
                                >
                                    <RefreshCw size={12} /> Reset Mem
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                                {activeAuxTab.messages.length === 0 && (
                                    <div className="mt-10 text-center text-slate-500 text-sm px-8 max-w-sm mx-auto">
                                        <p className="mb-2 font-bold text-slate-900 dark:text-slate-300">{activeAuxPreset?.title}</p>
                                        <p className="text-xs leading-relaxed">{activeAuxPreset?.autoTrigger 
                                            ? "I will automatically analyze every response from the Main AI." 
                                            : "Ask me specific questions about the conversation transcript."}
                                        </p>
                                    </div>
                                )}
                                {activeAuxTab.messages.map((m, idx, arr) => (
                                    <MessageBubble 
                                        key={m.id} 
                                        msg={m} 
                                        onPlayTTS={handleTTS} 
                                        isPlaying={playingMessageId === m.id}
                                        isLoadingTTS={loadingTTSId === m.id}
                                        isLastInGroup={idx >= arr.length - 2}
                                    />
                                ))}
                                <div ref={auxEndRef} />
                            </div>

                            <div className="p-4 bg-slate-50 dark:bg-[#141414] border-t border-slate-200 dark:border-[#2d2d2d] shrink-0">
                                <div className="flex gap-2">
                                    <input
                                        className="flex-1 bg-white dark:bg-[#1f1f1f] text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-600/50 outline-none border border-slate-200 dark:border-[#333333] text-base md:text-sm"
                                        placeholder={activeAuxPreset?.autoTrigger ? "Manual Query..." : `Ask ${activeAuxPreset?.title}...`}
                                        value={inputAux}
                                        onChange={e => setInputAux(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && sendAuxMessage()}
                                        disabled={isGeneratingAux}
                                    />
                                    <button 
                                        onClick={sendAuxMessage}
                                        disabled={isGeneratingAux || !inputAux.trim()}
                                        className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-200 dark:disabled:bg-[#222222] disabled:text-slate-400 dark:disabled:text-slate-600 text-white p-3 rounded-xl transition-all shadow-lg shadow-emerald-600/10"
                                    >
                                        <Send size={20} />
                                    </button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                            <Layers size={48} className="mb-4 text-slate-200 dark:text-slate-800" />
                            <h3 className="font-bold uppercase tracking-widest text-[10px]">No Helper Selected</h3>
                            <p className="text-xs mt-2 px-10 text-center opacity-70">Add a language tool from the top menu to get real-time assistance.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    </div>
  );
};
