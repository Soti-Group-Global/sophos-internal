import React, { useState } from 'react';

const PackageSelection = ({ formData, updateFormData, nextStep, prevStep, onSubmit }) => {
  const [selectedPackage, setSelectedPackage] = useState(formData.selectedPackage || null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const packages = [
    {
      id: 'basic',
      name: 'Basic Screening',
      price: 99,
      features: [
        'Basic skin analysis',
        'General recommendations',
        'PDF report',
        'Email support'
      ]
    },
    {
      id: 'standard',
      name: 'Standard Package',
      price: 199,
      features: [
        'Comprehensive skin analysis',
        'Personalized recommendations',
        'Detailed PDF report',
        'Priority email support',
        '1 follow-up consultation'
      ],
      recommended: true
    },
    {
      id: 'premium',
      name: 'Premium Care',
      price: 399,
      features: [
        'Advanced skin analysis with AI',
        'Custom treatment plan',
        'Detailed PDF report + video consultation',
        '24/7 support',
        '3 follow-up consultations',
        'Discount on future services'
      ]
    }
  ];

  const handlePackageSelect = (pkg) => {
    setSelectedPackage(pkg);
  };

const handleSubmit = async (e) => {
  e.preventDefault();
  setIsProcessing(true);

  const finalData = { ...formData, selectedPackage };

  setTimeout(() => {
    updateFormData(finalData);
    onSubmit(finalData);  // Pass full form data to parent
    setIsProcessing(false);
  }, 2000);
};





  return (
    <div className="step-container">
      <h2>Select a Package</h2>
      <p>Choose the package that best fits your needs.</p>

      <form onSubmit={handleSubmit} className="packages-form">
        <div className="packages-grid">
          {packages.map((pkg) => (
            <div
              key={pkg.id}
              className={`package-card ${selectedPackage?.id === pkg.id ? 'selected' : ''} ${
                pkg.recommended ? 'recommended' : ''
              }`}
              onClick={() => handlePackageSelect(pkg)}
            >
              {pkg.recommended && <div className="recommended-badge">Recommended</div>}
              <h3>{pkg.name}</h3>
              <div className="package-price">${pkg.price}</div>
              <ul className="package-features">
                {pkg.features.map((feature, index) => (
                  <li key={index}>{feature}</li>
                ))}
              </ul>
              <div className="package-select">
                <input
                  type="radio"
                  name="package"
                  checked={selectedPackage?.id === pkg.id}
                  onChange={() => handlePackageSelect(pkg)}
                  required
                />
                Select
              </div>
            </div>
          ))}
        </div>

        <div className="form-navigation">
          <button type="button" onClick={prevStep} className="back-btn">
            Back
          </button>
          <button 
            type="submit" 
            className="next-btn"
            disabled={!selectedPackage}
          >
            Submit the EarlyDetection Form
          </button>
        </div>
      </form>
    </div>
  );
};

export default PackageSelection;