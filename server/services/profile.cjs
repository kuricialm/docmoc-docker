const bcrypt = require('bcryptjs');
const { badRequest, conflict } = require('../errors/apiError.cjs');
const { isValidPassword, MIN_PASSWORD_LENGTH, normalizeEmail } = require('../validators/common.cjs');

function createProfileService({ sessionsRepository, usersRepository }) {
  return {
    updateEmail(userId, email) {
      if (!email || typeof email !== 'string') throw badRequest('Email is required');
      const nextEmail = normalizeEmail(email);
      if (!nextEmail.includes('@')) throw badRequest('Invalid email address');
      const existing = usersRepository.getByEmail(nextEmail);
      if (existing && existing.id !== userId) throw conflict('Email is already in use');
      usersRepository.updateById(userId, { email: nextEmail });
    },

    updatePassword(userId, newPassword) {
      if (!isValidPassword(newPassword)) throw badRequest(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      usersRepository.updatePassword(userId, bcrypt.hashSync(newPassword, 10));
      sessionsRepository.deleteByUserId(userId);
    },

    updateProfile(userId, updates) {
      const nextValues = {};
      if (Object.prototype.hasOwnProperty.call(updates, 'accentColor')) nextValues.accentColor = updates.accentColor;
      if (Object.prototype.hasOwnProperty.call(updates, 'fullName')) nextValues.fullName = updates.fullName;
      if (Object.prototype.hasOwnProperty.call(updates, 'workspaceLogoUrl')) nextValues.workspaceLogoUrl = updates.workspaceLogoUrl;
      return usersRepository.updateById(userId, nextValues);
    },
  };
}

module.exports = {
  createProfileService,
};
