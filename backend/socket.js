// socket.js
let io;

function initSocket(server) {
  const { Server } = require("socket.io");
  io = new Server(server, {
    cors: {
      origin: [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "https://manager.health-direct.ru",
        "https://health-direct-site.vercel.app",
      ],
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    // 

    socket.on("join", (room) => {
      socket.join(room);
      // 
    });

    // Employee management events
    socket.on('employee-created', (data) => {
      // Broadcast to all connected clients except the sender
      socket.broadcast.emit('employee-created', {
        ...data,
        timestamp: new Date(),
        message: `New ${data.employeeType} has been created`
      });
    });

    socket.on('employee-updated', (data) => {
      // Broadcast to all connected clients except the sender
      socket.broadcast.emit('employee-updated', {
        ...data,
        timestamp: new Date(),
        message: `${data.employeeType} has been updated`
      });
    });

    socket.on('employee-deleted', (data) => {
      // Broadcast to all connected clients except the sender
      socket.broadcast.emit('employee-deleted', {
        ...data,
        timestamp: new Date(),
        message: `${data.employeeType} has been deleted`
      });
    });

    socket.on("disconnect", () => {
      // 
    });
  });

  return io;
}

function getIO() {
  if (!io) {
    throw new Error("Socket.io not initialized! Call initSocket(server) first.");
  }
  return io;
}

module.exports = { initSocket, getIO };
