import { FaEye, FaEyeSlash } from 'react-icons/fa';

function InputField({ type, placeholder, label, value, onChange, togglePassword, showPassword }) {
  return (
    <div className="input-field">
      <label>{label}</label>
      <div className="input-wrapper">
        <input
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          className="input-element"
        />
        {togglePassword && (
          <span
            onClick={togglePassword}
            className="toggle-password"
          >
            {showPassword ? <FaEyeSlash /> : <FaEye />}
          </span>
        )}
      </div>
    </div>
  );
}

export default InputField;