import { ShieldCheck } from "lucide-react";
import { getWhatsAppUrl } from "../../utils/whatsapp.js";
import WhatsAppIcon from "../common/WhatsAppIcon.jsx";
import { useLanguage } from "../../context/LanguageContext.jsx";
import { useSiteData } from "../../context/SiteDataContext.jsx";

export default function Testimonials() {
  const { t } = useLanguage();
  const { business } = useSiteData();
  return (
    <section className="section testimonials-section">
      <div className="container feedback-card">
        <span className="feedback-icon"><ShieldCheck size={25} /></span>
        <span className="eyebrow">{t("Your feedback matters")}</span>
        <h2>{t("Have you visited us?")}</h2>
        <p>{t("We value honest feedback from our customers. Get in touch directly — we only publish reviews that have been verified.")}</p>
        <a className="button button-outline" href={getWhatsAppUrl(t("Hello JAY GURUDEVV ELECTRIICALS, I would like to share feedback about my experience."), business)} target="_blank" rel="noreferrer"><WhatsAppIcon className="whatsapp-icon" /> {t("Share feedback")}</a>
      </div>
    </section>
  );
}
