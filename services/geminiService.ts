

import { GoogleGenAI, GenerateContentResponse, Modality } from "@google/genai";
import { Message } from "../types";

// Initialize client with dynamic key
const getClient = (apiKey: string) => new GoogleGenAI({ apiKey });

export const streamChat = async (
  apiKey: string,
  model: string,
  systemInstruction: string,
  history: Message[],
  newMessage: string,
  temperature: number,
  onChunk: (text: string) => void
): Promise<string> => {
  if (!apiKey) {
    throw new Error("API Key is missing. Please add it in Settings.");
  }

  const ai = getClient(apiKey);

  // 1. Construct the chat history for the API
  const validHistory = history.map(h => ({
    role: h.role,
    parts: [{ text: h.text }]
  }));

  try {
    const chat = ai.chats.create({
      model: model,
      history: validHistory,
      config: {
        systemInstruction: systemInstruction,
        temperature: temperature,
      },
    });

    const result = await chat.sendMessageStream({ message: newMessage });
    
    let fullText = "";
    
    for await (const chunk of result) {
        const c = chunk as GenerateContentResponse;
        if (c.text) {
            fullText += c.text;
            onChunk(c.text);
        }
    }

    return fullText;

  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};

export const generateAuxiliaryResponse = async (
  apiKey: string,
  model: string,
  auxSystemPrompt: string,
  sharedContext: string, // New: The "Shared Prompt" from the main preset
  mainChatContext: Message[],
  auxHistory: Message[],
  userQuery: string,
  temperature: number,
  onChunk: (text: string) => void
): Promise<string> => {
    if (!apiKey) {
        throw new Error("API Key is missing. Please add it in Settings.");
    }

    const ai = getClient(apiKey);

    // Contextualize: formatting the main conversation as a reference block
    const mainContextString = mainChatContext
        .map(m => `[${m.role === 'user' ? 'Main User' : 'Main AI'}]: ${m.text}`)
        .join('\n');

    const contextBlock = `
<ScenarioContext>
${sharedContext ? sharedContext : "No specific scenario defined."}
</ScenarioContext>

<MainConversationContext>
${mainContextString}
</MainConversationContext>

You are an auxiliary assistant. 
The "ScenarioContext" describes the background of the conversation.
The "MainConversationContext" is the transcript of the conversation so far.

Your Goal: ${auxSystemPrompt}
`;

    const validAuxHistory = auxHistory.map(h => ({
        role: h.role,
        parts: [{ text: h.text }]
    }));

    try {
        const chat = ai.chats.create({
            model: model,
            history: validAuxHistory,
            config: {
                systemInstruction: contextBlock, // Dynamic system instruction containing the context
                temperature: temperature,
            }
        });

        const result = await chat.sendMessageStream({ message: userQuery });
        let fullText = "";

        for await (const chunk of result) {
             const c = chunk as GenerateContentResponse;
             if (c.text) {
                 fullText += c.text;
                 onChunk(c.text);
             }
        }
        return fullText;

    } catch (error) {
        console.error("Gemini Aux Error:", error);
        throw error;
    }
}

export const generateSceneImage = async (
    apiKey: string,
    model: string,
    prompt: string,
    aspectRatio?: string
): Promise<string> => {
    if (!apiKey) throw new Error("API Key is missing.");
    
    const ai = getClient(apiKey);
    
    // For 'gemini-2.5-flash-image' (nano banana) or 'gemini-3-pro-image-preview', use generateContent
    // aspectRatio defaults to 16:9 for desktop background use
    
    try {
        const response = await ai.models.generateContent({
            model: model,
            contents: {
                parts: [{ text: prompt }]
            },
            config: {
                imageConfig: {
                    aspectRatio: aspectRatio || "16:9",
                    // imageSize is only for 3.0 pro image, safe to omit for 2.5 flash image or if generic
                }
            }
        });

        // Iterate through parts to find the image
        let base64String = null;
        let textFallback = "";

        if (response.candidates && response.candidates.length > 0 && response.candidates[0].content && response.candidates[0].content.parts) {
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData) {
                    base64String = part.inlineData.data;
                    break;
                } else if (part.text) {
                    textFallback += part.text;
                }
            }
        } else {
             console.warn("Response had no candidates", response);
        }

        if (!base64String) {
            if (textFallback) {
                console.warn("Image Generation Refusal/Text:", textFallback);
                throw new Error(`Model returned text: ${textFallback}`);
            }
            throw new Error("No image data returned from model.");
        }

        return `data:image/png;base64,${base64String}`;

    } catch (error: any) {
        console.error("Gemini Image Gen Error:", error);
        throw error;
    }
}

// --- AUDIO / STT FUNCTIONS ---

