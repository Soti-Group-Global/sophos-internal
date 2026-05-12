
import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import "../styles/MaxMessenger.css";
import { BsFillPlusSquareFill } from "react-icons/bs";
import { IoIosArrowBack, IoMdArrowUp } from "react-icons/io";
import { FiSearch } from "react-icons/fi";
import { HiDotsVertical } from "react-icons/hi";
import { GrAttachment } from "react-icons/gr";
import { LuSticker } from "react-icons/lu";
import { MdOutlinePhotoLibrary } from "react-icons/md";
import { IoVideocamOutline } from "react-icons/io5";
import { CiFileOn } from "react-icons/ci";
import {
  getMaxChats,
  filterMaxChats,
  getMaxMessages,
  sendMaxMessage,
  sendMaxFile,
} from "../utils/api";
import { formatTimeHHMM } from "../utils/dateFormat";

export default function MaxMessenger() {
  const { t } = useTranslation();
  const [chats, setChats] = useState([]);
  const [messages, setMessages] = useState([]);
  const [selected, setSelected] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [inputValue, setInputValue] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [base64File, setBase64File] = useState("");
  const [fileType, setFileType] = useState(null);

  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);

  // Fetch chats on mount
  useEffect(() => {
    fetchChats();
  }, []);

  // Handle search
  useEffect(() => {
    if (searchTerm) {
      fetchChats(searchTerm);
    } else {
      fetchChats();
    }
  }, [searchTerm]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Add scroll event listener
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) {
      container.addEventListener("scroll", handleScroll);
      return () => container.removeEventListener("scroll", handleScroll);
    }
  }, [loading, selected]);

  const fetchChats = async (client_name = "") => {
    setLoading(true);
    try {
      const data = client_name ? await filterMaxChats(client_name) : await getMaxChats();
      setChats(
        (data.chats || []).map((chat) => ({
          id: chat.id,
          name: chat.name || chat.phone || t("maxMessenger.unknownContact"),
          last_message_data: chat.last_message_data || "",
          thumbnail: chat.thumbnail || "",
          unread_count: chat.unread_count || 0,
          type: chat.isGroup ? "group" : chat.participants?.some(p => p.is_bot) ? "bot" : "dialog",
        }))
      );
    } catch (error) {
      console.error("Failed to fetch chats:", error);
      alert(t("maxMessenger.failedFetchChats"));
      setChats([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (chat_id) => {
    setLoading(true);
    try {
      const data = await getMaxMessages(chat_id);
      setMessages(data || []);
    } catch (error) {
      console.error("Failed to fetch messages:", error);
      alert(t("maxMessenger.failedLoadMessages"));
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!inputValue.trim() || !selected) {
      alert(t("maxMessenger.selectChatAndMessage"));
      return;
    }
    try {
      await sendMaxMessage(selected, inputValue);
      setInputValue("");
      // Optimistically add message
      setMessages((prev) => [
        ...prev,
        { body: inputValue, fromMe: true, type: "text", time: new Date().toISOString() },
      ]);
      scrollToBottom();
      // Refresh messages
      fetchMessages(selected);
    } catch (error) {
      console.error("Failed to send message:", error);
      alert(t("maxMessenger.failedSendMessage"));
    }
  };

  const handleChatSelect = (chat_id) => {
    if (selected === chat_id) return;
    setSelected(chat_id);
    setMessages([]);
    fetchMessages(chat_id);
  };

  const handleFileUpload = (e, type) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setFileType(type);
      const reader = new FileReader();
      reader.onload = () => {
        const base64String = reader.result.split(",")[1]?.trim() || "";
        setBase64File(base64String);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSendFile = async () => {
    if (!selectedFile || !base64File || !selected || !fileType) {
      alert(t("maxMessenger.selectChatAndFile"));
      return;
    }
    try {
      await sendMaxFile(selected, selectedFile.name, base64File, fileType);
      setSelectedFile(null);
      setBase64File("");
      setFileType(null);
      setShowDialog(false);
      fetchMessages(selected); // Refresh messages
    } catch (error) {
      console.error("Failed to send file:", error);
      alert(t("maxMessenger.failedSendFile"));
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleScroll = () => {
    if (!messagesContainerRef.current || loading) return;
    const { scrollTop } = messagesContainerRef.current;

  };

  return (
    <div className="max-ui-container">
      <aside className="max-sidebar">
        <div className="max-sidebar-header">
          <span>{t("maxMessenger.chats")}</span>
          <BsFillPlusSquareFill className="max-add-chat" />
        </div>
        <div className="max-search-container">
          <input
            id="max-search-box"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t("maxMessenger.search")}
            className="max-search-box"
          />
        </div>
        <div className="max-contacts-list">
          {loading ? (
            <div>{t("maxMessenger.loading")}</div>
          ) : (
            chats.map(({ id, name, last_message_data, thumbnail, unread_count, type }) => (
              <div
                key={id}
                className={`max-contact-row${selected === id ? " max-active" : ""}`}
                onClick={() => handleChatSelect(id)}
              >
                <div className={`max-avatar ${type || "bot"}`} style={{ backgroundImage: thumbnail ? `url(${thumbnail})` : undefined }}></div>
                <div className="max-contact-info">
                  <div className="max-contact-details">
                    <div className="max-contact-title">{name}</div>
                    <div className="max-contact-preview">{last_message_data || t("maxMessenger.noMessages")}</div>
                  </div>
                  {unread_count > 0 && (
                    <span className="max-contact-time">{unread_count > 99 ? "99+" : unread_count}</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </aside>
      <main className="max-chat-main">
        {!selected ? (
          <div className="max-no-contact">{t("maxMessenger.selectContact")}</div>
        ) : (
          <>
            <div className="max-chat-header">
              <IoIosArrowBack className="max-back-btn" onClick={() => setSelected(null)} />
              <div className="max-chat-avatar max-avatar bot" />
              <div className="max-chat-name-area">
                <span className="max-chat-name">
                  {chats.find((c) => c.id === selected)?.name || t("maxMessenger.unknownContact")}
                </span>
                <span className="max-bot-label">{t("maxMessenger.bot")}</span>
              </div>
              <div className="max-spacer" />
              <FiSearch className="max-chat-header-btn" />
              <HiDotsVertical className="max-chat-header-btn" />
            </div>
            <div className="max-chat-content-area" ref={messagesContainerRef}>
              {loading ? (
                <div>{t("maxMessenger.loadingMessages")}</div>
              ) : (
                messages.map((msg, i) => (
                  <div
                    className={`max-chat-message ${msg.fromMe ? "max-sent" : ""}`}
                    key={i}
                  >
                    {msg.type === "image" && (
                      <img src={msg.src || msg.body} className="max-chat-image" alt="chat" />
                    )}
                    {msg.type === "video" && (
                      <video src={msg.src || msg.body} className="max-chat-image" controls />
                    )}
                    {msg.type === "document" && (
                      <a href={msg.src || msg.body} className="max-chat-image" download>
                        {msg.file_name || t("maxMessenger.documentFallback")}
                      </a>
                    )}
                    {msg.type === "text" && (
                      <span className="max-msg-text">{msg.body}</span>
                    )}
                    {msg.time && (
                      <span className="max-chat-time">
                        {formatTimeHHMM(msg.time)}
                      </span>
                    )}
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
            <form className="max-chat-input-bar" onSubmit={sendMessage}>
              <GrAttachment
                className="max-attach-btn"
                type="button"
                onClick={() => setShowDialog(!showDialog)}
              />
              <input
                type="text"
                placeholder={t("maxMessenger.messagePlaceholder")}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                className="max-input-text"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage(e);
                  }
                }}
              />
              <LuSticker className="max-sticker-btn" />
              <button className="max-send-btn" type="submit">
                <IoMdArrowUp />
              </button>
              {showDialog && (
                <div className="max-popup-menu">
                  <div className="max-popup-item">
                    <MdOutlinePhotoLibrary className="max-popup-icon" />
                    {t("maxMessenger.photo")}
                    <input
                      type="file"
                      accept="image/*"
                      className="max-hidden-file-input"
                      style={{ display: "none" }}
                      onChange={(e) => handleFileUpload(e, "image")}
                    />
                  </div>
                  <div className="max-popup-item">
                    <IoVideocamOutline className="max-popup-icon" />
                    {t("maxMessenger.video")}
                    <input
                      type="file"
                      accept="video/*"
                      className="max-hidden-file-input"
                      style={{ display: "none" }}
                      onChange={(e) => handleFileUpload(e, "video")}
                    />
                  </div>
                  <div className="max-popup-item">
                    <CiFileOn className="max-popup-icon" />
                    {t("maxMessenger.file")}
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.txt"
                      className="max-hidden-file-input"
                      style={{ display: "none" }}
                      onChange={(e) => handleFileUpload(e, "document")}
                    />
                  </div>
                  {selectedFile && (
                    <div className="max-popup-item">
                      <input
                        type="text"
                        value={selectedFile.name}
                        readOnly
                        className="max-file-name-input"
                      />
                      <button
                        className="max-send-btn"
                        type="button"
                        onClick={handleSendFile}
                      >
                        <IoMdArrowUp />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </form>
          </>
        )}
      </main>
    </div>
  );
}