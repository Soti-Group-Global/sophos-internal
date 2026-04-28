import React, { createContext, useContext, useEffect, useRef } from "react";

const WebSocketContext = createContext();

export const WebSocketProvider = ({ children }) => {
  const wsRef = useRef(null);

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:5001");
  
    ws.onopen = () => {};
  
    ws.onmessage = () => {};
  
    ws.onerror = (err) => {
      console.error("WebSocket error:", err);
    };
  
    ws.onclose = () => {};
  
    return () => {
      ws.close();
    };
  }, []);
  

  return (
    <WebSocketContext.Provider value={wsRef.current}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => useContext(WebSocketContext);
