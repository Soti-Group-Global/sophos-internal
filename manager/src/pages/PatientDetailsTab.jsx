import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FiChevronDown, FiChevronRight, FiEdit2, FiUser, FiPhone, FiFileText,
  FiMapPin, FiBriefcase, FiShield, FiActivity, FiAlertCircle, FiUsers
} from 'react-icons/fi';
import '../styles/PatientDetailsTab.css';

const PatientDetailsTab = ({ patient }) => {
  const { t } = useTranslation('patient_details_tab');
  const [collapsed, setCollapsed] = useState({});

  const toggle = (key) => setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));

  const formatDate = (d) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const Section = ({ id, icon, title, children }) => {
    const isOpen = !collapsed[id];
    return (
      <div className="pdt-section">
        <button className="pdt-section-hdr" onClick={() => toggle(id)}>
          <div className="pdt-section-title">{icon}<span>{title}</span></div>
          <div className="pdt-section-actions">
            <span className="pdt-section-edit" aria-hidden="true"><FiEdit2 size={14} /></span>
            {isOpen ? <FiChevronDown size={18} /> : <FiChevronRight size={18} />}
          </div>
        </button>
        {isOpen && <div className="pdt-section-body">{children}</div>}
      </div>
    );
  };

  const Field = ({ label, value }) => (
    <div className="pdt-field">
      <span className="pdt-label">{label}</span>
      <span className="pdt-value">{value || '—'}</span>
    </div>
  );

  const fullName = [patient?.lastName, patient?.firstName, patient?.middleName]
    .filter(Boolean)
    .join(' ') || '—';

  return (
    <div className="pdt-container">
      {/* Basic Info */}
      <Section id="basic" icon={<FiUser size={18} />} title={t('basic_info')}>
        <div className="pdt-patient-card">
          <div className="pdt-avatar-col">
            <div className="pdt-avatar-circle"><FiUser size={28} /></div>
          </div>
          <div className="pdt-patient-info-col">
            <h2 className="pdt-patient-fullname">{fullName}</h2>
            <div className="pdt-patient-meta-row">
              <span className="pdt-meta-item">{formatDate(patient.dateOfBirth)}</span>
              <span className="pdt-meta-item">{patient.gender || '—'}</span>
            </div>
            <div className="pdt-info-grid">
              <Field label={t('last_name')} value={patient.lastName} />
              <Field label={t('first_name')} value={patient.firstName} />
              <Field label={t('middle_name')} value={patient.middleName} />
              <Field label={t('email')} value={patient.email} />
            </div>
          </div>
        </div>
        {patient.notes && (
          <div className="pdt-notes">
            <span className="pdt-label">{t('notes')}</span>
            <p>{patient.notes}</p>
          </div>
        )}
      </Section>

      {/* Contacts */}
      <Section id="contacts" icon={<FiPhone size={18} />} title={t('contacts')}>
        <div className="pdt-grid">
          <Field label={t('primary_phone')} value={patient.phoneNumber} />
          <Field label={t('secondary_phone')} value={patient.additionalPhone} />
          <Field label={t('max_id')} value={patient.maxId} />
          <Field label={t('telegram')} value={patient.telegramNickname} />
          <Field label={t('telegram_id')} value={patient.telegramId} />
          <Field label={t('newsletter')} value={patient.newsletter ? t('yes') : t('no')} />
          <Field label={t('egisz')} value={patient.egisz ? t('yes') : t('no')} />
        </div>
        <div className="pdt-subheading">{t('social_media')}</div>
        <div className="pdt-grid">
          <Field label="Instagram" value={patient.instagram} />
          <Field label="VK" value={patient.vk} />
          <Field label="Facebook" value={patient.facebook} />
          <Field label="OK" value={patient.ok} />
        </div>
        <div className="pdt-subheading">{t('emergency_contact')}</div>
        <div className="pdt-grid">
          <Field label={t('contact_person')} value={patient.contactPerson} />
          <Field label={t('contact_phone')} value={patient.contactPersonPhone} />
        </div>
      </Section>

      {/* Documents */}
      <Section id="documents" icon={<FiFileText size={18} />} title={t('documents')}>
        <div className="pdt-grid">
          <Field label={t('snils')} value={patient.snils} />
          <Field label={t('cmip')} value={patient.cmip} />
          <Field label={t('cmip_date')} value={formatDate(patient.cmipDate)} />
          <Field label={t('cmip_org_code')} value={patient.cmipOrgCode} />
          <Field label={t('med_insurance')} value={patient.medInsuranceOrg} />
          <Field label={t('social_support_code')} value={patient.socialSupportCode} />
          <Field label={t('citizenship')} value={patient.citizenship} />
          <Field label={t('document_type')} value={patient.documentType} />
          <Field label={t('document_series')} value={patient.documentSeries} />
          <Field label={t('document_number')} value={patient.documentNumber} />
          <Field label={t('document_issued_date')} value={formatDate(patient.documentIssuedDate)} />
          <Field label={t('department_code')} value={patient.departmentCode} />
          <Field label={t('document_issued_by')} value={patient.documentIssuedBy} />
          <Field label={t('inn')} value={patient.inn} />
        </div>
      </Section>

      {/* Address */}
      <Section id="address" icon={<FiMapPin size={18} />} title={t('address')}>
        <div className="pdt-grid">
          <Field label={t('address_type')} value={patient.addressType} />
          <Field label={t('region')} value={patient.region} />
          <Field label={t('district')} value={patient.district} />
          <Field label={t('city')} value={patient.city} />
          <Field label={t('settlement')} value={patient.settlement} />
          <Field label={t('street')} value={patient.street} />
          <Field label={t('house')} value={patient.house} />
          <Field label={t('terrain')} value={patient.terrain} />
          <Field label={t('apartment')} value={patient.apartment} />
          <Field label={t('postcode')} value={patient.postcode} />
          <Field label={t('geocoordinates')} value={patient.geocoordinates} />
          <Field label={t('registration_change')} value={patient.registrationChange} />
        </div>
      </Section>

      {/* Personal Data */}
      <Section id="personal" icon={<FiBriefcase size={18} />} title={t('personal_data')}>
        <div className="pdt-grid">
          <Field label={t('marital_status')} value={patient.maritalStatus} />
          <Field label={t('education')} value={patient.education} />
          <Field label={t('employment')} value={patient.employment} />
          <Field label={t('place_of_work')} value={patient.placeOfWork} />
          <Field label={t('work_specialty')} value={patient.workSpecialty} />
          <Field label={t('change_place_of_work')} value={patient.changePlaceOfWork} />
          <Field label={t('change_of_position')} value={patient.changeOfPosition} />
        </div>
      </Section>

      {/* Disability */}
      <Section id="disability" icon={<FiShield size={18} />} title={t('disability')}>
        <div className="pdt-grid">
          <Field label={t('disability_status')} value={patient.disability || t('no')} />
          <Field label={t('disability_from')} value={formatDate(patient.disabilityFrom)} />
          <Field label={t('disability_to')} value={formatDate(patient.disabilityTo)} />
          <Field label={t('indefinitely')} value={patient.disabilityIndefinitely ? t('yes') : t('no')} />
          <Field label={t('invalid_group')} value={patient.invalidGroup} />
          <Field label={t('disability_type')} value={patient.disabilityType} />
          <Field label={t('primary_repeated')} value={patient.disabilityPrimaryRepeated} />
        </div>
      </Section>

      {/* Anamnesis */}
      <Section id="anamnesis" icon={<FiActivity size={18} />} title={t('anamnesis')}>
        <div className="pdt-grid">
          <Field label={t('anamnesis_disability')} value={patient.anamnesisDisability} />
          <Field label={t('blood_group')} value={patient.bloodGroup} />
          <Field label={t('rh_factor')} value={patient.rhFactor} />
          <Field label={t('kell_antigen')} value={patient.kellAntigen} />
          <Field label={t('other_blood_info')} value={patient.otherBloodInfo} />
          <Field label={t('allergies')} value={patient.allergies} />
        </div>
      </Section>

      {/* Diseases */}
      {patient.diseases?.length > 0 && (
        <Section id="diseases" icon={<FiAlertCircle size={18} />} title={t('diseases')}>
          <div className="pdt-array-list">
            {patient.diseases.map((d, i) => (
              <div key={d._id || i} className="pdt-array-card">
                <div className="pdt-grid">
                  <Field label={t('diagnosis')} value={d.diagnosis} />
                  <Field label={t('icd_code')} value={d.icdCode} />
                  <Field label={t('start_date')} value={formatDate(d.startDate)} />
                  <Field label={t('end_date')} value={formatDate(d.endDate)} />
                  <Field label={t('doctor')} value={d.doctor} />
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Final Diagnoses */}
      {patient.finalDiagnoses?.length > 0 && (
        <Section id="diagnoses" icon={<FiFileText size={18} />} title={t('final_diagnoses')}>
          <div className="pdt-array-list">
            {patient.finalDiagnoses.map((d, i) => (
              <div key={d._id || i} className="pdt-array-card">
                <div className="pdt-grid">
                  <Field label={t('diagnosis')} value={d.diagnosis} />
                  <Field label={t('icd_code')} value={d.icdCode} />
                  <Field label={t('date')} value={formatDate(d.date)} />
                  <Field label={t('primary_secondary')} value={d.primary === '1' ? t('primary') : t('secondary')} />
                  <Field label={t('doctor_name')} value={d.doctorName} />
                  <Field label={t('job_title')} value={d.jobTitle} />
                  <Field label={t('speciality')} value={d.speciality} />
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Radiation Doses */}
      {patient.radiationDoses?.length > 0 && (
        <Section id="radiation" icon={<FiActivity size={18} />} title={t('radiation_doses')}>
          <div className="pdt-array-list">
            {patient.radiationDoses.map((d, i) => (
              <div key={d._id || i} className="pdt-array-card">
                <div className="pdt-grid">
                  <Field label={t('date')} value={formatDate(d.date)} />
                  <Field label={t('research_type')} value={d.researchType} />
                  <Field label={t('effective_dose')} value={d.effectiveDose} />
                  <Field label={t('note')} value={d.note} />
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Legal Representatives */}
      {patient.legalRepresentatives?.length > 0 && (
        <Section id="legal" icon={<FiUsers size={18} />} title={t('legal_representatives')}>
          <div className="pdt-array-list">
            {patient.legalRepresentatives.map((rep, i) => (
              <div key={rep._id || i} className="pdt-array-card">
                <div className="pdt-grid">
                  <Field label={t('last_name')} value={rep.lastName} />
                  <Field label={t('first_name')} value={rep.firstName} />
                  <Field label={t('middle_name')} value={rep.middleName} />
                  <Field label={t('birthday')} value={formatDate(rep.birthday)} />
                  <Field label={t('gender')} value={rep.gender} />
                  <Field label={t('relationship')} value={rep.relationship} />
                  <Field label={t('document_type')} value={rep.documentType} />
                  <Field label={t('series')} value={rep.series} />
                  <Field label={t('number')} value={rep.number} />
                  <Field label={t('snils')} value={rep.snils} />
                  <Field label={t('address')} value={rep.address} />
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* System */}
      <Section id="system" icon={<FiShield size={18} />} title={t('system_info')}>
        <div className="pdt-grid">
          <Field label={t('notification_language')} value={patient.notificationLanguage === 'ru' ? 'Русский' : 'English'} />
          <Field label={t('profile_completed')} value={patient.profileCompleted ? t('yes') : t('no')} />
          <Field label={t('comments')} value={patient.comments} />
          <Field label={t('created_at')} value={formatDate(patient.createdAt)} />
        </div>
      </Section>
    </div>
  );
};

export default PatientDetailsTab;