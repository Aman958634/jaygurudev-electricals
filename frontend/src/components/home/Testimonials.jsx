import { ShieldCheck } from "lucide-react";
import { getWhatsAppUrl } from "../../utils/whatsapp.js";
import WhatsAppIcon from "../common/WhatsAppIcon.jsx";
import { useLanguage } from "../../context/LanguageContext.jsx";
import { useSiteData } from "../../context/SiteDataContext.jsx";

export default function Testimonials() {
  const { t } = useLanguage();
  const { business } = useSiteData();
  const googleReviewUrl = (() => {
    if (business.googleReviewVerified !== "true") return null;
    try {
      const url = new URL(business.googleReviewUrl);
      return url.protocol === "https:" ? url.href : null;
    } catch {
      return null;
    }
  })();
  return (
    <section className="section testimonials-section">
      <div className="container feedback-card">
        <span className="feedback-icon"><ShieldCheck size={25} /></span>
        <span className="eyebrow">{t("Your feedback matters")}</span>
        <h2>{t("Have you visited us?")}</h2>
        <p>{t("Your feedback helps us improve. Share your experience with our team directly.")}</p>
        <a className="button button-outline" href={getWhatsAppUrl(`${t("Hello")} ${business.name}, ${t("I would like to share feedback about my experience.")}`, business)} target="_blank" rel="noreferrer"><WhatsAppIcon className="whatsapp-icon" /> {t("Share feedback")}</a>
        {googleReviewUrl && <a className="button button-outline" href={googleReviewUrl} target="_blank" rel="noopener noreferrer">{t("Read our Google Reviews")}</a>}
      </div>
    </section>
  );
}
