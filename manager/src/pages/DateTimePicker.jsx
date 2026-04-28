import { useState } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { useTranslation } from 'react-i18next';
import '../styles/DateTimePicker.css';

function DateTimePicker({ value, onChange, name, error, placeholder }) {
  const { t } = useTranslation('assistants');
  const [isOpen, setIsOpen] = useState(false);

  const handleChange = (date) => {
    onChange(name, date ? date.toISOString() : '');
    setIsOpen(false);
  };

  return (
    <div className="datetime-picker-container">
      <DatePicker
        selected={value ? new Date(value) : null}
        onChange={handleChange}
        onInputClick={() => setIsOpen(true)}
        open={isOpen}
        onClickOutside={() => setIsOpen(false)}
        showTimeSelect
        timeFormat="h:mm aa"
        timeIntervals={60}
        timeCaption="Time"
        dateFormat="MMM d, yyyy h:mm aa"
        placeholderText={placeholder}
        className={`form-input ${error ? 'error' : ''}`}
        minDate={new Date()}
        popperClassName="datetime-picker-popper"
        style={{ width: '100%' }}
      />
      {isOpen && (
        <button
          className="datetime-picker-close-btn"
          onClick={() => setIsOpen(false)}
          title={t('cancel')}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
      {error && <span className="field-error">{error}</span>}
    </div>
  );
}

export default DateTimePicker;