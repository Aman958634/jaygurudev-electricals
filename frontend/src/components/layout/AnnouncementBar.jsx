import { Clock3, MapPin, Phone } from "lucide-react";
import { getWhatsAppUrl } from "../../utils/whatsapp.js";
import WhatsAppIcon from "../common/WhatsAppIcon.jsx";
import { useLanguage } from "../../context/LanguageContext.jsx";
import { useSiteData } from "../../context/SiteDataContext.jsx";

export default function AnnouncementBar() {
  const { t } = useLanguage();
  const { business } = useSiteData();
  return (
    <div className="announcement-bar">
      <div className="container announcement-inner">
        <a className="announcement-location" href={business.mapsUrl} target="_blank" rel="noreferrer">
          <MapPin size={14} /> {business.address}
        </a>
        <div className="announcement-actions">
          <span><Clock3 size={14} /> {t(business.hours)}</span>
          <a href={`tel:${business.phone.replace(/\s/g, "")}`}><Phone size={14} /> {business.phone}</a>
          <a href={getWhatsAppUrl(undefined, business)} target="_blank" rel="noreferrer"><WhatsAppIcon className="whatsapp-icon" /> {t("WhatsApp Now")} <span aria-hidden="true">↗</span></a>
        </div>
      </div>
    </div>
  );
}
