import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import PageHeading from "../components/common/PageHeading.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { useSiteData } from "../context/SiteDataContext.jsx";
import ResourceFeedback from "../components/common/ResourceFeedback.jsx";
import BrandLogo from "../components/common/BrandLogo.jsx";

export default function Brands() {
  const { t } = useLanguage();
  const { brands, refresh } = useSiteData();
  return (
    <>
      <PageHeading slug="brands" fallback={{ eyebrow: "Names you know", title: "Brands we", highlight: "offer", description: "Browse selected brands available across electricals, lighting and home appliances. Contact us to confirm current availability." }} />
      <section className="section section-soft brand-page">
        <div className="container brand-directory">
          <ResourceFeedback loading={brands.loading} error={brands.error} empty={!brands.data.length} onRetry={() => refresh("brands")} emptyMessage={t("No brands are available yet.")} />
          {!brands.loading && !brands.error && brands.data.map((brand) => (
            <Link className="brand-directory-card" key={brand.id || brand.slug || brand.name} to={`/products?brand=${encodeURIComponent(brand.slug || brand.name)}`}>
              <BrandLogo className="brand-directory-logo" brand={brand} />
              <span className="brand-directory-copy"><strong>{brand.name}</strong>{(brand.category || brand.description) && <small>{t(brand.category || brand.description)}</small>}<span>{t("Explore Brand")}</span></span>
              <ArrowUpRight size={18} />
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
