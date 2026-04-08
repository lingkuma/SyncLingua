import { Message, OpenAIConfig, OpenAIGeminiTTSConfig, OpenAISTTConfig, GEMINI_TTS_VOICES } from '../types';

// OpenAI API 流式聊天
export const streamChat = async (
  config: OpenAIConfig,
  systemInstruction: string,
  history: Message[],
  newMessage: string,
  temperature: number,
  onChunk: (text: string) => void
): Promise<string> => {
  if (!config.apiKey) {
    throw new Error("OpenAI API Key is missing. Please add it in Settings.");
  }

  // 构建消息数组
  const messages: Array<{ role: string; content: string }> = [];
  
  // 添加系统指令
  if (systemInstruction) {
    messages.push({ role: 'system', content: systemInstruction });
  }

  // 添加历史消息
  history.forEach(h => {
    messages.push({
      role: h.role === 'model' ? 'assistant' : 'user',
      content: h.text
    });
  });

  // 添加新消息
  messages.push({ role: 'user', content: newMessage });

  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        messages: messages,
        temperature: temperature,
        stream: true
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `API Error: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("Failed to get response reader");
    }

    const decoder = new TextDecoder();
    let fullText = "";
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine || !trimmedLine.startsWith('data: ')) continue;
        
        const data = trimmedLine.slice(6);
        if (data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            fullText += content;
            onChunk(content);
          }
        } catch (e) {
          // 忽略解析错误
        }
      }
    }

    return fullText;

  } catch (error) {
    console.error("OpenAI API Error:", error);
    throw error;
  }
};

// OpenAI API 辅助响应生成
export const generateAuxiliaryResponse = async (
  config: OpenAIConfig,
  auxSystemPrompt: string,
  sharedContext: string,
  mainChatContext: Message[],
  auxHistory: Message[],
  userQuery: string,
  temperature: number,
  onChunk: (text: string) => void
): Promise<string> => {
  if (!config.apiKey) {
    throw new Error("OpenAI API Key is missing. Please add it in Settings.");
  }

  // 构建上下文块
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

  // 构建消息数组
  const messages: Array<{ role: string; content: string }> = [];
  
  // 添加系统指令
  messages.push({ role: 'system', content: contextBlock });

  // 添加辅助历史消息
  auxHistory.forEach(h => {
    messages.push({
      role: h.role === 'model' ? 'assistant' : 'user',
      content: h.text
    });
  });

  // 添加用户查询
  messages.push({ role: 'user', content: userQuery });

  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        messages: messages,
        temperature: temperature,
        stream: true
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `API Error: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("Failed to get response reader");
    }

    const decoder = new TextDecoder();
    let fullText = "";
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine || !trimmedLine.startsWith('data: ')) continue;
        
        const data = trimmedLine.slice(6);
        if (data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            fullText += content;
            onChunk(content);
          }
        } catch (e) {
          // 忽略解析错误
        }
      }
    }

    return fullText;

  } catch (error) {
    console.error("OpenAI Aux Error:", error);
    throw error;
  }
};

