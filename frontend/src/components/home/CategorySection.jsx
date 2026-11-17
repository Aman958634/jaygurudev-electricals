import { ArrowUpRight, Cable, Fan, House, Plug, Settings2, ShieldCheck, Sun, Wind } from "lucide-react";
import { Link } from "react-router-dom";
import SectionTitle from "../common/SectionTitle.jsx";
import { useLanguage } from "../../context/LanguageContext.jsx";
import { useSiteData } from "../../context/SiteDataContext.jsx";
import { resolveMediaUrl } from "../../services/api.js";
import ResourceFeedback from "../common/ResourceFeedback.jsx";

const icons = { sun: Sun, plug: Plug, cable: Cable, shield: ShieldCheck, fan: Fan, wind: Wind, house: House, settings: Settings2 };

export default function CategorySection() {
  const { t } = useLanguage();
  const { categories, refresh } = useSiteData();
  return (
    <section className="section section-soft category-section" id="categories">
      <div className="container">
        <div className="section-heading-row">
          <SectionTitle eyebrow="તમારી જરૂરિયાત પ્રમાણે પસંદ કરો" title="Shop by" highlight="Category" />
          <Link className="text-link" to="/categories">{t("View All Categories")} <ArrowUpRight size={17} /></Link>
        </div>
        <div className="category-grid">
          <ResourceFeedback loading={categories.loading} error={categories.error} empty={!categories.data.length} onRetry={() => refresh("categories")} emptyMessage={t("No categories are available yet.")} />
          {!categories.loading && !categories.error && categories.data.map((category, index) => {
            const Icon = icons[category.icon] || Plug;
            return (
              <Link className={`category-card category-card-${index + 1}`} to={`/products?category=${encodeURIComponent(category.slug || category.name)}`} key={category.id || category.slug || category.name} style={{ backgroundImage: `linear-gradient(180deg, rgba(8, 24, 40, .1), rgba(8, 24, 40, .7)), url(${resolveMediaUrl(category.image)})` }}>
                <div className="category-overlay" />
                <span className="category-icon"><Icon size={20} /></span>
                <div className="category-content"><h3>{t(category.name)}</h3><p>{t(category.subtitle)}</p><small>{t("View Products")} <ArrowUpRight size={13} /></small></div>
                <span className="category-arrow"><ArrowUpRight size={18} /></span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
