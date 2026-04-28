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
import { IoCheckmark, IoCheckmarkDone } from "react-icons/io5";
import { LuClock } from "react-icons/lu";
import { toast } from "react-toastify";
import { getWhatsAppMedia, getTelegramMedia } from "../utils/api";

const MessagesContainer = ({
  messages = [],
  loading: initialLoading,
  profileId,
  selectedChat = null,
  platform = "whatsapp",
}) => {
  const messagesContainerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const isNearBottomRef = useRef(true);
  const autoScrollLockedRef = useRef(false);
  const initialScrollPendingRef = useRef(true);
  const SCROLL_BOTTOM_THRESHOLD = 40;
  const [mediaUrls, setMediaUrls] = useState({});
  const [loadingMedia, setLoadingMedia] = useState({});
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [isLoading, setIsLoading] = useState(initialLoading);
  const [previewMedia, setPreviewMedia] = useState(null);
  const [downloadingFiles, setDownloadingFiles] = useState({});
  const [downloadProgress, setDownloadProgress] = useState({});

  // Clear media state when messages change (e.g., switching chats)
  useEffect(() => {
    setMediaUrls({});
    setLoadingMedia({});
  }, [messages.length > 0 ? messages[0]?.id : null]);

  const fetchMedia = useCallback(async (messageId) => {
    if (!profileId) {
      return null;
    }

    try {
      // Use the appropriate API function based on platform
      const getMediaFunction = platform === "telegram" ? getTelegramMedia : getWhatsAppMedia;
      const response = await getMediaFunction(messageId, profileId);

      if (response.status === "success" && response.file_link) {
        return response.file_link;
      }
      throw new Error("No file_link found in response");
    } catch (error) {
      return null;
    }
  }, [profileId, platform]);

  const handleMediaLoad = useCallback(
    async (msg) => {
      if (
        msg &&
        !mediaUrls[msg.id] &&
        !loadingMedia[msg.id] &&
        ["image", "video", "document", "audio"].includes(msg.type)
      ) {
        setLoadingMedia((prev) => ({ ...prev, [msg.id]: true }));
        const mediaUrl = await fetchMedia(msg.id);
        if (mediaUrl) {
          setMediaUrls((prev) => ({ ...prev, [msg.id]: mediaUrl }));
        }
        setLoadingMedia((prev) => ({ ...prev, [msg.id]: false }));
      }
    },
    [mediaUrls, loadingMedia, fetchMedia]
  );

  useEffect(() => {
    if (!messagesContainerRef.current || messages.length === 0) return;

    // On first load of selected chat, always jump to latest message
    if (initialScrollPendingRef.current) {
      setTimeout(() => {
        if (messagesContainerRef.current) {
          messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
          isNearBottomRef.current = true;
          autoScrollLockedRef.current = false;
          setShowScrollButton(false);
        }
      }, 0);
      initialScrollPendingRef.current = false;
      return;
    }

    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);
    isNearBottomRef.current = distanceFromBottom <= SCROLL_BOTTOM_THRESHOLD;

    const shouldStickToBottom = !autoScrollLockedRef.current && isNearBottomRef.current;

    if (shouldStickToBottom) {
      // Scroll to bottom of messages container without affecting page scroll
      setTimeout(() => {
        if (messagesContainerRef.current) {
          messagesContainerRef.current.scrollTop =
            messagesContainerRef.current.scrollHeight;
        }
      }, 0);
    }
  }, [messages]);

  useEffect(() => {
    // Whenever chat changes, next message render should open at bottom
    initialScrollPendingRef.current = true;
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
      if (msg && ["image", "video", "document", "audio"].includes(msg.type)) {
        handleMediaLoad(msg);
      }
    });
  }, [messages, initialLoading, handleMediaLoad]);

  const getDeliveryStatusIcon = (status) => {
    switch (status) {
      case "sent":
        return <IoCheckmark className="wa-tick-icon" />;
      case "delivered":
        return <IoCheckmarkDone className="wa-tick-icon wa-tick-delivered" />;
      case "read":
        return <IoCheckmarkDone className="wa-tick-icon wa-tick-read" />;
      default:
        return <LuClock className="wa-tick-icon wa-tick-pending" />;
    }
  };

  const handleScroll = useCallback(() => {
    if (messagesContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } =
        messagesContainerRef.current;
      const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);
      const isNearBottom = distanceFromBottom <= SCROLL_BOTTOM_THRESHOLD;
      setShowScrollButton(!isNearBottom);
      isNearBottomRef.current = isNearBottom;
      autoScrollLockedRef.current = !isNearBottom;
    }
  }, [SCROLL_BOTTOM_THRESHOLD]);

  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop =
        messagesContainerRef.current.scrollHeight;
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
    else if (messageDate.toDateString() === yesterday.toDateString())
      return "Yesterday";
    else
      return messageDate.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
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
      if (label === "Yesterday")
        return new Date().setDate(new Date().getDate() - 1);
      return new Date(label.split(" ").reverse().join("-"));
    };
    return getDate(a) - getDate(b);
  });

  const downloadAllAttachments = () => {
    const attachments = messages.filter(
      (msg) =>
        ["image", "video", "document", "audio"].includes(msg.type) &&
        mediaUrls[msg.id]
    );
    attachments.forEach((msg) => {
      const fileName =
        msg.body?.fileName ||
        `Unknown.${msg.mimetype?.split("/")[1] || "file"}`;
      const link = document.createElement("a");
      link.href = mediaUrls[msg.id];
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
    toast.success(`${attachments.length} attachment(s) downloaded!`, {
      position: "top-right",
      autoClose: 3000,
    });
  };

  const getFileIcon = (mimetype) => {
    if (mimetype?.startsWith("image/")) return <FaFileImage />;
    if (mimetype?.startsWith("video/")) return <FaFileVideo />;
    if (mimetype === "application/pdf") return <FaFilePdf />;
    if (
      mimetype ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      mimetype === "application/msword"
    )
      return <FaFileWord />;
    return <FaFile />;
  };

  const getFileName = (msg) => {
    if (msg.body?.fileName) return msg.body.fileName;
    const fileType = msg.mimetype?.split("/")[1] || "file";
    return `Unknown.${fileType}`;
  };

  const handlePreview = (msgId, url) => {
    setPreviewMedia({ id: msgId, url });
  };

  const handleDownload = async (url, fileName, msgId) => {
    
    setDownloadingFiles((prev) => ({ ...prev, [msgId]: true }));

    try {
      // Create invisible iframe to download without opening new tab
      const iframe = document.createElement("iframe");
      iframe.style.display = "none";
      iframe.src = url;
      document.body.appendChild(iframe);
      
      // Remove iframe after download starts
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 3000);
      
      // Simulate progress for user feedback
      let progress = 0;
      const progressInterval = setInterval(() => {
        progress += 20;
        setDownloadProgress((prev) => ({ ...prev, [msgId]: Math.min(progress, 90) }));
        
        if (progress >= 100) {
          clearInterval(progressInterval);
          setDownloadProgress((prev) => ({ ...prev, [msgId]: 100 }));
          
          setTimeout(() => {
            setDownloadingFiles((prev) => ({ ...prev, [msgId]: false }));
            setDownloadProgress((prev) => ({ ...prev, [msgId]: 0 }));
          }, 500);
        }
      }, 200);
      
      toast.success(`Downloading: ${fileName}`, {
        position: "top-right",
        autoClose: 2000,
      });
    } catch (error) {
      toast.error(`Failed to download: ${fileName}`, {
        position: "top-right",
        autoClose: 3000,
      });
      setDownloadingFiles((prev) => ({ ...prev, [msgId]: false }));
      setDownloadProgress((prev) => ({ ...prev, [msgId]: 0 }));
    }
  };

  const LoadingAnimation = () => (
    <div className="wa-loading-animation">
      <div className="wa-spinner">
        <div></div>
        <div></div>
        <div></div>
        <div></div>
      </div>
      <p>Loading messages...</p>
    </div>
  );

  return (
    <div
      className="wa-messages-container"
      ref={messagesContainerRef}
      onScroll={handleScroll}
    >
      {isLoading && <LoadingAnimation />}
      {sortedDateLabels.map((dateLabel) => (
        <div key={dateLabel} className="wa-date-group">
          <div className="wa-date-label">{dateLabel}</div>
          {groupedMessages[dateLabel].map((msg, idx) => (
            <div
              key={msg.id || `${dateLabel}-${msg?.time || 0}-${msg?.fromMe ? "me" : "in"}-${idx}`}
              className={`wa-message-bubble ${
                msg.fromMe ? "wa-sent" : "wa-received"
              }`}
              style={{ marginBottom: "10px" }}
            >
              {!msg.fromMe && (
                <div className="wa-sender-name">
                  {msg.senderName || msg.contact_name || "Unknown"}
                </div>
              )}
              {["image", "video", "document", "audio"].includes(msg.type) ? (
                <>
                  {!mediaUrls[msg.id] && loadingMedia[msg.id] && (
                    <div className="wa-media-loading">
                      <div className="wa-spinner-small"></div>
                      <span>Loading media...</span>
                    </div>
                  )}
                  {mediaUrls[msg.id] && (
                    <div
                      className="wa-media-wrapper"
                      onClick={() =>
                        (msg.type === "image" || msg.type === "video") &&
                        handlePreview(msg.id, mediaUrls[msg.id])
                      }
                    >
                      {msg.type === "image" && (
                        <>
                          <img
                            src={mediaUrls[msg.id]}
                            alt={getFileName(msg)}
                            className="wa-media-image"
                            loading="lazy"
                            onError={(e) => {
                              
                              e.target.onerror = null;
                              e.target.src = "/placeholder.png";
                              e.target.alt = "Failed to load image";
                            }}
                          />
                          {msg.body?.caption && (
                            <p className="wa-media-caption">
                              {msg.body.caption}
                            </p>
                          )}
                        </>
                      )}
                      {msg.type === "video" && (
                        <>
                          <video
                            controls
                            className="wa-media-video"
                            style={{ maxWidth: "100%", height: "auto" }}
                          >
                            <source
                              src={mediaUrls[msg.id]}
                              type={msg.mimetype || "video/mp4"}
                            />
                            Your browser does not support the video tag.
                          </video>
                          {msg.body?.caption && (
                            <p className="wa-media-caption">
                              {msg.body.caption}
                            </p>
                          )}
                        </>
                      )}
                      {msg.type === "audio" && (
                        <>
                          <audio controls className="wa-media-audio">
                            <source
                              src={mediaUrls[msg.id]}
                              type={msg.mimetype || "audio/mpeg"}
                            />
                            Your browser does not support the audio element.
                          </audio>
                          {msg.body?.caption && (
                            <p className="wa-media-caption">
                              {msg.body.caption}
                            </p>
                          )}
                        </>
                      )}
                      {msg.type === "document" && (
                        <>
                          <div className="wa-media-file-container">
                            <div className="wa-file-icon">
                              {getFileIcon(msg.mimetype)}
                            </div>
                            <div className="wa-file-info">
                              <span className="wa-media-file-link">
                                {getFileName(msg)}
                              </span>
                              {msg.body?.fileSize && (
                                <span className="wa-file-size">
                                  {(msg.body.fileSize / 1024).toFixed(2)} KB
                                </span>
                              )}
                            </div>
                            <button
                              className="wa-download-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownload(
                                  mediaUrls[msg.id],
                                  getFileName(msg),
                                  msg.id
                                );
                              }}
                              disabled={downloadingFiles[msg.id]}
                            >
                              {downloadingFiles[msg.id] ? (
                                <div className="wa-download-progress">
                                  <svg className="wa-progress-circle" viewBox="0 0 36 36">
                                    <path
                                      className="wa-progress-circle-bg"
                                      d="M18 2.0845
                                        a 15.9155 15.9155 0 0 1 0 31.831
                                        a 15.9155 15.9155 0 0 1 0 -31.831"
                                    />
                                    <path
                                      className="wa-progress-circle-fg"
                                      strokeDasharray={`${downloadProgress[msg.id] || 0}, 100`}
                                      d="M18 2.0845
                                        a 15.9155 15.9155 0 0 1 0 31.831
                                        a 15.9155 15.9155 0 0 1 0 -31.831"
                                    />
                                  </svg>
                                  <span className="wa-progress-text">
                                    {downloadProgress[msg.id] || 0}%
                                  </span>
                                </div>
                              ) : (
                                <FaDownload />
                              )}
                            </button>
                          </div>
                          {msg.body?.caption && (
                            <p className="wa-media-caption">
                              {msg.body.caption}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  )}
                  {!mediaUrls[msg.id] && !loadingMedia[msg.id] && (
                    <div className="wa-unsupported-format">
                      Failed to load media for message ID: {msg.id}
                    </div>
                  )}
                </>
              ) : (
                <p className="wa-message-text">
                  {typeof msg.body === "string" ? (
                    msg.body.split(/(https?:\/\/[^\s]+)/g).map((part, i) =>
                      /^https?:\/\//.test(part) ? (
                        <a
                          key={i}
                          href={part}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="wa-chat-link"
                        >
                          {part}
                        </a>
                      ) : (
                        <span key={i}>{part}</span>
                      )
                    )
                  ) : (
                    <span>
                      Unsupported message type: {msg.type || "Unknown"}
                    </span>
                  )}
                </p>
              )}
              <div className="wa-message-meta">
                <span className="wa-chat-timestamp">
                  {msg &&
                    new Date(msg.time * 1000).toLocaleTimeString("en-IN", {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: true,
                    })}
                </span>
                <span className="wa-delivery-status">
                  {msg && getDeliveryStatusIcon(msg.delivery_status)}
                </span>
              </div>
            </div>
          ))}
        </div>
      ))}

      {previewMedia && (
        <div
          className="wa-media-preview-overlay"
          onClick={() => setPreviewMedia(null)}
        >
          <div
            className="wa-media-preview-content"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="wa-preview-close"
              onClick={() => setPreviewMedia(null)}
            >
              <FiX />
            </button>
            {previewMedia.url && (
              <>
                {previewMedia.url.includes(".jpg") ||
                previewMedia.url.includes(".jpeg") ? (
                  <img
                    src={previewMedia.url}
                    alt="Preview"
                    className="wa-preview-image"
                    onError={(e) => {
                      
                      e.target.src = "/placeholder.png";
                      e.target.alt = "Failed to load preview";
                    }}
                  />
                ) : (
                  <video controls className="wa-preview-video">
                    <source src={previewMedia.url} type="video/mp4" />
                    Your browser does not support the video tag.
                  </video>
                )}
                <button
                  className="wa-preview-download"
                  onClick={() =>
                    handleDownload(
                      previewMedia.url,
                      messages.find((msg) => msg.id === previewMedia.id)?.body
                        ?.fileName || `Unknown.file`
                    )
                  }
                >
                  <FaDownload /> Download
                </button>
                {messages.find((msg) => msg.id === previewMedia.id)?.body
                  ?.caption && (
                  <p className="wa-media-caption">
                    {
                      messages.find((msg) => msg.id === previewMedia.id).body
                        .caption
                    }
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      )}
      <div ref={messagesEndRef} />
      {showScrollButton && (
        <button className="wa-scroll-to-bottom-button" onClick={scrollToBottom}>
          <FiArrowDownCircle size={35} />
        </button>
      )}
    </div>
  );
};

export default MessagesContainer;
