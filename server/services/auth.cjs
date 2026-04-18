const bcrypt = require('bcryptjs');
const { getSessionCookieOptions } = require('../config/index.cjs');
const { badRequest, forbidden, unauthorized } = require('../errors/apiError.cjs');
const { isValidPassword, normalizeEmail } = require('../validators/common.cjs');

function createAuthService({
  brandingService,
  config,
  sessionsRepository,
  settingsService,
  usersRepository,
  now,
  uid,
}) {
  function buildLoginUserResponse(user) {
    return {
      accentColor: user.accent_color,
      avatarUrl: user.avatar_url,
      email: user.email,
      fullName: user.full_name,
      id: user.id,
      role: user.role,
      upload_quota_bytes: user.upload_quota_bytes,
      workspaceLogoUrl: brandingService.getPublicLogoUrl(),
    };
  }

  function buildSessionUser(user) {
    return {
      ...user,
      workspace_logo_url: brandingService.getPublicLogoUrl(),
    };
  }

  return {
    getAuthenticatedUserBySessionToken(token) {
      if (!token) throw unauthorized('Not authenticated');
      const session = sessionsRepository.getByToken(token);
      if (!session) throw unauthorized('Invalid session');
      const user = usersRepository.getById(session.user_id);
      if (!user) throw unauthorized('User not found');
      if (user.suspended) throw forbidden('Account suspended');
      return buildSessionUser(user);
    },

    getOptionalAuthenticatedUserBySessionToken(token) {
      try {
        return this.getAuthenticatedUserBySessionToken(token);
      } catch {
        return null;
      }
    },

    login(req, { email, password, rememberMe = false }) {
      const normalizedEmail = normalizeEmail(email);
      if (!normalizedEmail || typeof password !== 'string') {
        throw badRequest('Email and password are required');
      }

      const user = usersRepository.getByEmail(normalizedEmail);
      if (!user || !bcrypt.compareSync(password, user.password_hash)) {
        throw unauthorized('Invalid email or password');
      }
      if (user.suspended) {
        throw forbidden('Account suspended');
      }

      const token = uid();
      const signedInAt = now();
      sessionsRepository.createSession(token, user.id, signedInAt);
      usersRepository.updateLastSignIn(user.id, signedInAt);
      const maxAge = rememberMe ? 30 * 86400000 : undefined;

      return {
        cookie: {
          name: 'session',
          options: getSessionCookieOptions(req, config, maxAge),
          value: token,
        },
        user: buildLoginUserResponse({
          ...user,
          last_sign_in_at: signedInAt,
        }),
      };
    },

    logout(token) {
      if (token) sessionsRepository.deleteByToken(token);
    },

    register({ email, fullName, password }) {
      if (!settingsService.isRegistrationEnabled()) {
        throw forbidden('Registration is disabled');
      }

      const normalizedEmail = normalizeEmail(email);
      if (!normalizedEmail) throw badRequest('Valid email is required');
      if (!isValidPassword(password)) throw badRequest('Password must be at least 4 characters');
      if (usersRepository.getByEmail(normalizedEmail)) throw badRequest('Email already exists');

      const id = uid();
      const createdAt = now();
      const user = usersRepository.createUser({
        createdAt,
        email: normalizedEmail,
        fullName: fullName || normalizedEmail,
        id,
        passwordHash: bcrypt.hashSync(password, 10),
        role: 'user',
      });

      return {
        email: user.email,
        fullName: user.full_name,
        id: user.id,
        role: user.role,
      };
    },
  };
}

module.exports = {
  createAuthService,
};
