import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import config from '../config/env.js';
import logger from '../utils/logger.js';

class SocketService {
  constructor() {
    this.io = null;
    this.organizationRooms = new Map();
  }

  initialize(server) {
    this.io = new Server(server, {
      cors: {
        origin: config.frontendUrl,
        credentials: true,
        methods: ['GET', 'POST']
      },
      transports: ['websocket', 'polling']
    });

    // Authentication middleware
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token;

        if (!token) {
          return next(new Error('Authentication token required'));
        }

        const decoded = jwt.verify(token, config.jwt.secret);
        
        socket.userId = decoded.userId;
        socket.organizationId = decoded.organizationId;
        socket.userRole = decoded.role;

        next();
      } catch (error) {
        logger.error('Socket authentication error:', error);
        next(new Error('Authentication failed'));
      }
    });

    // Connection handler
    this.io.on('connection', (socket) => {
      logger.info(`Socket connected: ${socket.id}, User: ${socket.userId}`);

      // Join organization room
      const orgRoom = `org:${socket.organizationId}`;
      socket.join(orgRoom);

      // Join user-specific room
      const userRoom = `user:${socket.userId}`;
      socket.join(userRoom);

      // Track connections per organization
      if (!this.organizationRooms.has(socket.organizationId.toString())) {
        this.organizationRooms.set(socket.organizationId.toString(), new Set());
      }
      this.organizationRooms.get(socket.organizationId.toString()).add(socket.id);

      // Send connection confirmation
      socket.emit('connected', {
        socketId: socket.id,
        userId: socket.userId,
        organizationId: socket.organizationId
      });

      // Handle video subscription
      socket.on('subscribe:video', (videoId) => {
        socket.join(`video:${videoId}`);
        logger.debug(`Socket ${socket.id} subscribed to video ${videoId}`);
      });

      socket.on('unsubscribe:video', (videoId) => {
        socket.leave(`video:${videoId}`);
        logger.debug(`Socket ${socket.id} unsubscribed from video ${videoId}`);
      });

      // Handle ping/pong for connection health check
      socket.on('ping', () => {
        socket.emit('pong');
      });

      // Handle disconnection
      socket.on('disconnect', (reason) => {
        logger.info(`Socket disconnected: ${socket.id}, Reason: ${reason}`);

        const orgRooms = this.organizationRooms.get(socket.organizationId.toString());
        if (orgRooms) {
          orgRooms.delete(socket.id);
          if (orgRooms.size === 0) {
            this.organizationRooms.delete(socket.organizationId.toString());
          }
        }
      });

      // Handle errors
      socket.on('error', (error) => {
        logger.error(`Socket error: ${socket.id}`, error);
      });
    });

    // Handle connection errors
    this.io.on('connect_error', (error) => {
      logger.error('Socket.io connection error:', error);
    });

    logger.info('✅ Socket.io initialized');
  }

  /**
   * Emit event to specific organization
   */
  emitToOrganization(organizationId, event, data) {
    if (this.io) {
      this.io.to(`org:${organizationId}`).emit(event, data);
    }
  }

  /**
   * Emit event to specific video subscribers
   */
  emitToVideo(videoId, event, data) {
    if (this.io) {
      this.io.to(`video:${videoId}`).emit(event, data);
    }
  }

  /**
   * Emit event to specific user
   */
  emitToUser(userId, event, data) {
    if (this.io) {
      this.io.to(`user:${userId}`).emit(event, data);
    }
  }

  /**
   * Get active connections count for organization
   */
  getConnectionCount(organizationId) {
    const orgRooms = this.organizationRooms.get(organizationId.toString());
    return orgRooms ? orgRooms.size : 0;
  }

  /**
   * Get total active connections
   */
  getTotalConnections() {
    return Array.from(this.organizationRooms.values())
      .reduce((total, set) => total + set.size, 0);
  }
}

export default new SocketService();

