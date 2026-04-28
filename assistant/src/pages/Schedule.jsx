import React, { useState, useEffect } from "react";
import { FiCopy, FiPlus, FiX, FiCheck, FiTrash2 } from "react-icons/fi";
import "../styles/Schedule.css";
import { getAssistantAvailability, postAssistantAvailability, deleteAssistantAvailability } from "../utils/api";
import { useTranslation } from "react-i18next";
import "react-toastify/dist/ReactToastify.css";
import { ToastContainer, toast } from "react-toastify";

const Schedule = () => {
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copySourceId, setCopySourceId] = useState(null);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [copyOptions, setCopyOptions] = useState({
    sameWeekday: false,
    allFollowing: false,
    customDays: []
  });
  const { t, i18n } = useTranslation();

  const [removeOptions, setRemoveOptions] = useState({ // Add this line
    sameWeekday: false,
    allFollowing: false,
    customDays: []
  });

  useEffect(() => {
    initializeDays();
  }, []);

  const initializeDays = async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const next30Days = Array.from({ length: 30 }, (_, i) => {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      return {
        id: i,
        date,
        dateString: date.toDateString(),
        isAvailable: false,
        slots: []
      };
    });

    try {
      const startDate = new Date(today);
      const endDate = new Date(today);
      endDate.setDate(endDate.getDate() + 30);
      
      const availabilityData = await getAssistantAvailability(startDate.toISOString(), endDate.toISOString());
      
      const updatedDays = next30Days.map(day => {
        const dayAvailability = availabilityData.filter(a => 
          new Date(a.start).toDateString() === day.dateString
        );
        
        if (dayAvailability.length > 0) {
          return {
            ...day,
            isAvailable: true,
            slots: dayAvailability.map(slot => ({
              _id: slot._id,
              from: new Date(slot.start).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit' }),
              to: new Date(slot.end).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit' })              
            }))
          };
        }
        return day;
      });
      
      setDays(updatedDays);
    } catch (err) {
      console.error("Error loading availability", err);
      setDays(next30Days);
    } finally {
      setLoading(false);
    }
  };

  const toggleAvailability = (dayId) => {
    setDays(days.map(day => {
      if (day.id === dayId) {
        const newAvailability = !day.isAvailable;
        return {
          ...day,
          isAvailable: newAvailability,
          slots: newAvailability && day.slots.length === 0 
            ? [{ from: "09:00", to: "17:00" }] 
            : newAvailability ? day.slots : []
        };
      }
      return day;
    }));
  };

  const addSlot = (dayId) => {
    setDays(days.map(day => 
      day.id === dayId 
        ? { ...day, slots: [...day.slots, { from: "09:00", to: "17:00" }] } 
        : day
    ));
  };

  const updateSlot = (dayId, slotIndex, field, value) => {
    const [hour, minute] = value.split(":").map(Number);

    const totalMinutes = hour * 60 + minute;

    const minMinutes = 9 * 60;
    const maxMinutes = 21 * 60;

    if (totalMinutes < minMinutes || totalMinutes > maxMinutes) {
      toast.error("Time must be between 09:00 and 21:00");
      return;
    }

    setDays(days.map(day => {
      if (day.id === dayId) {
        const updatedSlots = [...day.slots];
        updatedSlots[slotIndex][field] = value;
        return { ...day, slots: updatedSlots };
      }
      return day;
    }));
  };

  const removeSlot = (dayId, slotIndex) => {
    setDays(days.map(day => {
      if (day.id === dayId) {
        const updatedSlots = day.slots.filter((_, i) => i !== slotIndex);
        return {
          ...day,
          slots: updatedSlots,
          isAvailable: updatedSlots.length > 0
        };
      }
      return day;
    }));
  };

  const saveAvailability = async () => {
    try {
      const startDate = new Date(days[0].date);
      const endDate = new Date(days[days.length - 1].date);
      endDate.setHours(23, 59, 59, 999);
  
      const existingAvailability = await getAssistantAvailability(startDate.toISOString(), endDate.toISOString());
  
      const existingTimeSlotsMap = new Map();
      existingAvailability.forEach(slot => {
        const key = `${new Date(slot.start).toISOString()}|${new Date(slot.end).toISOString()}`;
        existingTimeSlotsMap.set(key, slot._id);
      });
  
      const currentTimeSlots = new Set();
      const newSlots = [];
  
      days.forEach(day => {
        if (!day.isAvailable || day.slots.length === 0) return;
  
        day.slots.forEach(slot => {
          const [fromH, fromM] = slot.from.split(":").map(Number);
          const [toH, toM] = slot.to.split(":").map(Number);
  
          // ✅ Construct local datetime correctly (avoids timezone offset issues)
          const start = new Date(
            day.date.getFullYear(),
            day.date.getMonth(),
            day.date.getDate(),
            fromH,
            fromM,
            0,
            0
          );
  
          const end = new Date(
            day.date.getFullYear(),
            day.date.getMonth(),
            day.date.getDate(),
            toH,
            toM,
            0,
            0
          );
  
          const key = `${start.toISOString()}|${end.toISOString()}`;
          currentTimeSlots.add(key);
  
          if (!existingTimeSlotsMap.has(key)) {
            newSlots.push({ start, end, status: "Available" });
          }
        });
      });
  
      // Determine deleted slots
      const deletedSlots = existingAvailability.filter(slot => {
        const key = `${new Date(slot.start).toISOString()}|${new Date(slot.end).toISOString()}`;
        return !currentTimeSlots.has(key);
      });
  
      // Perform deletes and posts
      await Promise.all(deletedSlots.map(slot => deleteAssistantAvailability(slot._id)));
      await Promise.all(newSlots.map(slot => postAssistantAvailability(slot)));
  
      toast.success("Availability updated!");
      await initializeDays(); // Refresh
    } catch (err) {
      console.error("Error saving availability", err);
      toast.error("Failed to save availability.");
    }
  };
  
  
  const openCopyModal = (dayId) => {
    setCopySourceId(dayId);
    setShowCopyModal(true);
    setCopyOptions({
      sameWeekday: false,
      allFollowing: false,
      customDays: []
    });
  };

  const closeCopyModal = () => {
    setShowCopyModal(false);
  };

  const handleCopyOptionChange = (option) => {
    if (option === 'sameWeekday' || option === 'allFollowing') {
      setCopyOptions({
        ...copyOptions,
        [option]: !copyOptions[option],
        customDays: []
      });
    } else {
      setCopyOptions({
        ...copyOptions,
        sameWeekday: false,
        allFollowing: false,
        customDays: copyOptions.customDays.includes(option)
          ? copyOptions.customDays.filter(d => d !== option)
          : [...copyOptions.customDays, option]
      });
    }
  };

  const applyCopy = () => {
    if (copySourceId === null) return;
    
    const sourceDay = days.find(d => d.id === copySourceId);
    if (!sourceDay?.isAvailable || sourceDay.slots.length === 0) {
      alert("No availability to copy");
      return;
    }

    const sourceDayOfWeek = sourceDay.date.getDay();
    let daysToUpdate = [];

    if (copyOptions.sameWeekday) {
      daysToUpdate = days
        .filter(d => d.id > copySourceId && d.date.getDay() === sourceDayOfWeek)
        .map(d => d.id);
    } else if (copyOptions.allFollowing) {
      daysToUpdate = days
        .filter(d => d.id > copySourceId)
        .map(d => d.id);
    } else if (copyOptions.customDays.length > 0) {
      daysToUpdate = days
        .filter(d => d.id > copySourceId && copyOptions.customDays.includes(d.date.getDay()))
        .map(d => d.id);
    } else {
      alert("Please select at least one copy option");
      return;
    }

    setDays(days.map(day => {
      if (daysToUpdate.includes(day.id)) {
        return {
          ...day,
          isAvailable: true,
          slots: JSON.parse(JSON.stringify(sourceDay.slots))
        };
      }
      return day;
    }));

    closeCopyModal();
  };

  const formatDayName = (dayIndex) => {
    const days = [
      t('schedule.days.sunday'),
      t('schedule.days.monday'),
      t('schedule.days.tuesday'),
      t('schedule.days.wednesday'),
      t('schedule.days.thursday'),
      t('schedule.days.friday'),
      t('schedule.days.saturday')
    ];
    return days[dayIndex];
  };

  const formatShortDayName = (dayIndex) => {
    const days = [
      t('schedule.daysShort.sun'),
      t('schedule.daysShort.mon'),
      t('schedule.daysShort.tue'),
      t('schedule.daysShort.wed'),
      t('schedule.daysShort.thu'),
      t('schedule.daysShort.fri'),
      t('schedule.daysShort.sat')
    ];
    return days[dayIndex];
  };


  const openRemoveModal = (dayId) => {
    setCopySourceId(dayId);
    setShowRemoveModal(true);
    setRemoveOptions({
      sameWeekday: false,
      allFollowing: false,
      customDays: []
    });
  };

  const closeRemoveModal = () => {
    setShowRemoveModal(false);
  };

  const handleRemoveOptionChange = (option) => {
    if (option === 'sameWeekday' || option === 'allFollowing') {
      setRemoveOptions({
        ...removeOptions,
        [option]: !removeOptions[option],
        customDays: []
      });
    } else {
      setRemoveOptions({
        ...removeOptions,
        sameWeekday: false,
        allFollowing: false,
        customDays: removeOptions.customDays.includes(option)
          ? removeOptions.customDays.filter(d => d !== option)
          : [...removeOptions.customDays, option]
      });
    }
  };

  const applyRemove = () => {
    if (copySourceId === null) return;
    
    let daysToUpdate = [];

    if (removeOptions.sameWeekday) {
      const sourceDay = days.find(d => d.id === copySourceId);
      const sourceDayOfWeek = sourceDay.date.getDay();
      daysToUpdate = days
        .filter(d => d.id >= copySourceId && d.date.getDay() === sourceDayOfWeek)
        .map(d => d.id);
    } else if (removeOptions.allFollowing) {
      daysToUpdate = days
        .filter(d => d.id >= copySourceId)
        .map(d => d.id);
    } else if (removeOptions.customDays.length > 0) {
      daysToUpdate = days
        .filter(d => d.id >= copySourceId && removeOptions.customDays.includes(d.date.getDay()))
        .map(d => d.id);
    } else {
      // If no options selected, just remove the current day
      daysToUpdate = [copySourceId];
    }

    setDays(days.map(day => {
      if (daysToUpdate.includes(day.id)) {
        return {
          ...day,
          isAvailable: false,
          slots: []
        };
      }
      return day;
    }));

    closeRemoveModal();
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>{t('schedule.loading')}</p>
      </div>
    );
  }

  return (
    <div className="schedule-container">
    <ToastContainer position="top-right" autoClose={3000} />

    <header className="schedule-header">
      <h1>{t('schedule.title')}</h1>
      <p>{t('schedule.subtitle')}</p>
    </header>

    <div className="days-list">
      {days.map(day => (
        <div key={day.id} className={`day-card ${day.isAvailable ? 'available' : ''}`}>
          <div className="day-header">
            <div className="date-info">
              <span className="weekday">
                {formatShortDayName(day.date.getDay())}
              </span>
              <span className="date">
                {day.date.toLocaleDateString(i18n.language, { 
                  month: 'short', 
                  day: 'numeric' 
                })}
              </span>
            </div>

            <div className="day-actions">
              <label className="availability-toggle">
                <input
                  type="checkbox"
                  checked={day.isAvailable}
                  onChange={() => toggleAvailability(day.id)}
                />
                <span className="toggle-slider"></span>
                <span className="toggle-label">
                  {day.isAvailable ? t('schedule.available') : t('schedule.unavailable')}
                </span>
              </label>

              {day.isAvailable && (
                <div className="action-buttons">
                  <button 
                    className="copy-button"
                    onClick={() => openCopyModal(day.id)}
                  >
                    <FiCopy className="icon" />
                    {t('schedule.copy')}
                  </button>
                  <button 
                    className="remove-button"
                    onClick={() => openRemoveModal(day.id)}
                  >
                    <FiTrash2 className="icon" />
                    {t('schedule.remove')}
                  </button>
                </div>
              )}
            </div>
          </div>

          {day.isAvailable && (
            <div className="time-slots-container">
              <div className="time-slots">
                {day.slots.map((slot, slotIndex) => (
                  <div key={slotIndex} className="time-slot">
                    <input
                      type="time"
                      min="09:00"
                      max="21:00"
                      value={slot.from}
                      onChange={(e) => updateSlot(day.id, slotIndex, 'from', e.target.value)}
                      className="time-input"
                    />
                    <span className="time-separator">
                      {t('schedule.to')}
                    </span>
                    <input
                      type="time"
                      lang="en-GB"
                      min="09:00"
                      max="21:00"
                      value={slot.to}
                      onChange={(e) => updateSlot(day.id, slotIndex, 'to', e.target.value)}
                      className="time-input"
                    />
                    <button
                      className="remove-slot-button"
                      onClick={() => removeSlot(day.id, slotIndex)}
                      disabled={day.slots.length === 1}
                    >
                      <FiX className="icon" />
                    </button>
                  </div>
                ))}
              </div>
              <button 
                className="add-slot-button"
                onClick={() => addSlot(day.id)}
              >
                <FiPlus className="icon" />
                {t('schedule.addSlot')}
              </button>
            </div>
          )}
        </div>
      ))}
    </div>

    {showRemoveModal && (
      <div className="modal-overlay">
        <div className="copy-modal">
          <div className="modal-header">
            <h3>{t('schedule.removeModal.title')}</h3>
          
          </div>

          <div className="modal-content">
            <div className="copy-option">
              <label className="option-checkbox">
                <input
                  type="checkbox"
                  checked={removeOptions.sameWeekday}
                  onChange={() => handleRemoveOptionChange('sameWeekday')}
                />
                <span className="checkmark"></span>
                <span className="option-label">
                  {t('schedule.removeModal.sameWeekday', {
                    day: formatDayName(days.find(d => d.id === copySourceId)?.date.getDay())
                  })}
                </span>
              </label>
            </div>

            <div className="copy-option">
              <label className="option-checkbox">
                <input
                  type="checkbox"
                  checked={removeOptions.allFollowing}
                  onChange={() => handleRemoveOptionChange('allFollowing')}
                />
                <span className="checkmark"></span>
                <span className="option-label">
                  {t('schedule.removeModal.allFollowing')}
                </span>
              </label>
            </div>

            <div className="copy-option">
              <div className="option-label">
                {t('schedule.removeModal.customDays')}:
              </div>
              <div className="day-selector">
                {[0, 1, 2, 3, 4, 5, 6].map(dayIndex => (
                  <button
                    key={dayIndex}
                    className={`day-pill ${removeOptions.customDays.includes(dayIndex) ? 'selected' : ''}`}
                    onClick={() => handleRemoveOptionChange(dayIndex)}
                  >
                    {formatShortDayName(dayIndex)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="modal-actions">
            <button className="cancel-button" onClick={closeRemoveModal}>
              {t('schedule.cancel')}
            </button>
            <button className="apply-button remove" onClick={applyRemove}>
              <FiTrash2 className="icon" />
              {t('schedule.remove')}
            </button>
          </div>
        </div>
      </div>
    )}

    {showCopyModal && (
      <div className="modal-overlay">
        <div className="copy-modal">
          <div className="modal-header">
            <h3>{t('schedule.copyModal.title')}</h3>
            
          </div>

          <div className="modal-content">
            <div className="copy-option">
              <label className="option-checkbox">
                <input
                  type="checkbox"
                  checked={copyOptions.sameWeekday}
                  onChange={() => handleCopyOptionChange('sameWeekday')}
                />
                <span className="checkmark"></span>
                <span className="option-label">
                  {t('schedule.copyModal.sameWeekday', {
                    day: formatDayName(days.find(d => d.id === copySourceId)?.date.getDay())
                  })}
                </span>
              </label>
            </div>

            <div className="copy-option">
              <label className="option-checkbox">
                <input
                  type="checkbox"
                  checked={copyOptions.allFollowing}
                  onChange={() => handleCopyOptionChange('allFollowing')}
                />
                <span className="checkmark"></span>
                <span className="option-label">
                  {t('schedule.copyModal.allFollowing')}
                </span>
              </label>
            </div>

            <div className="copy-option">
              <div className="option-label">
                {t('schedule.copyModal.customDays')}:
              </div>
              <div className="day-selector">
                {[0, 1, 2, 3, 4, 5, 6].map(dayIndex => (
                  <button
                    key={dayIndex}
                    className={`day-pill ${copyOptions.customDays.includes(dayIndex) ? 'selected' : ''}`}
                    onClick={() => handleCopyOptionChange(dayIndex)}
                  >
                    {formatShortDayName(dayIndex)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="modal-actions">
            <button className="cancel-button" onClick={closeCopyModal}>
              {t('schedule.cancel')}
            </button>
            <button className="apply-button" onClick={applyCopy}>
              <FiCheck className="icon" />
              {t('schedule.apply')}
            </button>
          </div>
        </div>
      </div>
    )}

    <div className="save-section">
      <button className="save-button" onClick={saveAvailability}>
        {t('schedule.saveChanges')}
      </button>
    </div>
  </div>
  );
};

export default Schedule;