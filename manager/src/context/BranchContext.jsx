import { createContext, useContext, useState, useEffect } from "react";

const BranchContext = createContext();

export const BranchProvider = ({ children }) => {
  const [selectedBranch, setSelectedBranch] = useState(
    sessionStorage.getItem("selectedBranch") || "All"
  );

  // Persist branch during session (refresh-safe)
  useEffect(() => {
    sessionStorage.setItem("selectedBranch", selectedBranch);
  }, [selectedBranch]);

  return (
    <BranchContext.Provider value={{ selectedBranch, setSelectedBranch }}>
      {children}
    </BranchContext.Provider>
  );
};

export const useBranch = () => useContext(BranchContext);
