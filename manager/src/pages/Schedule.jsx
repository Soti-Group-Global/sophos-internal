import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  FiCopy,
  FiPlus,
  FiX,
  FiCheck,
  FiTrash2,
  FiArrowLeft,
  FiClock,
  FiCalendar,
  FiSave,
} from "react-icons/fi";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";
import {
  getDoctorByEmail,
  getAvailability,
  postAvailability,
  deleteAvailability,
} from "../utils/api";
import "../styles/Schedule.css";

const Schedule = ({ email: emailProp }) => {
  const { t } = useTranslation("schedule");
  const params = useParams();
  const email = emailProp || params.email;
  const [doctor, setDoctor] = useState(null);
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copySourceId, setCopySourceId] = useState(null);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [copyOptions, setCopyOptions] = useState({
    sameWeekday: false,
    allFollowing: false,
    customDays: [],
  });
  const [removeOptions, setRemoveOptions] = useState({
    sameWeekday: false,
    allFollowing: false,
    customDays: [],
  });
  const navigate = useNavigate();

  useEffect(() => {
    if (!email) {
      toast.error(t("error_invalid_email"));
      setLoading(false);
      navigate("/doctors");
      return;
    }

    const fetchDoctorAndAvailability = async () => {
      try {
        const doctorResponse = await getDoctorByEmail(email);
        if (!doctorResponse.data.doctor) {
          throw new Error("Doctor not found");
        }
        setDoctor(doctorResponse.data.doctor);
        await initializeDays(doctorResponse.data.doctor.email);
      } catch (error) {
        toast.error(t("error_fetch_doctor"));
        navigate("/doctors");
      }
    };
    fetchDoctorAndAvailability();
  }, [email, navigate, t]);

  const initializeDays = async (doctorEmail) => {
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
        slots: [],
      };
    });

    try {
      const startDate = new Date(today);
      const endDate = new Date(today);
      endDate.setDate(endDate.getDate() + 30);
      endDate.setHours(23, 59, 59, 999);

      const availabilityResponse = await getAvailability(
        doctorEmail.toLowerCase(),
        startDate.toISOString(),
        endDate.toISOString()
      );

      const availabilityData = Array.isArray(availabilityResponse)
        ? availabilityResponse
        : [];

      if (!Array.isArray(availabilityResponse)) {
        toast.warn(t("warn_invalid_availability"));
      }

      const updatedDays = next30Days.map((day) => {
        const dayAvailability = availabilityData.filter(
          (a) => new Date(a.start).toDateString() === day.dateString
        );

        if (dayAvailability.length > 0) {
          return {
            ...day,
            isAvailable: true,
            slots: dayAvailability.map((slot) => ({
              _id: slot._id,
              from: new Date(slot.start).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              }),
              to: new Date(slot.end).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              }),
            })),
          };
        }
        return day;
      });

      setDays(updatedDays);
    } catch (err) {
      toast.error(t("error_fetch_availability"));
      setDays(next30Days);
    } finally {
      setLoading(false);
    }
  };

  const toggleAvailability = (dayId) => {
    setDays(
      days.map((day) => {
        if (day.id === dayId) {
          const newAvailability = !day.isAvailable;
          return {
            ...day,
            isAvailable: newAvailability,
            slots:
              newAvailability && day.slots.length === 0
                ? [{ from: "09:00", to: "17:00" }]
                : newAvailability
                ? day.slots
                : [],
          };
        }
        return day;
      })
    );
  };

  const addSlot = (dayId) => {
    setDays(
      days.map((day) =>
        day.id === dayId
          ? { ...day, slots: [...day.slots, { from: "09:00", to: "17:00" }] }
          : day
      )
    );
  };

  const updateSlot = (dayId, slotIndex, field, value) => {
    setDays(
      days.map((day) => {
        if (day.id === dayId) {
          const updatedSlots = [...day.slots];
          updatedSlots[slotIndex][field] = value;
          return { ...day, slots: updatedSlots };
        }
        return day;
      })
    );
  };

  const removeSlot = (dayId, slotIndex) => {
    setDays(
      days.map((day) => {
        if (day.id === dayId) {
          const updatedSlots = day.slots.filter((_, i) => i !== slotIndex);
          return {
            ...day,
            slots: updatedSlots,
            isAvailable: updatedSlots.length > 0,
          };
        }
        return day;
      })
    );
  };

  const saveAvailability = async () => {
    try {
      if (!doctor?.email) {
        throw new Error(t("error_no_doctor_email"));
      }

      const startDate = new Date(days[0].date);
      const endDate = new Date(days[days.length - 1].date);
      endDate.setHours(23, 59, 59, 999);

      let existingAvailability = [];
      try {
        existingAvailability = await getAvailability(
          doctor.email.toLowerCase(),
          startDate.toISOString(),
          endDate.toISOString()
        );
        if (!Array.isArray(existingAvailability)) {
          existingAvailability = [];
        }
      } catch (err) {
        existingAvailability = [];
      }

      const existingSlots = new Set(
        existingAvailability.map(
          (slot) => `${slot.start}_${slot.end}_${slot._id}`
        )
      );

      const slotsToDelete = [];
      const slotsToAdd = [];

      days.forEach((day) => {
        if (!day.isAvailable || day.slots.length === 0) {
          const daySlots = existingAvailability.filter(
            (slot) => new Date(slot.start).toDateString() === day.dateString
          );
          slotsToDelete.push(
            ...daySlots.map((slot) => ({
              id: slot._id,
              email: doctor.email.toLowerCase(),
            }))
          );
        } else {
          day.slots.forEach((slot) => {
            const [fromH, fromM] = slot.from.split(":").map(Number);
            const [toH, toM] = slot.to.split(":").map(Number);

            const start = new Date(day.date);
            start.setHours(fromH, fromM, 0, 0);

            const end = new Date(day.date);
            end.setHours(toH, toM, 0, 0);

            const slotKey = `${start.toISOString()}_${end.toISOString()}`;
            const slotKeyWithId = Array.from(existingSlots).find((key) =>
              key.startsWith(slotKey)
            );

            if (!slotKeyWithId) {
              slotsToAdd.push({
                start: start.toISOString(),
                end: end.toISOString(),
                status: "Available",
              });
            }
          });
        }
      });

      existingAvailability.forEach((slot) => {
        const slotKey = `${slot.start}_${slot.end}`;
        const isStillPresent = days.some(
          (day) =>
            day.isAvailable &&
            day.slots.some((s) => {
              const [fromH, fromM] = s.from.split(":").map(Number);
              const [toH, toM] = s.to.split(":").map(Number);
              const start = new Date(day.date);
              start.setHours(fromH, fromM, 0, 0);
              const end = new Date(day.date);
              end.setHours(toH, toM, 0, 0);
              return (
                start.toISOString() === slot.start &&
                end.toISOString() === slot.end
              );
            })
        );
        if (!isStillPresent) {
          slotsToDelete.push({
            id: slot._id,
            email: doctor.email.toLowerCase(),
          });
        }
      });

      if (slotsToDelete.length > 0) {
        await Promise.all(
          slotsToDelete.map(async ({ id, email }) => {
            try {
              await deleteAvailability(id, email);
            } catch (err) {
              
            }
          })
        );
      }

      if (slotsToAdd.length > 0) {
        await Promise.all(
          slotsToAdd.map(async (slot) => {
            try {
              await postAvailability(doctor.email.toLowerCase(), slot);
            } catch (err) {
              
            }
          })
        );
      }

      await initializeDays(doctor.email.toLowerCase());
      toast.success(t("success_save"));
    } catch (err) {
      
      toast.error(t("error_save"));
    }
  };

  const openCopyModal = (dayId) => {
    setCopySourceId(dayId);
    setShowCopyModal(true);
    setCopyOptions({
      sameWeekday: false,
      allFollowing: false,
      customDays: [],
    });
  };

  const closeCopyModal = () => {
    setShowCopyModal(false);
  };

  const handleCopyOptionChange = (option) => {
    if (option === "sameWeekday" || option === "allFollowing") {
      setCopyOptions({
        ...copyOptions,
        [option]: !copyOptions[option],
        customDays: [],
      });
    } else {
      setCopyOptions({
        ...copyOptions,
        sameWeekday: false,
        allFollowing: false,
        customDays: copyOptions.customDays.includes(option)
          ? copyOptions.customDays.filter((d) => d !== option)
          : [...copyOptions.customDays, option],
      });
    }
  };

  const applyCopy = () => {
    if (copySourceId === null) return;

    const sourceDay = days.find((d) => d.id === copySourceId);
    if (!sourceDay?.isAvailable || sourceDay.slots.length === 0) {
      toast.error(t("error_no_availability"));
      return;
    }

    const sourceDayOfWeek = sourceDay.date.getDay();
    let daysToUpdate = [];

    if (copyOptions.sameWeekday) {
      daysToUpdate = days
        .filter(
          (d) => d.id > copySourceId && d.date.getDay() === sourceDayOfWeek
        )
        .map((d) => d.id);
    } else if (copyOptions.allFollowing) {
      daysToUpdate = days.filter((d) => d.id > copySourceId).map((d) => d.id);
    } else if (copyOptions.customDays.length > 0) {
      daysToUpdate = days
        .filter(
          (d) =>
            d.id > copySourceId &&
            copyOptions.customDays.includes(d.date.getDay())
        )
        .map((d) => d.id);
    } else {
      toast.error(t("error_no_copy_option"));
      return;
    }

    setDays(
      days.map((day) => {
        if (daysToUpdate.includes(day.id)) {
          return {
            ...day,
            isAvailable: true,
            slots: JSON.parse(JSON.stringify(sourceDay.slots)),
          };
        }
        return day;
      })
    );

    closeCopyModal();
  };

  const formatDayName = (dayIndex) => {
    return t(`day_${dayIndex}`);
  };

  const openRemoveModal = (dayId) => {
    setCopySourceId(dayId);
    setShowRemoveModal(true);
    setRemoveOptions({
      sameWeekday: false,
      allFollowing: false,
      customDays: [],
    });
  };

  const closeRemoveModal = () => {
    setShowRemoveModal(false);
  };

  const handleRemoveOptionChange = (option) => {
    if (option === "sameWeekday" || option === "allFollowing") {
      setRemoveOptions({
        ...removeOptions,
        [option]: !removeOptions[option],
        customDays: [],
      });
    } else {
      setRemoveOptions({
        ...removeOptions,
        sameWeekday: false,
        allFollowing: false,
        customDays: removeOptions.customDays.includes(option)
          ? removeOptions.customDays.filter((d) => d !== option)
          : [...removeOptions.customDays, option],
      });
    }
  };

  const applyRemove = () => {
    if (copySourceId === null) return;

    let daysToUpdate = [];

    if (removeOptions.sameWeekday) {
      const sourceDay = days.find((d) => d.id === copySourceId);
      const sourceDayOfWeek = sourceDay.date.getDay();
      daysToUpdate = days
        .filter(
          (d) => d.id >= copySourceId && d.date.getDay() === sourceDayOfWeek
        )
        .map((d) => d.id);
    } else if (removeOptions.allFollowing) {
      daysToUpdate = days.filter((d) => d.id >= copySourceId).map((d) => d.id);
    } else if (removeOptions.customDays.length > 0) {
      daysToUpdate = days
        .filter(
          (d) =>
            d.id >= copySourceId &&
            removeOptions.customDays.includes(d.date.getDay())
        )
        .map((d) => d.id);
    } else {
      daysToUpdate = [copySourceId];
    }

    setDays(
      days.map((day) => {
        if (daysToUpdate.includes(day.id)) {
          return {
            ...day,
            isAvailable: false,
            slots: [],
          };
        }
        return day;
      })
    );

    closeRemoveModal();
  };

  if (loading) {
    return (
      <div className="modern-loading-container">
        <div className="modern-spinner"></div>
        <p>{t("loading")}</p>
      </div>
    );
  }

  return (
    <div className="modern-schedule-container">
      {/* Header */}
      <div className="modern-schedule-header">
        <div className="modern-header-content">
          <button className="modern-back-button" onClick={() => navigate(-1)}>
            <FiArrowLeft className="modern-icon" />
            {t("back")}
          </button>

          <div className="modern-doctor-info">
            <div className="modern-doctor-avatar">
              {doctor?.firstName?.[0]}
              {doctor?.lastName?.[0]}
            </div>
            <div className="modern-doctor-details">
              <h1 className="modern-doctor-name">
                Dr. {doctor?.firstName} {doctor?.lastName}
              </h1>
              <p className="modern-doctor-email">{doctor?.email}</p>
            </div>
          </div>
        </div>
        {/*
        <div className="modern-header-stats">
          <div className="modern-stat">
            <FiCalendar className="modern-stat-icon" />
            <span className="modern-stat-value">
              {days.filter(d => d.isAvailable).length}
            </span>
            <span className="modern-stat-label">{t("available_days")}</span>
          </div>
          <div className="modern-stat">
            <FiClock className="modern-stat-icon" />
            <span className="modern-stat-value">
              {days.reduce((total, day) => total + day.slots.length, 0)}
            </span>
            <span className="modern-stat-label">{t("time_slots")}</span>
          </div>
        </div>
        */}
      </div>

      {/* Schedule Grid */}
      <div className="modern-schedule-grid">
        {days.map((day) => (
          <div
            key={day.id}
            className={`modern-day-card ${
              day.isAvailable ? "modern-available" : "modern-unavailable"
            }`}
          >
            <div className="modern-day-header">
              <div className="modern-date-info">
                <span className="modern-weekday">
                  {day.date.toLocaleDateString(undefined, { weekday: "long" })}
                </span>
                <span className="modern-date">
                  {day.date.toLocaleDateString(undefined, {
                    month: "long",
                    day: "numeric",
                  })}
                </span>
              </div>

              <div className="modern-day-controls">
                <label className="modern-toggle">
                  <input
                    type="checkbox"
                    checked={day.isAvailable}
                    onChange={() => toggleAvailability(day.id)}
                  />
                  <span className="modern-toggle-slider"></span>
                </label>

                {day.isAvailable && (
                  <div className="modern-day-actions">
                    <button
                      className="modern-action-btn modern-copy-btn"
                      onClick={() => openCopyModal(day.id)}
                      title={t("copy")}
                    >
                      <FiCopy />
                    </button>
                    <button
                      className="modern-action-btn modern-remove-btn"
                      onClick={() => openRemoveModal(day.id)}
                      title={t("remove")}
                    >
                      <FiTrash2 />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {day.isAvailable && (
              <div className="modern-time-slots">
                <div className="modern-slots-list">
                  {day.slots.map((slot, slotIndex) => (
                    <div key={slotIndex} className="modern-time-slot">
                      <div className="modern-time-inputs">
                        <input
                          type="time"
                          value={slot.from}
                          onChange={(e) =>
                            updateSlot(
                              day.id,
                              slotIndex,
                              "from",
                              e.target.value
                            )
                          }
                          className="modern-time-input"
                        />
                        <span className="modern-time-separator">-</span>
                        <input
                          type="time"
                          value={slot.to}
                          onChange={(e) =>
                            updateSlot(day.id, slotIndex, "to", e.target.value)
                          }
                          className="modern-time-input"
                        />
                      </div>
                      <button
                        className="modern-remove-slot-btn"
                        onClick={() => removeSlot(day.id, slotIndex)}
                        disabled={day.slots.length === 1}
                        title={t("remove_slot")}
                      >
                        <FiX />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  className="modern-add-slot-btn"
                  onClick={() => addSlot(day.id)}
                >
                  <FiPlus className="modern-icon" />
                  {t("add_time_slot")}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Save Button */}
      <div className="modern-save-section">
        <button className="modern-save-btn" onClick={saveAvailability}>
          <FiSave className="modern-icon" />
          {t("save_all_changes")}
        </button>
      </div>

      {/* Copy Modal */}
      {showCopyModal && (
        <div className="modern-modal-overlay">
          <div className="modern-modal">
            <div className="modern-modal-header">
              <h3>{t("copy_availability")}</h3>
              <button className="modern-close-btn" onClick={closeCopyModal}>
                <FiX />
              </button>
            </div>

            <div className="modern-modal-content">
              <div className="modern-option-group">
                <label className="modern-option">
                  <input
                    type="checkbox"
                    checked={copyOptions.sameWeekday}
                    onChange={() => handleCopyOptionChange("sameWeekday")}
                  />
                  <span className="modern-checkbox"></span>
                  <span className="modern-option-text">
                    {t("same_weekday", {
                      day: formatDayName(
                        days.find((d) => d.id === copySourceId)?.date.getDay()
                      ),
                    })}
                  </span>
                </label>

                <label className="modern-option">
                  <input
                    type="checkbox"
                    checked={copyOptions.allFollowing}
                    onChange={() => handleCopyOptionChange("allFollowing")}
                  />
                  <span className="modern-checkbox"></span>
                  <span className="modern-option-text">
                    {t("all_following_days")}
                  </span>
                </label>
              </div>

              <div className="modern-custom-days">
                <p className="modern-option-label">{t("custom_days")}</p>
                <div className="modern-day-pills">
                  {[0, 1, 2, 3, 4, 5, 6].map((dayIndex) => (
                    <button
                      key={dayIndex}
                      className={`modern-day-pill ${
                        copyOptions.customDays.includes(dayIndex)
                          ? "modern-selected"
                          : ""
                      }`}
                      onClick={() => handleCopyOptionChange(dayIndex)}
                    >
                      {formatDayName(dayIndex).slice(0, 3)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="modern-modal-actions">
              <button
                className="modern-btn modern-cancel-btn"
                onClick={closeCopyModal}
              >
                {t("cancel")}
              </button>
              <button
                className="modern-btn modern-apply-btn"
                onClick={applyCopy}
              >
                <FiCheck className="modern-icon" />
                {t("apply")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Modal */}
      {showRemoveModal && (
        <div className="modern-modal-overlay">
          <div className="modern-modal">
            <div className="modern-modal-header">
              <h3>{t("remove_availability")}</h3>
              <button className="modern-close-btn" onClick={closeRemoveModal}>
                <FiX />
              </button>
            </div>

            <div className="modern-modal-content">
              <div className="modern-option-group">
                <label className="modern-option">
                  <input
                    type="checkbox"
                    checked={removeOptions.sameWeekday}
                    onChange={() => handleRemoveOptionChange("sameWeekday")}
                  />
                  <span className="modern-checkbox"></span>
                  <span className="modern-option-text">
                    {t("same_weekday", {
                      day: formatDayName(
                        days.find((d) => d.id === copySourceId)?.date.getDay()
                      ),
                    })}
                  </span>
                </label>

                <label className="modern-option">
                  <input
                    type="checkbox"
                    checked={removeOptions.allFollowing}
                    onChange={() => handleRemoveOptionChange("allFollowing")}
                  />
                  <span className="modern-checkbox"></span>
                  <span className="modern-option-text">
                    {t("all_following_days")}
                  </span>
                </label>
              </div>

              <div className="modern-custom-days">
                <p className="modern-option-label">{t("custom_days")}</p>
                <div className="modern-day-pills">
                  {[0, 1, 2, 3, 4, 5, 6].map((dayIndex) => (
                    <button
                      key={dayIndex}
                      className={`modern-day-pill ${
                        removeOptions.customDays.includes(dayIndex)
                          ? "modern-selected"
                          : ""
                      }`}
                      onClick={() => handleRemoveOptionChange(dayIndex)}
                    >
                      {formatDayName(dayIndex).slice(0, 3)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="modern-modal-actions">
              <button
                className="modern-btn modern-cancel-btn"
                onClick={closeRemoveModal}
              >
                {t("cancel")}
              </button>
              <button
                className="modern-btn modern-remove-btn"
                onClick={applyRemove}
              >
                <FiTrash2 className="modern-icon" />
                {t("remove")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Schedule;
