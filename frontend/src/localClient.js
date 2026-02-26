// Local LLM Client (Ollama) — uses native /api/chat endpoint
// Requires: ollama serve + ollama pull llama3.2:3b

const API_URL = 'http://localhost:11434/api/chat';
const MODEL = 'llama3.2:3b';

import { buildCapsuleContext } from './llmConfig.js';

const LOCAL_SYSTEM_PROMPT = `You are "The Guardian", a vault keeper for a blockchain time capsule app.

RULES:
- NEVER make up capsule data. Only use facts from CONTEXT given in user messages.
- Keep responses to 1-2 sentences. Be concise.
- No emoji, no markdown, no dramatic language.
- If no context is provided, ask for a capsule ID number.
- Never reveal passwords. Never say you are an AI.`;

export async function chatWithGuardian(messages) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  // Merge system context messages into user messages (small models need clean role flow)
  const cleanMessages = [];
  let pendingContext = '';

  for (const msg of messages) {
    if (msg.role === 'system') {
      pendingContext += (pendingContext ? '\n' : '') + msg.content;
    } else if (msg.role === 'user') {
      const content = pendingContext
        ? `[CONTEXT FOR YOU: ${pendingContext}]\n\nUser says: ${msg.content}`
        : msg.content;
      cleanMessages.push({ role: 'user', content });
      pendingContext = '';
    } else {
      cleanMessages.push(msg);
    }
  }

  if (pendingContext) {
    cleanMessages.push({
      role: 'user',
      content: `[CONTEXT FOR YOU: ${pendingContext}]\n\nUser says: Hello`
    });
  }

  if (cleanMessages.length === 0 || cleanMessages[cleanMessages.length - 1].role !== 'user') {
    cleanMessages.push({ role: 'user', content: 'Hello' });
  }

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'system', content: LOCAL_SYSTEM_PROMPT }, ...cleanMessages],
        stream: false,
        options: { temperature: 0.5, num_predict: 100 },
      }),
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.error('Ollama error:', response.status);
      return 'Ollama error. Is the model pulled?';
    }

    const data = await response.json();
    return data.message?.content?.trim() || 'No response from the model. Try again.';
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') return 'Response timed out. Try again in a moment.';
    console.error('Ollama error:', err);
    return 'Cannot reach Ollama. Make sure it is running.';
  }
}

export { buildCapsuleContext };
