import { ArrowRight, BadgeCheck, Boxes, Lightbulb, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import { useEnquiry } from "../../context/EnquiryContext.jsx";
import { useLanguage } from "../../context/LanguageContext.jsx";
import { useSiteData } from "../../context/SiteDataContext.jsx";

const benefits = [
  { icon: Lightbulb, title: "Lighting & Electricals", text: "Fittings & accessories", to: "/categories" },
  { icon: Boxes, title: "Home appliances", text: "Explore the catalogue", to: "/products?category=home-appliances" },
];

export default function TrustBadges() {
  const { t } = useLanguage();
  const { business } = useSiteData();
  const { openWholesale } = useEnquiry();
  return (
    <section className="trust-strip" aria-label={t("Store information")}>
      <div className="trust-grid">
        {benefits.map(({ icon: Icon, title, text, to }) => (
          <Link className="trust-item" key={title} to={to}>
            <span className="trust-icon"><Icon size={22} /></span>
            <span className="trust-copy"><strong>{t(title)}</strong><small>{t(text)}</small></span>
            <ArrowRight className="trust-arrow" size={18} aria-hidden="true" />
          </Link>
        ))}
        <button className="trust-item" type="button" onClick={openWholesale}>
          <span className="trust-icon"><BadgeCheck size={22} /></span>
          <span className="trust-copy"><strong>{t("Wholesale enquiries")}</strong><small>{t("For larger requirements")}</small></span>
          <ArrowRight className="trust-arrow" size={18} aria-hidden="true" />
        </button>
        <Link className="trust-item trust-location" to="/contact">
          <span className="trust-icon"><MapPin size={22} /></span>
          <span className="trust-copy"><strong>{t("Visit our showroom")}</strong><small>{business.address}</small></span>
          <ArrowRight className="trust-arrow" size={18} aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
