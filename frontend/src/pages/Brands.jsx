import { Link } from "react-router-dom";
import SectionTitle from "../components/common/SectionTitle.jsx";
import { useSiteData } from "../context/SiteDataContext.jsx";
import ResourceFeedback from "../components/common/ResourceFeedback.jsx";
import BrandLogo from "../components/common/BrandLogo.jsx";
import Seo from "../components/common/Seo.jsx";

export default function Brands() {
  const { brands, refresh } = useSiteData();
  const publishedBrands = brands.data.filter((brand) => Number(brand.is_active) === 1);

  return (
    <>
      <Seo
        title="Electrical Brands | Jay Guru Dev Electricals"
        description="Browse electrical, lighting and home-appliance brands. Contact Jay Guru Dev Electricals in Palanpur to confirm product availability."
        canonicalPath="/brands"
      />
      <section className="page-heading">
        <div className="container">
          <SectionTitle
            eyebrow="Brand directory"
            title="Our Trusted"
            highlight="Brands"
            description="Browse electrical, lighting and home-appliance brands. Contact us to confirm product availability."
            headingLevel={1}
          />
        </div>
      </section>
      <section className="section section-soft brand-page">
        <div className="container">
          <div className="brand-directory">
            <ResourceFeedback
              loading={brands.loading}
              error={brands.error}
              empty={!publishedBrands.length}
              onRetry={() => refresh("brands")}
              emptyMessage="No brands are available yet."
            />
            {!brands.loading && !brands.error && publishedBrands.map((brand) => (
              <Link
                className="brand-directory-card"
                key={brand.id || brand.slug || brand.name}
                title={brand.name}
                to={`/products?brand=${encodeURIComponent(brand.slug || brand.name)}`}
              >
                <BrandLogo className="brand-directory-logo" brand={brand} />
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
