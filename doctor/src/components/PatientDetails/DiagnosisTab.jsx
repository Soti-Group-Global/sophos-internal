import React from 'react';

const DiagnosisTab = ({ diagnosisData }) => {
  return (
    <div className="diagnosis-content">
      {diagnosisData.map(item => (
        <div key={item.id} className="diagnosis-card">
          <div className="diagnosis-date">{item.date} • {item.doctor}</div>
          <div className="diagnosis-title">{item.title}</div>
          <div className="diagnosis-type">{item.type}</div>
          <div className="diagnosis-details">
            <p>{item.details}</p>
            <p><strong>Tests Performed:</strong> {item.tests.join(', ')}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default DiagnosisTab;