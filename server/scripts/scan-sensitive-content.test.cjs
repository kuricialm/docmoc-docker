// @vitest-environment node
const { findSensitiveAssignments } = require('../../scripts/scan-sensitive-content.cjs');

describe('findSensitiveAssignments', () => {
  it('ignores underscore-style placeholder secrets', () => {
    const matches = findSensitiveAssignments(`
      AI_SECRETS_MASTER_KEY: 'REPLACE_WITH_A_SEPARATE_LONG_RANDOM_AI_SECRET',
      COOKIE_SECRET: 'REPLACE_WITH_A_LONG_RANDOM_COOKIE_SECRET',
    `);

    expect(matches).toEqual([]);
  });

  it('still detects non-placeholder secret assignments', () => {
    const matches = findSensitiveAssignments(`
      COOKIE_SECRET: 'prod-cookie-secret-123456789',
      AI_SECRETS_MASTER_KEY: 'super-long-random-ai-secret-123456789',
    `);

    expect(matches).toEqual(['COOKIE_SECRET', 'AI_SECRETS_MASTER_KEY']);
  });
});
