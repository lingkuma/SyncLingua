

import React, { useEffect, useRef, useState } from 'react';
import { Send, Bot, User, Trash2, Plus, RefreshCw, Copy, Layers, Volume2, Loader2, StopCircle, X, Zap, TriangleAlert, Lock, Globe, LayoutTemplate, Info, Image as ImageIcon, MessageSquare, Menu, PanelLeftOpen, Mic } from 'lucide-react';
import { Message, Session, Preset, AppSettings, AuxTab, SystemTemplate, ImageTemplate } from '../types';
import { streamChat, generateAuxiliaryResponse, generateSpeech, generateSceneImage, transcribeUserAudio } from '../services/geminiService';
import { saveImageToCache } from '../services/imageDb';

interface ChatInterfaceProps {
  session: Session;
  updateSession: (updated: Session) => void;
  auxPresets: Preset[];
  systemTemplates: SystemTemplate[];
  imageTemplates: ImageTemplate[];
  settings: AppSettings;
  mainPreset?: Preset;
  isSidebarOpen?: boolean;
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
  onExpandSidebar?: () => void;
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

    // Helper to render text lines independently
    const renderContent = (text: string) => {
        return text.split('\n').map((line, index) => (
            <div key={index} className="min-h-[1.2rem] whitespace-pre-wrap break-words">
                {line || <br />}
            </div>
        ));
    };

