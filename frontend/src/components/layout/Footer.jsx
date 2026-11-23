import { Link } from "react-router-dom";
import { Facebook, Instagram, Linkedin, Mail, MapPin, Phone, Youtube } from "lucide-react";
import { NAV_LINKS } from "../../utils/constants.js";
import { getWhatsAppUrl } from "../../utils/whatsapp.js";
import WhatsAppIcon from "../common/WhatsAppIcon.jsx";
import { useLanguage } from "../../context/LanguageContext.jsx";
import { useSiteData } from "../../context/SiteDataContext.jsx";
import ResourceFeedback from "../common/ResourceFeedback.jsx";
import logo from "../../assets/images/jay-gurudevv-logo.jpg";

export default function Footer() {
  const { t } = useLanguage();
  const { business, categories, refresh } = useSiteData();
  const socialLinks = [
    { key: "socialFacebook", label: "Facebook", Icon: Facebook },
    { key: "socialInstagram", label: "Instagram", Icon: Instagram },
    { key: "socialYouTube", label: "YouTube", Icon: Youtube },
    { key: "socialLinkedIn", label: "LinkedIn", Icon: Linkedin },
    { key: "socialWhatsApp", label: "WhatsApp", Icon: WhatsAppIcon },
  ].flatMap(({ key, label, Icon }) => {
    try {
      const url = new URL(business[key]);
      return ["http:", "https:"].includes(url.protocol) ? [{ label, Icon, url: url.href }] : [];
    } catch {
      return [];
    }
  });
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div className="footer-brand">
          <Link className="brand-lockup" to="/" aria-label={t(`${business.name} home`)}>
            <img className="brand-logo" src={logo} alt={business.name} />
          </Link>
          <p>{t(business.footerDescription || business.tagline || "Electrical essentials, lighting and home appliances for homes, shops and projects in Palanpur.")}</p>
        </div>
        <div>
          <h3>{t("Explore")}</h3>
          {NAV_LINKS.map(({ label, to }) => <Link className="footer-link" key={to} to={to}>{t(label)}</Link>)}
        </div>
        <div>
          <h3>{t("Product categories")}</h3>
          <ResourceFeedback loading={categories.loading} error={categories.error} empty={!categories.data.length} onRetry={() => refresh("categories")} emptyMessage={t("No categories available.")} />
          {!categories.loading && !categories.error && categories.data.slice(0, 6).map(({ id, slug, name }) => <Link className="footer-link" key={id || slug || name} to={`/products?category=${encodeURIComponent(slug || name)}`}>{t(name)}</Link>)}
        </div>
        <div className="footer-contact">
          <h3>{t("Get in touch")}</h3>
          <a href={`tel:${business.phone.replace(/\s/g, "")}`}><Phone size={16} /> {business.phone}</a>
          {business.secondaryPhone && <a href={`tel:${business.secondaryPhone.replace(/\s/g, "")}`}><Phone size={16} /> {business.secondaryPhone}</a>}
          <a href={getWhatsAppUrl(undefined, business)} target="_blank" rel="noreferrer"><WhatsAppIcon className="whatsapp-icon" /> {t("WhatsApp us")}</a>
          <a href={`mailto:${business.email}`}><Mail size={16} /> {business.email}</a>
          <a href={business.mapsDirectionsUrl || business.mapsUrl} target="_blank" rel="noopener noreferrer"><MapPin size={16} /> {business.address}</a>
          <span>{t(business.hours)}</span>
          {socialLinks.length > 0 && <div className="footer-social-links" aria-label={t("Social media links")}>
            {socialLinks.map(({ label, Icon, url }) => <a key={label} href={url} target="_blank" rel="noopener noreferrer" aria-label={label}>{label === "WhatsApp" ? <Icon className="whatsapp-icon" /> : <Icon size={17} />}</a>)}
          </div>}
        </div>
      </div>
      <div className="container footer-bottom">
        <span>© {new Date().getFullYear()} {business.name}. {t("All rights reserved.")}</span>
        <span>{t(business.footerNote || "Product availability and pricing shared on enquiry.")}</span>
      </div>
    </footer>
  );
}
