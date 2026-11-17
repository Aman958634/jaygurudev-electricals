import { ArrowRight, BadgeCheck, Lightbulb, Plug, ShieldCheck, Star } from "lucide-react";
import Button from "../common/Button.jsx";
import WhatsAppIcon from "../common/WhatsAppIcon.jsx";
import { getWhatsAppUrl } from "../../utils/whatsapp.js";
import { useLanguage } from "../../context/LanguageContext.jsx";
import showroom from "../../assets/images/reference-showroom-hero.webp";
import { useSiteData } from "../../context/SiteDataContext.jsx";
import ResourceFeedback from "../common/ResourceFeedback.jsx";

const assurances = [
  { icon: BadgeCheck, label: "Electricals" },
  { icon: ShieldCheck, label: "Home appliances" },
  { icon: Lightbulb, label: "Lighting" },
  { icon: Plug, label: "Switches & fittings" },
];

export default function Hero() {
  const { language, t } = useLanguage();
  const { business, pages, statistics, refresh } = useSiteData();
  const homePage = pages.data.find((item) => item.slug === "home");
  const defaultStatistics = [
    { metric_key: "google_rating", metric_value: "5.0", label: "Google Rating" },
    { metric_key: "happy_reviews", metric_value: "645+", label: "Happy Reviews" },
    { metric_key: "years_of_service", metric_value: "13+", label: "Years of Service" },
  ];
  const displayedStatistics = statistics.data.length ? statistics.data : defaultStatistics;
  return (
    <section className="hero-section" id="home">
      <div className="hero-glow" aria-hidden="true" />
      <div className="container hero-layout">
        <div className="hero-copy">
          <span className="hero-kicker"><span className="kicker-dot" /> {t("Trusted electrical destination in Palanpur")}</span>
          <h1>{homePage?.title || "JAY GURUDEVV"}<br /><span>{homePage?.heading || "ELECTRIICALS"}</span></h1>
          <p className="hero-description" lang={language}>{t(homePage?.description || "Complete Electrical & Home Appliances under one roof — for your home, shop and project.")}</p>
          <div className="hero-assurances">
            {assurances.map(({ icon: Icon, label }) => <span key={label}><Icon size={17} /> {t(label)}</span>)}
          </div>
          <div className="hero-actions">
            <Button href={getWhatsAppUrl(t("Hello JAY GURUDEVV ELECTRIICALS, I would like to enquire about your products."), business)} target="_blank" rel="noreferrer">
              <WhatsAppIcon className="whatsapp-icon" /> {t("Enquire on WhatsApp")} <ArrowRight size={17} />
            </Button>
            <Button to="/contact" variant="light"><MapPinIcon /> {t("Visit Our Showroom")} <ArrowRight size={17} /></Button>
          </div>
          <div className="hero-statistics" aria-label={t("Customer trust and experience")}>
            {displayedStatistics.map((statistic) => (
              <div className="hero-stat" key={statistic.metric_key}>
                <strong>{statistic.metric_value} {statistic.metric_key === "google_rating" && <Star size={15} fill="currentColor" aria-hidden="true" />}</strong>
                <span>{t(statistic.label)}</span>
              </div>
            ))}
          </div>
          {statistics.error && <ResourceFeedback error={statistics.error} onRetry={() => refresh("statistics")} />}
          <a className="hero-location" href={business.mapsUrl} target="_blank" rel="noreferrer">
            {business.address} <span aria-hidden="true">↗</span>
          </a>
          {pages.error && <ResourceFeedback error={pages.error} onRetry={() => refresh("pages")} />}
        </div>
        <div className="hero-visual">
          <img className="hero-showroom-image" src={showroom} alt="" aria-hidden="true" />
          <div className="hero-image-shade" />
          <div className="hero-pendants" aria-hidden="true">
            <div className="hero-pendant hero-pendant--one">
              <span className="hero-pendant-wire" />
              <span className="hero-pendant-socket" />
              <span className="hero-pendant-bulb" />
            </div>
            <div className="hero-pendant hero-pendant--two">
              <span className="hero-pendant-wire" />
              <span className="hero-pendant-socket" />
              <span className="hero-pendant-bulb" />
            </div>
            <div className="hero-pendant hero-pendant--three">
              <span className="hero-pendant-wire" />
              <span className="hero-pendant-socket" />
              <span className="hero-pendant-bulb" />
            </div>
          </div>
          <div className="hero-badge-pendant">
            <span className="hero-badge-wire" aria-hidden="true" />
            <div className="hero-experience-badge" aria-label={t("13 plus years of trust, experience and quality")}>
              <div className="hero-badge-content">
                <strong>13+</strong>
                <span className="hero-badge-trust">{t("YEARS OF TRUST")}</span>
                <span className="hero-badge-quality">{t("EXPERIENCE & QUALITY")}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function MapPinIcon() {
  return <span aria-hidden="true">⌖</span>;
}
