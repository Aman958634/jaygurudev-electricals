import { ArrowRight, Lightbulb, Refrigerator } from "lucide-react";
import { Link } from "react-router-dom";
import { useLanguage } from "../../context/LanguageContext.jsx";
import { useSiteData } from "../../context/SiteDataContext.jsx";
import { resolveMediaUrl } from "../../services/api.js";
import ResourceFeedback from "../common/ResourceFeedback.jsx";

export default function HomePromoBanners() {
  const { t } = useLanguage();
  const { banners, refresh } = useSiteData();
  return (
    <section className="container promo-grid" aria-label={t("Featured categories")}>
      <ResourceFeedback loading={banners.loading} error={banners.error} empty={!banners.data.length} onRetry={() => refresh("banners")} emptyMessage={t("No promotions are available right now.")} />
      {!banners.loading && !banners.error && banners.data.map((banner) => {
        const category = banner.category || "";
        const Icon = /appliance/i.test(category) ? Refrigerator : Lightbulb;
        const className = /appliance/i.test(category) ? "promo-appliances" : "promo-lighting";
        const fallbackTarget = `/products?category=${encodeURIComponent(category)}`;
        const configuredTarget = banner.link_url || "";
        const externalTarget = /^https?:\/\//i.test(configuredTarget) ? configuredTarget : null;
        const internalTarget = configuredTarget.startsWith("/") && !configuredTarget.startsWith("//") ? configuredTarget : fallbackTarget;
        const content = (
          <div className={`promo-banner ${className}`} style={{ backgroundImage: `linear-gradient(90deg, rgba(6, 26, 45, .92), rgba(6, 26, 45, .22)), url(${resolveMediaUrl(banner.image)})` }}>
            <div className="promo-content">
              <span className="promo-eyebrow"><Icon size={15} /> {t(banner.subtitle || "")}</span>
              <h2>{t(banner.title)}<br /><strong>{t(banner.highlight || "")}</strong></h2>
              <p>{t(banner.description || "")}</p>
              <span className="promo-link">{t(banner.button_text || `Explore ${category}`)} <ArrowRight size={15} /></span>
            </div>
          </div>
        );
        return externalTarget
          ? <a key={banner.id} href={externalTarget} target="_blank" rel="noreferrer">{content}</a>
          : <Link key={banner.id} to={internalTarget}>{content}</Link>;
      })}
    </section>
  );
}
