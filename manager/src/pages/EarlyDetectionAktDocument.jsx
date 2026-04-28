import React, { useRef, useEffect, useState } from "react";
import html2pdf from "html2pdf.js";
import "../styles/AktDocument.css";

const EarlyDetectionAktDocument = ({ data = {}, onClose }) => {
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
    full_name: data?.full_name || "",
    date_of_birth: formatDateForInput(data?.date_of_birth),
    email: data?.email || "",
    phone_no: data?.phone_no || "",
    service_name: data?.service_name || "",
    agreement_number: data?.agreement_number || "",
    akt_number: data?.akt_number || "",
    link_created_at: formatDateForInput(data?.link_created_at),
    payment_date: formatDateForInput(data?.payment_date),
    appointment_created_at: formatDateForInput(data?.appointment_created_at),
    total_amount: data?.total_amount || 0,
    packages: data?.packages || [],
  });

  useEffect(() => {
    setFormData({
      full_name: data?.full_name || "",
      date_of_birth: formatDateForInput(data?.date_of_birth),
      email: data?.email || "",
      phone_no: data?.phone_no || "",
      service_name: data?.service_name || "",
      agreement_number: data?.agreement_number || "",
      akt_number: data?.akt_number || "",
      link_created_at: formatDateForInput(data?.link_created_at),
      payment_date: formatDateForInput(data?.payment_date),
      appointment_created_at: formatDateForInput(data?.appointment_created_at),
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
      margin: 10,
      filename: `AKT_${formData.agreement_number}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: "mm", format: "a4", orientation: "landscape" },
    };

    await html2pdf().from(input).set(options).save();
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

  const formatCurrency = (amount) => {
    if (!amount) return "0.00 руб";
    return parseFloat(amount).toLocaleString("ru-RU", {
      style: "currency",
      currency: "RUB",
      minimumFractionDigits: 2,
    });
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

  const formatDateDDMMYYYY = (date) => {
    if (!date) return "N/A";
    const d = new Date(date);
    if (isNaN(d)) return "N/A";
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}.${month}.${year}`;
  };

  const formatDateToRussianMonth = (date) => {
    if (!date) return "";
    const d = new Date(date);
    if (isNaN(d)) return "";

    const day = d.getDate();
    const month = d.getMonth();
    const year = d.getFullYear();

    const monthNames = [
      "января",
      "февраля",
      "марта",
      "апреля",
      "мая",
      "июня",
      "июля",
      "августа",
      "сентября",
      "октября",
      "ноября",
      "декабря",
    ];

    return `${day} ${monthNames[month]} ${year} г.`;
  };

  const total = formData.packages?.reduce(
    (sum, p) => sum + (p.amount || 0) * (p.quantity || 1),
    0
  );

  const handleSave = (e) => {
    if (e) e.preventDefault();
    setIsEditing(false);
    // Here you could also save the formData to your backend if needed
  };

  const handleToggleEdit = () => {
    if (isEditing) {
      handleSave();
    } else {
      setIsEditing(true);
    }
  };

  return (
    <div className="akt-popup-overlay">
      <div className="akt-popup">
        <button className="close-btn" onClick={onClose}>
          &times;
        </button>

        {isEditing ? (
          <div className="akt-form-container">
            <form className="akt-form" onSubmit={handleSave}>
              <label>Full Name:</label>
              <input
                type="text"
                name="full_name"
                value={formData.full_name}
                onChange={handleChange}
                required
              />
              <label>Date of Birth:</label>
              <input
                type="date"
                name="date_of_birth"
                value={formData.date_of_birth}
                onChange={handleChange}
              />
              <label>Email:</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
              />
              <label>Phone:</label>
              <input
                type="text"
                name="phone_no"
                value={formData.phone_no}
                onChange={handleChange}
              />
              <label>Service Name:</label>
              <input
                type="text"
                name="service_name"
                value={formData.service_name}
                onChange={handleChange}
              />
              <label>Agreement Number:</label>
              <input
                type="text"
                name="agreement_number"
                value={formData.agreement_number}
                onChange={handleChange}
              />
              <label>Payment Date:</label>
              <input
                type="date"
                name="payment_date"
                value={formData.payment_date}
                onChange={handleChange}
              />
              <label>Link Created At:</label>
              <input
                type="date"
                name="link_created_at"
                value={formData.link_created_at}
                onChange={handleChange}
              />
              <label>Appointment Created At:</label>
              <input
                type="date"
                name="appointment_created_at"
                value={formData.appointment_created_at}
                onChange={handleChange}
              />
              <label>Total Amount:</label>
              <input
                type="number"
                name="total_amount"
                value={formData.total_amount}
                onChange={handleChange}
                step="0.01"
              />
              <div className="form-actions">
                <button type="submit" className="btn btn-primary">
                  Save Changes
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsEditing(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="akt-content" ref={aktRef}>
            <div className="container">
              <p
                className="heading"
                style={{
                  fontSize: "18px",
                  fontWeight: "bold",
                  textDecoration: "underline",
                }}
              >
                Акт сдачи-приемки услуг № {formData.agreement_number || "N/A"}{" "}
                {formatDateDDMMYYYY(formData.payment_date) || ""} от{" "}
                {formatDateDDMMYYYY(formData.link_created_at) || "N/A"} г.
              </p>

              <div>
                <table className="info-table">
                  <tbody>
                    <tr>
                      <td>Исполнитель:</td>
                      <td>
                        <b>
                          ООО "Ла Клиника", ИНН 0572024746, КПП 057201001,
                          367026, Республика Дагестан, г. Махачкала, пр.
                          Али-Гаджи Акушинского, д. 7, тел. +7(915) 333 30 66,
                          р/с 40702810360320006644, в банке Севастопольское
                          отделение № 5230 ПАО Сбербанк, БИК 040702615, к/с
                          30101810907020000615
                        </b>
                      </td>
                    </tr>
                    <tr>
                      <td>Заказчик:</td>
                      <td>
                        <b>
                          {formData.full_name} (
                          {formatDateDDMMYYYY(formData.date_of_birth) || ""}{" "}
                          г.р.)
                          <br />
                          e-mail: {formData.email}; Тел.: {formData.phone_no}
                        </b>
                      </td>
                    </tr>
                    <tr>
                      <td>Основание:</td>
                      <td>
                        <b>
                          Договор № {formData.akt_number} от{" "}
                          {formatDateDDMMYYYY(formData.link_created_at) ||
                            "N/A"}{" "}
                          г
                        </b>
                      </td>
                    </tr>
                  </tbody>
                </table>

                <table className="border-table">
                  <thead>
                    <tr>
                      <th style={{ textAlign: "center" }}>№</th>
                      <th style={{ textAlign: "center" }}>
                        Наименование работ, услуг
                      </th>
                      <th style={{ textAlign: "center" }}>Кол-во</th>
                      <th style={{ textAlign: "center" }}>Ед.</th>
                      <th style={{ textAlign: "center" }}>Цена</th>
                      <th style={{ textAlign: "center" }}>Сумма</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formData.packages?.map((pkg, idx) => (
                      <tr key={idx}>
                        <td>{idx + 1}</td>
                        <td>{pkg.name}</td>
                        <td style={{ textAlign: "right" }}>
                          {pkg.quantity || 1}
                        </td>
                        <td>шт</td>
                        <td style={{ textAlign: "right" }}>
                          {formatCurrency(pkg.amount)}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          {formatCurrency(
                            (pkg.amount || 0) * (pkg.quantity || 1)
                          )}
                        </td>
                      </tr>
                    ))}
                    <tr>
                      <td colSpan="4" style={{ border: "none" }}></td>
                      <td
                        style={{
                          textAlign: "right",
                          border: "none",
                          fontWeight: "bold",
                        }}
                      >
                        Итого:
                      </td>
                      <td
                        style={{
                          textAlign: "right",
                          fontWeight: "bold",
                          border: "none",
                        }}
                      >
                        {formatCurrency(total)}
                      </td>
                    </tr>
                    <tr>
                      <td colSpan="4" style={{ border: "none" }}></td>
                      <td
                        style={{
                          textAlign: "right",
                          border: "none",
                          fontWeight: "bold",
                        }}
                      >
                        Без налога (НДС):
                      </td>
                      <td
                        style={{
                          textAlign: "right",
                          fontWeight: "bold",
                          border: "none",
                        }}
                      >
                        -
                      </td>
                    </tr>
                  </tbody>
                </table>
                <p>
                  Всего оказано услуг {formData.packages?.length || 0}, на сумму{" "}
                  {total.toLocaleString("ru-RU")} рублей{" "}
                  {Math.round((total - Math.floor(total)) * 100)
                    .toString()
                    .padStart(2, "0")}{" "}
                  копеек.
                </p>

                <p>
                  <b>Сумма прописью: {numberToWordsRussian(total)}</b>
                </p>
                <p style={{ marginTop: "10px" }}>
                  Вышеперечисленные услуги выполнены полностью и в срок.
                  Заказчик претензий по объему, качеству и срокам оказания услуг
                  не имеет, в том числе и при неподписании акта сдачи-приемки.
                </p>
                <hr
                  style={{
                    height: "2px",
                    color: "#000",
                    background: "#000",
                    margin: "15px 0",
                  }}
                />

                <div>
                  <table style={{ width: "100%" }}>
                    <tbody>
                      <tr>
                        <td style={{ width: "20%", fontWeight: "bold" }}>
                          ИСПОЛНИТЕЛЬ
                        </td>
                        <td>Директор АНО "ЕАФО", Субраманиан С.</td>
                        <td style={{ width: "5%" }}></td>
                        <td style={{ width: "20%", fontWeight: "bold" }}>
                          ЗАКАЗЧИК
                        </td>
                        <td>{formData.full_name}</td>
                      </tr>

                      <tr>
                        <td></td>
                        <td
                          style={{
                            borderBottom: "2px solid #000",
                            paddingTop: "60px",
                          }}
                        ></td>
                        <td></td>
                        <td></td>
                        <td style={{ borderBottom: "2px solid #000" }}></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="actions">
          <button onClick={handleToggleEdit} className="btn">
            {isEditing ? "Cancel" : "Edit"}
          </button>
          <button
            onClick={handleDownloadPDF}
            className="btn"
            disabled={isEditing}
          >
            Download PDF
          </button>
        </div>
      </div>
    </div>
  );
};

export default EarlyDetectionAktDocument;
