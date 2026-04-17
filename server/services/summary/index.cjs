const { extractDocumentInput } = require('./extractors.cjs');

const MINIMUM_EXTRACTED_TEXT_LENGTH = 80;
const DIRECT_SUMMARY_CHAR_LIMIT = 12000;
const CHUNK_CHAR_LIMIT = 9000;
const MAX_CHUNKS = 8;
const DIRECT_SUMMARY_MAX_TOKENS = 1200;
const CHUNK_SUMMARY_MAX_TOKENS = 700;
const SYNTHESIS_MAX_TOKENS = 1200;
const VISION_SUMMARY_MAX_TOKENS = 1200;
const DEFAULT_SUMMARY_PROMPT = [
  'Summarize the file in its original language.',
  '',
  'Output only:',
  '* a short summary of 1 to 2 sentences',
  '* one blank line',
  '* then takeaways bullet points',
  '',
  'Strict output rules:',
  '* do not print any headings, labels, or section names',
  '* the first part must be the summary text itself',
  '* after the blank line begins the bullet points of takeaways.',
  '* every new line of a takeaway bullet must begin exactly with "-" then a space.',
  '* use only the normal hyphen bullet format: "-", never use dots, Arabic bullets, numbering, symbols, or decorative characters',
  '* do not output "Summary", "Key points", "الملخص", or "أهم النقاط"',
  '* do not add introductions, conclusions, notes, or any extra text',
  '* do not add introductions, conclusions, notes, or any extra text',
  '* return only the final output block, with no reasoning or dialogue in any language before or after it',
  '',
  'Content rules:',
  '* keep it factual, brief, and consistent',
  '* include as many bullet points as needed, but only when they add important supported information',
  '* keep each bullet short and clean',
  '* parse and normalize the source before writing so the final text is free of OCR noise, broken punctuation, malformed RTL text, repeated symbols, or messy extraction artifacts',
  '* if the source is mixed-language, use the dominant language of the document',
].join('\n');

function getSummaryPrompt(summaryPrompt) {
  if (typeof summaryPrompt !== 'string') return DEFAULT_SUMMARY_PROMPT;
  const trimmed = summaryPrompt.trim();
  return trimmed || DEFAULT_SUMMARY_PROMPT;
}

function normalizeSummaryText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function buildRetryInstruction() {
  return 'Your previous response was empty. Reply again with the requested summary text only.';
}

function withRetryMessages(messages) {
  return [
    ...messages,
    {
      role: 'user',
      content: buildRetryInstruction(),
    },
  ];
}

async function requestSummaryText({ provider, apiKey, modelId, messages, maxTokens = DIRECT_SUMMARY_MAX_TOKENS }) {
  let lastError = null;
  const attempts = [messages, withRetryMessages(messages)];

  for (const attemptMessages of attempts) {
    let completion;
    try {
      completion = await provider.chatCompletion({
        apiKey,
        model: modelId,
        messages: attemptMessages,
        maxTokens,
        temperature: 0,
      });
    } catch (error) {
      lastError = error;
      if ([401, 402, 403, 429].includes(error?.status)) {
        throw error;
      }
      continue;
    }

    const content = normalizeSummaryText(completion.content);
    if (content) {
      return {
        completion,
        content,
      };
    }

    lastError = new Error('Model returned an empty summary');
  }

  throw lastError || new Error('Model returned an empty summary');
}

function buildDocumentMessages({ fileName, fileType, extractedText, summaryPrompt }) {
  return [
    {
      role: 'system',
      content: getSummaryPrompt(summaryPrompt),
    },
    {
      role: 'user',
      content: [
        `Document name: ${fileName}`,
        `Document type: ${fileType}`,
        '',
        'Document content:',
        extractedText,
      ].join('\n'),
    },
  ];
}

function buildChunkMessages({ fileName, fileType, chunkText, chunkIndex, chunkCount, summaryPrompt }) {
  return [
    {
      role: 'system',
      content: getSummaryPrompt(summaryPrompt),
    },
    {
      role: 'user',
      content: [
        `Document name: ${fileName}`,
        `Document type: ${fileType}`,
        `This is chunk ${chunkIndex} of ${chunkCount} from a larger document.`,
        '',
        'Chunk content:',
        chunkText,
      ].join('\n'),
    },
  ];
}

function buildSynthesisMessages({ fileName, fileType, chunkSummaries, summaryPrompt }) {
  return [
    {
      role: 'system',
      content: getSummaryPrompt(summaryPrompt),
    },
    {
      role: 'user',
      content: [
        `Document name: ${fileName}`,
        `Document type: ${fileType}`,
        'The following are intermediate chunk summaries from one larger document.',
        'Produce one final response for the full document.',
        '',
        'Chunk summaries:',
        chunkSummaries.join('\n\n'),
      ].join('\n'),
    },
  ];
}

