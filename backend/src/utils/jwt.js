import jwt from 'jsonwebtoken';
import config from '../config/env.js';

export const generateAccessToken = (user) => {
  return jwt.sign(
    {
      userId: user._id.toString(),
      role: user.role,
      organizationId: user.organizationId.toString()
    },
    config.jwt.secret,
    { expiresIn: config.jwt.expire }
  );
};

export const generateRefreshToken = (user) => {
  return jwt.sign(
    { userId: user._id.toString() },
    config.jwt.refreshSecret,
    { expiresIn: config.jwt.refreshExpire }
  );
};

export const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, config.jwt.secret);
  } catch (error) {
    throw error;
  }
};

export const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, config.jwt.refreshSecret);
  } catch (error) {
    throw error;
  }
};

export default {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken
};