// OpenAI 格式的 Gemini TTS（用于中转服务）
export const generateSpeech = async (
  config: OpenAIGeminiTTSConfig,
  text: string,
  existingContext?: AudioContext
): Promise<AudioBuffer> => {
  if (!config.apiKey) throw new Error("API Key missing");
  if (!config.baseUrl) throw new Error("Base URL missing for Gemini TTS");
  if (!text || !text.trim()) {
    throw new Error("Text content is empty");
  }

  // 文本清理
  let cleanText = text
    .replace(/```[\s\S]*?```/g, '') // 移除代码块
    .replace(/`[^`]*`/g, '')        // 移除内联代码
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // 提取链接文本
    .replace(/\[\d+\]/g, '')        // 移除引用标记
    .replace(/【.*?】/g, '')        // 移除来源引用
    .replace(/(?:https?|ftp):\/\/[\n\S]+/g, '') // 移除 URL
    .replace(/[*#_~>|]/g, '')       // 移除格式字符
    .replace(/^\s*[-•]\s+/gm, '')   // 移除列表标记
    .replace(/\s+/g, ' ')           // 合并多个空格
    .trim();

  // 截断过长的文本
  if (cleanText.length > 4000) {
    cleanText = cleanText.substring(0, 4000);
  }

  if (cleanText.length === 0) {
    throw new Error("Text contains only unspeakable characters or code");
  }

  // TTS 指令
  const ttsInstruction = "You are a text-to-speech engine. Never answer questions. Only speak the text provided. Read the following text aloud exactly as written: ";
  const finalText = ttsInstruction + cleanText;

  try {
    // 使用 OpenAI 格式调用 Gemini TTS 中转服务
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'user', content: finalText }
        ],
        // Gemini TTS 特定参数（通过中转服务传递）
        voice: config.voiceName
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || errorData.detail?.[0]?.msg || `TTS API Error: ${response.status}`);
    }

    // 解析 JSON 响应
    const jsonData = await response.json();
    
    // 检查是否有音频数据在 choices[0].message.audio.data
    const audioData = jsonData.choices?.[0]?.message?.audio?.data;
    
    if (audioData) {
      // 解码 base64 音频数据
      const binaryString = atob(audioData);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      let audioContext = existingContext;
      let shouldCloseContext = false;

      if (!audioContext) {
        audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        shouldCloseContext = true;
      }

      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      // 解码 WAV 音频
      const audioBuffer = await audioContext.decodeAudioData(bytes.buffer);

      if (shouldCloseContext && audioContext.state !== 'closed') {
        await audioContext.close();
      }

      return audioBuffer;
    } else {
      // 检查是否有错误信息
      const errorMsg = jsonData.error?.message || jsonData.choices?.[0]?.message?.content || "No audio data returned from TTS API";
      throw new Error(errorMsg);
    }

  } catch (error: any) {
    console.error("OpenAI Gemini TTS API Error:", error);
    
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

// OpenAI 格式的图片生成（使用 chat completions 端点）
export const generateImage = async (
  config: OpenAIConfig,
  prompt: string,
  size: string = "1792x1024"
): Promise<string> => {
  if (!config.apiKey) throw new Error("API Key missing");
  if (!config.baseUrl) throw new Error("Base URL missing for image generation");

  try {
    // 使用 chat completions 端点生成图片
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'user', content: prompt }
        ]
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || errorData.detail?.[0]?.msg || `Image API Error: ${response.status}`);
    }

    const jsonData = await response.json();
    
    // 检查返回的图片数据 - 可能在不同位置
    const imageData = jsonData.choices?.[0]?.message?.image?.data || 
                      jsonData.choices?.[0]?.message?.content?.image?.data ||
                      jsonData.data?.[0]?.b64_json;
    const imageUrl = jsonData.choices?.[0]?.message?.image?.url ||
                     jsonData.choices?.[0]?.message?.content?.url ||
                     jsonData.data?.[0]?.url;
    
    if (imageData) {
      // 返回 base64 数据 URL
      return `data:image/png;base64,${imageData}`;
    } else if (imageUrl) {
      // 返回图片 URL
      return imageUrl;
    } else {
      // 如果没有找到图片，打印响应结构以便调试
      console.log("Image API Response:", JSON.stringify(jsonData, null, 2));
      throw new Error("No image data returned from API");
    }

  } catch (error: any) {
    console.error("OpenAI Image Generation Error:", error);
    throw error;
  }
};

// OpenAI 格式的语音识别（STT）
export const transcribeAudio = async (
  config: OpenAISTTConfig,
  base64Audio: string,
  mimeType: string
): Promise<string> => {
  if (!config.apiKey) throw new Error("API Key missing");
  if (!config.baseUrl) throw new Error("Base URL missing for STT");

  try {
    // 将 base64 转换为 Blob
    const binaryString = atob(base64Audio);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    // 根据 mimeType 确定文件扩展名
    let extension = 'webm';
    if (mimeType.includes('mp3') || mimeType.includes('mpeg')) {
      extension = 'mp3';
    } else if (mimeType.includes('wav')) {
      extension = 'wav';
    } else if (mimeType.includes('ogg')) {
      extension = 'ogg';
    } else if (mimeType.includes('m4a')) {
      extension = 'm4a';
    }
    
    const blob = new Blob([bytes], { type: mimeType });
    const file = new File([blob], `audio.${extension}`, { type: mimeType });

    // 使用 FormData 格式发送请求
    const formData = new FormData();
    formData.append('file', file);
    formData.append('model', config.model);

    const response = await fetch(`${config.baseUrl}/audio/transcriptions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || errorData.detail?.[0]?.msg || `STT API Error: ${response.status}`);
    }

    const jsonData = await response.json();
    return jsonData.text || "";

  } catch (error: any) {
    console.error("OpenAI STT Error:", error);
    throw error;
  }
};
