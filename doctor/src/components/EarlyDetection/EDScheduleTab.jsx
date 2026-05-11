import React from "react";
import { FileText, Calendar, Clock } from "lucide-react";
import { useTranslation } from "react-i18next";
import CustomCalendar from "../CustomCalendar";
import CustomTimePicker from "../CustomTimePicker";

/**
 * Content area for the "Appointment Details" tab (activeTab === "appointmentDetails").
 *
 * Props:
 *   booking                       – full booking object
 *   isEditing                     – boolean
 *   groupedSchedule               – { 1: item[], 2: item[] }
 *   editedScheduleItems           – item[] (used while editing)
 *   setEditedScheduleItems        – setter
 *   doctors                       – doctor[]
 *   loadingDoctors                – boolean
 *   formatLocalDateOnly           – (date, locale) => string
 *   formatDayMetaDate             – (items) => string
 *   toLocalDateOnly               – (value) => string
 *   normalizeId                   – id normalizer
 *   normalizeSpecialistTitle      – title normalizer
 *   handleScheduleItemChange      – (scheduleItemId, field, value) => void
 *   getDoctorDisplayName          – (doctor) => string
 *   getDoctorsForScheduleItem     – (item) => doctor[]
 *   getAvailableStartTimesForItem – (item, scheduleItemId) => string[]
 *   getAvailableEndTimesForItem   – (item, scheduleItemId) => string[]
 *   resolveDoctorEmail            – (doctor) => string
 *   i18nLanguage                  – current i18n.language string
 */
