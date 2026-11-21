import { ArrowRight } from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useProducts } from "../../hooks/useProducts.js";
import { useLanguage } from "../../context/LanguageContext.jsx";
import { selectHomepageProducts } from "../../utils/productPresentation.js";
import ResourceFeedback from "../common/ResourceFeedback.jsx";
import SectionTitle from "../common/SectionTitle.jsx";
import ProductCard from "../products/ProductCard.jsx";

export default function FeaturedProducts() {
  const { t } = useLanguage();
  const { products, loading, error, refresh } = useProducts({ allProducts: true, sort: "newest" });
  const homepageProducts = useMemo(() => selectHomepageProducts(products, 4), [products]);

  if (!loading && !error && homepageProducts.length === 0) return null;

  return (
    <section className="section section-soft catalog-products" id="catalog">
      <div className="container">
        <div className="section-heading-row">
          <SectionTitle eyebrow="Our Regular Stock" title="Featured" highlight="Products" />
          <Link className="text-link" to="/products">{t("Browse all products")} <ArrowRight size={17} /></Link>
        </div>
        <ResourceFeedback loading={loading} error={error} onRetry={refresh} />
        {!loading && !error && homepageProducts.length > 0 && (
          <div className="product-grid home-products-grid">
            {homepageProducts.map((product) => (
              <ProductCard key={product.id} product={product} variant="featured" />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
