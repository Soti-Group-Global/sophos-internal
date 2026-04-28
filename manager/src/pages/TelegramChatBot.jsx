import React, { useState, useEffect } from "react";
import { FiX } from "react-icons/fi";
import { FaTelegramPlane } from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "../styles/TelegramChatBot.css";
import TelegramMessagesContainer from "./TelegramMessagesContainer";
import { getTelegramMessages, sendTelegramMessage } from "../utils/api";

const TelegramChatBot = ({ isOpen, onClose, phoneNumber, profileId }) => {
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && phoneNumber && profileId) {
      fetchMessages();
    }
  }, [isOpen, phoneNumber, profileId]);

  const fetchMessages = async () => {
    setLoading(true);
    try {
      const response = await getTelegramMessages(phoneNumber, profileId);
      if (!response || !Array.isArray(response) || response.length === 0) {
        setMessages([]);
        toast.info("No messages found", { position: "top-right", autoClose: 3000 });
      } else {
        setMessages(response.reverse());
      }
    } catch (error) {
      if (error.response?.status === 400 || error.response?.status === 404 || error.response?.data?.message?.includes("no messages")) {
        setMessages([]);
        toast.info("No messages found", { position: "top-right", autoClose: 3000 });
      } else {
        toast.error(error.response?.data?.error || "Failed to load messages!", {
          position: "top-right",
          autoClose: 3000,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!message.trim()) return;
    try {
      await sendTelegramMessage(phoneNumber, message);
      setMessages((prev) => [
        ...prev,
        { body: message, fromMe: true, type: "chat", time: Math.floor(Date.now() / 1000) },
      ]);
      toast.success("Message sent successfully!", { position: "top-right", autoClose: 3000 });
      setMessage("");
      fetchMessages();
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to send message!", {
        position: "top-right",
        autoClose: 3000,
      });
      if (error.response?.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("userEmail");
        onClose();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="tg-chatbot">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="tg-chatbot-container"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
          >
            <ToastContainer position="top-right" autoClose={3000} />
            <motion.div
              className="tg-chatbot-header"
              initial={{ y: -50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -50, opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <span>Chat with {phoneNumber}</span>
              <FiX className="tg-chat-close-icon" onClick={onClose} />
            </motion.div>
            <div className="tg-messages-container">
              <TelegramMessagesContainer
                messages={messages}
                loading={loading}
                profileId={profileId}
                selectedChat={phoneNumber}
              />
            </div>
            <div className="tg-chatbot-footer">
              <input
                type="text"
                placeholder="Type a message..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              />
              <button onClick={sendMessage}>
                <FaTelegramPlane />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TelegramChatBot;