import React from "react";

const Button = ({ children, variant = "default", onClick, disabled, type = "button" }) => {
  const baseStyles = "px-4 py-2 rounded-md font-medium transition-colors";
  const variantStyles = {
    default: "bg-blue-600 text-white hover:bg-blue-700",
    outline: "border border-gray-300 hover:bg-gray-100",
  };

  return (
    <button
      type={type}
      className={`${baseStyles} ${variantStyles[variant]}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
};

export default Button;