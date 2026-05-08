import React, { createContext, useContext, useState } from 'react';

const TabContext = createContext();

export const TabProvider = ({ children, defaultTab = 'appointment' }) => {
  const [activeTab, setActiveTab] = useState(defaultTab);

  return (
    <TabContext.Provider value={{ activeTab, setActiveTab }}>
      {children}
    </TabContext.Provider>
  );
};

export const useTab = () => useContext(TabContext);
