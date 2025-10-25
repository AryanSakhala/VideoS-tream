import logger from '../utils/logger.js';

/**
 * Role-Based Access Control Middleware
 * @param {...string} allowedRoles - Roles that can access the route
 */
export const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      logger.warn(`Access denied for user ${req.userId} with role ${req.user.role}`);
      return res.status(403).json({
        error: 'Forbidden',
        message: `This action requires one of the following roles: ${allowedRoles.join(', ')}`
      });
    }

    next();
  };
};

/**
 * Check if user can access resource in their organization
 */
export const checkOrganizationAccess = (resourceOrgId) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Admin can access everything
    if (req.user.role === 'admin') {
      return next();
    }

    // Check if resource belongs to user's organization
    if (resourceOrgId.toString() !== req.organizationId.toString()) {
      logger.warn(`Organization access denied: User ${req.userId} tried to access resource in org ${resourceOrgId}`);
      return res.status(403).json({ error: 'Access denied to this organization' });
    }

    next();
  };
};

export default { authorize, checkOrganizationAccess };

