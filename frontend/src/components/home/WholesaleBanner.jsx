import { ArrowRight, Boxes } from "lucide-react";
import { useEnquiry } from "../../context/EnquiryContext.jsx";
import WhatsAppIcon from "../common/WhatsAppIcon.jsx";
import { useLanguage } from "../../context/LanguageContext.jsx";
import { getWhatsAppUrl } from "../../utils/whatsapp.js";
import { useSiteData } from "../../context/SiteDataContext.jsx";

export default function WholesaleBanner() {
  const { openWholesale } = useEnquiry();
  const { t } = useLanguage();
  const { business } = useSiteData();
  const catalogueUrl = getHttpsUrl(business.catalogueUrl)
    || getWhatsAppUrl(`${t("Hello")} ${business.name}, ${t("Please share your product catalogue.")}`, business);
  const wholesalePriceUrl = getWhatsAppUrl(`${t("Hello")} ${business.name}, ${t("Please share wholesale pricing for my requirements.")}`, business);
  return (
    <section className="container wholesale-wrap">
      <div className="wholesale-banner">
        <div className="wholesale-icon"><Boxes size={28} /></div>
        <div className="wholesale-copy">
          <span className="eyebrow">{t("For dealers & contractors")}</span>
          <h2>{t("One enquiry for your")} <span>{t("next project.")}</span></h2>
          <p>{t("Share the products, quantities and delivery details you need. We’ll get back to you on WhatsApp.")}</p>
        </div>
        <div className="wholesale-actions">
          <a className="button button-outline button-wholesale-secondary" href={catalogueUrl} target="_blank" rel="noopener noreferrer">{t("Get Catalogue")} <ArrowRight size={16} /></a>
          <a className="button button-outline button-wholesale-secondary" href={wholesalePriceUrl} target="_blank" rel="noopener noreferrer">{t("Ask Wholesale Price")} <WhatsAppIcon className="whatsapp-icon" /></a>
          <button className="button button-light" type="button" onClick={openWholesale}><WhatsAppIcon className="whatsapp-icon" /> {t("Start wholesale enquiry")} <ArrowRight size={17} /></button>
        </div>
      </div>
    </section>
  );
}

function getHttpsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}
