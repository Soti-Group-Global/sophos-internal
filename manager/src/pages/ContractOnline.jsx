import React, { useRef, useEffect, useState } from "react";
import html2pdf from "html2pdf.js";
import "../styles/AktDocument.css";

const ContractOnline = ({ data = {}, onClose }) => {
  const aktRef = useRef();
  const [isEditing, setIsEditing] = useState(false);

  const formatDateForDisplay = (date) => {
    if (!date) return "N/A";
    const parsedDate = new Date(date);
    return !isNaN(parsedDate) ? parsedDate.toLocaleDateString("ru-RU") : "N/A";
  };

  const formatDateForInput = (date) => {
    if (!date) return "";
    const parsedDate = new Date(date);
    return isNaN(parsedDate) ? "" : parsedDate.toISOString().split("T")[0];
  };

  const [formData, setFormData] = useState({
    full_name: data?.fullName || "",
    full_name_russian: data?.fullNameRussian || data?.fullName || "",
    date_of_birth: formatDateForInput(data?.date_of_birth),
    email: data?.email || "",
    phone_no: data?.phone_no || "",
    service_name: data?.service_name || "",
    agreement_number: data?.agreement_number || "",
    akt_number: data?.aktNumber || "",
    agreement_date: formatDateForInput(data?.agreement_date),
    total_amount: data?.total_amount || 0,
    packages: data?.packages || [],
  });


  useEffect(() => {
    setFormData({
      full_name: data?.fullName || "",
      full_name_russian: data?.fullNameRussian || data?.fullName || "",
      date_of_birth: formatDateForInput(data?.date_of_birth),
      email: data?.email || "",
      phone_no: data?.phone_no || "",
      service_name: data?.service_name || "",
      agreement_number: data?.agreement_number || "",
      akt_number: data?.aktNumber || "",
      agreement_date: formatDateForInput(data?.agreement_date),
      total_amount: data?.total_amount || 0,
      packages: data?.packages || [],
    });
  }, [data]);

  const handleDownloadPDF = async () => {
    const input = aktRef.current;
    if (!input) {
      return;
    }

    const options = {
      margin: 8,
      filename: `Договор БК_АО_онлайн_итог_${formData.akt_number}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, scrollX: 0,
        scrollY: -window.scrollY },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      pagebreak: {
        mode: ['css', 'legacy'], // critical
      }
    };

    await html2pdf().from(input).set(options).save();
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    // Parse total_amount as a number, keep other fields as strings
    const newValue = name === "total_amount" ? parseFloat(value) || 0 : value;

    setFormData((prev) => ({
      ...prev,
      [name]: newValue,
    }));
  };

  const handleSave = () => {
    setIsEditing(false);
  };

  return (
    <div className="akt-popup-overlay">
      <div className="akt-popup">
        <button className="close-btn" onClick={onClose}>
          &times;
        </button>

        {isEditing ? (
          <div className="akt-form-container">
            <form className="akt-form">
  <label>Full Name (English):</label>
  <input
    type="text"
    name="full_name"
    value={formData.full_name}
    onChange={handleChange}
  />

  <label>Full Name (Russian):</label>
  <input
    type="text"
    name="full_name_russian"
    value={formData.full_name_russian}
    onChange={handleChange}
  />

  <label>Phone Number:</label>
  <input
    type="text"
    name="phone_no"
    value={formData.phone_no}
    onChange={handleChange}
  />

  <label>Email:</label>
  <input
    type="email"
    name="email"
    value={formData.email}
    onChange={handleChange}
  />

  <label>AKT Number:</label>
  <input
    type="text"
    name="akt_number"
    value={formData.akt_number}
    onChange={handleChange}
  />
</form>

          </div>
        ) : (
          <div className="akt-content" ref={aktRef}>
            <div className="bilingual-container">
              <div className="header-rows">
                <div className="column english">
                  <h1 className="document-title">
                    PUBLIC OFFER № {formData.akt_number}
                  </h1>
                  <p
                    className="document-date"
                    style={{ display: "flex", justifyContent: "space-between" }}
                  >
                    <span>Moscow</span>
                    <span></span>May 1, 2025
                  </p>
                </div>
                <div className="column russian">
                  <h1 className="document-title">
                    ПУБЛИЧНАЯ ОФЕРТА № {formData.akt_number}
                  </h1>
                  <p
                    className="document-date"
                    style={{ display: "flex", justifyContent: "space-between" }}
                  >
                    <span>Москва</span>
                    <span>1 мая 2025 г.</span>
                  </p>
                </div>
              </div>

              <div className="content-rows">
                <div className="column english">
                  <p className="para">
                  This Agreement (hereinafter referred to as the "Agreement/Offer") constitutes a public Offer by the Autonomous Non-Profit Organization "Scientific and Educational Center 'Eurasian Oncology Program 'EAFO'", represented by Director Somasundaram Subramanian, acting on the basis of the Charter, hereinafter referred to as the "Contractor", and is addressed to any legal entity or individual,{" "}
                    <div
                      style={{
                        display: "inline-block",
                        borderBottom: "1px solid #000",
                        paddingBottom: "1px",
                        paddingRight:"3px"
                      }}
                    >
                      {formData.full_name},</div>
                      <div
                      style={{
                        display: "inline-block",
                        borderBottom: "1px solid #000",
                        paddingBottom: "1px",
                        paddingRight:"3px"
                      }}
                    >{formData.email}, {" "}</div><div
                    style={{
                      display: "inline-block",
                      borderBottom: "1px solid #000",
                      paddingBottom: "1px",
                      paddingRight:"3px"
                    }}
                  >{formData.phone_no}</div> 
                    hereinafter referred to as the "Customer", collectively referred to as the "Parties". It contains all the essential terms of the Service Agreement available on the Contractor’s website at: <a href="http://basic.eafo.info">http://basic.eafo.info</a> and its domains (hereinafter referred to as the "Website"). This Offer becomes effective upon its publication on the Website. By accepting this Offer (thereby entering into this Agreement), You understand and agree to all the terms set forth herein, including the consent to the processing of personal data, which is an integral part of this Offer.
                  </p>
                </div>
                <div className="column russian">
                  <p className="para">
                  Настоящий Договор (далее - «Договор/Оферта») является публичной Офертой Автономной некоммерческой организации «Научно-образовательный центр «Евразийская онкологическая программа «ЕАФО», в лице Директора СУБРАМАНИАНА Сомасундарама, действующего на основании Устава, именуемая в дальнейшем «Исполнитель», и адресован любому юридическому или физическому лицу,{" "}
                  <div
                      style={{
                        display: "inline-block",
                        borderBottom: "1px solid #000",
                        paddingBottom: "1px",
                        paddingRight:"3px"
                      }}
                    >
                      {formData.full_name},</div>
                      <div
                      style={{
                        display: "inline-block",
                        borderBottom: "1px solid #000",
                        paddingBottom: "1px",
                        paddingRight:"3px"
                      }}
                    >{formData.email}, {" "}</div><div
                    style={{
                      display: "inline-block",
                      borderBottom: "1px solid #000",
                      paddingBottom: "1px",
                      paddingRight:"3px"
                    }}
                  >{formData.phone_no}</div>
                    именуемому в дальнейшем «Заказчик», с другой стороны, вместе именуемые «Стороны», и содержит все существенные условия Договора оказания услуг, представленных на сайте Исполнителя по адресу: <a href="http://basic.eafo.info">http://basic.eafo.info</a> и его доменах (далее - Сайт). Настоящая Оферта вступает в силу с момента ее размещения на Сайте. Совершая акцепт настоящей Оферты (тем самым заключая настоящий Договор), Вы понимаете и соглашаетесь со всеми изложенными в ней условиями, в том числе, соглашаетесь на обработку персональных данных, согласие является неотъемлемой частью настоящей Оферты.
                  </p>
                </div>
              </div>

              {/* Section 1 */}
              <div className="section-rows">
                <div className="column english">
                  <h2 className="section-titles">
                    1. SUBJECT OF THE AGREEMENT
                  </h2>
                  <p className="paragraph">
                  1.1. The Executor undertakes to provide, and the Customer to accept and pay for the Services (hereinafter referred to as the "Services") related to participation in the Event XI EAFO Basic Medical Courses (hereinafter referred to as the "Event/Service"), detailed information about which is available on the Website.
                  </p>
                  <p className="paragraph">
                  1.2. The venue of the Event is determined by the Executor and communicated to the Customer no later than 30 (thirty) calendar days prior to the start of the Event and published on the Website.
                  </p>
                  <p className="paragraph">
                  1.3. The date and time of the Event are determined by the Contractor and published on the Event Website.
                  </p>
                  <p className="paragraph">
                  1.4. During the broadcast of the Event, short-term interruptions are permitted (e.g., interruption of the Internet channel, computer reboot by the lecturer, etc.), provided that the Event resumes. In the event that it is impossible to continue the broadcast of the Event, the Contractor undertakes to inform the Customer of the date and time of the resumption of the Event.
                  </p>
                  <p className="paragraph">
                  1.5. The cost of the Services is determined in accordance with the Price List posted on the Website. The Executor has the right to unilaterally change the cost of the Services by posting an updated Price List on the Website at least 30 (thirty) calendar days before the changes take effect. The cost in effect at the time of the conclusion of the Agreement is fixed in the invoice for payment.
                  </p>
                </div>
                <div className="column russian">
                  <h2 className="section-titles">1. ПРЕДМЕТ ДОГОВОРА</h2>
                  <p className="paragraph">
                  1.1. Исполнитель обязуется оказать, а Заказчик принять и оплатить Услуги (далее - «Услуги») по онлайн участию в мероприятии XI EAFO Базовые медицинские курсы по онкологии и онкопатологии (далее - «Мероприятие/Услуга»), подробная информация о котором указана на Сайте.
                  </p>
                  <p className="paragraph">
                  1.2. Место проведения Мероприятия: https://ui.eafo.info/dashboard/courses.
                  </p>
                  <p className="paragraph">
                  1.3. Дата проведения Мероприятия: с 23 июля по 8 августа 2025 года.
                  </p>
                  <p className="paragraph">
                  1.4. При трансляции Мероприятия допускается кратковременное прерывание трансляции (перерыв работы Интернет-канала, перезагрузка компьютера у лектора и т.п.), при условии возобновления Мероприятия. В случае невозможности продолжения трансляции Мероприятия Исполнитель обязуется сообщить Заказчику о дате и времени продолжения Мероприятия.
                  </p>
                  <p className="paragraph">
                  1.5. Стоимость Услуг определяется в соответствии с Прайс-листом, размещенном на Сайте. Исполнитель вправе в одностороннем порядке изменять стоимость Услуг путем размещения обновленного Прайс-листа на Сайте не менее чем за 30 (тридцать) календарных дней до вступления изменений в силу. Действующая на момент заключения Договора стоимость фиксируется в счете на оплату.
                  </p>
                </div>
              </div>

              {/* Section 2 */}
              <div className="section-rows">
                <div className="column english">
                  <h2 className="section-titles">
                    2. OBLIGATIONS OF THE PARTIES
                  </h2>
                  <p className="paragraph">
                    2.1. The Contractor has the right to:
                  </p>
                  <p className="paragraph">
                  2.1.1. To provide the Services either independently or with the involvement of third parties;
                  </p>
                  <p className="paragraph">
                  2.1.2. To independently determine the composition of lecturers participating in the Event;
                  </p>
                  <p className="paragraph">
                  2.1.3. To conduct photo, audio, and video recordings during the Event and to use the obtained materials at its discretion, including publishing them in the public domain on its internet resources.
                  </p>
                  <p className="paragraph">
                  2.1.4. In the Event of non-payment or late payment by the Customer for the Services, to deny the Customer access to the Event until the Customer fulfills their payment obligations;
                  </p>
                  <p className="paragraph page-break">
                  2.1.5. In case of necessity, but no later than 3 (three) calendar days before the Event, the time and venue of the Event may be changed; the corresponding notification of changes is published on the Contractor’s Website.
                  </p>
                  <p className="paragraph">
                  2.2. The Contractor is obligated to:
                  </p>
                  <p className="paragraph">
                  2.2.1. To provide the Services to the Customer in accordance with this Agreement and the Event program.
                  </p>
                  <p className="paragraph">
                  2.2.2. To ensure the Customer’s registration for the Event and accommodation, in the Event that the Customer has paid for accommodation.
                  </p>
                  <p className="paragraph">
                  2.2.3. To provide the Customer with access to materials during the Event, as well as access to recordings of the Event for a period of two months after the completion of the Event.
                  </p>
                  <p className="paragraph">
                  2.2.4. To issue the Customer a certificate of participation in the Event in either paper or electronic form.
                  </p>
                  <p className="paragraph">
                  2.3. The Customer has the right to:
                  </p>
                  <p className="paragraph">
                  2.3.1. To receive from the Executor full information on issues related to the provision of Services;
                  </p>
                  <p className="paragraph">
                  2.3.2. To participate in the Events as a listener. The Customer’s admission to participate in the Event is only possible subject to the fulfillment of their obligation to pay for the Services;
                  </p>
                  <p className="paragraph">
                  2.3.3. To address lecturers with questions related to the topic of the Event.
                  </p>
                  <p className="paragraph">
                    2.4. The Customer is obligated to:
                  </p>
                  <p className="paragraph">
                  2.4.1. To provide complete and accurate data required by the system during registration in the personal account for the Event.
                  </p>
                  <p className="paragraph">
                  2.4.2. To pay the Contractor for the Services rendered in the manner and amount specified in this Agreement.
                  </p>
                  <p className="paragraph">
                  2.4.3. To participate in the Event.
                  </p>
                  <p className="paragraph">
                  2.4.4. To independently and promptly familiarize themselves with the date, time, and program of the Events, as well as any relevant changes posted by the Contractor on the Website.
                  </p>
                  <p className="paragraph">
                    2.4.5. To comply with the rules established by the
                    Contractor for the Event.
                  </p>
                  <p className="paragraph">
                  2.5. The Customer is not entitled to:
                  </p>
                  <p className="paragraph">
                  2.5.1. Transfer the unique login/password pair from the personal account or links to the Event to third parties;
                  </p>
                  <p className="paragraph">
                  2.5.2. Cause discomfort to lecturers, as well as other participants and guests of the Event, disrupt public order, or violate generally accepted rules of conduct;
                  </p>
                  <p className="paragraph">
                  2.5.3. Use non-normative, rude, or offensive language when communicating with lecturers, participants, and guests of the Event;
                  </p>
                  <p className="paragraph">
                  2.5.4. Make audio or video recordings of the Event;
                  </p>
                  <p className="paragraph">
                  2.5.5. Distribute advertising information about other individuals, organizations, or third-party Events;
                  </p>
                  <p className="paragraph">
                  2.5.6. Use software tools that hinder or make it impossible to conduct and/or broadcast the Event;
                  </p>
                  <p className="paragraph">
                  2.5.7. Download recordings of the Event using any software tools for commercial/non-commercial reproduction outside the scope of the provided access or for reproduction to third parties;
                  </p>
                  <p className="paragraph page-break">
                  2.5.8. Distribute in any way informational materials provided to the Customer within the framework of the Events, whether in electronic or printed form.
                  </p>
                </div>
                <div className="column russian">
                  <h2 className="section-titles">2. ОБЯЗАННОСТИ СТОРОН</h2>
                  <p className="paragraph">2.1. Исполнитель имеет право:</p>
                  <p className="paragraph">
                  2.1.1. Осуществлять оказание Услуг своими силами или
с привлечением третьих лиц;
                  </p>
                  <p className="paragraph">
                  2.1.2. Самостоятельно формировать состав лекторов, принимающих участие в Мероприятие;
                  </p>
                  <p className="paragraph">
                  2.1.3. Проводить фото -, аудио- и видеосъемку во время проведения Мероприятий и использовать полученные материалы по своему усмотрению, в том числе публиковать в открытом доступе на своих интернет-ресурсах.
                  </p>
                  <p className="paragraph">
                  2.1.4. При невнесении или несвоевременном внесении Заказчиком платы за Услуги не допускать Заказчика к участию в Мероприятии до исполнения Заказчиком обязанностей по оплате Услуг;
                  </p>
                  <p className="paragraph page-break">
                  2.1.5. В случае необходимости, но не менее чем за 3 (три) календарных дня до проведения Мероприятия изменять время проведения, соответствующее уведомления об изменениях, публикуется на Сайте Исполнителя.
                  </p>
                  <p className="paragraph">2.2. Исполнитель обязан:</p>
                  <p className="paragraph">
                  2.2.1. Оказать Услуги Заказчику в соответствии с настоящим Договором и программой Мероприятия.
                  </p>
                  <p className="paragraph">
                  2.2.2. Обеспечить регистрацию Заказчика на Мероприятие и размещение Заказчика в случае, если Заказчик произвел оплату размещения.
                  </p>
                  <p className="paragraph">
                  2.2.3. Предоставить Заказчику доступ к материалам во время проведения Мероприятия, а также доступ к записям Мероприятия в течение двух месяцев после проведения Мероприятия.
                  </p>
                  <p className="paragraph">
                  2.2.4. Выдать Заказчику сертификат участника Мероприятия в бумажном или электронном виде.
                  </p>
                  <p className="paragraph">2.3. Заказчик имеет право:</p>
                  <p className="paragraph">
                  2.3.1. Получать от Исполнителя полную информацию по вопросам, связанным с оказанием Услуг;
                  </p>
                  <p className="paragraph">
                  2.3.2. Принимать участие в Мероприятиях в качестве слушателя. При этом допуск Заказчика к участию в Мероприятии возможен только при условии исполнения им обязанностей по оплате Услуг;
                  </p>
                  <p className="paragraph">
                  2.3.3. Обращаться к лекторам по вопросам, касающимся тематики Мероприятия.
                  </p>
                  <p className="paragraph">2.4. Заказчик обязан:</p>
                  <p className="paragraph">
                  2.4.1. Предоставить полные и правильные данные, которые требует система при регистрации в личном кабинете на Мероприятии.
                  </p>
                  <p className="paragraph">
                  2.4.2. Произвести Исполнителю оплату оказанных Услуг в порядке и в размере, указанном в настоящем Договоре.
                  </p>
                  <p className="paragraph">
                  2.4.3. Принять участие в Мероприятии.
                  </p>
                  <p className="paragraph">
                  2.4.4. Самостоятельно и своевременно знакомиться с датой, временем и программой проводимых Мероприятий, а также соответствующими изменениями, размещаемыми Исполнителем на Сайте.
                  </p>
                  <p className="paragraph">
                  2.4.5. Соблюдать правила, установленные Исполнителем на Мероприятии.
                  </p>
                  <p className="paragraph">2.5. Заказчик не вправе:</p>
                  <p className="paragraph">
                  2.5.1. Передавать уникальную идентификационную пару логин/пароль от личного кабинета или ссылки на Мероприятия иным лицам;
                  </p>
                  <p className="paragraph">
                  2.5.2. Причинять дискомфорт лекторам, а также иным участникам и гостям Мероприятия, нарушать общественный порядок и общепринятые правила поведения;
                  </p>
                  <p className="paragraph">
                  2.5.3. Допускать при общении с лекторами, а также участниками и гостями Мероприятия ненормативные, грубые и оскорбительные высказывания;
                  </p>
                  <p className="paragraph">
                  2.5.4. Производить аудио- или видеозапись Мероприятия;
                  </p>
                  <p className="paragraph">
                  2.5.5. Распространять рекламную информацию о других лицах, организациях, а также сторонних Мероприятиях;
                  </p>
                  <p className="paragraph">
                  2.5.6. Применять программные средства, затрудняющие или делающие невозможным проведение и (или) трансляцию Мероприятия;
                  </p>
                  <p className="paragraph">
                  2.5.7. Осуществлять скачивание записи Мероприятий при помощи каких-либо программных средств для коммерческого/некоммерческого воспроизведения вне рамок предоставленного доступа, либо для воспроизведения третьим лицам;
                  </p>
                  <p className="paragraph page-break">
                  2.5.8. Осуществлять любое распространение предоставленных Заказчику в рамках проводимых Мероприятий информационных материалов, как в электронном, так и в печатном виде.
                  </p>
                </div>
              </div>

              <div className="section-rows">
                <div className="column english">
                  <h2 className="section-titles">
                    3. COST OF SERVICES AND PAYMENT TERMS
                  </h2>
                  <p className="paragraph">
                  3.1. The cost of the Services provided under this Agreement is specified in the invoice issued to the Customer for organizing participation in the Event, which constitutes an integral part of this Agreement. The cost of organizing participation in the Event is determined based on the Price List in effect at the time of concluding the Agreement, as posted on the Event Website. The invoice shall include its number and the necessary details regarding the Service. Payment of the invoice by the Customer signifies that they have fully reviewed and accepted the terms of this Agreement and the Price List in effect on the date of payment, as published on the Website.
                  </p>
                  <p className="paragraph">
                  3.2. Payment for the Services is made by the Customer in the form of 100% advance payment in accordance with the conditions set forth in Clause 1.1 of this Agreement.
                  </p>
                </div>
                <div className="column russian">
                  <h2 className="section-titles">
                    3. СТОИМОСТЬ УСЛУГ И ПОРЯДОК РАСЧЕТОВ
                  </h2>
                  <p className="paragraph">
                  3.1. Стоимость Услуг, оказываемых по настоящему Договору, указывается в выставленном Заказчику счёте на организацию участия в Мероприятии, который является неотъемлемой частью настоящего Договора. Стоимость организации участия в Мероприятии определяется на основании Прайс-листа, действующего на момент заключения Договора, размещенного на Сайте Мероприятия. В выставляемом счёте указывается его номер, необходимые сведения об Услуге. Оплата счёта Заказчиком означает, что он полностью ознакомился и принимает условия настоящего Договора и Прайс-листа, действующего на дату оплаты, содержащиеся на Сайте.
                  </p>
                  <p className="paragraph">
                  3.2. Оплата Услуг производится Заказчиком в порядке 100% предварительной оплаты согласно условиям, определяемым пунктом 1.1. настоящего Договора.
                  </p>
                </div>
              </div>

              <div className="section-rows">
                <div className="column english">
                  <h2 className="section-titles">
                    4. PROCEDURE FOR ACCEPTANCE AND DELIVERY OF SERVICES
                  </h2>
                  <p className="paragraph">
                  4.1. No later than 2 (two) business days after the expiration of the service period specified in Clause 1.1 of this Agreement, the Customer has the right to send motivated objections regarding the fact, quality, or scope of the paid Services that were to be provided by the Contractor to the email address basic@eafo.info. These objections shall be reviewed by the Contractor, who will provide a written response within 10 (ten) business days. The Services are considered to have been performed satisfactorily and in full if no timely objections are made by the Customer.
                  </p>
                  <p className="paragraph">
                  4.2. The Parties have agreed that the Certificates of Acceptance for the rendered Services shall not be prepared or provided unless a special request is made to the Contractor no later than the date of payment for the Services.
                  </p>
                  <p className="paragraph">
                  4.3. All documents have legal validity when transmitted via email between the Parties.
                  </p>
                </div>
                <div className="column russian">
                  <h2 className="section-titles">
                    4. ПОРЯДОК ПРИЕМА-СДАЧИ УСЛУГ
                  </h2>
                  <p className="paragraph">
                  4.1. Не позднее 2-х рабочих дней после истечения срока оказания Услуг, определяемого пунктом 1.1. настоящего Договора, Заказчик вправе прислать на электронную почту basic@eafo.info мотивированные возражения относительно факта оказания, качества или объема оплаченных Услуг, которые должны были быть оказаны Исполнителем. Указанные возражения подлежат рассмотрению Исполнителем с направлением письменного ответа в течение 10 рабочих дней. Услуги считаются выполненными качественно и в полном объеме при отсутствии своевременно сделанных Заказчиком возражений.
                  </p>
                  <p className="paragraph">
                  4.2. Стороны пришли к соглашению о том, что Акты сдачи-приемки оказанных Услуг не составляются и не предоставляются, если не было сделано специального запроса Исполнителю не позднее даты оплаты Услуг.
                  </p>
                  <p className="paragraph">
                  4.3. Все документы имеют юридическую силу при пересылке через электронную почту Сторон.
                  </p>
                </div>
              </div>

              <div className="section-rows">
                <div className="column english">
                  <h2 className="section-titles">5. LIABILITY</h2>
                  <p className="paragraph">
                  5.1. The Parties shall bear liability for improper performance of the terms of this Agreement in accordance with the requirements of the legislation of the Russian Federation.
                  </p>
                  <p className="paragraph">
                  5.2. In the event of disputes or disagreements, the Parties agree to make every effort to resolve them as soon as possible through negotiations. The pre-claim procedure is mandatory. The response time to a claim is 20 business days.
                  </p>
                  <p className="paragraph">
                  5.3. If disputes cannot be resolved through negotiations, the Parties shall refer them to the court at the location of the defendant.
                  </p>
                  <p className="paragraph">
                  5.4. The Contractor shall not be liable for the manner in which the Customer uses the information obtained from the Event or for the results of such use by the Customer. Any illegal use of information by the Customer, which became known to them through the Contractor, fully absolves the Contractor of all legal and legal consequences associated with the Customer’s illegal actions.
                  </p>
                  <p className="paragraph">
                  5.5. Without contradicting the above, the Parties shall be released from liability for breach of the terms of the Agreement if such breach is caused by force majeure circumstances (force majeure), including: actions of state authorities (e.g., adoption of legal acts, blocking access to websites, messengers, social networks, etc.),<span className="page-break"> termination of access to resources involved in maintaining the operation of the personal account, website, its domains, and content due to reasons beyond the Contractor's control, such as sanctions, fire, flood, earthquake, other natural disasters, lack of electricity and/or computer network malfunctions, strikes, civil unrest, riots, and any other circumstances, without limitation, that may affect the Parties' ability to fulfill the terms of the Agreement.</span>
                  </p>
                </div>
                <div className="column russian">
                  <h2 className="section-titles">5. ОТВЕТСТВЕННОСТЬ</h2>
                  <p className="paragraph">
                  5.1. За ненадлежащее исполнение условий настоящего Договора стороны несут ответственность в соответствии с требованиями законодательства Российской Федерации.
                  </p>
                  <p className="paragraph">
                  5.2. В случае возникновения разногласий или споров, стороны обязуются приложить все усилия к их скорейшему урегулированию путём переговоров. Претензионный порядок обязателен. Срок ответа на претензию 20 рабочих дней.
                  </p>
                  <p className="paragraph">
                  5.3. В случае невозможности разрешения споров путем переговоров Стороны после передают их на рассмотрение в суд по местонахождению ответчика.
                  </p>
                  <p className="paragraph">
                  5.4. Исполнитель не несет ответственности за то, каким образом Заказчик использовал информацию Мероприятия, и за результаты ее использования Заказчиком. Любое незаконное использование информации Заказчиком, которая стала известна ему от Исполнителя, полностью освобождает Исполнителя от всех юридических и правовых последствий, связанных с незаконными действиями Заказчика.
                  </p>
                  <p className="paragraph">
                  5.5. Не вступая в противоречие с указанным выше, Стороны освобождаются от ответственности за нарушение условий Договора, если такое нарушение вызвано действием обстоятельств непреодолимой силы (форс-мажор), включая:<span className="page-break">действия органов государственной власти (в т. ч. принятие правовых актов, блокировка доступа к сайтам, мессенджерам, социальным сетям и др.), прекращение доступа к ресурсам, задействованным в поддержании работы личного кабинета, сайта и его доменов и наполнении контентом, по независящим от Исполнителя причинам например, санкции, пожар, наводнение, землетрясение, другие стихийные бедствия, отсутствие электроэнергии и/или сбои работы компьютерной сети, забастовки, гражданские волнения, беспорядки, любые иные обстоятельства, не ограничиваясь перечисленным, которые могут повлиять на исполнение Сторонами условий Договора.</span> 
                  </p>
                </div>
              </div>

              <div className="section-rows">
                <div className="column english">
                  <h2 className="section-titles">
                    6. TERMINATION OF THE AGREEMENT
                  </h2>
                  <p className="paragraph">
                  6.1. The Agreement may be terminated unilaterally by either party in accordance with the legislation of the Russian Federation.
                  </p>
                  <p className="paragraph">
                  6.2. In the event of termination of the Agreement at the initiative of the Customer:
                  </p>
                  <p className="paragraph">
                  6.2.1. No less than 2 (two) calendar months before the date of commencement of Services – the funds shall be refunded in full;
                  </p>
                  <p className="paragraph">
                  6.2.2. No less than 1 (one) calendar month before the date of commencement of Services – 50% of the funds shall be refunded;
                  </p>
                  <p className="paragraph">
                  6.2.3. Less than 1 (one) calendar month before the date of commencement of Services – the funds received by the Contractor as payment for Services shall not be refunded. The Contractor is not obligated to refund the funds paid by the Customer for the already provided Services upon the Customer’s request.
                  </p>
                  <p className="paragraph">
                  6.3. The Contractor shall not be liable for any discrepancy between the Event materials and the Customer’s expectations and/or for the Customer’s subjective evaluation. Such discrepancy or negative subjective evaluation shall not be considered grounds to deem the Services as provided improperly or in an unauthorized scope.
                  </p>
                </div>
                <div className="column russian">
                  <h2 className="section-titles">
                    6. ПОРЯДОК РАСТОРЖЕНИЯ ДОГОВОРА
                  </h2>
                  <p className="paragraph">
                  6.1. Договор может быть расторгнут сторонами в одностороннем порядке, предусмотренным законодательством РФ.
                  </p>
                  <p className="paragraph">
                  6.2. В случае расторжения Договора по инициативе Заказчика:
                  </p>
                  <p className="paragraph">
                  6.2.1. Не менее, чем за 2 (два) календарных месяца до даты начала оказания Услуг - денежные средства возвращаются в полном объеме;
                  </p>
                  <p className="paragraph">
                  6.2.2. Не менее, чем за 1 (один) календарный месяц до даты начала оказания Услуг - денежные средства возвращаются в сумме 50%;
                  </p>
                  <p className="paragraph">
                  6.2.3. Менее, чем за 1 (один) календарный месяц до даты начала оказания Услуг средства, поступившие на расчетный счет Исполнителя в качестве оплаты Услуг, не подлежат возврату. Исполнитель не обязан возвращать денежные средства Заказчику за уже оплаченную Услугу по требованию Заказчика.
                  </p>
                  <p className="paragraph">
                  6.3. Исполнитель не несет ответственности за несоответствие материалов Мероприятия ожиданиям Заказчика и/или за его субъективную оценку. Такое несоответствие ожиданиям и/или отрицательная субъективная оценка не являются основаниями считать Услугу оказанной не качественно, или в несогласованном объеме.
                  </p>
                </div>
              </div>

              <div className="section-rows">
                <div className="column english">
                  <h2 className="section-titles">7. CONFIDENTIALITY</h2>
                  <p className="paragraph">
                  7.1. Information related to this Agreement provided by the Contractor and the Customer to each other is considered confidential.
                  </p>
                  <p className="paragraph">
                  7.2. The Contractor may process personal data throughout the term of this Agreement. Personal data processing includes collection, systematization, accumulation, clarification (updating, modification), use, anonymization, blocking, destruction, as well as performing other actions with personal data necessary for fulfilling obligations under this Agreement. The Contractor undertakes to ensure the security and non-disclosure of personal data for purposes other than those specified in this Agreement.
                  </p>
                </div>
                <div className="column russian">
                  <h2 className="section-titles">7. КОНФИДЕНЦИАЛЬНОСТЬ</h2>
                  <p className="paragraph">
                  7.1. Информация по Договору, предоставляемая Исполнителем и Заказчиком друг другу, считается конфиденциальной.
                  </p>
                  <p className="paragraph">
                  7.2. Исполнитель может в течение всего срока действия Договора осуществлять обработку персональных данных. Под обработкой персональных данных понимается: сбор, систематизация, накопление, уточнение (обновление, изменение), использование, обезличивание, блокирование, уничтожение, а также совершение иных действий с персональными данными для исполнения обязательств по Договору. Исполнитель обязуется обеспечивать сохранность и неразглашение персональных данных в целях иных, нежели предусмотрены настоящим Договором.
                  </p>
                </div>
              </div>

              <div className="section-rows">
                <div className="column english">
                  <h2 className="section-titles">8. MISCELLANEOUS TERMS</h2>
                  <p className="paragraph">
                  8.1. This Agreement enters into force from the moment of payment receipt to the Contractor's account on the terms of this Agreement and remains valid until the Parties have fully performed their obligations under it.
                  </p>
                  <p className="paragraph">
                  8.2. In all matters not covered by this Agreement, the applicable laws of the Russian Federation shall apply.
                  </p>
                  <p className="paragraph">
                  8.3. This Agreement constitutes a public Offer, including other terms and conditions posted on the Event Website.
                  </p>
                  <p className="paragraph">
                  8.4. The Parties agree that documents signed using a facsimile reproduction of a signature have legal validity.
                  </p>
                  <p className="paragraph page-break">
                  8.5. To simplify the document exchange process, the Parties recognize the appropriateness of using email. The Parties acknowledge the authenticity of documents signed by the Parties and transmitted via email addresses known to the Parties at the time of payment.
                  </p>
                  <p className="paragraph">
                  8.6. The Customer consents to the processing of their personal data by the Contractor and/or third parties involved in the provision of Services.
                  </p>
                  <p className="paragraph">
                  8.7. The Customer consents to the transfer of their personal data by the Contractor to third parties involved in the provision of Services.
                  </p>
                  <p className="paragraph">
                  8.8. The Contractor has the right to use the Customer’s personal data for interaction purposes, including for advertising purposes.
                  </p>
                  <p className="paragraph">
                  8.9. The Contractor undertakes to prevent unauthorized access attempts to personal data and/or its transfer to persons not directly involved in the provision of Services; to promptly detect and stop such incidents.
                  </p>
                  <p className="paragraph">
                  8.10. The Contractor has the right to unilaterally amend the terms of this Agreement at any time by posting the updated text of the Agreement on the Website.
                  </p>
                  <p className="paragraph">
                  8.11. The Customer agrees and acknowledges that amendments to the Agreement result in corresponding changes to the Agreement concluded and currently in effect between the Contractor and the Customer, and such changes to the Agreement take effect simultaneously with the amendments to the Agreement.
                  </p>
                  <p className="paragraph">
                  8.12. For all matters not governed by this Agreement, the Parties shall be guided by the applicable laws of the Russian Federation.
                  </p>
                </div>
                <div className="column russian">
                  <h2 className="section-titles">8. ПРОЧИЕ УСЛОВИЯ</h2>
                  <p className="paragraph">
                  8.1. Настоящий Договор вступает в силу с момента поступления оплаты на расчетный счет Исполнителя на условиях настоящего Договора и действует до исполнения Сторонами своих обязательств по нему в полном объеме.
                  </p>
                  <p className="paragraph">
                  8.2. Во всем, что не предусмотрено настоящим Договором, подлежит применению действующее законодательство РФ.
                  </p>
                  <p className="paragraph">
                  8.3. Настоящий Договор является публичной Офертой, включающей и иные условия, размещенные на Сайте Мероприятия.
                  </p>
                  <p className="paragraph">
                  8.4. Стороны соглашаются, что документы, подписанные факсимильным воспроизведением подписи, имеют юридическую силу.
                  </p>
                  <p className="paragraph page-break">
                  8.5. Для упрощения процедуры обмена документами стороны признают целесообразность использования электронной почты. Стороны признают подлинность документов, подписанных сторонами и переданных по электронной почте, известной Сторонам на момент оплаты.
                  </p>
                  <p className="paragraph">
                  8.6. Заказчик дает согласие на обработку Исполнителем и/или третьими лицами, задействованными в оказании Услуг, персональных данных Заказчика.
                  </p>
                  <p className="paragraph">
                  8.7. Заказчик дает согласие на передачу своих персональных данных Исполнителем третьим лицам, задействованным в оказании Услуг.
                  </p>
                  <p className="paragraph">
                  8.8. Исполнитель имеет право использовать персональные данные Заказчика для взаимодействия, в том числе в рекламных целях.
                  </p>
                  <p className="paragraph">
                  8.9. Исполнитель обязуется: предотвращать попытки несанкционированного доступа к персональным данным и/или передачу ее лицам, не имеющим непосредственного отношения к предоставлению Услуг; своевременно обнаруживать и пресекать такие факты.
                  </p>
                  <p className="paragraph">
                  8.10. Исполнитель имеет право в любой момент изменять условия настоящей Договора в одностороннем порядке путем размещения обновленного текста Договора на Сайте.
                  </p>
                  <p className="paragraph">
                  8.11. Заказчик соглашается и признает, что внесение изменений в Договор влечет за собой внесение этих изменений в заключенный и действующий между Исполнителем и Заказчиком Договор, и эти изменения в Договоре вступают в силу одновременно с такими изменениями в Договоре.
                  </p>
                  <p className="paragraph">
                  8.12. По всем вопросам, не урегулированным настоящим Договором, стороны руководствуются действующим законодательством РФ.
                  </p>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  position: "relative",
                }}
              >
                {/* Left Side Image */}
                <div style={{ flexShrink: 0 }}>
                  <img
                    src="https://static.wixstatic.com/media/59c2f3_4a0ea350d575421db1c1f7dc2240a4d1~mv2.png"
                    alt="Left Decoration"
                    style={{
                      height: "200px",
                      display: "flex",
                      alignItems: "flex-end",
                      position: "absolute",
                      marginLeft: "170px",
                      marginTop: "120px",
                    }}
                  />
                </div>

                {/* English Column */}
                <div className="column english" style={{ flex: 1 }}>
                  <h2 className="section-titles">9. DETAILS</h2>
                  <p className="paragraph">
                    <strong>Contractor:</strong>
                  </p>
                  <p className="paragraph">
                    Autonomous Non-Profit Organization
                  </p>
                  <p className="paragraph">
                    "Scientific and Educational Center
                  </p>
                  <p className="paragraph">
                    Eurasian Oncology Program "EAFO"" (ANO "EAFO")
                  </p>
                  <p className="paragraph">
                    <strong>Location:</strong> 125080, Moscow, Volokolamskoe
                    shosse, 1, p.1, Office 606C
                  </p>
                  <p className="paragraph">
                    <strong>Current address:</strong> 125080, Moscow,
                    Volokolamskoe shosse, 1, bldg. 1, office 606C
                  </p>
                  <p className="paragraph">
                    <strong>Email:</strong> basic@eafo.info
                  </p>
                  <p className="paragraph">
                    <strong>TIN:</strong> 7715491261
                  </p>
                  <p className="paragraph">
                    <strong>CPT:</strong> 774301001
                  </p>
                  <p className="paragraph">
                    <strong>OGRN:</strong> 1127799008072
                  </p>
                  <p className="paragraph">
                    <strong>OKPO:</strong> 09258958
                  </p>
                  <p className="paragraph">
                    <strong>Bank:</strong> AO "Alfa-Bank"
                  </p>
                  <p className="paragraph">
                    <strong>BIK:</strong> 044525593
                  </p>
                  <p className="paragraph">
                    <strong>Account No. (R/с):</strong> 40703810902570000043
                  </p>
                  <p className="paragraph">
                    <strong>Corr. Account (K/с):</strong> 30101810200000000593
                  </p>
                  <p className="paragraph">
                    <strong>Director:</strong>
                  </p>
                  <p>
                    <div style={{ textAlign: "center", marginBottom: "2rem" }}>
                      <img
                        src="https://static.wixstatic.com/media/59c2f3_91a4a81dc17646a09d2a2d916a3392d1~mv2.png"
                        alt="Top Decoration"
                        style={{
                          width: "100px",
                          position: "absolute",
                          marginTop: "-40px",
                          marginLeft: "-140px",
                        }}
                      />
                    </div>
                  </p>
                  <p className="paragraph">
                    ______________________SUBRAMANIAN S.
                  </p>
                </div>

                {/* Center Image */}
                <div style={{ flexShrink: 0 }}>
                  <img
                    src="https://static.wixstatic.com/media/59c2f3_4a0ea350d575421db1c1f7dc2240a4d1~mv2.png"
                    alt="Center Decoration"
                    style={{
                      height: "200px",
                      display: "flex",
                      alignItems: "flex-end",
                      position: "absolute",
                      marginLeft: "120px",
                      marginTop: "120px",
                    }}
                  />
                </div>

                {/* Russian Column */}
                <div
                  className="column russian"
                  style={{ flex: 1, paddingLeft: "1rem" }}
                >
                  <h2 className="section-titles">9. РЕКВИЗИТЫ</h2>
                  <p className="paragraph">
                    <strong>Исполнитель:</strong>
                  </p>
                  <p className="paragraph">
                    Автономная некоммерческая организация
                  </p>
                  <p className="paragraph">«Научно-образовательный центр</p>
                  <p className="paragraph">
                    Евразийская онкологическая программа «EAFO»» (АНО «EAFO»)
                  </p>
                  <p className="paragraph">
                    <strong>Юридический адрес:</strong> 125080, г. Москва,
                    Волоколамское шоссе, д. 1, стр. 1, офис 606С
                  </p>
                  <p className="paragraph">
                    <strong>Фактический адрес:</strong> 125080, г. Москва,
                    Волоколамское шоссе, д. 1, стр. 1, офис 606С
                  </p>
                  <p className="paragraph">
                    <strong>Эл. почта:</strong> basic@eafo.info
                  </p>
                  <p className="paragraph">
                    <strong>ИНН:</strong> 7715491261
                  </p>
                  <p className="paragraph">
                    <strong>КПП:</strong> 774301001
                  </p>
                  <p className="paragraph">
                    <strong>ОГРН:</strong> 1127799008072
                  </p>
                  <p className="paragraph">
                    <strong>ОКПО:</strong> 09258958
                  </p>
                  <p className="paragraph">
                    <strong>Банк:</strong> АО «Альфа-Банк»
                  </p>
                  <p className="paragraph">
                    <strong>БИК:</strong> 044525593
                  </p>
                  <p className="paragraph">
                    <strong>Р/с:</strong> 40703810902570000043
                  </p>
                  <p className="paragraph">
                    <strong>К/с:</strong> 30101810200000000593
                  </p>
                  <p className="paragraph">
                    <strong>Директор:</strong>
                  </p>
                  <div style={{ textAlign: "center", marginBottom: "2rem" }}>
                    <img
                      src="https://static.wixstatic.com/media/59c2f3_91a4a81dc17646a09d2a2d916a3392d1~mv2.png"
                      alt="Top Decoration"
                      style={{
                        width: "100px",
                        position: "absolute",
                        marginTop: "-10px",
                        marginLeft: "-180px",
                      }}
                    />
                  </div>
                  <p className="paragraph">
                    ______________________СУБРАМАНИАН С.
                  </p>
                </div>

                {/* Right Side Image */}
              </div>
            </div>
          </div>
        )}

        <div className="actions">
          <button onClick={() => setIsEditing(!isEditing)} className="btn">
            {isEditing ? "Save" : "Edit"}
          </button>
          <button onClick={handleDownloadPDF} className="btn">
            Download PDF
          </button>
        </div>
      </div>
    </div>
  );
};

export default ContractOnline;
