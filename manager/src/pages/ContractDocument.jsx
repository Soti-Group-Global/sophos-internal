import React, { useRef, useEffect, useState, forwardRef } from "react";
import html2pdf from "html2pdf.js";
import "../styles/ContractDocument.css";

const ContractDocument = forwardRef(({ data = {}, onClose }, ref) => {
  const contractRef = useRef();
  const [isEditing, setIsEditing] = useState(false);

  const formatDateForInput = (date) => {
    if (!date) return "";
    const parsedDate = new Date(date);
    return isNaN(parsedDate) ? "" : parsedDate.toISOString().split("T")[0];
  };

  const formatCurrency = (amount) => {
    if (!amount) return "0.00 руб";
    return parseFloat(amount).toLocaleString("ru-RU", {
      style: "currency",
      currency: "RUB",
      minimumFractionDigits: 2,
    });
  };

  // Helper function to extract numeric amount from string
  const extractNumericAmount = (amountStr) => {
    if (!amountStr) return 0;
    if (typeof amountStr === "number") return amountStr;
    if (typeof amountStr === "string") {
      // Extract numeric part from strings like "10 RUB" or "10.50 RUB"
      const match = amountStr.match(/(\d+(\.\d+)?)/);
      return match ? parseFloat(match[1]) : 0;
    }
    return 0;
  };

  const [formData, setFormData] = useState({
    // Updated to use invoice fields instead of contract/agreement
    full_name: data?.full_name || "",
    date_of_birth: formatDateForInput(data?.date_of_birth),
    email: data?.email || "",
    phone_no: data?.phone_no || "",
    invoice_number: data?.invoice_number || data?.agreement_number || "",
    contract_number: data?.contract_number || "",
    agreement_number: data?.agreement_number || "",
    invoice_date: formatDateForInput(data?.invoice_date),
    agreement_date: formatDateForInput(data?.agreement_date),
    link_created_at: formatDateForInput(data?.link_created_at),
    payment_date: formatDateForInput(data?.payment_date),
    appointment_created_at: formatDateForInput(data?.appointment_created_at),
    total_amount: extractNumericAmount(data?.total_amount) || 0,
    items: data?.items || data?.packages || [],
    patient_id: data?.patient_id || "",
    application_id: data?.application_id || "",
    status: data?.status || "",
    payment_method: data?.payment_method || "",
    attendance_mode: data?.attendance_mode || "",
    payment_type: data?.payment_type || "",
    gateway: data?.gateway || "",
    mode: data?.mode || "",
    sign_date: formatDateForInput(data?.sign_date),
    contract_date: formatDateForInput(data?.contract_date),
  });

  useEffect(() => {
    setFormData({
      full_name: data?.full_name || "",
      date_of_birth: formatDateForInput(data?.date_of_birth),
      email: data?.email || "",
      phone_no: data?.phone_no || "",
      invoice_number: data?.invoice_number || data?.agreement_number || "",
      contract_number: data?.contract_number || "",
      agreement_number: data?.agreement_number || "",
      invoice_date: formatDateForInput(data?.invoice_date),
      agreement_date: formatDateForInput(data?.agreement_date),
      link_created_at: formatDateForInput(data?.link_created_at),
      payment_date: formatDateForInput(data?.payment_date),
      appointment_created_at: formatDateForInput(data?.appointment_created_at),
      total_amount: extractNumericAmount(data?.total_amount) || 0,
      items: data?.items || data?.packages || [],
      patient_id: data?.patient_id || "",
      application_id: data?.application_id || "",
      status: data?.status || "",
      payment_method: data?.payment_method || "",
      attendance_mode: data?.attendance_mode || "",
      payment_type: data?.payment_type || "",
      gateway: data?.gateway || "",
      mode: data?.mode || "",
      sign_date: formatDateForInput(data?.sign_date),
      contract_date: formatDateForInput(data?.contract_date),
    });
  }, [data]);

  const generateContractPDFBlob = async (element) => {
    if (!element) {
      return null;
    }

    const options = {
      margin: 0,
      filename: "contract.pdf",
      image: { type: "jpeg", quality: 1 },
      html2canvas: { scale: 3, useCORS: true },
      jsPDF: { unit: "mm", format: [210, 350], orientation: "portrait" },
    };

    return new Promise((resolve, reject) => {
      html2pdf()
        .from(element)
        .set(options)
        .outputPdf("blob")
        .then(resolve)
        .catch(reject);
    });
  };

  const handleDownloadPDF = async () => {
    const input = contractRef.current;
    if (!input) {
      return;
    }

    // Clone the content to apply PDF-specific styling
    const clonedContent = input.cloneNode(true);

    // Apply smaller font size and larger height for PDF
    clonedContent.style.fontSize = "10px";
    clonedContent.style.width = "210mm";
    clonedContent.style.height = "400mm";
    clonedContent.style.padding = "5mm";

    const options = {
      margin: [0, 0, 0, 0],
      filename: `Счет_${
        formData.invoice_number || formData.agreement_number
      }.pdf`,
      image: { type: "jpeg", quality: 1.0 },
      html2canvas: { scale: 3, useCORS: true },
      jsPDF: { unit: "mm", format: [210, 350], orientation: "portrait" },
    };

    await html2pdf().from(clonedContent).set(options).save();
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    const newValue = name === "total_amount" ? parseFloat(value) || 0 : value;

    setFormData((prev) => ({
      ...prev,
      [name]: newValue,
    }));
  };

const numberToWordsRussian = (num) => {
  if (typeof num !== "number" || isNaN(num)) return "ноль рублей ноль копеек";

  const belowTwenty = [
    "", "один", "два", "три", "четыре", "пять", "шесть", "семь", "восемь",
    "девять", "десять", "одиннадцать", "двенадцать", "тринадцать", "четырнадцать",
    "пятнадцать", "шестнадцать", "семнадцать", "восемнадцать", "девятнадцать"
  ];

  const tens = [
    "", "", "двадцать", "тридцать", "сорок", "пятьдесят", "шестьдесят",
    "семьдесят", "восемьдесят", "девяносто"
  ];

  const hundreds = [
    "", "сто", "двести", "триста", "четыреста", "пятьсот", "шестьсот",
    "семьсот", "восемьсот", "девятьсот"
  ];

  const thousandsForms = ["тысяча", "тысячи", "тысяч"];
  const millionsForms = ["миллион", "миллиона", "миллионов"];
  const billionsForms = ["миллиард", "миллиарда", "миллиардов"];

  const getForm = (n, forms) => {
    const lastDigit = n % 10;
    const lastTwoDigits = n % 100;
    if (lastTwoDigits >= 11 && lastTwoDigits <= 14) return forms[2];
    if (lastDigit === 1) return forms[0];
    if (lastDigit >= 2 && lastDigit <= 4) return forms[1];
    return forms[2];
  };

  const convertTriplet = (n, isFemale = false) => {
    if (n === 0) return "";
    
    let result = [];
    const h = Math.floor(n / 100);
    const t = Math.floor((n % 100) / 10);
    const u = n % 10;
    
    if (h > 0) result.push(hundreds[h]);
    
    if (t >= 2) {
      result.push(tens[t]);
      if (u > 0) {
        if (u === 1 && isFemale) result.push("одна");
        else if (u === 2 && isFemale) result.push("две");
        else result.push(belowTwenty[u]);
      }
    } else if (t === 1) {
      result.push(belowTwenty[10 + u]);
    } else if (u > 0) {
      if (u === 1 && isFemale) result.push("одна");
      else if (u === 2 && isFemale) result.push("две");
      else result.push(belowTwenty[u]);
    }
    
    return result.filter(Boolean).join(" ");
  };

  const integerPart = Math.floor(num);
  const fractionalPart = Math.round((num - integerPart) * 100);

  const billions = Math.floor(integerPart / 1e9);
  const millions = Math.floor((integerPart % 1e9) / 1e6);
  const thousands = Math.floor((integerPart % 1e6) / 1e3);
  const remainder = integerPart % 1e3;

  const parts = [];

  if (billions > 0) {
    const billionWords = convertTriplet(billions);
    parts.push(`${billionWords} ${getForm(billions, billionsForms)}`);
  }
  
  if (millions > 0) {
    const millionWords = convertTriplet(millions);
    parts.push(`${millionWords} ${getForm(millions, millionsForms)}`);
  }
  
  if (thousands > 0) {
    const thousandWords = convertTriplet(thousands, true);
    parts.push(`${thousandWords} ${getForm(thousands, thousandsForms)}`);
  }
  
  if (remainder > 0) {
    const rubleWords = convertTriplet(remainder);
    parts.push(`${rubleWords} рублей`);
  } else if (integerPart === 0) {
    parts.push("ноль рублей");
  } else {
    // If integerPart > 0 but remainder = 0, we still need "рублей"
    parts.push("рублей");
  }

  const kopeckWords = fractionalPart === 0 
    ? "ноль копеек" 
    : `${convertTriplet(fractionalPart)} копеек`;

  const result = `${parts.join(" ")} ${kopeckWords}`.trim();
  
  // Clean up any double spaces
  return result.replace(/\s+/g, ' ');
};

  const formatDateDDMMYYYY = (date) => {
    if (!date) return "N/A";
    const d = new Date(date);
    if (isNaN(d)) return "N/A";
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}.${month}.${year}`;
  };

  const total = formData.items.reduce(
    (sum, item) => sum + (item.amount || 0) * (item.quantity || 1),
    0
  );

  const currentDate = formatDateDDMMYYYY(new Date());

  return (
    <div ref={ref} className="contract-page">
      <div className="contract-popup-overlay">
        <div className="contract-popup">
          <button className="contract-close-btn" onClick={onClose}>
            &times;
          </button>

          {isEditing ? (
            <div className="contract-form-container">
              <form className="contract-form">
                <div className="form-row">
                  <label>Full Name:</label>
                  <input
                    type="text"
                    name="full_name"
                    value={formData.full_name}
                    onChange={handleChange}
                  />
                </div>

                <div className="form-row">
                  <label>Date of Birth:</label>
                  <input
                    type="date"
                    name="date_of_birth"
                    value={formData.date_of_birth}
                    onChange={handleChange}
                  />
                </div>

                <div className="form-row">
                  <label>Email:</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                  />
                </div>

                <div className="form-row">
                  <label>Phone:</label>
                  <input
                    type="text"
                    name="phone_no"
                    value={formData.phone_no}
                    onChange={handleChange}
                  />
                </div>

                <div className="form-row">
                  <label>Invoice Number:</label>
                  <input
                    type="text"
                    name="invoice_number"
                    value={formData.invoice_number}
                    onChange={handleChange}
                  />
                </div>

                <div className="form-row">
                  <label>Invoice Date:</label>
                  <input
                    type="date"
                    name="invoice_date"
                    value={formData.invoice_date}
                    onChange={handleChange}
                  />
                </div>

                <div className="form-row">
                  <label>Contract Number:</label>
                  <input
                    type="text"
                    name="contract_number"
                    value={formData.contract_number}
                    onChange={handleChange}
                  />
                </div>

                <div className="form-row">
                  <label>Contract Date:</label>
                  <input
                    type="date"
                    name="contract_date"
                    value={formData.contract_date}
                    onChange={handleChange}
                  />
                </div>

                <div className="form-row">
                  <label>Total Amount:</label>
                  <input
                    type="number"
                    name="total_amount"
                    value={formData.total_amount.toString()}
                    onChange={handleChange}
                  />
                </div>
              </form>
            </div>
          ) : (
            <div
              className="contract-content"
              ref={contractRef}
              style={{ fontSize: "12px" }}
            >
              <div className="container">
                <table className="top-table">
                  <tbody>
                    <tr>
                      <td className="col-1">ПАО Сбербанк г. Москва</td>
                      <td className="col-2">БИК</td>
                      <td className="col-3">040702615</td>
                    </tr>
                    <tr>
                      <td className="col-1">Банк получателя</td>
                      <td className="col-2">Сч. №</td>
                      <td className="col-3">30101810907020000615 </td>
                    </tr>

                    <tr>
                      <td colSpan="1">
                        <div
                          className="row-3"
                          style={{
                            display: "flex",
                            gap: "15px",
                            alignItems: "center",
                          }}
                        >
                          <div style={{ width: "25%" }}>ИНН</div>
                          <div style={{ width: "50%" }}>0572024746</div>
                          <div style={{ width: "25%" }}>КПП</div>
                          <div style={{ width: "50%" }}>057201001</div>
                        </div>
                      </td>
                      <td className="col-2">Сч. №</td>
                      <td className="col-3">40702810360320006644</td>
                    </tr>

                    {/* Dynamic participant info */}
                    <tr>
                      <td className="col-1">
                        NcnonHl1Tenb: ООО "Ла Клиника
                        <br />
                        <br />
                        Заказчик: {formData.full_name} (
                        {formatDateDDMMYYYY(formData.date_of_birth) || ""} г.р),
                        <br />
                        контактные данные: e-mail: {formData.email}; тел.:{" "}
                        {formData.phone_no}
                        <br />
                      </td>
                      <td className="col-2"></td>
                      <td className="col-3"></td>
                    </tr>
                  </tbody>
                </table>

                <h2 style={{ margin: "5px 0px", fontSize: "16px" }}>
                  Счет-оферта на оплату №{" "}
                  {formData.invoice_number || formData.agreement_number} от{" "}
                  {formatDateDDMMYYYY(
                    formData.invoice_date || formData.agreement_date
                  ) || currentDate}{" "}
                  г
                </h2>

                <p style={{ textDecoration: "underline", marginBottom: "5px" }}>
                  В назначении платежа укажите: Договор №{" "}
                  {formData.contract_number || formData.agreement_number}, от{" "}
                  {formatDateDDMMYYYY(
                    formData.contract_date ||
                      formData.invoice_date ||
                      formData.agreement_date
                  ) || currentDate}
                </p>

                <table
                  className="information-table"
                  style={{ fontSize: "8px" }}
                >
                  <tbody>
                    <tr>
                      <td>Исполнитель:</td>
                      <td>
                        <b>
                          ООО "Ла Клиника", ИНН 0572024746, КПП 057201001,
                          367026, Республика Дагестан, г. Махачкала, пр.
                          Али-Гаджи Акушинского, д. 7, тел. +7(915) 333 30 66
                        </b>
                      </td>
                    </tr>
                    <tr>
                      <td>Заказчик:</td>
                      <td>
                        <b>
                          {formData.full_name} (
                          {formatDateDDMMYYYY(formData.date_of_birth) || ""}{" "}
                          г.р)
                          <br />
                          e-mail: {formData.email}; Тел.: {formData.phone_no}
                        </b>
                      </td>
                    </tr>
                    <tr>
                      <td>Основание:</td>
                      <td>
                        <b>
                          Договор №{" "}
                          {formData.contract_number ||
                            formData.agreement_number}{" "}
                          от{" "}
                          {formatDateDDMMYYYY(
                            formData.contract_date ||
                              formData.invoice_date ||
                              formData.agreement_date
                          ) || currentDate}{" "}
                          г.
                        </b>
                      </td>
                    </tr>
                  </tbody>
                </table>

                <table className="border-table" style={{ fontSize: "12px" }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "center" }}>№</th>
                      <th style={{ textAlign: "center" }}>
                        Товары (работы, услуги)
                      </th>
                      <th style={{ textAlign: "center" }}>Кол-во</th>
                      <th style={{ textAlign: "center" }}>Ед.</th>
                      <th style={{ textAlign: "center" }}>Цена</th>
                      <th style={{ textAlign: "center" }}>Сумма</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formData.items.map((item, index) => (
                      <tr key={index}>
                        <td>{index + 1}</td>
                        <td>{item.name}</td>
                        <td>{item.quantity || 1}</td>
                        <td>шт</td>
                        <td>{formatCurrency(item.amount)}</td>
                        <td>
                          {formatCurrency(
                            (item.amount || 0) * (item.quantity || 1)
                          )}
                        </td>
                      </tr>
                    ))}

                    <tr>
                      <td style={{ border: "none" }}></td>
                      <td style={{ border: "none" }}></td>
                      <td style={{ border: "none" }}></td>
                      <td style={{ border: "none" }}></td>
                      <td style={{ border: "none", textAlign: "right" }}>
                        <b>Итого:</b>
                      </td>
                      <td style={{ border: "none", textAlign: "left" }}>
                        <b>{formatCurrency(total)}</b>
                      </td>
                    </tr>
                    <tr>
                      <td style={{ border: "none" }}></td>
                      <td style={{ border: "none" }}></td>
                      <td style={{ border: "none" }}></td>
                      <td style={{ border: "none" }}></td>
                      <td style={{ border: "none", textAlign: "right" }}>
                        <b>Без НДС:</b>
                      </td>
                      <td style={{ border: "none", textAlign: "left" }}>
                        <b>{formatCurrency(total)}</b>
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* Additional information section */}
                <div
                  style={{
                    marginTop: "10px",
                    fontSize: "12px",
                    lineHeight: "1.6",
                  }}
                >
                  {/* Item count and total amount */}
                  <p style={{ fontSize: "14px" }}>
                    Всего наименований {formData.items.length}, на сумму{" "}
                    {formatCurrency(total)}.
                  </p>
                  <p style={{ fontSize: "14px" }}>
                    <b>
                      Сумма прописью:{" "}
                      {numberToWordsRussian(parseFloat(total || 0))}
                    </b>
                  </p>

                  {/* Service deadline */}
                  <p style={{ marginTop: "10px", fontSize: "14px" }}>
                    <b>Срок организации услуги:</b> не позднее 20 рабочих дней
                    после поступления денежных средств на расчетный счет
                  </p>

                  {/* Payment instructions */}
                  <p style={{ marginTop: "10px", fontSize: "14px" }}>
                    <b>Внимание!</b>Прежде чем произвести оплату настоящего
                    счёта ознакомьтесь со всеми условиями Договора оказания
                    услуг информационно аналитического медицинского ассистанса,
                    опубликованного на сайте
                    <a
                      href="https://health-direct.info/oferta"
                      target="_blank"
                      style={{
                        color: "#007BFF",
                        textDecoration: "none",
                        margin: "0px 2px",
                      }}
                    >
                      https://health-direct.info/oferta
                    </a>
                    и Политикой оператора в отношении персональных данных,
                    опубликованной на сайте
                    <a
                      href="https://health-direct.info/politika-konfidencialnosti"
                      target="_blank"
                      style={{
                        color: "#007BFF",
                        textDecoration: "none",
                        margin: "0px 2px",
                      }}
                    >
                      https://health-direct.info/politika-konfidencialnosti
                    </a>
                    <br />
                    <br />
                    Оплата данного счета означает принятие всех условий АНО
                    «ЕАФО» и заключение Договора оказания услуг
                    информационно-аналитического медицинского ассистанса,
                    опубликованного на сайте на сайте
                    <a
                      href="https://health-direct.info/offer"
                      target="_blank"
                      style={{
                        color: "#007BFF",
                        textDecoration: "none",
                        margin: "0px 2px",
                      }}
                    >
                      https://health-direct.info/offer
                    </a>
                    в письменной форме (п.п.2,3 ст.434, п.3 ст.438 ГК РФ), а
                    также письменное согласие на обработку персональных данных
                    согласно Политики оператора в отношении персональных данных,
                    опубликованной на сайте
                    <a
                      href="https://health-direct.info/politika-konfidencialnosti"
                      target="_blank"
                      style={{
                        color: "#007BFF",
                        textDecoration: "none",
                        margin: "0px 2px",
                      }}
                    >
                      https://health-direct.info/politika-konfidencialnosti
                    </a>
                  </p>

                  {/* Signature section */}
                  <div style={{ marginTop: "10px", fontSize: "14px" }}>
                    <table
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        border: "none",
                      }}
                    >
                      <tbody>
                        {/* Client Row */}
                        <tr style={{ fontSize: "10px" }}>
                          <td style={{ padding: "10px 0", width: "20%" }}>
                            <b>Клиент</b>
                          </td>
                          <td style={{ width: "10%" }}></td>
                          <td style={{ width: "30%" }}>
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                justifyContent: "center",
                                alignItems: "center",
                              }}
                            >
                              <span style={{ zIndex: "100" }}>
                                ______________________________
                              </span>
                              <span style={{ zIndex: "100" }}>подписи</span>
                            </div>
                          </td>
                          <td style={{ width: "40%" }}>
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                justifyContent: "center",
                                alignItems: "center",
                              }}
                            >
                              <span>______________________________</span>
                              <span>расшифровка подписи</span>
                            </div>
                          </td>
                        </tr>
                        <div
                          style={{
                            position: "relative",
                            width: "100%",
                            height: "0",
                            display: "flex",
                            justifyContent: "center",
                            zIndex: "10000",
                          }}
                          className="stamp_image"
                        >
                          <img
                            src="https://static.wixstatic.com/media/59c2f3_4a0ea350d575421db1c1f7dc2240a4d1~mv2.png"
                            alt="Stamp"
                            style={{
                              position: "absolute",
                              top: "0px",
                              zIndex: 10000,
                              width: "120px",
                              opacity: 0.9,
                            }}
                          />
                        </div>

                        {/* Director Row */}
                        <tr style={{ fontSize: "10px" }}>
                          <td style={{ padding: "10px 0", width: "20%" }}>
                            <b>Руководитель</b>
                          </td>
                          <td style={{ width: "10%", textAlign: "center" }}>
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                justifyContent: "center",
                                alignItems: "center",
                              }}
                            >
                              <span style={{ marginBottom: "-10px" }}>
                                <b>Директор</b>
                              </span>
                              <span>___________________</span>
                              <span>должность</span>
                            </div>
                          </td>
                          <td style={{ width: "30%", textAlign: "center" }}>
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                justifyContent: "center",
                                alignItems: "center",
                                marginTop: "5px",
                              }}
                            >
                              <span
                                style={{ marginBottom: "-15px", zIndex: "100" }}
                              >
                                <img
                                  src="https://static.wixstatic.com/media/59c2f3_91a4a81dc17646a09d2a2d916a3392d1~mv2.png"
                                  style={{ width: "60px" }}
                                  alt="signature"
                                />
                              </span>

                              <span style={{ zIndex: "100" }}>
                                ______________________________
                              </span>
                              <span style={{ zIndex: "100" }}>подписи</span>
                            </div>
                          </td>
                          <td style={{ width: "40%", textAlign: "center" }}>
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                justifyContent: "center",
                                alignItems: "center",
                                marginTop: "5px",
                              }}
                            >
                              <span style={{ marginBottom: "-10px" }}>
                                <b>Субраманиан Сомасундарам</b>
                              </span>
                              <span>______________________________</span>
                              <span>расшифровка подписи</span>
                            </div>
                          </td>
                        </tr>

                        {/* Accountant Row */}
                        <tr style={{ fontSize: "10px" }}>
                          <td style={{ padding: "10px 0px", width: "20%" }}>
                            <b>Главный (старший) бухгалтер</b>
                          </td>
                          <td style={{ width: "10%" }}></td>
                          <td style={{ width: "30%", textAlign: "center" }}>
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                justifyContent: "center",
                                alignItems: "center",
                                marginTop: "5px",
                              }}
                            >
                              <span
                                style={{ marginBottom: "-15px", zIndex: "100" }}
                              >
                                <img
                                  src="https://static.wixstatic.com/media/59c2f3_c49968169bbf4849b6948c3d7b06452b~mv2.png"
                                  style={{ width: "80px" }}
                                  alt="director signature"
                                />
                              </span>
                              <span>______________________________</span>
                              <span>подписи</span>
                            </div>
                          </td>
                          <td style={{ width: "40%", textAlign: "center" }}>
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                justifyContent: "center",
                                alignItems: "center",
                                marginTop: "5px",
                              }}
                            >
                              <span style={{ marginBottom: "-10px" }}>
                                <b>Смирнова Елена Федоровна</b>
                              </span>
                              <span>______________________________</span>
                              <span>расшифровка подписи</span>
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
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
    </div>
  );
});

export default ContractDocument;
