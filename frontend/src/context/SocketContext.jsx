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
    // if user logged in, initialize socket
    if (authUser) {
      // connect (change URL if your backend server runs on other host/port)
      const s = io("http://localhost:5000"); // backend server where socket.io listens
      setSocket(s);

      s.on("connect", () => {
        // let server know who this socket belongs to (use DB user id)
        s.emit("add-user", authUser._id);
      });

      s.on("getOnlineUsers", (users) => {
        // users is array of userIds (strings)
        setOnlineUsers(users || []);
      });

      // keep simple logging for debugging
      s.on("connect_error", (err) => {
        console.warn("Socket connect_error:", err);
      });

      return () => {
        s.disconnect();
        setSocket(null);
      };
    } else {
      // if user logged out, cleanup socket
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
