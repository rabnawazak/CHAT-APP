// frontend/src/components/messages/MessageContainer.jsx
import React, { useEffect, useRef, useState } from "react";
import useConversation from "../../store/useConversation";
import MessageInput from "./MessageInput";
import Messages from "./Messages";
import { TiMessages } from "react-icons/ti";
import { useAuthContext } from "../../context/AuthContext";
import { useSocketContext } from "../../context/SocketContext";

const configuration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

const MessageContainer = () => {
  const { selectedConversation, setSelectedConversation } = useConversation();
  const { authUser } = useAuthContext();
  const { socket } = useSocketContext();

  const pcRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const [inCall, setInCall] = useState(false);

  // cleanup on unmount
  useEffect(() => {
    return () => {
      endCall();
      setSelectedConversation(null);
    };
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    if (!socket) return;

    socket.on("offer", async (data) => {
      try {
        if (!pcRef.current) {
          await createPeerConnection(data.fromUserId);
        }
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.sdp));
        const answer = await pcRef.current.createAnswer();
        await pcRef.current.setLocalDescription(answer);

        socket.emit("answer", {
          to: data.fromUserId,
          sdp: answer,
        });

        setInCall(true);
      } catch (err) {
        console.error("Error handling offer:", err);
      }
    });

    socket.on("answer", async (data) => {
      try {
        if (pcRef.current) {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.sdp));
        }
      } catch (err) {
        console.error("Error handling answer:", err);
      }
    });

    socket.on("ice-candidate", async (data) => {
      try {
        if (pcRef.current && data.candidate) {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
      } catch (err) {
        console.error("Error adding ice-candidate:", err);
      }
    });

    return () => {
      socket.off("offer");
      socket.off("answer");
      socket.off("ice-candidate");
    };
  }, [socket]);

  async function createPeerConnection(targetUserId) {
    pcRef.current = new RTCPeerConnection(configuration);

    // get local stream
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    if (localVideoRef.current) localVideoRef.current.srcObject = stream;

    stream.getTracks().forEach((track) => pcRef.current.addTrack(track, stream));

    pcRef.current.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
        remoteVideoRef.current.play().catch(() => {}); // autoplay fix
      }
    };

    pcRef.current.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit("ice-candidate", {
          to: targetUserId,
          candidate: event.candidate,
        });
      }
    };
  }

  async function startCall() {
    if (!selectedConversation) return alert("Select a conversation first");
    if (!socket) return alert("Not connected to socket");

    try {
      await createPeerConnection(selectedConversation._id);

      const offer = await pcRef.current.createOffer();
      await pcRef.current.setLocalDescription(offer);

      socket.emit("offer", {
        to: selectedConversation._id,
        fromUserId: authUser._id,
        sdp: offer,
      });

      setInCall(true);
    } catch (err) {
      console.error("Error starting call:", err);
    }
  }

  function endCall() {
    try {
      if (localVideoRef.current?.srcObject) {
        localVideoRef.current.srcObject.getTracks().forEach((t) => t.stop());
        localVideoRef.current.srcObject = null;
      }
      if (remoteVideoRef.current?.srcObject) {
        remoteVideoRef.current.srcObject.getTracks().forEach((t) => t.stop());
        remoteVideoRef.current.srcObject = null;
      }
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
      setInCall(false);
    } catch (err) {
      console.warn("Error ending call:", err);
    }
  }

  if (!selectedConversation) return <NoChatSelected authUser={authUser} />;

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b bg-slate-600">
        <h3 className="font-bold text-gray-200">{selectedConversation.fullName}</h3>
        <div className="flex gap-2">
          <button
            onClick={startCall}
            disabled={inCall}
            className="px-3 py-1 rounded bg-emerald-600 text-white"
          >
            📹 Call
          </button>
          <button
            onClick={endCall}
            disabled={!inCall}
            className="px-3 py-1 rounded bg-red-600 text-white"
          >
            End
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto">
        <Messages />
      </div>

      <MessageInput />

      {/* Video windows */}
      {inCall && (
        <div className="fixed bottom-4 right-4 flex gap-2 z-50">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            style={{ width: 140, height: 100, background: "#000", borderRadius: 8 }}
          />
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            style={{ width: 200, height: 140, background: "#000", borderRadius: 8 }}
          />
        </div>
      )}
    </div>
  );
};

export default MessageContainer;

const NoChatSelected = ({ authUser }) => (
  <div className="flex items-center justify-center w-full h-full">
    <div className="px-4 text-center sm:text-lg md:text-xl text-gray-200 font-semibold flex flex-col items-center gap-2">
      <p>Welcome 👋 {authUser?.fullName}</p>
      <p>Select a chat to start messaging</p>
      <TiMessages className="text-xl md:text-6xl text-center" />
    </div>
  </div>
);
