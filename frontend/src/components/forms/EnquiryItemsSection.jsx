import { useEffect, useState } from "react";
import { ImageOff, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { resolveMediaUrl } from "../../services/api.js";
import { useLanguage } from "../../context/LanguageContext.jsx";

export default function EnquiryItemsSection({
  items,
  updateEnquiryItem,
  removeEnquiryItem,
  clearEnquiryItems,
  onContinueShopping,
}) {
  const { t } = useLanguage();
  const totalQuantity = items.reduce((total, item) => total + item.quantity, 0);

  return (
    <section className="selected-enquiry-products" aria-labelledby="selected-enquiry-heading">
      <div className="selected-enquiry-heading">
        <div>
          <h3 id="selected-enquiry-heading">{t("Your Selected Products")}</h3>
          <p>{t("Review products and quantities before sending your enquiry.")}</p>
        </div>
        <ShoppingBag size={21} aria-hidden="true" />
      </div>
      <div className="selected-enquiry-totals" role="status" aria-live="polite">
        <span><strong>{items.length}</strong> {t("Total product types")}</span>
        <span><strong>{totalQuantity}</strong> {t("Total requested quantity")}</span>
      </div>
      {items.length === 0
        ? <p className="selected-enquiry-empty">{t("No products added yet. Please add products from our catalogue.")}</p>
        : <ul className="selected-enquiry-items">
          {items.map((item) => (
            <EnquiryItemRow
              key={item.key}
              item={item}
              updateEnquiryItem={updateEnquiryItem}
              removeEnquiryItem={removeEnquiryItem}
            />
          ))}
        </ul>}
      <div className="selected-enquiry-actions">
        {onContinueShopping && (
          <button className="button button-outline" type="button" onClick={onContinueShopping}>
            {t("Continue shopping")}
          </button>
        )}
        {items.length > 0 && (
          <button className="enquiry-list-clear" type="button" onClick={clearEnquiryItems}>
            <Trash2 size={15} aria-hidden="true" /> {t("Clear Enquiry List")}
          </button>
        )}
      </div>
    </section>
  );
}

function EnquiryItemRow({ item, updateEnquiryItem, removeEnquiryItem }) {
  const { t } = useLanguage();
  const imageUrl = resolveMediaUrl(item.image);
  const [imageFailed, setImageFailed] = useState(!imageUrl);
  const quantity = Math.max(1, Number(item.quantity) || 1);
  const updateQuantity = (value) => updateEnquiryItem(item.key, { quantity: value });

  useEffect(() => setImageFailed(!imageUrl), [imageUrl]);

  return (
    <li className="selected-enquiry-item" data-product-id={item.productId}>
      <div className="selected-enquiry-image">
        {imageUrl && !imageFailed
          ? <img src={imageUrl} alt={t(item.name)} loading="lazy" onError={() => setImageFailed(true)} />
          : <span role="img" aria-label={t("Product image unavailable")}><ImageOff size={21} aria-hidden="true" /></span>}
      </div>
      <div className="selected-enquiry-product">
        <strong>{t(item.name)}</strong>
        {item.brand && <small>{item.brand}</small>}
        {item.model && <small>{t("Model")}: {item.model}</small>}
        {item.sku && item.sku !== item.model && <small>{t("SKU")}: {item.sku}</small>}
        {item.details && <small>{t(item.details)}</small>}
        {item.variant && <small>{t("Pole configuration")}: {item.variant}</small>}
        {item.variantOptions.length > 1 && (
          <label className="selected-enquiry-variant">
            {t("Pole configuration")}
            <select
              value={item.variant}
              onChange={(event) => updateEnquiryItem(item.key, { variant: event.target.value })}
              aria-label={t("Pole configuration")}
            >
              <option value="">{t("Select configuration")}</option>
              {item.variantOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
        )}
      </div>
      <div className="selected-enquiry-controls">
        <div className="enquiry-quantity-control">
          <button
            type="button"
            aria-label={t("Decrease quantity for {name}", { name: t(item.name) })}
            disabled={quantity <= 1}
            onClick={() => updateQuantity(quantity - 1)}
          >
            <Minus size={14} aria-hidden="true" />
          </button>
          <input
            type="number"
            min="1"
            step="1"
            value={quantity}
            aria-label={t("Quantity for {name}", { name: t(item.name) })}
            onChange={(event) => updateQuantity(event.target.value)}
          />
          <button
            type="button"
            aria-label={t("Increase quantity for {name}", { name: t(item.name) })}
            onClick={() => updateQuantity(quantity + 1)}
          >
            <Plus size={14} aria-hidden="true" />
          </button>
        </div>
        <button
          className="enquiry-list-remove"
          type="button"
          onClick={() => removeEnquiryItem(item.key)}
          aria-label={t("Remove {name} from enquiry list", { name: t(item.name) })}
        >
          <Trash2 size={15} aria-hidden="true" /> <span>{t("Remove")}</span>
        </button>
      </div>
    </li>
  );
}
