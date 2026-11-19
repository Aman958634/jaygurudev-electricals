import { ArrowRight, Check, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import SectionTitle from "../common/SectionTitle.jsx";
import showroom from "../../assets/images/showroom-interior.webp";
import { useLanguage } from "../../context/LanguageContext.jsx";
import { useSiteData } from "../../context/SiteDataContext.jsx";
import { normalizeBusinessCopy } from "../../utils/branding.js";

export default function AboutSection({ full = false }) {
  const { t } = useLanguage();
  const { pages } = useSiteData();
  const page = pages.data.find((item) => item.slug === "about");
  return (
    <section className={`section about-section${full ? " about-page-section" : ""}`} id="about">
      <div className="container about-layout">
        <div className="about-visual">
          <img src={showroom} alt={t("Warm modern living space with decorative lighting")} loading="lazy" />
          <div className="about-image-note"><Sparkles size={18} /><span>{t("For home, shop")}<br />{t("and project")}</span></div>
        </div>
        <div className="about-copy">
          <SectionTitle eyebrow="About Jay Gurudev" title={t(normalizeBusinessCopy(page?.title || "Your local partner for"))} highlight={t(normalizeBusinessCopy(page?.heading || "electricals & appliances"))} description={t(normalizeBusinessCopy(page?.description || "JAY GURUDEV ELECTRICALS is a Palanpur showroom for electrical essentials and home appliances. We help make it easier to explore products for your home, shop or project, with practical guidance along the way."))} />
          <ul className="about-points">
            <li><Check size={17} /> {t("Electrical fittings, lighting and more")}</li>
            <li><Check size={17} /> {t("Home appliances from familiar brands")}</li>
            <li><Check size={17} /> {t("Enquiries for individual and project needs")}</li>
          </ul>
          {full ? (
            <div className="about-detail-card"><strong>{t("A straightforward way to find what you need.")}</strong><p>{t("Tell us what you’re looking for, visit the showroom, or contact the team to check product details and availability.")}</p></div>
          ) : <Link className="text-link" to="/about">{t("Get to know us")} <ArrowRight size={17} /></Link>}
        </div>
      </div>
    </section>
  );
}
