// backend/socket/socket.js
import { Server } from "socket.io";
import http from "http";
import express from "express";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5000", // change if frontend served from different origin
    methods: ["GET", "POST"],
  },
});

/**
 * Keep mapping from userId (your DB id) => socketId
 * This repo already uses user ids as "onlineUsers". We will keep same idea.
 */
const userSocketMap = {};

// helper to get receiver socket id by userId
export const getRecieverSocketId = (recieverId) => {
  return userSocketMap[recieverId];
};

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  // client should emit "add-user" with its userId after connecting
  socket.on("add-user", (userId) => {
    // map user's DB id to this socket id
    userSocketMap[userId] = socket.id;
    // broadcast online user list (array of userIds)
    io.emit("getOnlineUsers", Object.keys(userSocketMap));
    console.log("User added:", userId, "->", socket.id);
  });

  // Signaling: Offer
  // data: { to: <recipientUserId>, sdp: <offerSDP>, fromUserId: <optional> }
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
      console.error("Error in offer handler:", err);
    }
  });

  // Signaling: Answer
  // data: { to: <recipientUserId>, sdp: <answerSDP> }
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
      console.error("Error in answer handler:", err);
    }
  });

  // Signaling: ICE candidates
  // data: { to: <recipientUserId>, candidate: <iceCandidate> }
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
      console.error("Error in ice-candidate handler:", err);
    }
  });

  // handle disconnect: remove user mapping if any
  socket.on("disconnect", () => {
    console.log("A user disconnected", socket.id);
    // find the userId mapped to this socket and delete it
    const mappedUser = Object.keys(userSocketMap).find(
      (k) => userSocketMap[k] === socket.id
    );
    if (mappedUser) {
      delete userSocketMap[mappedUser];
    }
    io.emit("getOnlineUsers", Object.keys(userSocketMap));
  });
});

export { app, io, server };
