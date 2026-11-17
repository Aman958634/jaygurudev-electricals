import { ArrowRight, Boxes } from "lucide-react";
import { useEnquiry } from "../../context/EnquiryContext.jsx";
import WhatsAppIcon from "../common/WhatsAppIcon.jsx";
import { useLanguage } from "../../context/LanguageContext.jsx";

export default function WholesaleBanner() {
  const { openWholesale } = useEnquiry();
  const { t } = useLanguage();
  return (
    <section className="container wholesale-wrap">
      <div className="wholesale-banner">
        <div className="wholesale-icon"><Boxes size={28} /></div>
        <div className="wholesale-copy">
          <span className="eyebrow">{t("For dealers & contractors")}</span>
          <h2>{t("One enquiry for your")} <span>{t("next project.")}</span></h2>
          <p>{t("Share the products, quantities and delivery details you need. We’ll get back to you on WhatsApp.")}</p>
        </div>
        <button className="button button-light" onClick={openWholesale}><WhatsAppIcon className="whatsapp-icon" /> {t("Start wholesale enquiry")} <ArrowRight size={17} /></button>
      </div>
    </section>
  );
}
