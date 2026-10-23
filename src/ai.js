// LLM / speech-to-text with provider fallback. OpenRouter first, then the other OpenAI-compatible providers.
const CHAT = [
  ['OPENROUTER_API_KEY', 'https://openrouter.ai/api/v1/chat/completions', 'openai/gpt-4o-mini'],
  ['OPENAI_API_KEY', 'https://api.openai.com/v1/chat/completions', 'gpt-4o-mini'],
  ['DEEPSEEK_API_KEY', 'https://api.deepseek.com/chat/completions', 'deepseek-chat'],
  ['GROQ_API_KEY', 'https://api.groq.com/openai/v1/chat/completions', 'qwen/qwen3.8-27b'],
];
const STT = [
  ['GROQ_API_KEY', 'https://api.groq.com/openai/v1/audio/transcriptions', 'whisper-large-v3'],
  ['OPENAI_API_KEY', 'https://api.openai.com/v1/audio/transcriptions', 'whisper-1'],
];

export async function chat(env, messages, maxTokens = 200) {
  let err;
  for (const [key, url, model] of CHAT) {
    if (!env[key]) continue;
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { authorization: 'Bearer ' + env[key], 'content-type': 'application/json' },
        body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature: 0.2 }),
        signal: AbortSignal.timeout(20000),
      });
      if (!r.ok) throw new Error(key + ' ' + r.status);
      const text = (await r.json()).choices?.[0]?.message?.content?.trim();
      if (text) return { text, model: `${key.split('_')[0].toLowerCase()}:${model}` };
    } catch (e) { err = e; }
  }
  throw err || new Error('no AI provider configured');
}

export async function transcribe(env, wav, lang = 'ar') {
  let err;
  for (const [key, url, model] of STT) {
    if (!env[key]) continue;
    try {
      const fd = new FormData();
      fd.append('file', new Blob([wav], { type: 'audio/wav' }), 'a.wav');
      fd.append('model', model);
      if (lang) fd.append('language', lang);
      fd.append('response_format', 'json');
      const r = await fetch(url, { method: 'POST', headers: { authorization: 'Bearer ' + env[key] }, body: fd, signal: AbortSignal.timeout(25000) });
      if (!r.ok) throw new Error(key + ' ' + r.status);
      return ((await r.json()).text || '').trim();
    } catch (e) { err = e; }
  }
  throw err || new Error('no speech-to-text provider configured');
}
