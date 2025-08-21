const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const SocketEmitter = require('./SocketEmitter');

function setupSocket(server) {
  const io = socketIo(server, {
    cors: {
      origin: (origin, callback) => {
        callback(null, true); // allow all origins dynamically
      },
      methods: ["GET", "POST"],
      credentials: true
    }
  });

  // Socket.IO authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication error'));
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.userId;
      socket.userRole = decoded.role;
      socket.companyId = decoded.companyId;
      next();
    } catch (err) {
      return next(new Error('Authentication error'));
    }
  });

  // Socket.IO event handlers
  global.SocketEmitter = new SocketEmitter(io);
  io.on('connection', (socket) => {
    global.SocketEmitter.addUser(socket, socket.userId);
    console.log(`User connected +=>: ${socket.userId} (${socket.userRole})`);

    // Join user to their personal room
    socket.join(`user_${socket.userId}`);
    // If admin, join company room
    if (socket.companyId) {
      socket.join(`company_${socket.companyId}`);
    }
    // Join conversation room
    socket.on('join_conversation', (conversationId) => {
      socket.leaveAll();
      socket.join(`conversation_${conversationId}`);
      socket.join(`user_${socket.userId}`);
      if (socket.companyId) {
        socket.join(`company_${socket.companyId}`);
      }
      console.log(`User ${socket.userId} joined conversation ${conversationId}`);
    });
  
    // Handle disconnection
    socket.on('disconnect', () => {
      global.SocketEmitter.removeUser(socket.userId);
      console.log(`User disconnected: ${socket.userId}`);
    });
  });
  return io;
}

module.exports = setupSocket;
