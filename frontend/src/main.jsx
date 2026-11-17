import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { EnquiryProvider } from "./context/EnquiryContext.jsx";
import { LanguageProvider } from "./context/LanguageContext.jsx";
import { SiteDataProvider } from "./context/SiteDataContext.jsx";
import "./styles/global.css";
import "./styles/responsive.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <LanguageProvider>
        <EnquiryProvider>
          <SiteDataProvider>
            <App />
          </SiteDataProvider>
        </EnquiryProvider>
      </LanguageProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
