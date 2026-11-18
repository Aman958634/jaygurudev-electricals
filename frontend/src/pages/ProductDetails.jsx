import { useEffect, useState } from "react";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import ResourceFeedback from "../components/common/ResourceFeedback.jsx";
import WhatsAppIcon from "../components/common/WhatsAppIcon.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { useSiteData } from "../context/SiteDataContext.jsx";
import { apiRequest, resolveMediaUrl } from "../services/api.js";
import { getWhatsAppUrl } from "../utils/whatsapp.js";
import Seo from "../components/common/Seo.jsx";

export default function ProductDetails() {
  const { id } = useParams();
  const { t } = useLanguage();
  const { business } = useSiteData();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    apiRequest(`/products/${encodeURIComponent(id)}`, { signal: controller.signal })
      .then((response) => setProduct(response.data))
      .catch((requestError) => {
        if (requestError.name !== "AbortError") setError(requestError.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [id, retryKey]);

  const price = Number(product?.price);
  const hasPrice = Number.isFinite(price) && price > 0 && !product?.price_on_request && product?.stock_status !== "price_on_request";
  const priceOnRequest = product?.price_on_request || product?.stock_status === "price_on_request";
  const message = product
    ? `${t("Hello")} JAY GURUDEVV ELECTRIICALS, ${t("I would like to enquire about")} ${t(product.name)} by ${product.brand}${product.size ? ` (${t(product.size)})` : ""}.`
    : undefined;
  const productDescription = product?.meta_description || product?.short_description || product?.description || `Enquire about ${product?.name || "this product"} at Jay Guru Dev Electricals.`;
  const productSchema = product ? {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: productDescription,
    sku: product.sku || undefined,
    brand: product.brand ? { "@type": "Brand", name: product.brand } : undefined,
    category: product.category || undefined,
    offers: hasPrice ? {
      "@type": "Offer",
      priceCurrency: "INR",
      price,
      availability: product.stock_status === "out_of_stock" ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
    } : undefined,
  } : undefined;

  return (
    <>
      <Seo
        title={product?.meta_title || (product ? `${product.name} | Jay Guru Dev Electricals` : "Product | Jay Guru Dev Electricals")}
        description={productDescription}
        canonicalPath={`/products/${product?.id || id}`}
        image={product?.image}
        imageAlt={product?.name || "Jay Guru Dev Electricals product"}
        type={product ? "product" : "website"}
        schema={productSchema}
        noindex={!product && !loading}
      />
      <section className="page-heading product-detail-heading">
        <div className="container">
          <Link className="text-link product-detail-back" to="/products"><ArrowLeft size={16} /> {t("Back to products")}</Link>
          {product && <h1>{t(product.name)}</h1>}
        </div>
      </section>
      <section className="section section-soft product-detail-section">
        <div className="container">
          <ResourceFeedback
            loading={loading}
            error={error}
            empty={!product && !loading && !error}
            onRetry={() => setRetryKey((current) => current + 1)}
            emptyMessage={t("Product not found.")}
          />
          {product && (
            <article className="product-detail-card">
              <div className="product-detail-image-wrap">
                <img
                  className="product-detail-image"
                  src={resolveMediaUrl(product.image)}
                  alt={t(product.name)}
                />
              </div>
              <div className="product-detail-copy">
                <span className="product-detail-brand">{product.brand}</span>
                <h2>{t(product.name)}</h2>
                <p className="product-detail-category">{t(product.category)}</p>
                {(product.short_description || product.description) && <p className="product-detail-description">{t(product.short_description || product.description)}</p>}
                {product.size && <p className="product-detail-size">{t("Size / specification")}: {t(product.size)}</p>}
                {hasPrice && <p className="product-detail-price">{new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(price)}</p>}
                {priceOnRequest && <p className="product-detail-price">{t("Price on request")}</p>}
                {product.specifications?.length > 0 && (
                  <dl className="product-detail-specifications">
                    {product.specifications.map((specification) => (
                      <div key={specification.id || specification.name}>
                        <dt>{t(specification.name)}</dt><dd>{t(specification.value)}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                <a className="button button-primary product-detail-enquire" href={getWhatsAppUrl(message, business)} target="_blank" rel="noreferrer">
                  <WhatsAppIcon className="whatsapp-icon" /> {t("Enquire on WhatsApp")} <ArrowUpRight size={17} />
                </a>
              </div>
            </article>
          )}
        </div>
      </section>
    </>
  );
}
