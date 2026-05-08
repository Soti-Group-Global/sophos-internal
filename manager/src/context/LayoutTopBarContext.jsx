import { createContext, useContext, useState } from "react";

const LayoutTopBarContext = createContext({
  topBarContent: null,
  setTopBarContent: () => {},
});

export const LayoutTopBarProvider = ({ children }) => {
  const [topBarContent, setTopBarContent] = useState(null);

  return (
    <LayoutTopBarContext.Provider value={{ topBarContent, setTopBarContent }}>
      {children}
    </LayoutTopBarContext.Provider>
  );
};

export const useLayoutTopBar = () => useContext(LayoutTopBarContext);
