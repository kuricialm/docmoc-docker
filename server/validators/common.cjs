const MIN_PASSWORD_LENGTH = 8;

function normalizeEmail(email) {
  if (typeof email !== 'string') return '';
  return email.trim().toLowerCase();
}

function isValidPassword(password) {
  return typeof password === 'string' && password.length >= MIN_PASSWORD_LENGTH;
}

module.exports = {
  isValidPassword,
  MIN_PASSWORD_LENGTH,
  normalizeEmail,
};
