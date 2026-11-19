import { useEffect, useState } from "react";
import { ArrowLeft, ArrowUpRight, ImageOff, ListPlus } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import ResourceFeedback from "../components/common/ResourceFeedback.jsx";
import WhatsAppIcon from "../components/common/WhatsAppIcon.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { useSiteData } from "../context/SiteDataContext.jsx";
import { apiRequest, resolveMediaUrl } from "../services/api.js";
import { getWhatsAppUrl } from "../utils/whatsapp.js";
import Seo from "../components/common/Seo.jsx";
import { useEnquiry } from "../context/EnquiryContext.jsx";
import { getPoleConfigurations, getProductImagePaths } from "../utils/productPresentation.js";

export default function ProductDetails() {
  const { id } = useParams();
  const { t } = useLanguage();
  const { business } = useSiteData();
  const { enquiryItems, addEnquiryItem } = useEnquiry();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [imageFailed, setImageFailed] = useState(false);
  const [selectedPole, setSelectedPole] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setProduct(null);
    setSelectedImageIndex(0);
    setImageFailed(false);
    setSelectedPole("");
    apiRequest(`/products/${encodeURIComponent(id)}`, { signal: controller.signal })
      .then((response) => {
        setProduct(response.data);
        const poleOptions = getPoleConfigurations(response.data);
        setSelectedPole(poleOptions.includes("DP") && /DP/i.test(response.data.name) ? "DP" : (poleOptions[0] || ""));
      })
      .catch((requestError) => {
        if (requestError.name !== "AbortError") setError(requestError.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [id, retryKey]);

  const poleConfigurations = getPoleConfigurations(product);
  const imagePaths = getProductImagePaths(product);
  const selectedImage = imagePaths[selectedImageIndex] || product?.image;
  const imageUrl = selectedImage ? resolveMediaUrl(selectedImage) : "";
  const price = Number(product?.price);
  const hasPrice = Number.isFinite(price) && price > 0 && !product?.price_on_request && product?.stock_status !== "price_on_request";
  const priceOnRequest = product?.price_on_request || product?.stock_status === "price_on_request";
  const message = product
    ? `${t("Hello")} ${business.name}, ${t("I would like to enquire about")} ${t(product.name)}${product.brand ? ` by ${product.brand}` : ""}${selectedPole ? ` (${t("Pole configuration")}: ${selectedPole})` : product.size && !poleConfigurations.length ? ` (${t(product.size)})` : ""}.`
    : undefined;
  const productDescription = product?.meta_description || product?.short_description || product?.description || `Enquire about ${product?.name || "this product"} at Jay Guru Dev Electricals.`;
  const stockAvailability = product?.stock_status === "out_of_stock"
    ? "https://schema.org/OutOfStock"
    : product?.stock_status === "in_stock" ? "https://schema.org/InStock" : undefined;
  const productSchema = product ? {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: productDescription,
    image: imageUrl || undefined,
    sku: product.sku || undefined,
    brand: product.brand ? { "@type": "Brand", name: product.brand } : undefined,
    category: product.category || undefined,
    offers: hasPrice ? {
      "@type": "Offer",
      priceCurrency: "INR",
      price,
      availability: stockAvailability,
    } : undefined,
  } : undefined;
  const specificationRows = product ? getSpecificationRows(product, t, poleConfigurations) : [];
  const alreadyAdded = enquiryItems.some((item) => (
    String(item.productId) === String(product?.id) && item.variant === selectedPole
  ));

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
                {imageUrl && !imageFailed
                  ? <img className="product-detail-image" src={imageUrl} alt={t(product.name)} onError={() => setImageFailed(true)} />
                  : <span className="product-detail-image-fallback" role="img" aria-label={`${t(product.name)} image unavailable`}><ImageOff size={36} aria-hidden="true" /></span>}
                {imagePaths.length > 1 && <div className="product-detail-thumbnails" aria-label={t("Product images")}>
                  {imagePaths.map((path, index) => (
                    <button className={`product-detail-thumbnail${selectedImageIndex === index ? " is-active" : ""}`} type="button" key={`${path}-${index}`} onClick={() => { setSelectedImageIndex(index); setImageFailed(false); }} aria-label={`${t("View image")} ${index + 1}`} aria-pressed={selectedImageIndex === index}>
                      <img src={resolveMediaUrl(path)} alt="" loading="lazy" onError={(event) => { event.currentTarget.hidden = true; }} />
                    </button>
                  ))}
                </div>}
              </div>
              <div className="product-detail-copy">
                {product.brand && <span className="product-detail-brand">{product.brand}</span>}
                <h2>{t(product.name)}</h2>
                {product.category && <p className="product-detail-category">{t(product.category)}</p>}
                {(product.short_description || product.description) && <p className="product-detail-description">{t(product.short_description || product.description)}</p>}
                {product.size && !poleConfigurations.length && <p className="product-detail-size">{t("Size / specification")}: {t(product.size)}</p>}
                {poleConfigurations.length > 1 && <label className="product-pole-selector">
                  {t("Pole configuration")}
                  <select value={selectedPole} onChange={(event) => setSelectedPole(event.target.value)} aria-label={t("Pole configuration")}>
                    {poleConfigurations.map((option) => <option value={option} key={option}>{option}</option>)}
                  </select>
                </label>}
                {hasPrice && <p className="product-detail-price">{new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(price)}</p>}
                {priceOnRequest && <p className="product-detail-price">{t("Price on request")}</p>}
                {specificationRows.length > 0 && (
                  <dl className="product-detail-specifications">
                    {specificationRows.map((specification) => (
                      <div key={specification.key}>
                        <dt>{t(specification.name)}</dt><dd>{t(specification.value)}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                <div className="product-detail-actions">
                  <a className="button button-primary product-detail-enquire" href={getWhatsAppUrl(message, business)} target="_blank" rel="noreferrer">
                    <WhatsAppIcon className="whatsapp-icon" /> {t("Enquire on WhatsApp")} <ArrowUpRight size={17} />
                  </a>
                  <button className="button button-outline product-detail-add" type="button" onClick={() => addEnquiryItem(product, selectedPole, poleConfigurations)}>
                    <ListPlus size={17} /> {t(alreadyAdded ? "Add another" : "Add to enquiry list")}
                  </button>
                </div>
              </div>
            </article>
          )}
        </div>
      </section>
    </>
  );
}

function getSpecificationRows(product, t, poleConfigurations) {
  const specifications = product.specifications || [];
  const findValue = (pattern) => specifications.find(({ name }) => pattern.test(name || ""))?.value;
  const rows = [];
  if (product.sku) rows.push({ key: "sku", name: "SKU", value: product.sku });

  if (/mcb/i.test(product.name || "")) {
    rows.push(
      { key: "model-number", name: "Model number", value: findValue(/model(\s*number)?/i) || t("Contact for specification") },
      { key: "ampere-rating", name: "Ampere rating", value: findValue(/ampere|current rating/i) || t("Contact for specification") },
      { key: "breaking-capacity", name: "Breaking capacity", value: findValue(/breaking capacity/i) || t("Contact for specification") },
    );
  }

  const handledNames = /^(sku|model(\s*number)?|ampere(\s*rating)?|current rating|breaking capacity)$/i;
  specifications
    .filter(({ name }) => {
      const normalizedName = (name || "").trim();
      return !handledNames.test(normalizedName) && !(poleConfigurations.length && /^(pole configuration|size)$/i.test(normalizedName));
    })
    .forEach((specification, index) => rows.push({
      key: specification.id || `${specification.name}-${index}`,
      name: specification.name,
      value: specification.value,
    }));

  return rows;
}
