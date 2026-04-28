import React, { useEffect, useState, useRef } from "react";
import { Room, createLocalTracks } from "livekit-client";
import { 
  FaMicrophone, 
  FaMicrophoneSlash, 
  FaVideo, 
  FaVideoSlash, 
  FaPhoneSlash,
  FaExpand,
  FaCompress,
  FaTimes,
  FaPaperPlane,
  FaCircle
} from "react-icons/fa";
import { BsThreeDotsVertical } from "react-icons/bs";
import "../styles/VideoConsultation.css";

export default function VideoConsultation({ user, token, roomName }) {
  const [room, setRoom] = useState(null);
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);
  const localContainerRef = useRef(null);
  const remoteContainerRef = useRef(null);
  const livekitUrl = "ws://192.168.0.102:7880";

  useEffect(() => {
    if (!token) return;

    const joinRoom = async () => {
      try {
        const lkRoom = new Room({
          adaptiveStream: true,
          dynacast: true,
          publishDefaults: { simulcast: true },
        });

        await lkRoom.connect(livekitUrl, token);
        setRoom(lkRoom);


        const tracks = await createLocalTracks({
          audio: true,
          video: { resolution: "hd" },
        });

        tracks.forEach((track) => {
          lkRoom.localParticipant.publishTrack(track);
          const el = track.attach();
          el.className = "local-video";
          if (localContainerRef.current) {
            localContainerRef.current.appendChild(el);
          }
        });

        lkRoom.on("trackSubscribed", (track) => {
          const el = track.attach();
          el.className = "remote-video";
          if (remoteContainerRef.current) {
            remoteContainerRef.current.appendChild(el);
          }
        });

        lkRoom.on("trackUnsubscribed", (track) => {
          track.detach().forEach((el) => el.remove());
        });

        lkRoom.on("participantDisconnected", (participant) => {
        });
      } catch (err) {
      }
    };

    joinRoom();

    return () => {
      if (room) room.disconnect();
      if (localContainerRef.current) localContainerRef.current.innerHTML = "";
      if (remoteContainerRef.current) remoteContainerRef.current.innerHTML = "";
    };
  }, [token]);

  const toggleMic = () => {
    if (!room) return;
    const enabled = !micEnabled;
    room.localParticipant.audioTracks.forEach((pub) => {
      enabled ? pub.track?.unmute() : pub.track?.mute();
    });
    setMicEnabled(enabled);
  };

  const toggleCamera = () => {
    if (!room) return;
    const enabled = !cameraEnabled;
    room.localParticipant.videoTracks.forEach((pub) => {
      enabled ? pub.track?.unmute() : pub.track?.mute();
    });
    setCameraEnabled(enabled);
  };

const handleLeave = async () => {
  if (room) {
    try {
      await fetch("http://localhost:3003/api/meeting/start-recording", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomName }),
      });
    } catch (err) {
    }

    room.disconnect();
    setRoom(null);
    if (localContainerRef.current) localContainerRef.current.innerHTML = "";
    if (remoteContainerRef.current) remoteContainerRef.current.innerHTML = "";
  }
};


  const toggleMinimize = () => {
    setIsMinimized(!isMinimized);
  };

  if (isMinimized) {
    return (
      <div className="minimized-container">
        <div className="minimized-header">
          <div className="minimized-info">
            <FaCircle className="minimized-status" />
            <span className="minimized-title">Video Call</span>
          </div>
          <div className="minimized-controls">
            <button onClick={toggleMinimize} className="icon-btn">
              <FaExpand size={12} />
            </button>
            <button onClick={handleLeave} className="icon-btn-danger">
              <FaTimes size={12} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="video-consultation-container">
      {/* Header */}
      <div className="consultation-header">
        <div className="header-info">
          <div className="status">
            <FaCircle className="status-indicator" />
            <span>Live Consultation</span>
          </div>
          <span className="participant">Dr. Smith</span>
        </div>
        <div className="header-controls">
          <button onClick={toggleMinimize} className="icon-btn">
            <FaCompress size={14} />
          </button>
          <button onClick={handleLeave} className="icon-btn-danger">
            <FaTimes size={14} />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="consultation-content">
        {/* Video Area */}
        <div className="video-section">
          <div ref={remoteContainerRef} className="remote-container"></div>
          <div ref={localContainerRef} className="local-container"></div>
        </div>

        {/* Controls */}
        <div className="controls">
          <button
            onClick={toggleMic}
            className={`control-btn ${micEnabled ? 'control-btn-active' : 'control-btn-inactive'}`}
          >
            <span className="control-icon">
              {micEnabled ? <FaMicrophone size={20} /> : <FaMicrophoneSlash size={20} />}
            </span>
            <span className="control-text">
              {micEnabled ? "Mute" : "Unmute"}
            </span>
          </button>

          <button
            onClick={toggleCamera}
            className={`control-btn ${cameraEnabled ? 'control-btn-active' : 'control-btn-inactive'}`}
          >
            <span className="control-icon">
              {cameraEnabled ? <FaVideo size={20} /> : <FaVideoSlash size={20} />}
            </span>
            <span className="control-text">
              {cameraEnabled ? "Stop Video" : "Start Video"}
            </span>
          </button>

          <button onClick={handleLeave} className="leave-btn">
            <span className="control-icon">
              <FaPhoneSlash size={18} />
            </span>
            <span className="control-text">End Call</span>
          </button>
        </div>
      </div>

    </div>
  );
}