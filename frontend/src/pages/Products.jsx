import { useEnquiry } from "../context/EnquiryContext.jsx";
import ProductGrid from "../components/products/ProductGrid.jsx";
import PageHeading from "../components/common/PageHeading.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import Seo from "../components/common/Seo.jsx";

export default function Products() {
  const { openWholesale } = useEnquiry();
  const { t } = useLanguage();
  return (
    <>
      <Seo
        title="Electrical Products | Jay Guru Dev Electricals"
        description="Browse electrical products, lighting and home appliances. Search by product, brand or category, and enquire about availability."
        canonicalPath="/products"
      />
      <PageHeading slug="products" fallback={{ eyebrow: "Electricals & home appliances", title: "Find the right", highlight: "products", description: "Search our selection by product, brand or category. Ask us about variants, pricing and availability." }} />
      <section className="section section-soft products-page">
        <div className="container">
          <div className="products-page-callout">
            <span>{t("Planning a larger order?")}</span>
            <button type="button" className="text-link" onClick={openWholesale}>{t("Send a wholesale enquiry")} <span aria-hidden="true">→</span></button>
          </div>
          <ProductGrid />
        </div>
      </section>
    </>
  );
}
