import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import SectionTitle from "../common/SectionTitle.jsx";
import ProductGrid from "../products/ProductGrid.jsx";
import { useLanguage } from "../../context/LanguageContext.jsx";

export default function FeaturedProducts() {
  const { t } = useLanguage();
  return (
    <section className="section section-soft catalog-products" id="catalog">
      <div className="container">
        <div className="section-heading-row">
          <SectionTitle eyebrow="Popular Picks at Our Store" title="Best Selling" highlight="Products" />
          <Link className="text-link" to="/products">{t("Browse all products")} <ArrowRight size={17} /></Link>
        </div>
        <ProductGrid allProducts />
      </div>
    </section>
  );
}
