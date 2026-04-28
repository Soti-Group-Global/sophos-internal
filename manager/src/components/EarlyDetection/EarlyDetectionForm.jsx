import React, { useState } from 'react';
import './EarlyDetection.css';

const EarlyDetectionForm = ({ formData, updateFormData, nextStep, prevStep }) => {
  const [answers, setAnswers] = useState(formData.answers || {});

  const questions = [
    {
      id: 1,
      question: "Have you noticed any unusual changes in your skin recently?",
      options: ["Yes", "No", "Not sure"]
    },
    {
      id: 2,
      question: "Do you have a family history of skin cancer?",
      options: ["Yes", "No", "Not sure"]
    },
    {
      id: 3,
      question: "How often do you use sunscreen when going outdoors?",
      options: ["Always", "Sometimes", "Rarely", "Never"]
    },
    {
      id: 4,
      question: "Have you experienced any skin irritation or itching?",
      options: ["Yes, frequently", "Yes, occasionally", "No", "Not sure"]
    },
    {
      id: 5,
      question: "How would you describe your sun exposure habits?",
      options: ["Minimal", "Moderate", "High", "Very high"]
    }
  ];

  const handleAnswerChange = (questionId, answer) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    updateFormData({ answers });
    nextStep();
  };

  const allQuestionsAnswered = questions.every(q => answers[q.id]);

  return (
    <div className="step-container">
      <h2>Early Detection Questions</h2>
      <p>Please answer the following questions to help us assess your skin health.</p>

      <form onSubmit={handleSubmit} className="questions-form">
        {questions.map((question) => (
          <div key={question.id} className="question-group">
            <label className="question-label">
              {question.id}. {question.question}
            </label>
            <div className="options-group">
              {question.options.map((option) => (
                <label key={option} className="option-label">
                  <input
                    type="radio"
                    name={`question-${question.id}`}
                    value={option}
                    checked={answers[question.id] === option}
                    onChange={() => handleAnswerChange(question.id, option)}
                    required
                  />
                  {option}
                </label>
              ))}
            </div>
          </div>
        ))}

        <div className="form-navigation">
          <button type="button" onClick={prevStep} className="back-btn">
            Back
          </button>
          <button 
            type="submit" 
            className="next-btn"
            disabled={!allQuestionsAnswered}
          >
            Continue to Packages
          </button>
        </div>
      </form>
    </div>
  );
};

export default EarlyDetectionForm;