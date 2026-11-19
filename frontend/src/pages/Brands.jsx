import { Link } from "react-router-dom";
import SectionTitle from "../components/common/SectionTitle.jsx";
import { useSiteData } from "../context/SiteDataContext.jsx";
import ResourceFeedback from "../components/common/ResourceFeedback.jsx";
import BrandLogo from "../components/common/BrandLogo.jsx";
import Seo from "../components/common/Seo.jsx";
import { brands as brandCatalog } from "../data/brands.js";

function normalizeBrandName(name) {
  return String(name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export default function Brands() {
  const { brands: siteBrands, refresh } = useSiteData();
  const existingNames = new Set(brandCatalog.flatMap((brand) => [brand.name, ...(brand.aliases || [])].map(normalizeBrandName)));
  const directory = [
    ...brandCatalog,
    ...siteBrands.data.filter((brand) => !existingNames.has(normalizeBrandName(brand.name))),
  ];

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
          {siteBrands.error && <ResourceFeedback error={siteBrands.error} onRetry={() => refresh("brands")} />}
          <div className="brand-directory">
            {directory.map((brand) => {
              const aliases = [brand.name, ...(brand.aliases || [])].map(normalizeBrandName);
              const siteBrand = siteBrands.data.find((item) => aliases.includes(normalizeBrandName(item.name)));
              const logo = <BrandLogo className="brand-directory-logo" brand={siteBrand || { name: brand.name }} />;
              return siteBrand
                ? <Link className="brand-directory-card" key={brand.slug || brand.name} title={brand.name} to={`/products?brand=${encodeURIComponent(siteBrand.slug || siteBrand.name)}`}>{logo}</Link>
                : <article className="brand-directory-card" key={brand.slug || brand.name}>{logo}</article>;
            })}
          </div>
        </div>
      </section>
    </>
  );
}
