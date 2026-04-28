// context/PatientContext.js
import { createContext, useContext, useState } from "react";

const PatientContext = createContext();

export const PatientProvider = ({ children }) => {
  const [currentPatient, setCurrentPatient] = useState(null);

  return (
    <PatientContext.Provider value={{ currentPatient, setCurrentPatient }}>
      {children}
    </PatientContext.Provider>
  );
};

export const usePatient = () => useContext(PatientContext);
