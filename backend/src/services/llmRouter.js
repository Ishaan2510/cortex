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

/* ─────────────────── Non-streaming providers ───────────────────
 * Kept because the eval framework calls these directly and doesn't
 * need streaming. Removing them would force the eval to consume an
 * async iterable, which adds complexity without benefit for scorers.
 */

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
    model: 'gpt-oss-120b',
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
  const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });
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

/* ─────────────────── Streaming providers ─────────────────── */

async function streamGroq(systemPrompt, userMessage) {
  const client = new Groq({ apiKey: process.env.GROQ_API_KEY });
  return client.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    temperature: 0.7,
    max_tokens: 2048,
    stream: true,
  });
}

async function streamCerebras(systemPrompt, userMessage) {
  const client = new Cerebras({ apiKey: process.env.CEREBRAS_API_KEY });
  return client.chat.completions.create({
    model: 'gpt-oss-120b',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    temperature: 0.7,
    max_tokens: 2048,
    stream: true,
  });
}

async function streamGemini(systemPrompt, userMessage, imageData = null) {
  const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });
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
  return ai.models.generateContentStream({
    model: 'gemini-2.5-flash',
    contents: [{ role: 'user', parts }],
    config: {
      systemInstruction: systemPrompt,
      temperature: 0.7,
      maxOutputTokens: 2048,
    },
  });
}

async function streamOpenRouter(systemPrompt, userMessage) {
  const client = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
  });
  return client.chat.completions.create({
    model: 'meta-llama/llama-3.3-70b-instruct:free',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    temperature: 0.7,
    max_tokens: 2048,
    stream: true,
  });
}

// Groq, Cerebras, and OpenRouter all expose chunks in the OpenAI delta format,
// so one adapter handles all three.
async function* openAIStreamToIter(stream) {
  for await (const chunk of stream) {
    const text = chunk.choices?.[0]?.delta?.content || '';
    if (text) yield text;
  }
}

// Gemini has its own chunk shape: chunk.text returns the accumulated text-only
// delta for that response part.
async function* geminiStreamToIter(stream) {
  for await (const chunk of stream) {
    const text = chunk.text || '';
    if (text) yield text;
  }
}

async function startProviderStream(provider, systemPrompt, userMessage, imageData) {
  if (provider === Provider.GROQ) {
    return openAIStreamToIter(await streamGroq(systemPrompt, userMessage));
  }
  if (provider === Provider.CEREBRAS) {
    return openAIStreamToIter(await streamCerebras(systemPrompt, userMessage));
  }
  if (provider === Provider.GEMINI) {
    return geminiStreamToIter(await streamGemini(systemPrompt, userMessage, imageData));
  }
  if (provider === Provider.OPENROUTER) {
    return openAIStreamToIter(await streamOpenRouter(systemPrompt, userMessage));
  }
  throw new Error(`Unknown provider: ${provider}`);
}

/**
 * Async generator that streams tokens from the provider chain.
 *
 * Events yielded:
 *   { type: 'token', text, provider }
 *     A chunk of LLM output. May be one token or several depending on the
 *     provider's chunking.
 *
 *   { type: 'provider_switch', from, to }
 *     Emitted when a provider fails AFTER at least one token was already
 *     yielded. The consumer should discard accumulated text — the next
 *     provider starts from scratch. Pre-token failures (rate limit at
 *     request initiation, 4xx errors) fall through silently as before;
 *     no provider_switch is emitted because no tokens were committed.
 *
 *   { type: 'complete', provider, attempted }
 *     Final terminal event when streaming finishes successfully.
 *
 * Throws if all providers in the chain exhaust.
 */
async function* routeAndStream({
  systemPrompt, userMessage, operation, inputLength, hasImage = false, imageData = null,
}) {
  const chain = getProviderChain(operation, inputLength, hasImage);
  const attempted = [];
  let lastError = null;

  for (let i = 0; i < chain.length; i++) {
    const provider = chain[i];
    attempted.push(provider);
    let tokensEmitted = 0;

    try {
      console.log(`Trying provider: ${provider} (streaming)`);
      const iter = await startProviderStream(provider, systemPrompt, userMessage, imageData);

      for await (const chunk of iter) {
        if (chunk) {
          tokensEmitted++;
          yield { type: 'token', text: chunk, provider };
        }
      }

      // Some providers close a stream with zero content on a soft failure.
      // Treat that as a regular failure so we fall through to the next provider.
      if (tokensEmitted === 0) {
        throw new Error('Provider returned empty stream');
      }

      console.log(`Success with provider: ${provider} (${tokensEmitted} chunks)`);
      yield { type: 'complete', provider, attempted: [...attempted] };
      return;
    } catch (err) {
      lastError = err;
      const errStr = String(err?.message || err).toLowerCase();
      const isRateLimit = ['429', 'rate limit', 'quota', 'resource_exhausted', 'too many']
        .some(t => errStr.includes(t));
      if (isRateLimit) console.warn(`Rate limit on ${provider}, falling through`);
      else console.error(`Error on ${provider}: ${err.message}`);

      // Only emit provider_switch if we already committed tokens to the client.
      // Otherwise this is a silent fallthrough exactly like routeAndCall.
      if (tokensEmitted > 0 && i < chain.length - 1) {
        yield { type: 'provider_switch', from: provider, to: chain[i + 1] };
      }
    }
  }

  throw new Error(`All providers failed. Last error: ${lastError?.message || lastError}`);
}

module.exports = { routeAndCall, routeAndStream };