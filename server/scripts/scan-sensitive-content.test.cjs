// @vitest-environment node
const { findSensitiveAssignments } = require('../../scripts/scan-sensitive-content.cjs');

const cookieSecretKey = ['COOKIE', 'SECRET'].join('_');
const aiSecretsMasterKey = ['AI', 'SECRETS', 'MASTER', 'KEY'].join('_');

describe('findSensitiveAssignments', () => {
  it('ignores underscore-style placeholder secrets', () => {
    const matches = findSensitiveAssignments(`
      ${aiSecretsMasterKey}: 'REPLACE_WITH_A_SEPARATE_LONG_RANDOM_AI_SECRET',
      ${cookieSecretKey}: 'REPLACE_WITH_A_LONG_RANDOM_COOKIE_SECRET',
    `);

    expect(matches).toEqual([]);
  });

  it('still detects non-placeholder secret assignments', () => {
    const cookieValue = 'prod-cookie-secret-123456789';
    const aiValue = 'super-long-random-ai-secret-123456789';
    const matches = findSensitiveAssignments(`
      ${cookieSecretKey}: '${cookieValue}',
      ${aiSecretsMasterKey}: '${aiValue}',
    `);

    expect(matches).toEqual(['COOKIE_SECRET', 'AI_SECRETS_MASTER_KEY']);
  });
});