function chunkText(value, chunkSize, maxChunks) {
  const chunks = [];
  let start = 0;

  while (start < value.length && chunks.length < maxChunks) {
    let end = Math.min(value.length, start + chunkSize);
    if (end < value.length) {
      const lastBreak = Math.max(
        value.lastIndexOf('\n\n', end),
        value.lastIndexOf('\n', end),
        value.lastIndexOf('. ', end),
      );
      if (lastBreak > start + Math.floor(chunkSize * 0.4)) {
        end = lastBreak + 1;
      }
    }

    const chunk = value.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    start = end;
  }

  return {
    chunks,
    truncated: start < value.length,
  };
}

async function summarizeText({ provider, apiKey, modelId, fileName, fileType, extractedText, summaryPrompt }) {
  if (extractedText.length <= DIRECT_SUMMARY_CHAR_LIMIT) {
    const response = await requestSummaryText({
      provider,
      apiKey,
      modelId,
      messages: buildDocumentMessages({ fileName, fileType, extractedText, summaryPrompt }),
      maxTokens: DIRECT_SUMMARY_MAX_TOKENS,
    });

    return {
      content: response.content,
      coverage: 'full',
      model: modelId,
    };
  }

  const { chunks, truncated } = chunkText(extractedText, CHUNK_CHAR_LIMIT, MAX_CHUNKS);
  const chunkSummaries = [];

  for (let index = 0; index < chunks.length; index += 1) {
    const response = await requestSummaryText({
      provider,
      apiKey,
      modelId,
      messages: buildChunkMessages({
        fileName,
        fileType,
        chunkText: chunks[index],
        chunkIndex: index + 1,
        chunkCount: chunks.length,
        summaryPrompt,
      }),
      maxTokens: CHUNK_SUMMARY_MAX_TOKENS,
    });
    chunkSummaries.push(`Chunk ${index + 1}\n${response.content}`);
  }

  const synthesis = await requestSummaryText({
    provider,
    apiKey,
    modelId,
    messages: buildSynthesisMessages({
      fileName,
      fileType,
      chunkSummaries,
      summaryPrompt,
    }),
    maxTokens: SYNTHESIS_MAX_TOKENS,
  });

  return {
    content: synthesis.content,
    coverage: truncated ? 'truncated' : 'full',
    model: modelId,
  };
}

async function summarizeVision({ provider, apiKey, modelId, fileName, fileType, imageDataUrl, summaryPrompt }) {
  const response = await requestSummaryText({
    provider,
    apiKey,
    modelId,
    messages: [
      {
        role: 'system',
        content: getSummaryPrompt(summaryPrompt),
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: [
              `Document name: ${fileName}`,
              `Document type: ${fileType}`,
              'This image is the document to summarize.',
            ].join('\n'),
          },
          {
            type: 'image_url',
            image_url: {
              url: imageDataUrl,
            },
          },
        ],
      },
    ],
    maxTokens: VISION_SUMMARY_MAX_TOKENS,
  });

  return {
    content: response.content,
    coverage: 'full',
    model: modelId,
  };
}

function getSelectedModel(modelOptions, selectedModelId) {
  return modelOptions.find((model) => model.id === selectedModelId) || null;
}

async function summarizeDocument({
  doc,
  filePath,
  provider,
  apiKey,
  textModelId,
  visionModelId,
  textModels,
  visionModels,
  summaryPrompt,
}) {
  const extracted = await extractDocumentInput(doc, filePath);

  if (extracted.mode === 'unsupported') {
    return {
      status: 'unsupported',
      reason: extracted.reason,
      coverage: null,
      model: null,
    };
  }

  if (extracted.mode === 'vision') {
    const selectedModel = getSelectedModel(visionModels, visionModelId);
    if (!selectedModel) {
      throw new Error('Choose a valid vision model in Settings before summarizing image documents.');
    }

    const result = await summarizeVision({
      provider,
      apiKey,
      modelId: selectedModel.id,
      fileName: doc.name,
      fileType: doc.file_type,
      imageDataUrl: extracted.imageDataUrl,
      summaryPrompt,
    });

    return {
      status: 'completed',
      content: result.content,
      coverage: result.coverage,
      model: result.model,
      mode: 'vision',
    };
  }

  const extractedText = String(extracted.content || '').trim();
  if (!extractedText || (doc.file_type === 'application/pdf' && extractedText.length < MINIMUM_EXTRACTED_TEXT_LENGTH)) {
    return {
      status: 'unsupported',
      reason: doc.file_type === 'application/pdf'
        ? 'This PDF does not contain enough extractable text yet. Image-only and scanned PDFs are not supported in this version.'
        : 'This document does not contain enough extractable text to summarize.',
      coverage: null,
      model: null,
    };
  }

  const selectedModel = getSelectedModel(textModels, textModelId);
  if (!selectedModel) {
    throw new Error('Choose a valid text summary model in Settings before summarizing this document.');
  }

  const result = await summarizeText({
    provider,
    apiKey,
    modelId: selectedModel.id,
    fileName: doc.name,
    fileType: doc.file_type,
    extractedText,
    summaryPrompt,
  });

  return {
    status: 'completed',
    content: result.content,
    coverage: result.coverage,
    model: result.model,
    mode: 'text',
  };
}

module.exports = {
  DEFAULT_SUMMARY_PROMPT,
  summarizeDocument,
};
