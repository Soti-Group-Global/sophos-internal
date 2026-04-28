
import React, { useRef, useEffect, useState, useCallback } from "react";
import { FiArrowDownCircle, FiDownload, FiX } from "react-icons/fi";
import {
  FaFileImage,
  FaFileVideo,
  FaFilePdf,
  FaFileWord,
  FaFile,
  FaDownload,
} from "react-icons/fa";
import { toast } from "react-toastify";
import { getTelegramMedia } from "../utils/api";

const TelegramMessagesContainer = ({ messages = [], selectedChat, loading: initialLoading, profileId }) => {
  const messagesContainerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const isNearBottomRef = useRef(true);
  const autoScrollLockedRef = useRef(false);
  const SCROLL_BOTTOM_THRESHOLD = 40;
  const [mediaUrls, setMediaUrls] = useState({});
  const [loadingMedia, setLoadingMedia] = useState({});
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [isLoading, setIsLoading] = useState(initialLoading);
  const [previewMedia, setPreviewMedia] = useState(null);

  const fetchMedia = async (messageId) => {
    try {
      const response = await getTelegramMedia(messageId, profileId);
      if (response.status === "success" && response.file_link) {
        return response.file_link;
      } else {
        throw new Error("No file_link found in response");
      }
    } catch (error) {
      const errorId = `ERR-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      toast.error(
        `Error Loading Media: Failed to fetch media for message ID: ${messageId}. Details: ${error.response?.data?.error || error.message}. Error ID: ${errorId} - Please report this with the ID for support.`,
        { position: "top-right", autoClose: 5000 }
      );
      return null;
    }
  };

  const handleMediaLoad = useCallback(
    async (msg) => {
      if (
        msg &&
        !mediaUrls[msg.id] &&
        !loadingMedia[msg.id] &&
        ["image", "video", "document"].includes(msg.type)
      ) {
        setLoadingMedia((prev) => ({ ...prev, [msg.id]: true }));
        const mediaUrl = await fetchMedia(msg.id);
        if (mediaUrl) {
          setMediaUrls((prev) => ({ ...prev, [msg.id]: mediaUrl }));
        }
        setLoadingMedia((prev) => ({ ...prev, [msg.id]: false }));
      }
    },
    [mediaUrls, loadingMedia, profileId]
  );

  useEffect(() => {
    if (!messagesEndRef.current || messages.length === 0) return;

    const container = messagesContainerRef.current;
    if (container) {
      const distanceFromBottom = container.scrollHeight - (container.scrollTop + container.clientHeight);
      isNearBottomRef.current = distanceFromBottom <= SCROLL_BOTTOM_THRESHOLD;
    }

    const shouldStickToBottom = !autoScrollLockedRef.current && isNearBottomRef.current;

    if (shouldStickToBottom) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  useEffect(() => {
    // New chat selection should start in auto-scroll mode
    autoScrollLockedRef.current = false;
    isNearBottomRef.current = true;
    setShowScrollButton(false);
  }, [selectedChat]);

  useEffect(() => {
    return () => {
      Object.values(mediaUrls).forEach((url) => URL.revokeObjectURL(url));
    };
  }, [mediaUrls]);

  useEffect(() => {
    setIsLoading(initialLoading);
    if (!messages || messages.length === 0) return;
    messages.forEach((msg) => {
      if (msg && ["image", "video", "document"].includes(msg.type)) {
        handleMediaLoad(msg);
      }
    });
  }, [messages, initialLoading, handleMediaLoad]);

  const getDeliveryStatusIcon = (status) => {
    switch (status) {
      case "sent":
        return "📤";
      case "delivered":
        return "✅";
      case "read":
        return "👁️";
      default:
        return "⏳";
    }
  };

  const handleScroll = useCallback(() => {
    if (messagesContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
      const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);
      const isNearBottom = distanceFromBottom <= SCROLL_BOTTOM_THRESHOLD;
      setShowScrollButton(!isNearBottom);
      isNearBottomRef.current = isNearBottom;
      autoScrollLockedRef.current = !isNearBottom;
    }
  }, [SCROLL_BOTTOM_THRESHOLD]);

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
      setShowScrollButton(false);
      isNearBottomRef.current = true;
      autoScrollLockedRef.current = false;
    }
  };

  const getDateLabel = (timestamp) => {
    if (!timestamp) return "Unknown";
    const messageDate = new Date(timestamp * 1000);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (messageDate.toDateString() === today.toDateString()) return "Today";
    else if (messageDate.toDateString() === yesterday.toDateString()) return "Yesterday";
    else return messageDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  };

  const groupedMessages = messages.reduce((acc, msg) => {
    if (!msg) return acc;
    const dateLabel = getDateLabel(msg.time);
    if (!acc[dateLabel]) acc[dateLabel] = [];
    acc[dateLabel].push(msg);
    return acc;
  }, {});

  const sortedDateLabels = Object.keys(groupedMessages).sort((a, b) => {
    const getDate = (label) => {
      if (label === "Today") return new Date();
      if (label === "Yesterday") return new Date().setDate(new Date().getDate() - 1);
      return new Date(label.split(" ").reverse().join("-"));
    };
    return getDate(a) - getDate(b);
  });

  const downloadAllAttachments = () => {
    const attachments = messages.filter(
      (msg) => ["image", "video", "document"].includes(msg.type) && mediaUrls[msg.id]
    );
    attachments.forEach((msg) => {
      const link = document.createElement("a");
      link.href = mediaUrls[msg.id];
      link.download = msg.file_name || `attachment_${msg.id}${msg.mimetype ? `.${msg.mimetype.split("/")[1]}` : ""}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
    toast.success(`${attachments.length} attachment(s) downloaded!`, { position: "top-right", autoClose: 3000 });
  };

  const getFileIcon = (mimetype) => {
    if (mimetype?.startsWith("image/")) return <FaFileImage />;
    if (mimetype?.startsWith("video/")) return <FaFileVideo />;
    if (mimetype === "application/pdf") return <FaFilePdf />;
    if (
      mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      mimetype === "application/msword"
    ) return <FaFileWord />;
    return <FaFile />;
  };

  const LoadingAnimation = () => (
    <div className="tg-loading-animation">
      <div className="tg-spinner">
        <div></div>
        <div></div>
        <div></div>
        <div></div>
      </div>
      <p>Loading messages...</p>
    </div>
  );

  const handlePreview = (msgId, url) => {
    setPreviewMedia({ id: msgId, url });
  };

  const handleDownload = (url, fileName) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName || `attachment_${Date.now()}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="tg-messages-container" ref={messagesContainerRef} onScroll={handleScroll}>
      {isLoading && <LoadingAnimation />}
      {sortedDateLabels.map((dateLabel) => (
        <div key={dateLabel} className="tg-date-group">
          <div className="tg-date-label">{dateLabel}</div>
          {groupedMessages[dateLabel].map((msg, idx) => (
            <div
              key={msg.id || `${dateLabel}-${msg?.time || 0}-${msg?.fromMe ? "me" : "in"}-${idx}`}
              className={`tg-message-bubble ${msg.fromMe ? "tg-sent" : "tg-received"}`}
              style={{ marginBottom: "10px" }}
            >
              {!msg.fromMe && (
                <div className="tg-sender-name">{msg.senderName || msg.contact_name || "Unknown"}</div>
              )}
              {["image", "video", "document"].includes(msg.type) ? (
                <>
                  {!mediaUrls[msg.id] && loadingMedia[msg.id] && (
                    <div className="tg-media-loading">
                      <div className="tg-spinner-small"></div>
                      <span>Loading media...</span>
                    </div>
                  )}
                  {mediaUrls[msg.id] && (
                    <div
                      className="tg-media-wrapper"
                      onClick={() =>
                        (msg.mimetype?.startsWith("image/") || msg.mimetype?.startsWith("video/")) &&
                        handlePreview(msg.id, mediaUrls[msg.id])
                      }
                    >
                      {msg.mimetype?.startsWith("image/") && (
                        <img
                          src={mediaUrls[msg.id]}
                          alt={msg.file_name || `Image_${msg.id}`}
                          className="tg-media-image"
                          loading="lazy"
                        />
                      )}
                      {msg.mimetype?.startsWith("video/") && (
                        <video
                          controls
                          className="tg-media-video"
                          style={{ maxWidth: "100%", height: "auto" }}
                        >
                          <source src={mediaUrls[msg.id]} type={msg.mimetype} />
                          Your browser does not support the video tag.
                        </video>
                      )}
                      {msg.type === "document" && (
                        <div
                          className="tg-media-file-container"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownload(mediaUrls[msg.id], msg.file_name);
                          }}
                        >
                          <div className="tg-file-icon">{getFileIcon(msg.mimetype)}</div>
                          <span className="tg-media-file-link">
                            {typeof msg.body === "string" ? msg.body : msg.file_name || `Unnamed File_${msg.id}`}
                          </span>
                        </div>
                      )}
                      {msg.caption && <p className="tg-media-caption">{msg.caption}</p>}
                    </div>
                  )}
                </>
              ) : (
                <p className="tg-message-text">
                  {typeof msg.body === "string" ? (
                    msg.body.split(/(https?:\/\/[^\s]+)/g).map((part, i) =>
                      /^https?:\/\//.test(part) ? (
                        <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="tg-chat-link">
                          {part}
                        </a>
                      ) : (
                        <span key={i}>{part}</span>
                      )
                    )
                  ) : (
                    <span>Unsupported message type: {msg.type || "Unknown"}</span>
                  )}
                </p>
              )}
              <div className="tg-message-meta">
                <span className="tg-chat-timestamp">
                  {msg && new Date(msg.time * 1000).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}
                </span>
                <span className="tg-delivery-status">{msg && getDeliveryStatusIcon(msg.delivery_status)}</span>
              </div>
            </div>
          ))}
        </div>
      ))}
      {messages.some((msg) => ["image", "video", "document"].includes(msg.type) && mediaUrls[msg.id]) && (
        <button className="tg-download-all-button" onClick={downloadAllAttachments}>
          <FaDownload /> Download All Attachments
        </button>
      )}
      {previewMedia && (
        <div className="tg-media-preview-overlay" onClick={() => setPreviewMedia(null)}>
          <div className="tg-media-preview-content" onClick={(e) => e.stopPropagation()}>
            <button className="tg-preview-close" onClick={() => setPreviewMedia(null)}>
              <FiX />
            </button>
            {previewMedia.url && (
              <>
                {previewMedia.url.includes(".jpg") || previewMedia.url.includes(".jpeg") ? (
                  <img src={previewMedia.url} alt="Preview" className="tg-preview-image" />
                ) : (
                  <video controls className="tg-preview-video">
                    <source src={previewMedia.url} type="video/mp4" />
                    Your browser does not support the video tag.
                  </video>
                )}
                <button
                  className="tg-preview-download"
                  onClick={() => handleDownload(previewMedia.url, messages.find((msg) => msg.id === previewMedia.id)?.file_name)}
                >
                  <FaDownload /> Download
                </button>
                {messages.find((msg) => msg.id === previewMedia.id)?.caption && (
                  <p className="tg-media-caption">{messages.find((msg) => msg.id === previewMedia.id).caption}</p>
                )}
              </>
            )}
          </div>
        </div>
      )}
      <div ref={messagesEndRef} />
      {showScrollButton && (
        <button className="tg-scroll-to-bottom-button" onClick={scrollToBottom}>
          <FiArrowDownCircle size={35} />
        </button>
      )}
    </div>
  );
};

export default TelegramMessagesContainer;
