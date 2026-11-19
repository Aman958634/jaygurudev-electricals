import { Phone } from "lucide-react";
import { getWhatsAppUrl } from "../../utils/whatsapp.js";
import WhatsAppIcon from "./WhatsAppIcon.jsx";
import { useLanguage } from "../../context/LanguageContext.jsx";
import { useSiteData } from "../../context/SiteDataContext.jsx";
import { useEnquiry } from "../../context/EnquiryContext.jsx";

export default function WhatsAppButton() {
  const { t } = useLanguage();
  const { business } = useSiteData();
  const { enquiryItems, openEnquiryList } = useEnquiry();
  return (
    <>
      {enquiryItems.length > 0 && <button className="floating-enquiry-list" type="button" onClick={openEnquiryList} aria-label={t("Enquiry list ({count})", { count: enquiryItems.length })}>
        <span>{t("Enquiry list ({count})", { count: enquiryItems.length })}</span>
      </button>}
      <a className="floating-whatsapp" href={getWhatsAppUrl(undefined, business)} target="_blank" rel="noreferrer" aria-label={t("Chat with us on WhatsApp")}>
        <WhatsAppIcon className="whatsapp-icon whatsapp-icon--inverse" />
        <span>WhatsApp</span>
      </a>
      <div className="mobile-contact-dock">
        <a href={`tel:${business.phone.replace(/\s/g, "")}`}><Phone size={18} /> {t("Call")}</a>
        <a href={getWhatsAppUrl(undefined, business)} target="_blank" rel="noreferrer"><WhatsAppIcon className="whatsapp-icon whatsapp-icon--inverse" /> WhatsApp</a>
      </div>
    </>
  );
}
