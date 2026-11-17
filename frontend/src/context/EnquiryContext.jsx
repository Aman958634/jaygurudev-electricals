import { createContext, useContext, useMemo, useState } from "react";

const EnquiryContext = createContext(null);

export function EnquiryProvider({ children }) {
  const [wholesaleOpen, setWholesaleOpen] = useState(false);
  const value = useMemo(() => ({
    wholesaleOpen,
    openWholesale: () => setWholesaleOpen(true),
    closeWholesale: () => setWholesaleOpen(false),
  }), [wholesaleOpen]);

  return <EnquiryContext.Provider value={value}>{children}</EnquiryContext.Provider>;
}

export function useEnquiry() {
  const context = useContext(EnquiryContext);
  if (!context) throw new Error("useEnquiry must be used within an EnquiryProvider");
  return context;
}
