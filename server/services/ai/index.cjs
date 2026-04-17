const openrouter = require('./providers/openrouter.cjs');

function getAiProvider(providerId) {
  if (providerId === 'openrouter') return openrouter;
  throw new Error(`Unsupported AI provider: ${providerId}`);
}

module.exports = {
  getAiProvider,
};
