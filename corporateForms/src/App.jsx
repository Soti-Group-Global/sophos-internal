import { useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Header from "./components/Header.jsx";
import CorporateForm from "./pages/CorporateForm.jsx";
import CorporateResults from "./pages/CorporateResults.jsx";
import NotFound from "./pages/NotFound.jsx";

const App = () => {
  const [lang, setLang] = useState("en");

  return (
    <BrowserRouter>
      <ToastContainer position="top-right" autoClose={3000} />
      <Header lang={lang} onLangChange={setLang} />
      <Routes>
        <Route path="/:link" element={<CorporateForm lang={lang} />} />
        <Route path="/:link/results" element={<CorporateResults lang={lang} />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
