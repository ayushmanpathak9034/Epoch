const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;
const API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.3-70b-versatile';

import { GUARDIAN_SYSTEM_PROMPT, buildCapsuleContext } from './llmConfig.js';

export async function chatWithGuardian(messages) {
  if (!GROQ_API_KEY) {
    console.error('Missing VITE_GROQ_API_KEY in .env');
    return 'Missing API key. Please add VITE_GROQ_API_KEY to your .env file.';
  }

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: GUARDIAN_SYSTEM_PROMPT },
          ...messages,
        ],
        temperature: 0.5,
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      console.error('Groq API error:', response.status, errData);
      return 'Something went wrong. Please try again.';
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || 'No response. Please try again.';
  } catch (err) {
    console.error('Groq error:', err);
    return 'Connection error. Please check your internet and try again.';
  }
}

export { buildCapsuleContext };
