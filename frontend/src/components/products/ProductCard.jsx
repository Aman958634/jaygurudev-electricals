import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ImageOff, ListPlus } from "lucide-react";
import { getWhatsAppUrl } from "../../utils/whatsapp.js";
import WhatsAppIcon from "../common/WhatsAppIcon.jsx";
import BrandLogo from "../common/BrandLogo.jsx";
import { useLanguage } from "../../context/LanguageContext.jsx";
import { useSiteData } from "../../context/SiteDataContext.jsx";
import { resolveMediaUrl } from "../../services/api.js";
import { useEnquiry } from "../../context/EnquiryContext.jsx";
import { getPoleConfigurations } from "../../utils/productPresentation.js";

export default function ProductCard({ product, variant = "standard" }) {
  const { t } = useLanguage();
  const { business } = useSiteData();
  const { enquiryItems, addEnquiryItem } = useEnquiry();
  const poleConfigurations = getPoleConfigurations(product);
  const defaultVariant = poleConfigurations.length === 1 ? poleConfigurations[0] : "";
  const alreadyAdded = enquiryItems.some((item) => (
    String(item.productId) === String(product.id) && item.variant === defaultVariant
  ));
  const imageUrl = resolveMediaUrl(product.image);
  const [imageFailed, setImageFailed] = useState(!imageUrl);
  useEffect(() => setImageFailed(!imageUrl), [imageUrl]);
  const sizeDescription = poleConfigurations.length
    ? `${t("Available pole configurations")}: ${poleConfigurations.join(" / ")}`
    : product.size ? t(product.size) : "";
  const message = `${t("Hello")} ${business.name}, ${t("I would like to enquire about")} ${t(product.name)} by ${product.brand || t("Unbranded")}${sizeDescription ? ` (${sizeDescription})` : ""}.`;
  const price = Number(product.price);
  const hasPrice = Number.isFinite(price) && price > 0 && !product.price_on_request && product.stock_status !== "price_on_request";
  const priceOnRequest = product.price_on_request || product.stock_status === "price_on_request";
  return (
    <article className={`product-card${variant === "featured" ? " homepage-product-card" : ""}`}>
      <div className={`product-image${variant === "featured" ? " homepage-product-image" : ""}`}>
        {!imageFailed
          ? <img src={imageUrl} alt={t(product.name)} loading="lazy" onError={() => setImageFailed(true)} />
          : <span className="product-image-fallback" role="img" aria-label={`${t(product.name)} image unavailable`}><ImageOff size={28} aria-hidden="true" /></span>}
        {product.badge && <span className="product-badge">{t(product.badge)}</span>}
      </div>
      <div className="product-info">
        <h3><Link to={`/products/${product.id}`}>{t(product.name)}</Link></h3>
        <div className="product-card-meta">
          <span className="product-brand-lockup">
            {product.brand && product.brand_logo_url && <BrandLogo className="product-brand-logo" brand={{ name: product.brand, logo_url: product.brand_logo_url }} />}
            <span className="product-brand">{product.brand || t("Unbranded")}</span>
          </span>
          {product.category && <span className="product-category">{t(product.category)}</span>}
        </div>
        {sizeDescription && <p className="product-specification">{sizeDescription}</p>}
        {hasPrice && <p className="product-price">{new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(price)}</p>}
        {priceOnRequest && <p className="product-price">{t("Price on request")}</p>}
        <a className="product-enquire" href={getWhatsAppUrl(message, business)} target="_blank" rel="noreferrer" aria-label={`${t("Enquire on WhatsApp")}: ${t(product.name)}`}>
          <WhatsAppIcon className="whatsapp-icon" /> <span>{t("Enquire on WhatsApp")}</span>
        </a>
        <button className="product-enquire product-enquire-list" type="button" onClick={() => addEnquiryItem(product, "", poleConfigurations)} aria-label={`${t(alreadyAdded ? "Add another" : "Add to enquiry list")}: ${t(product.name)}`}>
          <ListPlus size={16} aria-hidden="true" /> <span>{t(alreadyAdded ? "Add another" : "Add to enquiry list")}</span>
        </button>
      </div>
    </article>
  );
}
