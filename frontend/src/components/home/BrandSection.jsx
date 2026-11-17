import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import SectionTitle from "../common/SectionTitle.jsx";
import { useLanguage } from "../../context/LanguageContext.jsx";
import { useSiteData } from "../../context/SiteDataContext.jsx";
import ResourceFeedback from "../common/ResourceFeedback.jsx";
import BrandLogo from "../common/BrandLogo.jsx";

export default function BrandSection() {
  const { t } = useLanguage();
  const { brands, refresh } = useSiteData();
  return (
    <section className="section brands-section" id="brands">
      <div className="container">
        <div className="section-heading-row">
          <SectionTitle eyebrow="Trusted names" title="Top Brands" highlight="We Offer" />
          <Link className="text-link" to="/brands">{t("View All Brands")} <ArrowRight size={17} /></Link>
        </div>
        <div className="brand-grid">
          <ResourceFeedback loading={brands.loading} error={brands.error} empty={!brands.data.length} onRetry={() => refresh("brands")} emptyMessage={t("No brands are available yet.")} />
          {!brands.loading && !brands.error && brands.data.map((brand) => (
            <Link to={`/products?brand=${encodeURIComponent(brand.slug || brand.name)}`} className="brand-tile" key={brand.id || brand.slug || brand.name} title={brand.name}>
              <BrandLogo className="brand-tile-logo" brand={brand} />
              <span>{t(brand.category)}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
