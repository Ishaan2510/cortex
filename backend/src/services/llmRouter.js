const Groq = require('groq-sdk').default || require('groq-sdk');
const Cerebras = require('@cerebras/cerebras_cloud_sdk').default || require('@cerebras/cerebras_cloud_sdk');
const { GoogleGenAI } = require('@google/genai');
const OpenAI = require('openai').default || require('openai');

const LONG_THRESHOLD = 15_000;

const Provider = {
  GROQ: 'groq',
  CEREBRAS: 'cerebras',
  GEMINI: 'gemini',
  OPENROUTER: 'openrouter',
};

function getProviderChain(operation, inputLength, hasImage) {
  if (hasImage) return [Provider.GEMINI, Provider.OPENROUTER];
  if (inputLength > LONG_THRESHOLD) {
    return [Provider.GEMINI, Provider.CEREBRAS, Provider.OPENROUTER];
  }
  return [Provider.GROQ, Provider.CEREBRAS, Provider.GEMINI, Provider.OPENROUTER];
}

async function callGroq(systemPrompt, userMessage) {
  const client = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const r = await client.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    temperature: 0.7,
    max_tokens: 2048,
  });
  return r.choices[0].message.content;
}

async function callCerebras(systemPrompt, userMessage) {
  const client = new Cerebras({ apiKey: process.env.CEREBRAS_API_KEY });
  const r = await client.chat.completions.create({
    model: 'llama-3.3-70b',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    temperature: 0.7,
    max_tokens: 2048,
  });
  return r.choices[0].message.content;
}

async function callGemini(systemPrompt, userMessage, imageData = null) {
  const ai = new GoogleGenAI({
    apiKey: process.env.GOOGLE_API_KEY,
  });

  try {
    const parts = [];

    if (imageData) {
      parts.push({
        inlineData: {
          mimeType: imageData.mimeType,
          data: imageData.data.toString('base64'),
        },
      });
    }

    parts.push({ text: userMessage });

    const r = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts }],
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.7,
        maxOutputTokens: 2048,
      },
    });

    return r.text;
  } catch (err) {
    console.error('GEMINI RAW ERROR:', err);

    if (err.response) {
      console.error('STATUS:', err.response.status);
      console.error('BODY:', err.response.data);
    }

    throw err;
  }
}

async function callOpenRouter(systemPrompt, userMessage) {
  const client = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
  });
  const r = await client.chat.completions.create({
    model: 'meta-llama/llama-3.3-70b-instruct:free',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    temperature: 0.7,
    max_tokens: 2048,
  });
  return r.choices[0].message.content;
}

const CALLERS = {
  [Provider.GROQ]: callGroq,
  [Provider.CEREBRAS]: callCerebras,
  [Provider.GEMINI]: callGemini,
  [Provider.OPENROUTER]: callOpenRouter,
};

async function routeAndCall({
  systemPrompt, userMessage, operation, inputLength, hasImage = false, imageData = null,
}) {
  const chain = getProviderChain(operation, inputLength, hasImage);
  const attempted = [];
  let lastError = null;

  for (const provider of chain) {
    attempted.push(provider);
    try {
      console.log(`Trying provider: ${provider}`);
      const result = (provider === Provider.GEMINI)
        ? await callGemini(systemPrompt, userMessage, imageData)
        : await CALLERS[provider](systemPrompt, userMessage);
      console.log(`Success with provider: ${provider}`);
      return { result, attempted };
    } catch (err) {
      const errStr = String(err?.message || err).toLowerCase();
      const isRateLimit = ['429', 'rate limit', 'quota', 'resource_exhausted', 'too many']
        .some(t => errStr.includes(t));
      if (isRateLimit) console.warn(`Rate limit on ${provider}, falling through`);
      else console.error(`Error on ${provider}: ${err.message}`);
      lastError = err;
    }
  }
  throw new Error(`All providers failed. Last error: ${lastError?.message || lastError}`);
}

module.exports = { routeAndCall };