const EDScheduleTab = ({
  booking,
  isEditing,
  groupedSchedule,
  editedScheduleItems,
  setEditedScheduleItems,
  loadingDoctors,
  formatLocalDateOnly,
  formatDayMetaDate,
  toLocalDateOnly,
  normalizeId,
  normalizeSpecialistTitle,
  handleScheduleItemChange,
  getDoctorDisplayName,
  getDoctorsForScheduleItem,
  getAvailableStartTimesForItem,
  getAvailableEndTimesForItem,
  resolveDoctorEmail,
  i18nLanguage,
}) => {
  const { t } = useTranslation();
  const locale = i18nLanguage === "ru" ? "ru-RU" : "en-US";

  return (
    <div className="ed-schedule-wrapper">
      {[1, 2].map((day) => (
        <div key={day} className="ed-day-card">
          <div className="ed-day-header">
            <div className="ed-day-header-left">
              <span className="ed-day-title">{`${t("earlyDiagnosis.dayLabel")} ${day}`}</span>
              <span className="ed-day-date">{formatDayMetaDate(groupedSchedule[day])}</span>
            </div>
            <span className="ed-day-count-badge">
              {`${groupedSchedule[day].length} ${t("earlyDiagnosis.appointments")}`}
            </span>
          </div>

          <div className="ed-day-body">
            {groupedSchedule[day].length === 0 ? (
              <div className="ed-schedule-empty">{t("earlyDiagnosis.noAppointments")}</div>
            ) : (
              groupedSchedule[day].map((item, index) => {
                const scheduleItemId =
                  normalizeId(item?._id || item?.id) || `${day}-${index}`;
                return (
                  <div key={scheduleItemId} className="ed-schedule-item">
                    {!isEditing ? (
                      /* View mode */
                      <div className="ed-schedule-view-card">
                        <div className="ed-schedule-view-icon">
                          <FileText size={18} />
                        </div>
                        <div className="ed-schedule-view-main">
                          <div className="ed-schedule-view-topline">
                            <span className="ed-schedule-view-specialty">
                              {item?.title
                                ? t(
                                    `earlyDiagnosis.specialist_${normalizeSpecialistTitle(item.title)}`,
                                    item.title,
                                  )
                                : t("earlyDiagnosis.consultation")}
                            </span>
                          </div>
                          <div className="ed-schedule-view-doctor">
                            {getDoctorDisplayName(item?.doctor)}
                          </div>
                          <div className="ed-schedule-view-meta">
                            <span className="ed-schedule-view-meta-item">
                              <Calendar size={13} />
                              {item?.date
                                ? formatLocalDateOnly(item.date, locale)
                                : t("earlyDiagnosis.dateNotSet")}
                            </span>
                            <span className="ed-schedule-view-meta-item">
                              <Clock size={13} />
                              {item?.startTime && item?.endTime
                                ? `${item.startTime} - ${item.endTime}`
                                : t("earlyDiagnosis.notScheduled")}
                            </span>
                          </div>
                        </div>
                        <div className="ed-schedule-view-right">
                          <div className="ed-schedule-view-status-label">
                            {t("earlyDiagnosis.status")}
                          </div>
                          <span
                            className={`ed-schedule-view-status ${
                              item?.isCompleted ? "is-confirmed" : "is-pending"
                            }`}
                          >
                            <span className="ed-schedule-view-status-dot" />
                            {item?.isCompleted
                              ? t("earlyDiagnosis.confirmed")
                              : t("earlyDiagnosis.pendingStatus")}
                          </span>
                        </div>
                      </div>
                    ) : (
                      /* Edit mode */
                      <>
                        <div className="ed-schedule-head">
                          <div className="ed-schedule-title">
                            {item?.title
                              ? t(
                                  `earlyDiagnosis.specialist_${normalizeSpecialistTitle(item.title)}`,
                                  item.title,
                                )
                              : t("earlyDiagnosis.consultation")}
                          </div>
                          <label
                            className="ed-process-toggle"
                            title={t("earlyDiagnosis.markAsCompleted")}
                          >
                            <input
                              type="checkbox"
                              checked={!!item?.isCompleted}
                              disabled={!isEditing}
                              onChange={(e) =>
                                handleScheduleItemChange(
                                  scheduleItemId,
                                  "isCompleted",
                                  e.target.checked,
                                )
                              }
                            />
                            <span className="ed-process-toggle-slider" />
                            <span className="ed-process-toggle-label">
                              {item?.isCompleted
                                ? t("earlyDiagnosis.completed")
                                : t("earlyDiagnosis.pendingStatus")}
                            </span>
                          </label>
                        </div>

                        <div className="ed-schedule-grid">
                          {/* Date field */}
                          <div className="ed-schedule-field">
                            <label>{t("earlyDiagnosis.dateShort").toUpperCase()}</label>
                            <CustomCalendar
                              value={item?.date ? String(item.date).split("T")[0] : ""}
                              onChange={(date) =>
                                setEditedScheduleItems((prev) =>
                                  prev.map((row) =>
                                    normalizeId(row?._id || row?.id) ===
                                    normalizeId(scheduleItemId)
                                      ? {
                                          ...row,
                                          date: toLocalDateOnly(date),
                                          startTime: "",
                                          endTime: "",
                                        }
                                      : row,
                                  ),
                                )
                              }
                              minDate={new Date()}
                              dateFormat="yyyy-MM-dd"
                              className="ed-schedule-calendar"
                            />
                          </div>

                          {/* Doctor field */}
                          <div className="ed-schedule-field">
                            <label>{t("earlyDiagnosis.doctorShort").toUpperCase()}</label>
                            <select
                              className="ed-schedule-input"
                              value={
                                typeof item?.doctor === "object"
                                  ? item?.doctor?._id || ""
                                  : item?.doctor || ""
                              }
                              onChange={(e) =>
                                setEditedScheduleItems((prev) =>
                                  prev.map((row) =>
                                    normalizeId(row?._id || row?.id) ===
                                    normalizeId(scheduleItemId)
                                      ? {
                                          ...row,
                                          doctor: e.target.value,
                                          startTime: "",
                                          endTime: "",
                                        }
                                      : row,
                                  ),
                                )
                              }
                            >
                              <option value="">
                                {loadingDoctors
                                  ? t("earlyDiagnosis.loadingDoctors")
                                  : getDoctorsForScheduleItem(item).length
                                  ? t("earlyDiagnosis.selectDoctor")
                                  : t("earlyDiagnosis.noMatchingDoctors")}
                              </option>
                              {getDoctorsForScheduleItem(item).map((doctor) => (
                                <option
                                  key={normalizeId(doctor._id) || doctor.email}
                                  value={normalizeId(doctor._id) || ""}
                                >
                                  {getDoctorDisplayName(doctor)}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Start time field */}
                          <div className="ed-schedule-field">
                            <label>{t("earlyDiagnosis.startTimeShort").toUpperCase()}</label>
                            <CustomTimePicker
                              value={item?.startTime || ""}
                              onChange={(timeStr) =>
                                setEditedScheduleItems((prev) =>
                                  prev.map((row) => {
                                    if (
                                      normalizeId(row?._id || row?.id) !==
                                      normalizeId(scheduleItemId)
                                    )
                                      return row;
                                    const nextRow = { ...row, startTime: timeStr };
                                    const availableEndTimes = getAvailableEndTimesForItem(
                                      nextRow,
                                      scheduleItemId,
                                    );
                                    if (!availableEndTimes.includes(nextRow.endTime)) {
                                      nextRow.endTime = "";
                                    }
                                    return nextRow;
                                  }),
                                )
                              }
                              className="ed-schedule-input"
                              placeholder={t("earlyDiagnosis.selectTime")}
                              disabled={
                                !resolveDoctorEmail(item?.doctor) ||
                                !toLocalDateOnly(item?.date)
                              }
                              allowedTimes={getAvailableStartTimesForItem(item, scheduleItemId)}
                            />
                          </div>

                          {/* End time field */}
                          <div className="ed-schedule-field">
                            <label>{t("earlyDiagnosis.endTimeShort").toUpperCase()}</label>
                            <CustomTimePicker
                              value={item?.endTime || ""}
                              onChange={(timeStr) =>
                                handleScheduleItemChange(scheduleItemId, "endTime", timeStr)
                              }
                              className="ed-schedule-input"
                              placeholder={t("earlyDiagnosis.selectTime")}
                              disabled={
                                !item?.startTime ||
                                !resolveDoctorEmail(item?.doctor) ||
                                !toLocalDateOnly(item?.date)
                              }
                              allowedTimes={getAvailableEndTimesForItem(item, scheduleItemId)}
                            />
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default EDScheduleTab;
