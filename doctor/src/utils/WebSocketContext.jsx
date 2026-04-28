import React, { createContext, useContext, useEffect, useRef } from "react";

const WebSocketContext = createContext();

export const WebSocketProvider = ({ children }) => {
  const wsRef = useRef(null);

  useEffect(() => {
    // Use localhost for development, production URL for production
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'localhost:5002'
      : 'apidoctor.health-direct.ru';
    const wsUrl = `${wsProtocol}//${wsHost}`;

    const ws = new WebSocket(wsUrl);
  
    ws.onopen = () => {
      console.log("WebSocket connected to:", wsUrl);
    };
  
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      console.log("Received WS message:", msg);
    };
  
    ws.onerror = (err) => {
      console.error("WebSocket error:", err);
    };
  
    ws.onclose = () => {
      console.log("WebSocket disconnected from:", wsUrl);
    };

    wsRef.current = ws;
  
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
