
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
    // If it's an auto-trigger message and NOT the last one, fade it out significantly
    const isAuto = msg.isAutoTrigger;
    const opacityClass = (isAuto && !isLastInGroup) ? 'opacity-50 hover:opacity-100 transition-opacity' : 'opacity-100';

    return (
      <div className={`flex gap-3 mb-4 group ${msg.role === 'user' ? 'flex-row-reverse' : ''} ${opacityClass}`}>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
            msg.role === 'user' 
            ? (msg.isAutoTrigger ? 'bg-amber-600/80' : 'bg-indigo-600') 
            : 'bg-emerald-600'
        }`}>
            {msg.role === 'user' ? (
                msg.isAutoTrigger ? <Zap size={16} className="text-white fill-white" /> : <User size={16} />
            ) : <Bot size={16} />}
        </div>
        
        <div className={`flex flex-col max-w-[85%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            {msg.isAutoTrigger && msg.role === 'user' && (
                 <div className="text-[10px] text-amber-500/80 mb-1 uppercase tracking-wider font-bold">Auto Trigger</div>
            )}
            <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap break-words ${
                msg.role === 'user' 
                ? (msg.isAutoTrigger ? 'bg-slate-800/50 border border-amber-900/30 text-slate-300 italic' : 'bg-slate-800 text-slate-100')
                : 'bg-slate-900/80 border border-slate-700 text-slate-200 shadow-sm'
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
                    className={`p-1.5 rounded-md hover:bg-slate-800 transition-colors ${
                        isPlaying ? 'text-indigo-400 bg-slate-800' : 'text-slate-500 hover:text-indigo-300'
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
             // Default voice or configured voice
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

      // 1. Add "Auto Trigger" user message to UI
      const triggerMsgId = Date.now().toString() + Math.random().toString();
      const botMsgId = (Date.now() + 1).toString() + Math.random().toString();
      
      const userTriggerMsg: Message = {
          id: triggerMsgId,
          role: 'user',
          text: "Analyze latest response", // Short text for UI, logic uses system prompt
          timestamp: Date.now(),
          isAutoTrigger: true
      };

      // Add user message to state immediately
      setAuxGeneratingIds(prev => new Set(prev).add(tab.id));
      
      // Prevent mutation of original tab object
      const currentTab = {
          ...tab,
          messages: [...tab.messages, userTriggerMsg]
      };
      
      // Update global session state 
      const sessionWithTrigger = {
          ...sessionRef.current,
          auxTabs: sessionRef.current.auxTabs.map(t => t.id === tab.id ? currentTab : t)
      };
      updateSession(sessionWithTrigger);

      let currentBotText = '';

      try {
        // 2. Call API
        // CRITICAL: Pass empty array for auxHistory to make it stateless/independent
        await generateAuxiliaryResponse(
            settings.apiKey,
            settings.model,
            preset.systemPrompt,
            mainPreset?.sharedPrompt || '', // Pass shared context
            mainHistory,
            [], // Empty aux history for auto-mode
            "Perform your task based on the latest main conversation context.", // Generic instruction
            settings.temperature,
            (chunk) => {
                currentBotText += chunk;
                // Live update
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

    // 1. Get Base Template Content
    const templateContent = mainPreset?.systemTemplateId 
        ? systemTemplates.find(t => t.id === mainPreset.systemTemplateId)?.content || ''
        : '';

    // 2. Get Private Persona
    const privateSystem = mainPreset?.systemPrompt || 'You are a helpful assistant.';
    
    // 3. Get Shared Context
    const sharedContext = mainPreset?.sharedPrompt || '';
    
    // 4. Combine Private Instructions (Template + Persona)
    const combinedPrivate = [templateContent, privateSystem]
        .filter(s => s.trim().length > 0)
        .join('\n\n---\n\n');

    // 5. Final Assembly
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
                    ...session, // This might be slightly stale if typing very fast, but usually fine for main chat
                    mainMessages: [
                        ...updatedMessages,
                        { id: botMsgId, role: 'model' as const, text: currentBotText, timestamp: Date.now() }
                    ]
                });
            }
        );
        finalFullText = fullResponse;

        // Auto-play TTS if enabled in preset
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
        
        // --- CHECK AND TRIGGER AUTO-AUX ---
        // We only trigger if we got a valid response
        if (finalFullText) {
            const finalMainHistory = [...updatedMessages, { id: botMsgId, role: 'model' as const, text: finalFullText, timestamp: Date.now() }];
            
            // Find tabs with presets that have autoTrigger enabled
            const autoTabs = session.auxTabs.filter(t => {
                const preset = auxPresets.find(p => p.id === t.presetId);
                return preset?.autoTrigger === true;
            });

            if (autoTabs.length > 0) {
                // Pass the updated history explicitly
                autoTabs.forEach(tab => triggerAutoAuxResponse(tab, finalMainHistory));
            }
        }
    }
  };

  // Aux Chat Handlers
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
            mainPreset?.sharedPrompt || '', // Pass Shared Context
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

  // UI Selection State for Aux adder
  const [showAuxAdder, setShowAuxAdder] = useState(false);

  return (
    <div className="flex flex-col h-full w-full bg-slate-950 overflow-hidden">
        
        {/* MOBILE TAB NAVIGATOR (Visible only on md:hidden) */}
        <div className="flex md:hidden border-b border-slate-800 bg-slate-925 shrink-0">
            <button
                onClick={() => setMobileView('main')}
                className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 border-b-2 transition-colors ${
                    mobileView === 'main' 
                    ? 'border-indigo-500 text-indigo-100 bg-indigo-900/10' 
                    : 'border-transparent text-slate-500'
                }`}
            >
                <MessageSquare size={16} /> Main Chat
            </button>
            <button
                onClick={() => setMobileView('aux')}
                className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 border-b-2 transition-colors ${
                    mobileView === 'aux' 
                    ? 'border-emerald-500 text-emerald-100 bg-emerald-900/10' 
                    : 'border-transparent text-slate-500'
                }`}
            >
                <Briefcase size={16} /> Helper Tools
            </button>
        </div>

        {/* CONTENT CONTAINER - Flex on desktop, Conditional block on mobile */}
        <div className="flex-1 flex overflow-hidden relative">
            
            {/* LEFT PANE: MAIN CHAT */}
            <div className={`
                flex-col border-r border-slate-800 transition-all absolute inset-0 md:relative md:flex md:w-1/2 bg-slate-950
                ${mobileView === 'main' ? 'flex z-10' : 'hidden md:flex'}
            `}>
                {/* Header - Desktop Only, Hidden on Mobile to save space (since we have Tab Nav) */}
                <div className="h-14 border-b border-slate-800 hidden md:flex items-center px-4 bg-slate-900/50 justify-between shrink-0">
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
                        <h3 className="font-semibold text-slate-200">
                            {mainPreset ? mainPreset.title : 'Main Conversation'}
                        </h3>
                    </div>
                    <div className="flex items-center gap-3">
                        {!settings.apiKey && (
                            <div className="flex items-center gap-1 text-amber-500 text-xs font-bold animate-pulse" title="API Key missing in Settings">
                                <TriangleAlert size={14} />
                                <span>No API Key</span>
                            </div>
                        )}
                        <div className="text-xs text-slate-500 px-2 py-1 bg-slate-800 rounded">
                            {session.mainMessages.length} msgs
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                    {session.mainMessages.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-slate-600 space-y-2">
                            <Layers size={48} className="opacity-20" />
                            <p className="text-sm">Start the conversation...</p>
                            {!settings.apiKey && <p className="text-xs text-amber-500">Please set API Key in settings.</p>}
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

                <div className="p-4 bg-slate-900 border-t border-slate-800 shrink-0">
                    <div className="flex gap-2 relative">
                        <input
                            className="flex-1 bg-slate-800 text-slate-100 placeholder-slate-500 rounded-lg px-4 py-3 focus:ring-2 focus:ring-indigo-600/50 outline-none border border-slate-700 text-base md:text-sm" // increased font size on mobile to prevent zoom
                            placeholder={mainPreset ? `Speak as User...` : "Type a message..."}
                            value={inputMain}
                            onChange={e => setInputMain(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && sendMainMessage()}
                            disabled={isGeneratingMain}
                        />
                        <button 
                            onClick={sendMainMessage}
                            disabled={isGeneratingMain || !inputMain.trim()}
                            className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 text-white p-3 rounded-lg transition-colors"
                        >
                            <Send size={20} />
                        </button>
                    </div>
                </div>
            </div>

            {/* RIGHT PANE: AUX CHAT */}
            <div className={`
                flex-col bg-slate-950 transition-all absolute inset-0 md:relative md:flex md:w-1/2
                ${mobileView === 'aux' ? 'flex z-10' : 'hidden md:flex'}
            `}>
                {/* AUX TABS HEADER */}
                <div className="h-14 border-b border-slate-800 flex items-center bg-slate-900/30 overflow-x-auto custom-scrollbar shrink-0">
                    {session.auxTabs.map(tab => {
                        const preset = auxPresets.find(p => p.id === tab.presetId);
                        const isGenerating = auxGeneratingIds.has(tab.id);
                        return (
                            <div 
                                key={tab.id}
                                onClick={() => updateSession({ ...session, activeAuxTabId: tab.id })}
                                className={`group flex items-center gap-2 px-4 h-full text-sm font-medium border-r border-slate-800 cursor-pointer min-w-[140px] max-w-[200px] select-none relative ${
                                    session.activeAuxTabId === tab.id 
                                    ? 'bg-slate-900 text-indigo-400 border-b-2 border-b-indigo-500' 
                                    : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900/50'
                                }`}
                            >
                                {/* Auto Trigger Indicator on Tab */}
                                {preset?.autoTrigger && (
                                    <Zap size={10} className="text-amber-500 fill-amber-500 absolute top-1.5 right-1.5" />
                                )}
                                
                                <span className="truncate flex-1 flex items-center gap-2">
                                    {isGenerating && <Loader2 size={12} className="animate-spin text-indigo-500" />}
                                    {preset?.title || 'Unknown'}
                                </span>
                                <button 
                                    onClick={(e) => handleCloseAuxTab(tab.id, e)}
                                    className="md:opacity-0 group-hover:opacity-100 hover:text-red-400 p-1 opacity-100" // Always visible on mobile
                                >
                                    <X size={12} />
                                </button>
                            </div>
                        );
                    })}
                    
                    <div className="relative h-full flex items-center px-2">
                        <button 
                            onClick={() => setShowAuxAdder(!showAuxAdder)}
                            className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                        >
                            <Plus size={18} />
                        </button>
                        
                        {showAuxAdder && (
                            <div className="absolute top-12 left-0 w-64 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-20 overflow-hidden">
                                <div className="p-2 text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-900/50">Add Helper</div>
                                <div className="max-h-64 overflow-y-auto">
                                    {auxPresets.map(p => (
                                        <button
                                            key={p.id}
                                            onClick={() => { handleAddAuxTab(p.id); setShowAuxAdder(false); }}
                                            className="w-full text-left px-4 py-2.5 text-sm text-slate-300 hover:bg-indigo-600 hover:text-white transition-colors border-b border-slate-700/50 last:border-0 flex justify-between items-center"
                                        >
                                            {p.title}
                                            {p.autoTrigger && <Zap size={12} className="text-amber-400 fill-amber-400" />}
                                        </button>
                                    ))}
                                    {auxPresets.length === 0 && (
                                        <div className="p-4 text-center text-xs text-slate-500">No aux presets found. Create one in Library.</div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* AUX CHAT AREA */}
                <div className="flex-1 flex flex-col min-h-0 bg-slate-900/20">
                    {activeAuxTab ? (
                        <>
                            {/* TOOLBAR */}
                            <div className="h-10 border-b border-slate-800/50 flex items-center justify-between px-4 bg-slate-900/30 shrink-0">
                                <div className="text-xs text-slate-500 flex items-center gap-1">
                                    {activeAuxPreset?.autoTrigger ? (
                                        <>
                                            <Zap size={12} className="text-amber-500" />
                                            <span className="text-amber-500 font-medium hidden sm:inline">Auto-Responds</span>
                                            <span className="text-amber-500 font-medium sm:hidden">Auto</span>
                                        </>
                                    ) : (
                                        <>
                                            <span className="text-emerald-500">●</span> <span className="hidden sm:inline">Monitoring Context</span>
                                        </>
                                    )}
                                </div>
                                <button 
                                    onClick={clearAuxContext}
                                    title="Clear history for this helper (keeps context)"
                                    className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white px-2 py-1 hover:bg-slate-800 rounded transition-colors"
                                >
                                    <RefreshCw size={12} /> Clear Memory
                                </button>
                            </div>

                            {/* MESSAGES */}
                            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                                {activeAuxTab.messages.length === 0 && (
                                    <div className="mt-10 text-center text-slate-600 text-sm px-8">
                                        <p className="mb-2 font-medium text-slate-500">{activeAuxPreset?.title}</p>
                                        <p>{activeAuxPreset?.autoTrigger 
                                            ? "I will automatically analyze every new AI response." 
                                            : "Ask me anything about the conversation on the left."}
                                        </p>
                                        {mainPreset?.sharedPrompt && (
                                            <div className="mt-4 p-3 bg-slate-800/50 rounded-lg text-xs border border-slate-700/50 text-slate-400">
                                                <div className="font-bold text-emerald-500 mb-1 uppercase tracking-wider">Context Aware</div>
                                                <div className="line-clamp-3">{mainPreset.sharedPrompt}</div>
                                            </div>
                                        )}
                                    </div>
                                )}
                                {activeAuxTab.messages.map((m, idx, arr) => (
                                    <MessageBubble 
                                        key={m.id} 
                                        msg={m} 
                                        onPlayTTS={handleTTS} 
                                        isPlaying={playingMessageId === m.id}
                                        isLoadingTTS={loadingTTSId === m.id}
                                        isLastInGroup={idx >= arr.length - 2} // Crude approximation for "last interaction"
                                    />
                                ))}
                                <div ref={auxEndRef} />
                            </div>

                            {/* INPUT */}
                            <div className="p-4 bg-slate-900 border-t border-slate-800 shrink-0">
                                <div className="flex gap-2">
                                    <input
                                        className="flex-1 bg-slate-800 text-slate-100 placeholder-slate-500 rounded-lg px-4 py-3 focus:ring-2 focus:ring-emerald-600/50 outline-none border border-slate-700 text-base md:text-sm"
                                        placeholder={activeAuxPreset?.autoTrigger ? "Ask manual question..." : `Ask ${activeAuxPreset?.title || 'helper'}...`}
                                        value={inputAux}
                                        onChange={e => setInputAux(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && sendAuxMessage()}
                                        disabled={isGeneratingAux}
                                    />
                                    <button 
                                        onClick={sendAuxMessage}
                                        disabled={isGeneratingAux || !inputAux.trim()}
                                        className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white p-3 rounded-lg transition-colors"
                                    >
                                        <Send size={20} />
                                    </button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
                            <Layers size={64} className="mb-4 text-slate-700" />
                            <h3 className="text-lg font-medium text-slate-400">No Helper Selected</h3>
                            <p className="text-sm mt-2 px-6 text-center">Open a new tab (+) to add a language tool.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    </div>
  );
};
