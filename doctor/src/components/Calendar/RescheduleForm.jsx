import React, { useState } from "react";

const RescheduleForm = ({ appointment, onCancel, onSuccess }) => {
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");
    
    try {
      // API call to send reschedule request would go here
      console.log("Reschedule request sent:", { 
        appointmentId: appointment._id, 
        reason 
      });
      onSuccess();
    } catch (err) {
      setError("Failed to send reschedule request. Please try again.");
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 max-w-md mx-auto bg-white rounded-lg shadow-md">
      <h3 className="text-xl font-semibold mb-4 text-gray-800">Request Reschedule</h3>
      
      <div className="mb-6 space-y-2 text-gray-600">
        <p><span className="font-medium">Patient:</span> {appointment.patient}</p>
        <p><span className="font-medium">Current Date:</span> {appointment.date}</p>
        <p><span className="font-medium">Time:</span> {appointment.startTime} - {appointment.endTime}</p>
      </div>
      
      <form onSubmit={handleSubmit}>
        <div className="mb-6">
          <label htmlFor="reason" className="block mb-2 font-medium text-gray-700">
            Reason for Reschedule
          </label>
          <textarea
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
            className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[120px]"
            rows={4}
            placeholder="Please explain why you need to reschedule..."
          />
        </div>
        
        {error && (
          <div className="mb-4 p-2 bg-red-100 text-red-700 rounded-md">
            {error}
          </div>
        )}
        
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !reason.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </span>
            ) : "Send Request"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default RescheduleForm;