    return (
      <div className={`flex gap-3 mb-4 group ${msg.role === 'user' ? 'flex-row-reverse' : ''} ${opacityClass}`}>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm ${
            msg.role === 'user' 
            ? (msg.isAutoTrigger ? 'bg-amber-600/80' : 'bg-indigo-600') 
            : 'bg-emerald-600'
        }`}>
            {msg.role === 'user' ? (
                msg.isAutoTrigger ? <Zap size={16} className="text-white fill-white" /> : <User size={16} className="text-white" />
            ) : <Bot size={16} className="text-white" />}
        </div>
        
        <div className={`flex flex-col max-w-[85%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            {msg.isAutoTrigger && msg.role === 'user' && (
                 <div className="text-[10px] text-amber-600 dark:text-amber-500/80 mb-1 uppercase tracking-wider font-bold">Auto Trigger</div>
            )}
            <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === 'user' 
                ? (msg.isAutoTrigger 
                    ? 'bg-amber-50/90 dark:bg-slate-800/90 border border-amber-900/10 dark:border-amber-900/30 text-amber-900 dark:text-slate-300 italic' 
                    : 'bg-indigo-600/90 dark:bg-slate-800/90 text-white dark:text-slate-100')
                : 'bg-white/90 dark:bg-neutral-900/90 border border-gray-200 dark:border-neutral-700 text-gray-800 dark:text-neutral-200 shadow-sm'
            } ${msg.role === 'user' ? 'rounded-tr-none' : 'rounded-tl-none'}`}>
                {renderContent(msg.text)}
            </div>
            
            {/* Actions Line */}
            <div className={`flex items-center gap-2 mt-1 px-1 opacity-0 group-hover:opacity-100 transition-opacity ${
                 msg.role === 'user' ? 'flex-row-reverse' : ''
            }`}>
                <button 
                    onClick={() => onPlayTTS(msg.text, msg.id)}
                    disabled={isLoadingTTS}
                    className={`p-1.5 rounded-md hover:bg-gray-200/50 dark:hover:bg-slate-800/50 transition-colors ${
                        isPlaying ? 'text-indigo-500 dark:text-indigo-400 bg-gray-200/50 dark:bg-slate-800/50' : 'text-gray-500 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-300'
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

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ session, updateSession, auxPresets, systemTemplates, imageTemplates, settings, mainPreset, isSidebarOpen, isSidebarCollapsed, onToggleSidebar, onExpandSidebar }) => {
  const [inputMain, setInputMain] = useState('');
  const [inputAux, setInputAux] = useState('');
  const [isGeneratingMain, setIsGeneratingMain] = useState(false);
  const [isGeneratingAux, setIsGeneratingAux] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  
  // Mobile View Toggle
  const [mobileView, setMobileView] = useState<'main' | 'aux'>('main');

  // Track individual Aux tabs generating status (for auto triggers)
  const [auxGeneratingIds, setAuxGeneratingIds] = useState<Set<string>>(new Set());

  const mainEndRef = useRef<HTMLDivElement>(null);
  const auxEndRef = useRef<HTMLDivElement>(null);

  // Textarea Refs for auto-resizing
  const textareaMainRef = useRef<HTMLTextAreaElement>(null);
  const textareaAuxRef = useRef<HTMLTextAreaElement>(null);

  // Audio System
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const audioCache = useRef<Map<string, AudioBuffer>>(new Map()); // ephemeral cache
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const [loadingTTSId, setLoadingTTSId] = useState<string | null>(null);

  // Recording State
  const [recordingTarget, setRecordingTarget] = useState<'main' | 'aux' | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // UI Selection State for Aux adder
  const [showAuxAdder, setShowAuxAdder] = useState(false);

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

  // Auto-resize effects
  useEffect(() => {
    if (textareaMainRef.current) {
        const hasContent = inputMain.trim().length > 0;
        if (hasContent) {
            textareaMainRef.current.style.height = 'auto';
            const newHeight = Math.min(textareaMainRef.current.scrollHeight, 160); // max-h-40 = 160px
            textareaMainRef.current.style.height = `${newHeight}px`;
        } else {
            textareaMainRef.current.style.height = '46px'; // min-h-[46px]
        }
    }
  }, [inputMain]);

  useEffect(() => {
    if (textareaAuxRef.current) {
        const hasContent = inputAux.trim().length > 0;
        if (hasContent) {
            textareaAuxRef.current.style.height = 'auto';
            const newHeight = Math.min(textareaAuxRef.current.scrollHeight, 160); // max-h-40 = 160px
            textareaAuxRef.current.style.height = `${newHeight}px`;
        } else {
            textareaAuxRef.current.style.height = '46px'; // min-h-[46px]
        }
    }
  }, [inputAux]);

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
        if (audioSourceRef.current) {
            audioSourceRef.current.stop();
        }
        if (audioContextRef.current) {
            audioContextRef.current.close();
        }
        // Cleanup recording stream if active
        if (mediaRecorderRef.current && mediaRecorderRef.current.stream) {
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        }
    };
  }, []);

  // --- RECORDING FUNCTIONS ---
  const startRecording = async (target: 'main' | 'aux') => {
      try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          mediaRecorderRef.current = new MediaRecorder(stream);
          audioChunksRef.current = [];

          mediaRecorderRef.current.ondataavailable = (event) => {
              if (event.data.size > 0) {
                  audioChunksRef.current.push(event.data);
              }
          };

          mediaRecorderRef.current.onstop = async () => {
              const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' }); // Browsers usually record webm
              await handleTranscription(audioBlob, target);
              
              // Stop tracks
              stream.getTracks().forEach(track => track.stop());
          };

          mediaRecorderRef.current.start();
          setRecordingTarget(target);

      } catch (err) {
          console.error("Error accessing microphone:", err);
          alert("Could not access microphone. Please ensure permissions are granted.");
      }
  };

  const stopRecording = () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
          setRecordingTarget(null);
      }
  };

  const handleTranscription = async (audioBlob: Blob, target: 'main' | 'aux') => {
      if (!settings.apiKey) {
          alert("API Key missing. Cannot transcribe.");
          return;
      }

      setIsTranscribing(true);
      try {
          // Convert Blob to Base64
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = async () => {
              const base64String = reader.result as string;
              // Remove data URL prefix (e.g., "data:audio/webm;base64,")
              const base64Data = base64String.split(',')[1];
              const mimeType = base64String.split(',')[0].split(':')[1].split(';')[0];

              const text = await transcribeUserAudio(settings.apiKey, base64Data, mimeType);
              
              if (target === 'main') {
                  setInputMain(prev => (prev + " " + text).trim());
              } else {
                  setInputAux(prev => (prev + " " + text).trim());
              }
              setIsTranscribing(false);
          };
      } catch (e) {
          console.error("Transcription failed", e);
          setIsTranscribing(false);
      }
  };

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
             const voice = voiceName || mainPreset?.ttsConfig?.voiceName || 'Zephyr';
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

  const handleSceneImageGeneration = async (latestMessages: Message[]) => {
      if (!mainPreset?.backgroundImageConfig?.enabled) return;
      if (!settings.apiKey) return;

      setIsGeneratingImage(true);

      const config = mainPreset.backgroundImageConfig;
      
      // 1. Get Base Template
      const template = config.imageTemplateId 
         ? imageTemplates.find(t => t.id === config.imageTemplateId)?.prompt || '' 
         : '';

      // 2. Specific Prompt
      const specific = config.specificPrompt || '';

      // 3. Shared Context
      const shared = (config.useSharedContext && mainPreset.sharedPrompt) ? mainPreset.sharedPrompt : '';

      // 4. Conversation Context (Last 3 messages)
      const recentHistory = latestMessages.slice(-3).map(m => `${m.role === 'user' ? 'User' : 'Character'}: ${m.text}`).join('\n');

      // Construct Prompt
      const fullPrompt = `
      Create a cinematic, high-quality background image for a conversation scene.
      
      BASE STYLE:
      ${template}
      
      SCENARIO DETAILS:
      ${specific}
      ${shared}
      
      CURRENT ACTION (Visualize this moment):
      ${recentHistory}
      
      No text overlays. Focus on atmosphere and setting.
      `;

      // Detect device type and set appropriate aspect ratio
      const isMobile = window.innerWidth < 768;
      const aspectRatio = isMobile ? "9:16" : "16:9";

      try {
          const imageUrl = await generateSceneImage(settings.apiKey, settings.imageModel || 'gemini-2.5-flash-image', fullPrompt, aspectRatio);
          
          // Save to Local DB (IndexedDB)
          await saveImageToCache(session.id, imageUrl);

          // Update State for immediate view
          updateSession({
              ...sessionRef.current,
              backgroundImageUrl: imageUrl
          });
      } catch (e) {
          console.error("Image Gen Failed", e);
      } finally {
          setIsGeneratingImage(false);
      }
  }

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
          mainMessages: mainHistory,
          auxTabs: sessionRef.current.auxTabs.map(t => t.id === tab.id ? currentTab : t)
      };
      updateSession(sessionWithTrigger);

      let currentBotText = '';

      try {
        // 2. Call API
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
                    ...sessionRef.current, // Use ref to ensure we don't overwrite concurrent changes (like aux tabs closing)
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
        
        if (finalFullText) {
            const finalMainHistory = [...updatedMessages, { id: botMsgId, role: 'model' as const, text: finalFullText, timestamp: Date.now() }];
            
            // --- CHECK AND TRIGGER AUTO-AUX ---
            const autoTabs = session.auxTabs.filter(t => {
                const preset = auxPresets.find(p => p.id === t.presetId);
                return preset?.autoTrigger === true;
            });
            if (autoTabs.length > 0) {
                autoTabs.forEach(tab => triggerAutoAuxResponse(tab, finalMainHistory));
            }

            // --- CHECK AND TRIGGER IMAGE GEN ---
            if (mainPreset?.backgroundImageConfig?.enabled) {
                handleSceneImageGeneration(finalMainHistory);
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

  return (
    <div className="flex flex-col h-full w-full bg-transparent overflow-hidden">
        {/* MOBILE TABS SWITCHER - Hidden, using toggle buttons in input area instead */}
        <div className="hidden md:hidden flex border-b border-gray-200 dark:border-neutral-800 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-md shrink-0">
            <button 
                onClick={() => setMobileView('main')}
                className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                    mobileView === 'main' 
                    ? 'border-indigo-600 text-indigo-600 dark:text-white dark:border-white' 
                    : 'border-transparent text-gray-500 dark:text-gray-500'
                }`}
            >
                Main Chat
            </button>
            <button 
                onClick={() => setMobileView('aux')}
                className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                    mobileView === 'aux' 
                    ? 'border-indigo-600 text-indigo-600 dark:text-white dark:border-white' 
                    : 'border-transparent text-gray-500 dark:text-gray-500'
                }`}
            >
                Aux Tools {auxGeneratingIds.size > 0 && <span className="text-indigo-500 animate-pulse">●</span>}
            </button>
        </div>

        <div className="flex flex-1 overflow-hidden relative">
            
            {/* LEFT PANE: MAIN CHAT */}
            {/* Logic: Hidden on mobile if view is 'aux', Visible on Desktop always */}
            <div className={`w-full md:w-1/2 flex flex-col border-r border-white/10 dark:border-white/5 transition-all duration-300 ${
                mobileView === 'aux' ? 'hidden md:flex' : 'flex'
            } ${session.backgroundImageUrl ? 'bg-transparent' : 'bg-white dark:bg-neutral-950'}`}>
                <div className="h-11 border-b border-white/10 dark:border-white/5 flex items-center px-2 md:px-4 bg-transparent justify-between shrink-0">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                        {/* Mobile Menu Button */}
                        <button 
                            onClick={onToggleSidebar}
                            className="md:hidden p-2 rounded-lg hover:bg-white/20 dark:hover:bg-black/20 text-gray-600 dark:text-gray-300 transition-colors shrink-0"
                            title="Open Menu"
                        >
                            <Menu size={20} />
                        </button>
                        
                        {/* Desktop Expand Sidebar Button */}
                        {isSidebarCollapsed && onExpandSidebar && (
                            <button 
                                onClick={onExpandSidebar}
                                className="hidden md:flex p-2 rounded-lg hover:bg-white/20 dark:hover:bg-black/20 text-gray-500 dark:text-gray-300 transition-colors shrink-0"
                                title="Expand Sidebar"
                            >
                                <PanelLeftOpen size={20} />
                            </button>
                        )}
                        
                        <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse shrink-0"></span>
                        <h3 className="font-semibold text-gray-800 dark:text-gray-200 truncate drop-shadow-sm">
                            {mainPreset ? mainPreset.title : 'Main Conversation'}
                        </h3>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                         {isGeneratingImage && (
                            <div className="flex items-center gap-1 text-pink-500 text-xs font-bold animate-pulse" title="Generating Scene">
                                <ImageIcon size={14} />
                                <span className="hidden sm:inline">Updating Scene...</span>
                            </div>
                        )}
                        {!settings.apiKey && (
                            <div className="flex items-center gap-1 text-amber-500 text-xs font-bold animate-pulse" title="API Key missing in Settings">
                                <TriangleAlert size={14} />
                                <span className="hidden sm:inline">No API Key</span>
                            </div>
                        )}
                        <div className="text-xs text-gray-600 dark:text-gray-300 px-2 py-1 bg-white/20 dark:bg-black/20 rounded backdrop-blur-sm">
                            {session.mainMessages.length} msgs
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                    {/* Main Chat Context Preview Header */}
                    {mainPreset && (
                        <div className="mb-6 mx-2 border border-white/20 dark:border-white/10 rounded-xl overflow-hidden bg-white/10 dark:bg-black/10 backdrop-blur-sm">
                            {/* Private Config Header */}
                            <div className="bg-indigo-50/10 dark:bg-indigo-900/10 px-3 py-2 border-b border-white/10 dark:border-white/5 flex items-center gap-2">
                                <Lock size={12} className="text-indigo-500" />
                                <span className="text-xs font-bold text-indigo-800 dark:text-indigo-200 uppercase tracking-wider">System Configuration</span>
                            </div>
                            
                            <div className="p-3 space-y-3 text-sm">
                                {/* Base Template Info */}
                                {mainPreset.systemTemplateId && (
                                    <div className="flex gap-2">
                                        <div className="shrink-0 mt-0.5"><LayoutTemplate size={14} className="text-gray-400" /></div>
                                        <div>
                                            <span className="font-semibold text-gray-700 dark:text-gray-300">
                                                {systemTemplates.find(t => t.id === mainPreset.systemTemplateId)?.title || 'Template'}
                                            </span>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                                                 {systemTemplates.find(t => t.id === mainPreset.systemTemplateId)?.content}
                                            </p>
                                        </div>
                                    </div>
                                )}
                                
                                {/* Persona Info */}
                                <div className="flex gap-2">
                                    <div className="shrink-0 mt-0.5"><User size={14} className="text-gray-400" /></div>
                                    <div>
                                        <span className="font-semibold text-gray-700 dark:text-gray-300">Persona</span>
                                        <p className="text-gray-600 dark:text-gray-300 mt-0.5 whitespace-pre-wrap drop-shadow-sm">{mainPreset.systemPrompt}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Shared Context Info */}
                            {mainPreset.sharedPrompt && (
                                <>
                                    <div className="bg-emerald-50/10 dark:bg-emerald-900/10 px-3 py-2 border-t border-b border-white/10 dark:border-white/5 flex items-center gap-2">
                                        <Globe size={12} className="text-emerald-500" />
                                        <span className="text-xs font-bold text-emerald-800 dark:text-emerald-200 uppercase tracking-wider">Public Shared Context</span>
                                    </div>
                                    <div className="p-3 bg-emerald-50/5 dark:bg-emerald-900/5">
                                        <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap drop-shadow-sm">{mainPreset.sharedPrompt}</p>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* Empty State (only if no messages AND no preset - basically never for valid sessions) */}
                    {session.mainMessages.length === 0 && !mainPreset && (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400 dark:text-gray-600 space-y-2">
                            <Layers size={48} className="opacity-20" />
                            <p className="text-sm">Start the conversation...</p>
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

                <div className="p-4 bg-transparent">
                    <div className="flex gap-2 items-end relative">
                        {/* Audio Recorder Button for Main */}
                        <button 
                            onClick={recordingTarget === 'main' ? stopRecording : () => startRecording('main')}
                            className={`p-3 rounded-lg transition-all shrink-0 backdrop-blur-sm relative ${
                                recordingTarget === 'main'
                                ? 'bg-red-500 text-white animate-pulse'
                                : 'bg-white/20 dark:bg-black/30 text-gray-600 dark:text-gray-300 hover:bg-white/30 dark:hover:bg-black/50'
                            }`}
                            disabled={isTranscribing || (recordingTarget !== null && recordingTarget !== 'main')}
                            title={recordingTarget === 'main' ? "Stop Recording" : "Speak (STT)"}
                        >
                             {recordingTarget === 'main' ? <StopCircle size={20} /> : <Mic size={20} />}
                             {/* Loading indicator overlay */}
                             {isTranscribing && recordingTarget === 'main' && (
                                 <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
                                     <Loader2 size={16} className="animate-spin text-white" />
                                 </div>
                             )}
                        </button>

                        <textarea
                            ref={textareaMainRef}
                            rows={1}
                            name="main-chat-message"
                            id="main-chat-message"
                            autoComplete="off"
                            autoCorrect="off"
                            spellCheck="false"
                            className="flex-1 bg-white/10 dark:bg-black/20 text-gray-900 dark:text-gray-100 placeholder-gray-600 dark:placeholder-gray-400 rounded-lg px-4 py-3 focus:ring-2 focus:ring-indigo-600/50 outline-none border border-white/20 dark:border-white/10 transition-colors resize-none custom-scrollbar min-h-[46px] max-h-40 overflow-y-auto backdrop-blur-md shadow-inner"
                            placeholder={mainPreset ? `Speak in context of: ${mainPreset.title}...` : "Type a message..."}
                            value={inputMain}
                            onChange={e => setInputMain(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    sendMainMessage();
                                }
                            }}
                            disabled={isGeneratingMain || recordingTarget !== null}
                        />
                        <button 
                            onClick={() => setMobileView('aux')}
                            className="md:hidden bg-emerald-600 hover:bg-emerald-500 text-white p-3 rounded-lg transition-colors shrink-0 backdrop-blur-sm"
                            title="Switch to Aux Tools"
                        >
                            <Layers size={20} />
                        </button>
                        <button 
                            onClick={sendMainMessage}
                            disabled={isGeneratingMain || !inputMain.trim()}
                            className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-300 dark:disabled:bg-neutral-700 disabled:text-gray-500 dark:disabled:text-gray-500 text-white p-3 rounded-lg transition-colors shrink-0 backdrop-blur-sm"
                        >
                            <Send size={20} />
                        </button>
                    </div>
                </div>
            </div>

            {/* RIGHT PANE: AUX CHAT */}
            {/* Logic: Hidden on mobile if view is 'main', Visible on Desktop always */}
            <div className={`w-full md:w-1/2 flex flex-col bg-transparent transition-all duration-300 ${
                mobileView === 'main' ? 'hidden md:flex' : 'flex'
            }`}>
                {/* AUX TABS HEADER */}
                <div className="h-11 border-b border-white/10 dark:border-white/5 flex items-center bg-transparent overflow-x-auto custom-scrollbar shrink-0">
                    <button 
                        onClick={onToggleSidebar}
                        className="md:hidden p-2 rounded-lg hover:bg-white/20 dark:hover:bg-black/20 text-gray-600 dark:text-gray-300 transition-colors shrink-0 mr-1"
                        title="Open Menu"
                    >
                        <Menu size={20} />
                    </button>
                    {session.auxTabs.map(tab => {
                        const preset = auxPresets.find(p => p.id === tab.presetId);
                        const isGenerating = auxGeneratingIds.has(tab.id);
                        return (
                            <div 
                                key={tab.id}
                                onClick={() => updateSession({ ...session, activeAuxTabId: tab.id })}
                                className={`group flex items-center gap-2 px-4 h-full text-sm font-medium border-r border-white/10 dark:border-white/5 cursor-pointer min-w-[140px] max-w-[200px] select-none relative ${
                                    session.activeAuxTabId === tab.id 
                                    ? 'bg-white/10 dark:bg-black/20 text-indigo-700 dark:text-indigo-400 border-b-2 border-b-indigo-500 backdrop-blur-sm' 
                                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-300 hover:bg-white/5 dark:hover:bg-white/5'
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
                                    className="opacity-0 group-hover:opacity-100 hover:text-red-500 p-1"
                                >
                                    <X size={12} />
                                </button>
                            </div>
                        );
                    })}
                    
                    <div className="relative h-full flex items-center px-2">
                        <button 
                            onClick={() => setShowAuxAdder(true)}
                            className="p-1.5 rounded-md hover:bg-white/10 dark:hover:bg-white/5 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                            title="Add Helper Agent"
                        >
                            <Plus size={18} />
                        </button>
                    </div>
                </div>

                {/* AUX CHAT AREA */}
                <div className="flex-1 flex flex-col min-h-0 bg-transparent relative">
                    {activeAuxTab ? (
                        <>
                            {/* FLOATING BUTTONS - Mobile Only */}
                            <div className="absolute top-3 right-3 z-10 flex items-center gap-2 md:hidden">
                                {activeAuxPreset?.autoTrigger ? (
                                    <span className="text-amber-500" title="Auto-Responds to AI">
                                        <Zap size={16} />
                                    </span>
                                ) : (
                                    <span className="text-emerald-500" title="Monitoring Context">●</span>
                                )}
                                <button 
                                    onClick={clearAuxContext}
                                    title="Clear history for this helper (keeps context)"
                                    className="p-2 bg-white/80 dark:bg-black/60 backdrop-blur-sm rounded-full hover:bg-white/90 dark:hover:bg-black/80 transition-colors text-gray-600 dark:text-gray-300"
                                >
                                    <RefreshCw size={14} />
                                </button>
                            </div>

                            {/* TOOLBAR - Desktop Only */}
                            <div className="hidden md:flex h-10 border-b border-white/10 dark:border-white/5 items-center justify-between px-4 bg-transparent shrink-0">
                                <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                    {activeAuxPreset?.autoTrigger ? (
                                        <>
                                            <Zap size={12} className="text-amber-500" />
                                            <span className="text-amber-600 dark:text-amber-500 font-medium">Auto-Responds to AI</span>
                                        </>
                                    ) : (
                                        <>
                                            <span className="text-emerald-500">●</span> Monitoring Context
                                        </>
                                    )}
                                </div>
                                <button 
                                    onClick={clearAuxContext}
                                    title="Clear history for this helper (keeps context)"
                                    className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white px-2 py-1 hover:bg-white/10 dark:hover:bg-white/5 rounded transition-colors"
                                >
                                    <RefreshCw size={12} /> Clear Memory
                                </button>
                            </div>

                            {/* MESSAGES */}
                            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                                {/* Persistent Aux Info Header */}
                                <div className="mb-8 px-4 text-gray-500 dark:text-gray-400 text-sm">
                                    <div className="flex items-start gap-3">
                                        <div className="p-2 bg-indigo-100/40 dark:bg-neutral-800/40 rounded-lg shrink-0 backdrop-blur-sm">
                                            <Bot size={20} className="text-indigo-600 dark:text-indigo-400" />
                                        </div>
                                        <div className="space-y-2 flex-1">
                                            <div>
                                                <p className="font-bold text-gray-700 dark:text-gray-200 drop-shadow-sm">{activeAuxPreset?.title}</p>
                                                <p className="text-xs mt-1 text-gray-500 dark:text-gray-300 drop-shadow-sm">{activeAuxPreset?.autoTrigger 
                                                    ? "I will automatically analyze every new AI response." 
                                                    : "Ask me anything about the conversation on the left."}
                                                </p>
                                            </div>
                                            {/* Aux System Prompt Preview */}
                                            <div className="p-2 bg-white/20 dark:bg-black/20 rounded border border-white/10 dark:border-white/5 text-xs italic backdrop-blur-sm">
                                                "{activeAuxPreset?.systemPrompt}"
                                            </div>

                                            {/* Shared Context Preview */}
                                            {mainPreset?.sharedPrompt && (
                                                <div className="mt-2 p-3 bg-emerald-50/20 dark:bg-emerald-900/10 rounded-lg text-xs border border-white/10 dark:border-white/5 text-emerald-800 dark:text-emerald-200 backdrop-blur-sm">
                                                    <div className="font-bold text-emerald-600 dark:text-emerald-400 mb-1 uppercase tracking-wider flex items-center gap-1">
                                                        <Globe size={10} /> Context Aware
                                                    </div>
                                                    <div className="whitespace-pre-wrap">
                                                        I know that: {mainPreset.sharedPrompt}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                
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
                            <div className="p-4 bg-transparent">
                                <div className="flex gap-2 items-end">
                                    {/* Audio Recorder Button for Aux */}
                                    <button 
                                        onClick={recordingTarget === 'aux' ? stopRecording : () => startRecording('aux')}
                                        className={`p-3 rounded-lg transition-all shrink-0 backdrop-blur-sm relative ${
                                            recordingTarget === 'aux'
                                            ? 'bg-red-500 text-white animate-pulse'
                                            : 'bg-white/20 dark:bg-black/30 text-gray-600 dark:text-gray-300 hover:bg-white/30 dark:hover:bg-black/50'
                                        }`}
                                        disabled={isTranscribing || (recordingTarget !== null && recordingTarget !== 'aux')}
                                        title={recordingTarget === 'aux' ? "Stop Recording" : "Speak (STT)"}
                                    >
                                        {recordingTarget === 'aux' ? <StopCircle size={20} /> : <Mic size={20} />}
                                        {/* Loading indicator overlay */}
                                        {isTranscribing && recordingTarget === 'aux' && (
                                            <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
                                                <Loader2 size={16} className="animate-spin text-white" />
                                            </div>
                                        )}
                                    </button>

                                    <textarea
                                        ref={textareaAuxRef}
                                        rows={1}
                                        name="aux-chat-message"
                                        id="aux-chat-message"
                                        autoComplete="off"
                                        autoCorrect="off"
                                        spellCheck="false"
                                        className="flex-1 bg-white/10 dark:bg-black/20 text-gray-900 dark:text-gray-100 placeholder-gray-600 dark:placeholder-gray-400 rounded-lg px-4 py-3 focus:ring-2 focus:ring-emerald-600/50 outline-none border border-white/20 dark:border-white/10 transition-colors resize-none custom-scrollbar min-h-[46px] max-h-40 overflow-y-auto backdrop-blur-md shadow-inner"
                                        placeholder={activeAuxPreset?.autoTrigger ? "Manually ask specific question..." : `Ask ${activeAuxPreset?.title || 'helper'}...`}
                                        value={inputAux}
                                        onChange={e => setInputAux(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                sendAuxMessage();
                                            }
                                        }}
                                        disabled={isGeneratingAux || recordingTarget !== null}
                                    />
                                    <button 
                                        onClick={() => setMobileView('main')}
                                        className="md:hidden bg-indigo-600 hover:bg-indigo-500 text-white p-3 rounded-lg transition-colors shrink-0 backdrop-blur-sm"
                                        title="Switch to Main Chat"
                                    >
                                        <MessageSquare size={20} />
                                    </button>
                                    <button 
                                        onClick={sendAuxMessage}
                                        disabled={isGeneratingAux || !inputAux.trim()}
                                        className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-300 dark:disabled:bg-neutral-700 disabled:text-gray-500 dark:disabled:text-gray-500 text-white p-3 rounded-lg transition-colors shrink-0 backdrop-blur-sm"
                                    >
                                        <Send size={20} />
                                    </button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
                            <Layers size={64} className="mb-4 text-gray-300 dark:text-gray-600 opacity-50" />
                            <h3 className="text-lg font-medium text-gray-500 dark:text-gray-400 drop-shadow-sm">No Helper Selected</h3>
                            <p className="text-sm mt-2 drop-shadow-sm">Open a new tab (+) to add a language tool.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>

        {/* ADD HELPER MODAL */}
        {showAuxAdder && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowAuxAdder(false)}>
                <div 
                    className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl shadow-2xl w-full max-w-lg flex flex-col max-h-[80vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                    onClick={e => e.stopPropagation()}
                >
                    <div className="p-4 border-b border-gray-200 dark:border-neutral-800 flex justify-between items-center bg-gray-50 dark:bg-neutral-925">
                        <div>
                            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Add Auxiliary Agent</h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Select a specialized helper to join the conversation.</p>
                        </div>
                        <button onClick={() => setShowAuxAdder(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                    
                    <div className="overflow-y-auto p-2 custom-scrollbar">
                        <div className="grid grid-cols-1 gap-1">
                            {auxPresets.map(p => (
                                <button
                                    key={p.id}
                                    onClick={() => { handleAddAuxTab(p.id); setShowAuxAdder(false); }}
                                    className="group text-left p-3 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/10 border border-transparent hover:border-indigo-100 dark:hover:border-indigo-900/30 transition-all flex items-start justify-between"
                                >
                                    <div className="flex-1 min-w-0 mr-3">
                                        <div className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-0.5">
                                            {p.title}
                                            {p.autoTrigger && (
                                                <div className="flex items-center gap-1 text-[10px] font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-500 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-900/50 uppercase tracking-wide">
                                                    <Zap size={10} className="fill-current" /> Auto
                                                </div>
                                            )}
                                        </div>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">
                                            {p.systemPrompt}
                                        </p>
                                    </div>
                                    <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-neutral-800 text-gray-400 group-hover:bg-indigo-600 group-hover:text-white flex items-center justify-center transition-colors shrink-0 mt-1">
                                        <Plus size={16} />
                                    </div>
                                </button>
                            ))}
                        </div>

                        {auxPresets.length === 0 && (
                            <div className="p-8 text-center text-gray-400 dark:text-gray-500">
                                <Bot size={32} className="mx-auto mb-2 opacity-50" />
                                <p className="text-sm font-medium">No auxiliary tools found</p>
                                <p className="text-xs mt-1">Go to Library to create new agents.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};