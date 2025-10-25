import User from '../models/User.js';
import Organization from '../models/Organization.js';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt.js';
import logger from '../utils/logger.js';

export const register = async (req, res) => {
  try {
    const { email, password, name, organizationName } = req.validatedData || req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ error: 'User with this email already exists' });
    }

    // Handle organization
    let organizationId;
    let userRole = 'editor';

    if (organizationName) {
      // Create new organization
      const slug = organizationName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

      // Check if organization slug exists
      let finalSlug = slug;
      let counter = 1;
      while (await Organization.findOne({ slug: finalSlug })) {
        finalSlug = `${slug}-${counter}`;
        counter++;
      }

      const organization = await Organization.create({
        name: organizationName,
        slug: finalSlug
      });

      organizationId = organization._id;
      userRole = 'admin'; // First user in organization is admin
    } else {
      // Find or create default organization
      let defaultOrg = await Organization.findOne({ slug: 'default' });
      if (!defaultOrg) {
        defaultOrg = await Organization.create({
          name: 'Default Organization',
          slug: 'default'
        });
      }
      organizationId = defaultOrg._id;
    }

    // Create user
    const user = await User.create({
      email,
      password,
      name,
      organizationId,
      role: userRole
    });

    // Update organization owner if new org
    if (organizationName) {
      await Organization.findByIdAndUpdate(organizationId, { ownerId: user._id });
    }

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Store refresh token
    user.refreshToken = refreshToken;
    await user.save();

    // Set refresh token in httpOnly cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    logger.info(`User registered: ${email} (${userRole})`);

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        organizationId: user.organizationId
      },
      token: accessToken
    });
  } catch (error) {
    logger.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.validatedData || req.body;

    // Find user with password field
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (!user.isActive) {
      return res.status(403).json({ error: 'Account is deactivated' });
    }

    // Verify password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Update user
    user.refreshToken = refreshToken;
    user.lastLogin = new Date();
    await user.save();

    // Set refresh token in httpOnly cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    logger.info(`User logged in: ${email}`);

    res.json({
      message: 'Login successful',
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        organizationId: user.organizationId
      },
      token: accessToken
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
};

export const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.cookies;

    if (!refreshToken) {
      return res.status(401).json({ error: 'No refresh token provided' });
    }

    // Verify refresh token
    const decoded = verifyRefreshToken(refreshToken);

    // Find user
    const user = await User.findById(decoded.userId).select('+refreshToken');

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    if (user.refreshToken !== refreshToken) {
      return res.status(401).json({ error: 'Refresh token mismatch' });
    }

    // Generate new access token
    const accessToken = generateAccessToken(user);

    res.json({
      token: accessToken,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    logger.error('Token refresh error:', error);
    res.status(401).json({ error: 'Token refresh failed' });
  }
};

export const logout = async (req, res) => {
  try {
    // Clear refresh token from database
    if (req.userId) {
      await User.findByIdAndUpdate(req.userId, { refreshToken: null });
    }

    // Clear cookie
    res.clearCookie('refreshToken');

    logger.info(`User logged out: ${req.userId}`);

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
};

export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.userId)
      .populate('organizationId', 'name slug settings');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    logger.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { name, email } = req.validatedData || req.body;

    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if email is being changed and if it's already taken
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(409).json({ error: 'Email already in use' });
      }
      user.email = email;
    }

    if (name) user.name = name;

    await user.save();

    logger.info(`Profile updated: ${user._id}`);

    res.json({
      message: 'Profile updated successfully',
      user
    });
  } catch (error) {
    logger.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
};

export default {
  register,
  login,
  refreshToken,
  logout,
  getMe,
  updateProfile
};

