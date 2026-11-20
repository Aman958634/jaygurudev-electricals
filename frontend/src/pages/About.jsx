import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import AboutSection from "../components/home/AboutSection.jsx";
import PageHeading from "../components/common/PageHeading.jsx";
import { getWhatsAppUrl } from "../utils/whatsapp.js";
import WhatsAppIcon from "../components/common/WhatsAppIcon.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { useSiteData } from "../context/SiteDataContext.jsx";
import Seo from "../components/common/Seo.jsx";

export default function About() {
  const { t } = useLanguage();
  const { business } = useSiteData();
  return (
    <>
      <Seo
        title="About JAY GURUDEV ELECTRIICALS | Palanpur"
        description="Learn about JAY GURUDEV ELECTRIICALS, a local destination for electrical products, lighting and home appliances in Palanpur, Gujarat."
        canonicalPath="/about"
      />
      <PageHeading slug="about" fallback={{ eyebrow: "About our showroom", title: "Rooted in", highlight: "Palanpur", description: "A local destination for electrical essentials and home appliances." }} />
      <AboutSection full />
      <section className="section about-visit-section">
        <div className="container about-visit-card">
          <div><span className="eyebrow">{t("Come say hello")}</span><h2>{t("Let's find what your space needs.")}</h2><p>{t("Visit us at {address}, or contact us before your visit.", { address: business.address })}</p></div>
          <div className="about-visit-actions">
            <Link className="button button-outline" to="/contact">{t("Visit & contact details")} <ArrowRight size={17} /></Link>
            <a className="button button-primary" href={getWhatsAppUrl(undefined, business)} target="_blank" rel="noreferrer"><WhatsAppIcon className="whatsapp-icon" /> {t("Message us")}</a>
          </div>
        </div>
      </section>
    </>
  );
}
