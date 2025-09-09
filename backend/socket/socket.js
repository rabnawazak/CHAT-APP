// backend/socket/socket.js
import { Server } from "socket.io";
import http from "http";
import express from "express";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000", // update if frontend served elsewhere
    methods: ["GET", "POST"],
  },
});

// userId -> socketId mapping
const userSocketMap = {};

// helper to get receiver socket id
export const getRecieverSocketId = (recieverId) => {
  return userSocketMap[recieverId];
};

io.on("connection", (socket) => {
  console.log("✅ A user connected:", socket.id);

  // get userId from query params (like old code)
  const userId = socket.handshake.query.userId;
  if (userId && userId !== "undefined") {
    userSocketMap[userId] = socket.id;
    console.log("User registered:", userId, "->", socket.id);
  }

  // broadcast online users to all
  io.emit("getOnlineUsers", Object.keys(userSocketMap));

  // --------------------
  // WebRTC signaling
  // --------------------

  // Offer
  socket.on("offer", (data) => {
    try {
      const toSocketId = getRecieverSocketId(data.to);
      if (toSocketId) {
        io.to(toSocketId).emit("offer", {
          fromUserSocketId: socket.id,
          fromUserId: data.fromUserId || null,
          sdp: data.sdp,
        });
      }
    } catch (err) {
      console.error("❌ Error in offer handler:", err);
    }
  });

  // Answer
  socket.on("answer", (data) => {
    try {
      const toSocketId = getRecieverSocketId(data.to);
      if (toSocketId) {
        io.to(toSocketId).emit("answer", {
          fromUserSocketId: socket.id,
          sdp: data.sdp,
        });
      }
    } catch (err) {
      console.error("❌ Error in answer handler:", err);
    }
  });

  // ICE Candidate
  socket.on("ice-candidate", (data) => {
    try {
      const toSocketId = getRecieverSocketId(data.to);
      if (toSocketId) {
        io.to(toSocketId).emit("ice-candidate", {
          fromUserSocketId: socket.id,
          candidate: data.candidate,
        });
      }
    } catch (err) {
      console.error("❌ Error in ice-candidate handler:", err);
    }
  });

  // --------------------
  // Disconnect
  // --------------------
  socket.on("disconnect", () => {
    console.log("⚠️ A user disconnected:", socket.id);
    if (userId && userSocketMap[userId]) {
      delete userSocketMap[userId];
    }
    io.emit("getOnlineUsers", Object.keys(userSocketMap));
  });
});

export { app, io, server };
