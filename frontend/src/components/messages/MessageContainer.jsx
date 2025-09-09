// frontend/src/components/messages/MessageContainer.jsx
import React, { useEffect, useRef, useState } from "react";
import useConversation from "../../store/useConversation";
import MessageInput from "./MessageInput";
import Messages from "./Messages";
import { TiMessages } from "react-icons/ti";
import { useAuthContext } from "../../context/AuthContext";
import { useSocketContext } from "../../context/SocketContext";

const configuration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" }, // public STUN
    // For production add TURN server here
  ],
};

const MessageContainer = () => {
  const { selectedConversation, setSelectedConversation } = useConversation();
  const { authUser } = useAuthContext();
  const { socket } = useSocketContext();

  // WebRTC refs/state
  const pcRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const [inCall, setInCall] = useState(false);

  useEffect(() => {
    // cleanup on unmount
    return () => {
      setSelectedConversation(null);
      endCall();
    };
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    if (!socket) return;

    // When someone sends an offer to this client
    socket.on("offer", async (data) => {
      try {
        // data => { fromUserSocketId, fromUserId, sdp }
        // create RTCPeerConnection if not exists
        if (!pcRef.current) {
          await createPeerConnection(data.fromUserId || data.fromUserSocketId);
        }

        await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.sdp));
        const answer = await pcRef.current.createAnswer();
        await pcRef.current.setLocalDescription(answer);

        // send answer back to caller using recipient user id (we use selectedConversation._id or fallback)
        socket.emit("answer", {
          to: data.fromUserId || data.fromUserSocketId, // server will resolve userId->socketId if a userId is sent
          sdp: answer,
        });

        setInCall(true);
      } catch (err) {
        console.error("Error handling incoming offer:", err);
      }
    });

    socket.on("answer", async (data) => {
      try {
        if (pcRef.current && data.sdp) {
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
        console.error("Error adding remote ICE candidate:", err);
      }
    });

    return () => {
      socket.off("offer");
      socket.off("answer");
      socket.off("ice-candidate");
    };
    // eslint-disable-next-line
  }, [socket]);

  async function createPeerConnection(targetUserId) {
    pcRef.current = new RTCPeerConnection(configuration);

    // get local media
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });

    // attach local stream to local video element
    if (localVideoRef.current) localVideoRef.current.srcObject = stream;

    // add tracks to peer connection
    for (const track of stream.getTracks()) {
      pcRef.current.addTrack(track, stream);
    }

    // remote track handler
    pcRef.current.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    // ICE candidate handler => send to remote peer through socket
    pcRef.current.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit("ice-candidate", {
          to: targetUserId, // server expects recipient userId (we pass DB id if we have it)
          candidate: event.candidate,
        });
      }
    };

    return pcRef.current;
  }

  // start call to selectedConversation (1-to-1)
  async function startCall() {
    if (!selectedConversation) return alert("Select a conversation to call");
    if (!socket) return alert("Socket not connected");

    try {
      // create pc and get local stream
      await createPeerConnection(selectedConversation._id);

      const offer = await pcRef.current.createOffer();
      await pcRef.current.setLocalDescription(offer);

      // send offer to recipient (we send recipient's userId; backend resolves to socketId)
      socket.emit("offer", {
        to: selectedConversation._id,
        fromUserId: authUser?._id || null,
        sdp: offer,
      });

      setInCall(true);
    } catch (err) {
      console.error("Error starting call:", err);
      alert("Could not start call. Check console for details.");
    }
  }

  function endCall() {
    try {
      // stop local streams
      if (localVideoRef.current && localVideoRef.current.srcObject) {
        localVideoRef.current.srcObject.getTracks().forEach((t) => t.stop());
        localVideoRef.current.srcObject = null;
      }
      if (remoteVideoRef.current && remoteVideoRef.current.srcObject) {
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

  // UI: if no conversation selected, show placeholder
  if (!selectedConversation) {
    return <NoChatSelected />;
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Header: conversation name + call button */}
      <div className="flex items-center justify-between p-3 border-b">
        <div>
          <h3 className="font-bold text-gray-200">{selectedConversation.fullName}</h3>
          <p className="text-sm text-gray-400">{selectedConversation.email}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={startCall}
            className="px-3 py-1 rounded bg-emerald-600 text-white"
            disabled={inCall}
          >
            📹 Call
          </button>
          <button
            onClick={endCall}
            className="px-3 py-1 rounded bg-red-600 text-white"
            disabled={!inCall}
          >
            End
          </button>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-auto">
        <Messages />
      </div>

      {/* Message input */}
      <div>
        <MessageInput />
      </div>

      {/* Video elements (position as you like; small preview by default) */}
      <div className="fixed bottom-4 right-4 flex gap-2 z-50">
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          style={{ width: 140, height: 100, borderRadius: 8, background: "#000" }}
        />
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          style={{ width: 200, height: 140, borderRadius: 8, background: "#000" }}
        />
      </div>
    </div>
  );
};

export default MessageContainer;

const NoChatSelected = () => {
  return (
    <div className="flex items-center justify-center w-full h-full">
      <div className="px-4 text-center sm:text-lg md:text-xl text-gray-200 font-semibold flex flex-col items-center gap-2">
        <p>Welcome 👋</p>
        <p>Select a chat to start messaging</p>
        <TiMessages className="text-xl md:text-6xl text-center" />
      </div>
    </div>
  );
};
