import { Clock3, Mail, MapPin, Phone, ArrowUpRight } from "lucide-react";
import { getWhatsAppUrl } from "../../utils/whatsapp.js";
import SectionTitle from "../common/SectionTitle.jsx";
import WhatsAppIcon from "../common/WhatsAppIcon.jsx";
import { useLanguage } from "../../context/LanguageContext.jsx";
import { useSiteData } from "../../context/SiteDataContext.jsx";
import ResourceFeedback from "../common/ResourceFeedback.jsx";

export default function ContactSection() {
  const { t } = useLanguage();
  const { business, settings, refresh } = useSiteData();
  return (
    <section className="section contact-section" id="contact">
      <div className="container">
        <div className="contact-heading">
          <SectionTitle eyebrow="Let's connect" title="Looking for something" highlight="specific?" description="Call, message or stop by the showroom. We’ll be happy to help you with your enquiry." />
        </div>
        {settings.error && <ResourceFeedback error={settings.error} onRetry={() => refresh("settings")} />}
        <div className="contact-layout">
          <div className="contact-details">
            <a className="contact-card" href={business.mapsUrl} target="_blank" rel="noreferrer">
              <span className="contact-icon"><MapPin size={21} /></span><span><small>{t("Find our showroom")}</small><strong>{business.address}</strong><em>{t("Get directions")} <ArrowUpRight size={14} /></em></span>
            </a>
            <a className="contact-card" href={`tel:${business.phone.replace(/\s/g, "")}`}>
              <span className="contact-icon"><Phone size={20} /></span><span><small>{t("Call us")}</small><strong>{business.phone}</strong><em>{t("Speak with our team")} <ArrowUpRight size={14} /></em></span>
            </a>
            <a className="contact-card" href={`mailto:${business.email}`}>
              <span className="contact-icon"><Mail size={20} /></span><span><small>{t("Email")}</small><strong>{business.email}</strong><em>{t("Send us an email")} <ArrowUpRight size={14} /></em></span>
            </a>
            <div className="contact-card contact-hours">
              <span className="contact-icon"><Clock3 size={20} /></span><span><small>{t("Opening hours")}</small><strong>{business.hours}</strong><em>{t("We look forward to seeing you")}</em></span>
            </div>
            <a className="button button-primary contact-whatsapp" href={getWhatsAppUrl(undefined, business)} target="_blank" rel="noreferrer"><WhatsAppIcon className="whatsapp-icon" /> {t("Message us on WhatsApp")} <ArrowUpRight size={17} /></a>
          </div>
          <div className="map-frame">
            <iframe title={t("Map showing the area near JAY GURUDEV ELECTRICALS, Palanpur")} src={`https://maps.google.com/maps?q=${encodeURIComponent(business.address)}&output=embed`} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
            <a className="map-label" href={business.mapsUrl} target="_blank" rel="noreferrer"><MapPin size={17} /><span><strong>{business.name}</strong><small>{business.address}</small></span><ArrowUpRight size={17} /></a>
          </div>
        </div>
      </div>
    </section>
  );
}
