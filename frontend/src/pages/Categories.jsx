import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import ResourceFeedback from "../components/common/ResourceFeedback.jsx";
import SectionTitle from "../components/common/SectionTitle.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { useSiteData } from "../context/SiteDataContext.jsx";
import { resolveMediaUrl } from "../services/api.js";

export default function Categories() {
  const { t } = useLanguage();
  const { categories, refresh } = useSiteData();

  return (
    <>
      <section className="page-heading categories-heading">
        <div className="container">
          <SectionTitle
            eyebrow={t("Browse our range")}
            title={t("Shop by")}
            highlight={t("Category")}
            description={t("Explore our active product categories and find the right products for your needs.")}
          />
        </div>
      </section>
      <section className="section section-soft categories-page">
        <div className="container">
          <ResourceFeedback
            loading={categories.loading}
            error={categories.error}
            empty={!categories.data.length}
            onRetry={() => refresh("categories")}
            emptyMessage={t("No categories are available yet.")}
          />
          {!categories.loading && !categories.error && categories.data.length > 0 && (
            <div className="categories-page-grid">
              {categories.data.map((category) => (
                <article className="categories-page-card" key={category.id || category.slug || category.name}>
                  {category.image ? (
                    <img className="categories-page-image" src={resolveMediaUrl(category.image)} alt={t(category.name)} loading="lazy" />
                  ) : (
                    <div className="categories-page-image categories-page-image-empty" aria-hidden="true" />
                  )}
                  <div className="categories-page-content">
                    <h2>{t(category.name)}</h2>
                    {(category.subtitle || category.description) && <p>{t(category.subtitle || category.description)}</p>}
                    <Link className="button button-outline" to={`/products?category=${encodeURIComponent(category.slug || category.name)}`}>
                      {t("View Products")} <ArrowUpRight size={16} />
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
