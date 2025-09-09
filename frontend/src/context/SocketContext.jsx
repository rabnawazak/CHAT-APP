// frontend/src/context/SocketContext.jsx
import { createContext, useEffect, useState, useContext } from "react";
import { useAuthContext } from "./AuthContext";
import io from "socket.io-client";

const SocketContext = createContext();

export const useSocketContext = () => {
  return useContext(SocketContext);
};

export const SocketContextProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const { authUser } = useAuthContext();

  useEffect(() => {
    if (authUser) {
      // connect with query param (backend expects userId here)
      const s = io("http://localhost:5000", {
        query: { userId: authUser._id },
      });

      setSocket(s);

      // listen for online users list
      s.on("getOnlineUsers", (users) => {
        setOnlineUsers(users || []);
      });

      // optional: error handling
      s.on("connect_error", (err) => {
        console.error("❌ Socket connection error:", err);
      });

      return () => {
        s.disconnect();
        setSocket(null);
      };
    } else {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
    }
  }, [authUser]);

  return (
    <SocketContext.Provider value={{ socket, onlineUsers }}>
      {children}
    </SocketContext.Provider>
  );
};
