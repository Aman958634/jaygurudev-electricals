import { ArrowRight, BadgeCheck, FileText, Lightbulb, Plug, ShieldCheck, Star } from "lucide-react";
import Button from "../common/Button.jsx";
import { useLanguage } from "../../context/LanguageContext.jsx";
import showroom from "../../assets/images/reference-showroom-hero.webp";
import { useSiteData } from "../../context/SiteDataContext.jsx";
import ResourceFeedback from "../common/ResourceFeedback.jsx";
import { getHeroContent } from "../../utils/pageContent.js";
import { useEnquiry } from "../../context/EnquiryContext.jsx";
import { getRetailEnquiryMessage, getWhatsAppUrl } from "../../utils/whatsapp.js";
import WhatsAppIcon from "../common/WhatsAppIcon.jsx";

const assurances = [
  { icon: BadgeCheck, label: "Electricals" },
  { icon: ShieldCheck, label: "Home appliances" },
  { icon: Lightbulb, label: "Lighting" },
  { icon: Plug, label: "Switches & fittings" },
];

export default function Hero() {
  const { language, t } = useLanguage();
  const { business, homePage, pages, statistics, refresh } = useSiteData();
  const { openDealerQuotation } = useEnquiry();
  const savedHomePage = !Array.isArray(homePage.data) && homePage.data
    ? homePage.data
    : pages.data.find((item) => item.slug === "home");
  const heroContent = getHeroContent(savedHomePage);
  const displayedStatistics = statistics.data.filter((statistic) =>
    ["google_rating", "happy_reviews", "years_of_service"].includes(statistic.metric_key),
  );
  return (
    <section className="hero-section" id="home">
      <div className="container hero-layout">
        <div className="hero-copy">
          <span className="hero-kicker"><span className="kicker-dot" /> {t("Trusted electrical destination in Palanpur")}</span>
          <h1>{t(heroContent.title)}<br /><span>{t(heroContent.heading)}</span></h1>
          <p className="hero-description" lang={language}>{t(heroContent.description)}</p>
          <div className="hero-assurances">
            {assurances.map(({ icon: Icon, label }) => <span key={label}><Icon size={17} /> {t(label)}</span>)}
          </div>
          <div className="hero-actions">
            <Button type="button" onClick={openDealerQuotation}>
              <FileText size={15} aria-hidden="true" /> {t("Get Dealer Quotation")} <ArrowRight size={15} />
            </Button>
            <Button className="button-whatsapp" href={getWhatsAppUrl(getRetailEnquiryMessage(business), business)} target="_blank" rel="noreferrer">
              <WhatsAppIcon className="whatsapp-icon whatsapp-icon--inverse" /> {t("Ask Price & Stock on WhatsApp")}
            </Button>
            <Button to="/contact" variant="light"><MapPinIcon /> {t("Visit Our Showroom")} <ArrowRight size={15} /></Button>
          </div>
          <div className="hero-statistics" aria-label={t("Customer trust and experience")}>
            {displayedStatistics.map((statistic) => {
              const isGoogleStatistic = ["google_rating", "happy_reviews"].includes(statistic.metric_key);
              const Statistic = isGoogleStatistic ? "a" : "div";
              return (
              <Statistic className={`hero-stat${isGoogleStatistic ? " hero-stat--google" : ""}`} key={statistic.metric_key} {...(isGoogleStatistic ? { href: business.mapsUrl, target: "_blank", rel: "noopener noreferrer", "aria-label": `${statistic.label}: ${statistic.metric_value}. Open the Google Business listing.` } : {})}>
                <strong>{statistic.metric_value} {statistic.metric_key === "google_rating" && <Star size={15} fill="currentColor" aria-hidden="true" />}</strong>
                <span>{t(statistic.label)}</span>
              </Statistic>
              );
            })}
          </div>
          {statistics.error && <ResourceFeedback error={statistics.error} onRetry={() => refresh("statistics")} />}
          <a className="hero-location" href={business.mapsDirectionsUrl || business.mapsUrl} target="_blank" rel="noopener noreferrer">
            {business.address} <span aria-hidden="true">↗</span>
          </a>
          {pages.error && <ResourceFeedback error={pages.error} onRetry={() => refresh("pages")} />}
          {homePage.error && <ResourceFeedback error={homePage.error} onRetry={() => refresh("homePage")} />}
        </div>
        <div className="hero-visual">
          <img
            className="hero-showroom-image"
            src={showroom}
            alt={t("Electrical showroom with lighting, appliances and electrical supplies")}
            loading="eager"
          />
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
