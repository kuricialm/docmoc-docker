const bcrypt = require('bcryptjs');
const { badRequest, conflict, notFound } = require('../errors/apiError.cjs');
const { isValidPassword, MIN_PASSWORD_LENGTH, normalizeEmail } = require('../validators/common.cjs');

function createUsersService({ sessionsRepository, usersRepository, now, uid }) {
  return {
    createUser({ email, fullName, password, role }) {
      const normalizedEmail = normalizeEmail(email);
      if (!normalizedEmail) throw badRequest('Valid email is required');
      if (!isValidPassword(password)) throw badRequest(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      if (role && role !== 'admin' && role !== 'user') throw badRequest('Invalid role');
      if (usersRepository.getByEmail(normalizedEmail)) throw badRequest('Email already exists');

      const created = usersRepository.createUser({
        createdAt: now(),
        email: normalizedEmail,
        fullName: fullName || normalizedEmail,
        id: uid(),
        passwordHash: bcrypt.hashSync(password, 10),
        role: role || 'user',
      });

      return {
        email: created.email,
        fullName: created.full_name,
        id: created.id,
        role: created.role,
      };
    },

    deleteUser(userId, actorUserId) {
      if (userId === actorUserId) throw badRequest('You cannot delete your own account');
      const target = usersRepository.getById(userId);
      if (!target) throw notFound('User not found');
      usersRepository.deleteById(userId);
      sessionsRepository.deleteByUserId(userId);
    },

    listUsers() {
      return usersRepository.listWithUsage();
    },

    updateUser(userId, updates) {
      const target = usersRepository.getById(userId);
      if (!target) throw notFound('User not found');

      const nextValues = {};

      if (Object.prototype.hasOwnProperty.call(updates, 'fullName')) {
        if (typeof updates.fullName !== 'string' || !updates.fullName.trim()) throw badRequest('Name is required');
        nextValues.fullName = updates.fullName.trim();
      }

      if (Object.prototype.hasOwnProperty.call(updates, 'email')) {
        const normalizedEmail = normalizeEmail(updates.email);
        if (!normalizedEmail || !normalizedEmail.includes('@')) throw badRequest('Valid email is required');
        const existing = usersRepository.getByEmail(normalizedEmail);
        if (existing && existing.id !== userId) throw conflict('Email already exists');
        nextValues.email = normalizedEmail;
      }

      if (Object.prototype.hasOwnProperty.call(updates, 'role')) {
        if (updates.role !== 'admin' && updates.role !== 'user') throw badRequest('Invalid role');
        nextValues.role = updates.role;
      }

      if (Object.prototype.hasOwnProperty.call(updates, 'suspended')) {
        nextValues.suspended = !!updates.suspended;
      }

      if (Object.prototype.hasOwnProperty.call(updates, 'uploadQuotaBytes')) {
        if (updates.uploadQuotaBytes === null || updates.uploadQuotaBytes === '') {
          nextValues.uploadQuotaBytes = null;
        } else {
          const parsed = Number.parseInt(String(updates.uploadQuotaBytes), 10);
          if (!Number.isFinite(parsed) || parsed < 0) {
            throw badRequest('Upload quota must be a non-negative number of bytes or empty for unlimited');
          }
          nextValues.uploadQuotaBytes = parsed;
        }
      }

      if (!Object.keys(nextValues).length) throw badRequest('No changes provided');
      usersRepository.updateById(userId, nextValues);
      if (nextValues.suspended) sessionsRepository.deleteByUserId(userId);
    },

    updateUserPassword(userId, newPassword) {
      if (!isValidPassword(newPassword)) throw badRequest(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      const target = usersRepository.getById(userId);
      if (!target) throw notFound('User not found');
      usersRepository.updatePassword(userId, bcrypt.hashSync(newPassword, 10));
      sessionsRepository.deleteByUserId(userId);
    },
  };
}

module.exports = {
  createUsersService,
};