export const transcribeUserAudio = async (
    apiKey: string,
    base64Audio: string,
    mimeType: string
): Promise<string> => {
    if (!apiKey) throw new Error("API Key missing");

    const ai = getClient(apiKey);
    
    // Use gemini-2.5-flash as it is fast and multimodal capable
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [
                    {
                        inlineData: {
                            mimeType: mimeType,
                            data: base64Audio
                        }
                    },
                    {
                        text: "Transcribe the audio exactly as spoken. Do not add any introductory text, commentary, or punctuation unless it is clearly part of the speech. If the audio is silent or unintelligible, return an empty string."
                    }
                ]
            }
        });

        return response.text ? response.text.trim() : "";
    } catch (error: any) {
        console.error("Transcribe Error:", error);
        throw new Error("Failed to transcribe audio.");
    }
};

// --- TTS HELPER FUNCTIONS ---

const decodeBase64 = (base64: string): Uint8Array => {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

// Helper to decode raw PCM Int16 to AudioBuffer
// Gemini TTS returns raw PCM (Int16) at 24kHz
const pcmToAudioBuffer = (
    data: Uint8Array, 
    ctx: AudioContext, 
    sampleRate: number = 24000, 
    numChannels: number = 1
): AudioBuffer => {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

    for (let channel = 0; channel < numChannels; channel++) {
        const channelData = buffer.getChannelData(channel);
        for (let i = 0; i < frameCount; i++) {
            // Normalize Int16 to Float32 [-1.0, 1.0]
            channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
        }
    }
    return buffer;
}

export const generateSpeech = async (
  apiKey: string,
  text: string,
  voiceName: string,
  existingContext?: AudioContext
): Promise<AudioBuffer> => {
  if (!apiKey) throw new Error("API Key missing");
  if (!text || !text.trim()) {
      throw new Error("Text content is empty");
  }
  
  const ai = getClient(apiKey);

  // Aggressive Sanitization to prevent "Prompt not supported" errors
  let cleanText = text
    .replace(/```[\s\S]*?```/g, '') // Remove code blocks
    .replace(/`[^`]*`/g, '')        // Remove inline code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Extract link text [text](url) -> text
    .replace(/\[\d+\]/g, '')        // Remove citations like [1], [2]
    .replace(/【.*?】/g, '')        // Remove source citations often used by Gemini 【1:0†source】
    .replace(/(?:https?|ftp):\/\/[\n\S]+/g, '') // Remove raw URLs
    .replace(/[*#_~>|]/g, '')       // Remove formatting characters
    .replace(/^\s*[-•]\s+/gm, '')   // Remove list bullets
    .replace(/\s+/g, ' ')           // Collapse multiple spaces
    .trim();

  // If text is extremely long, truncate to avoid errors (approx 4000 chars safety limit)
  if (cleanText.length > 4000) {
    cleanText = cleanText.substring(0, 4000);
  }

  if (cleanText.length === 0) {
      // If cleaning removed everything (e.g. only code blocks), throw friendly error
      throw new Error("Text contains only unspeakable characters or code");
  }

  try {
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: cleanText }] }],
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: voiceName },
                },
            },
        },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!base64Audio) {
        // If model returned text instead of audio (refusal/error context), it's often in parts[0].text
        const textFallback = response.candidates?.[0]?.content?.parts?.[0]?.text;
        if (textFallback) {
            console.warn("TTS Model returned text instead of audio:", textFallback);
            throw new Error(`TTS generation refused by model (Safety/Policy).`);
        }
        throw new Error("No audio data returned from Gemini");
    }

    // Decode audio
    const pcmData = decodeBase64(base64Audio);
    
    // Use provided context or create a temporary one for buffer creation
    let audioContext = existingContext;
    let shouldCloseContext = false;

    if (!audioContext) {
        audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        shouldCloseContext = true;
    }
    
    // Ensure context is running (browser autoplay policy)
    if (audioContext.state === 'suspended') {
        await audioContext.resume();
    }
    
    const audioBuffer = pcmToAudioBuffer(pcmData, audioContext, 24000);
    
    if (shouldCloseContext && audioContext.state !== 'closed') {
        await audioContext.close();
    }

    return audioBuffer;

  } catch (error: any) {
    console.error("Gemini TTS API Error:", error);
    
    // Detailed error handling for the user
    let userMessage = "TTS Failed";
    
    if (error.message) {
        if (error.message.includes("model returned non-audio response") || 
            error.message.includes("prompt is not supported by the AudioOut model")) {
            userMessage = "TTS Skipped: Text content was rejected by the audio model.";
        } else if (error.message.includes("400")) {
             userMessage = "TTS Error: Invalid Request (400). Content might be too long or unsafe.";
        } else {
            userMessage = error.message;
        }
    }
    
    throw new Error(userMessage);
  }
};