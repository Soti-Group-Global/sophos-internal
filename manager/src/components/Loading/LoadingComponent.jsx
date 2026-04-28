import React, { useState, useEffect } from "react";
import "./LoadingComponent.css";

const LoadingComponent = ({ message = "Loading..." }) => {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 100);
    return () => clearInterval(id);
  }, []);

  const bars = Array.from({ length: 12 });

  return (
    <div className="lc-root">
      <div className="lc-scene">

        {/* Rotating ring */}
        <div className="lc-ring lc-ring--outer" />
        <div className="lc-ring lc-ring--mid" />
        <div className="lc-ring lc-ring--inner" />

        {/* Centre pulse circle */}
        <div className="lc-pulse">
          <svg viewBox="0 0 80 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="lc-ecg">
            <polyline
              points="0,20 10,20 16,8 22,32 28,14 34,26 40,20 46,20 52,4 58,36 64,20 80,20"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        {/* Orbit bars */}
        {bars.map((_, i) => (
          <div
            key={i}
            className="lc-bar"
            style={{
              transform: `rotate(${i * 30}deg) translateY(-52px)`,
              animationDelay: `${i * 0.08}s`,
            }}
          />
        ))}
      </div>

      {/* Shimmer text */}
      <p className="lc-text">{message}</p>

    
    </div>
  );
};

export default LoadingComponent;
