import { Phone } from "lucide-react";
import { getWhatsAppUrl } from "../../utils/whatsapp.js";
import WhatsAppIcon from "./WhatsAppIcon.jsx";
import { useLanguage } from "../../context/LanguageContext.jsx";
import { useSiteData } from "../../context/SiteDataContext.jsx";

export default function WhatsAppButton() {
  const { t } = useLanguage();
  const { business } = useSiteData();
  return (
    <>
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
