
import { GoogleGenAI, GenerateContentResponse, Modality } from "@google/genai";
import { Message } from "../types";

// Always create a new GoogleGenAI instance right before making an API call
const getClient = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

// Manual implementation of base64 decoding as required by guidelines
const decode = (base64: string): Uint8Array => {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

// Helper to decode raw PCM Int16 to AudioBuffer following guideline naming
async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export const streamChat = async (
  model: string,
  systemInstruction: string,
  history: Message[],
  newMessage: string,
  temperature: number,
  onChunk: (text: string) => void
): Promise<string> => {
  const ai = getClient();

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
        // Accessing the extracted string output directly via .text property
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
  model: string,
  auxSystemPrompt: string,
  sharedContext: string,
  mainChatContext: Message[],
  auxHistory: Message[],
  userQuery: string,
  temperature: number,
  onChunk: (text: string) => void
): Promise<string> => {
    const ai = getClient();

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
                systemInstruction: contextBlock,
                temperature: temperature,
            }
        });

        const result = await chat.sendMessageStream({ message: userQuery });
        let fullText = "";

        for await (const chunk of result) {
             const c = chunk as GenerateContentResponse;
             // Accessing the extracted string output directly via .text property
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

export const generateSpeech = async (
  text: string,
  voiceName: string,
  existingContext?: AudioContext
): Promise<AudioBuffer> => {
  const ai = getClient();

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: text }] }],
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
    throw new Error("No audio data returned from Gemini");
  }

  const pcmData = decode(base64Audio);
  
  const audioContext = existingContext || new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 24000});
  
  // Decoding raw PCM data at 24kHz as per guidelines
  return await decodeAudioData(pcmData, audioContext, 24000, 1);
};
