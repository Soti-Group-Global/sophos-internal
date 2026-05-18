import React, { useState, useEffect } from "react";
import api from "../utils/api";
import { FiX } from "react-icons/fi";
import { FaArrowRight } from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "../styles/WhatsAppChatBot.css";
import MessagesContainer from "./MessagesContainer";

const WhatsAppChatBot = ({ isOpen, onClose, phoneNumber, profileId }) => {
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
      const token = api.defaults.headers.common["Authorization"]?.replace("Bearer ", "");
      const res = await fetch(
        `${import.meta.env.VITE_BASE_URL}/api/whatsapp/chat/messages?chat_id=${encodeURIComponent(
          phoneNumber
        )}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );
      if (res.status === 401) {
        toast.error("WhatsApp gateway not connected (401).");
        return;
      }
      if (!res.ok) throw new Error("Failed to fetch messages");
      const response = await res.json();
      if (!response || !Array.isArray(response) || response.length === 0) {
        setMessages([]);
        toast.info("No messages found", {
          position: "top-right",
          autoClose: 3000,
        });
      } else {
        setMessages(response.reverse());
      }
    } catch (error) {
      
      if (
        error.response?.status === 400 ||
        error.response?.status === 404 ||
        error.response?.data?.message?.includes("no messages")
      ) {
        setMessages([]);
        toast.info("No messages found", {
          position: "top-right",
          autoClose: 3000,
        });
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
      const token = api.defaults.headers.common["Authorization"]?.replace("Bearer ", "");
      const res = await fetch(
        `${import.meta.env.VITE_BASE_URL}/api/whatsapp/send`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ to: phoneNumber, message }),
        }
      );
      if (res.status === 401) {
        toast.error("WhatsApp gateway not connected (401).");
        return;
      }
      if (!res.ok) throw new Error("Failed to send");

      setMessages((prev) => [
        ...prev,
        {
          body: message,
          fromMe: true,
          type: "chat",
          time: Math.floor(Date.now() / 1000),
        },
      ]);
      toast.success("Message sent successfully!", {
        position: "top-right",
        autoClose: 3000,
      });
      setMessage("");
      fetchMessages();
    } catch (error) {
      
      toast.error(error.response?.data?.error || "Failed to send message!", {
        position: "top-right",
        autoClose: 3000,
      });
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="wa-chatbot-container"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.4, ease: "easeInOut" }}
        >
          <ToastContainer position="top-right" autoClose={3000} />
          <motion.div
            className="wa-chatbot-header"
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <span>Chat with {phoneNumber}</span>
            <FiX className="wa-chat-close-icon" onClick={onClose} />
          </motion.div>
          <div className="wa-messages-container">
            <MessagesContainer
              messages={messages}
              loading={loading}
              profileId={profileId}
              platform="whatsapp"
            />
          </div>
          <div className="wa-chatbot-footer">
            <input
              type="text"
              placeholder="Type a message..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            />
            <button onClick={sendMessage}>
              <FaArrowRight />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default WhatsAppChatBot;
