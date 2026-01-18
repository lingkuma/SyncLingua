import { MinimaxConfig } from '../types';

const hexToArrayBuffer = (hexString: string): ArrayBuffer => {
  const bytes = new Uint8Array(hexString.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []);
  return bytes.buffer;
};

export const generateSpeechStream = async (
  config: MinimaxConfig,
  text: string,
  onChunk?: (buffer: ArrayBuffer) => void,
  onComplete?: (fullBuffer: ArrayBuffer) => void
): Promise<void> => {
  if (!config.apiKey) {
    throw new Error('MINIMAX API Key is missing');
  }

  if (!text || !text.trim()) {
    throw new Error('Text content is empty');
  }

  const cleanText = text.replace(/im/g, 'Im');

  try {
    const response = await fetch(config.apiEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: config.model || 'speech-01-turbo',
        text: cleanText,
        stream: true,
        language_boost: config.languageBoost,
        voice_setting: {
          voice_id: config.voiceId,
          speed: config.speed || 1.0,
          vol: 1,
          pitch: 0,
          emotio: config.emotion
        },
        audio_setting: {
          sample_rate: 32000,
          bitrate: 128000,
          format: 'mp3',
          channel: 1
        }
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Response body is not readable');
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let fullAudioData: Uint8Array[] = [];

    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }

    let initialBufferingComplete = false;
    let initialChunksCount = 0;
    const MIN_INITIAL_CHUNKS = 1;

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      while (true) {
        const endIndex = buffer.indexOf('\n\n');
        if (endIndex === -1) break;

        const chunk = buffer.slice(0, endIndex);
        buffer = buffer.slice(endIndex + 2);

        try {
          const jsonStr = chunk.replace(/^data: /, '');
          const data = JSON.parse(jsonStr);

          if (data.data?.status === 1 && data.data?.audio) {
            const audioBuffer = hexToArrayBuffer(data.data.audio);
            fullAudioData.push(new Uint8Array(audioBuffer));

            if (onChunk) {
              onChunk(audioBuffer);
            }

            if (!initialBufferingComplete) {
              initialChunksCount++;
              if (initialChunksCount >= MIN_INITIAL_CHUNKS) {
                initialBufferingComplete = true;
              }
            }
          }
        } catch (error) {
          console.error('JSON parse error:', error);
        }
      }
    }

    const totalLength = fullAudioData.reduce((sum, arr) => sum + arr.length, 0);
    const fullBuffer = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of fullAudioData) {
      fullBuffer.set(chunk, offset);
      offset += chunk.length;
    }

    if (onComplete) {
      onComplete(fullBuffer.buffer);
    }

    audioContext.close();

  } catch (error: any) {
    console.error('MINIMAX TTS API Error:', error);
    throw new Error(error.message || 'MINIMAX TTS Failed');
  }
};
