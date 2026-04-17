const OPENROUTER_API_BASE = 'https://openrouter.ai/api/v1';

function buildHeaders(apiKey) {
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  if (process.env.AI_OPENROUTER_HTTP_REFERER) {
    headers['HTTP-Referer'] = process.env.AI_OPENROUTER_HTTP_REFERER;
  }
  if (process.env.AI_OPENROUTER_TITLE) {
    headers['X-OpenRouter-Title'] = process.env.AI_OPENROUTER_TITLE;
  }

  return headers;
}

async function parseJsonResponse(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

function createProviderError(response, body, fallbackMessage) {
  const message = body?.error?.message
    || body?.error
    || body?.message
    || fallbackMessage;
  const error = new Error(message);
  error.status = response.status;
  error.body = body;
  return error;
}

function normalizePrice(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeModel(model) {
  const architecture = model?.architecture || {};
  const topProvider = model?.top_provider || {};

  return {
    id: String(model?.id || ''),
    name: String(model?.name || model?.id || 'Unknown model'),
    description: typeof model?.description === 'string' ? model.description : '',
    context_length: Number(model?.context_length || topProvider?.context_length || 0) || 0,
    input_modalities: Array.isArray(architecture?.input_modalities)
      ? architecture.input_modalities.map((value) => String(value))
      : [],
    output_modalities: Array.isArray(architecture?.output_modalities)
      ? architecture.output_modalities.map((value) => String(value))
      : [],
    prompt_price: normalizePrice(model?.pricing?.prompt),
    completion_price: normalizePrice(model?.pricing?.completion),
    request_price: normalizePrice(model?.pricing?.request),
    image_price: normalizePrice(model?.pricing?.image),
    max_completion_tokens: Number(topProvider?.max_completion_tokens || 0) || 0,
  };
}

function isTextOutputModel(model) {
  return model.output_modalities.includes('text');
}

function isTextInputModel(model) {
  return model.input_modalities.includes('text');
}

function isVisionInputModel(model) {
  return model.input_modalities.includes('image');
}

function sortModels(models) {
  return [...models].sort((left, right) => left.name.localeCompare(right.name));
}

function getTextModels(models) {
  return sortModels(models.filter((model) => isTextOutputModel(model) && isTextInputModel(model)));
}

function getVisionModels(models) {
  return sortModels(models.filter((model) => isTextOutputModel(model) && isVisionInputModel(model)));
}

async function validateApiKey(apiKey) {
  const response = await fetch(`${OPENROUTER_API_BASE}/key`, {
    method: 'GET',
    headers: buildHeaders(apiKey),
  });
  const body = await parseJsonResponse(response);

  if (!response.ok) {
    throw createProviderError(response, body, 'OpenRouter key validation failed');
  }

  return body?.data || null;
}

async function listModels(apiKey) {
  const response = await fetch(`${OPENROUTER_API_BASE}/models`, {
    method: 'GET',
    headers: buildHeaders(apiKey),
  });
  const body = await parseJsonResponse(response);

  if (!response.ok) {
    throw createProviderError(response, body, 'Failed to load models from OpenRouter');
  }

  return Array.isArray(body?.data)
    ? body.data.map(normalizeModel).filter((model) => model.id)
    : [];
}

function flattenMessageContent(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';

  return content
    .map((part) => {
      if (typeof part === 'string') return part;
      if (part?.type === 'text' && typeof part?.text === 'string') return part.text;
      return '';
    })
    .filter(Boolean)
    .join('\n');
}

async function chatCompletion({
  apiKey,
  model,
  messages,
  maxTokens = 700,
  temperature = 0.2,
  responseFormat = null,
}) {
  const payload = {
    model,
    messages,
    max_tokens: maxTokens,
    temperature,
  };

  if (responseFormat) {
    payload.response_format = responseFormat;
  }

  const response = await fetch(`${OPENROUTER_API_BASE}/chat/completions`, {
    method: 'POST',
    headers: buildHeaders(apiKey),
    body: JSON.stringify(payload),
  });
  const body = await parseJsonResponse(response);

  if (!response.ok) {
    throw createProviderError(response, body, 'OpenRouter completion failed');
  }

  const content = body?.choices?.[0]?.message?.content;
  return {
    id: body?.id || null,
    content: flattenMessageContent(content),
    raw: body,
  };
}

module.exports = {
  id: 'openrouter',
  chatCompletion,
  getTextModels,
  getVisionModels,
  listModels,
  validateApiKey,
};
