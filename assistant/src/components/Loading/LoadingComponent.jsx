import React from "react";
import "./LoadingComponent.css";

const LoadingComponent = ({ message = "Loading..." }) => (
  <div className="lc-wrapper">
    <div className="lc-spinner" />
    {message && <p className="lc-message">{message}</p>}
  </div>
);

export default LoadingComponent;
