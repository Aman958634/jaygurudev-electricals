import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { useEnquiry } from "../../context/EnquiryContext.jsx";
import { useLanguage } from "../../context/LanguageContext.jsx";
import { useSiteData } from "../../context/SiteDataContext.jsx";
import { createDealerQuotationMessage } from "../../utils/dealerQuotation.js";
import { getWhatsAppUrl } from "../../utils/whatsapp.js";
import WhatsAppIcon from "../common/WhatsAppIcon.jsx";

function createItem(id) {
  return { id, name: "", specification: "", quantity: "1" };
}

export default function DealerQuotationForm() {
  const { dealerQuotationOpen, closeDealerQuotation } = useEnquiry();
  const { t } = useLanguage();
  const { business } = useSiteData();
  const [items, setItems] = useState([createItem(1)]);
  const [nextItemId, setNextItemId] = useState(2);
  const [error, setError] = useState("");
  const [preparedUrl, setPreparedUrl] = useState("");
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!dealerQuotationOpen) return;
    setItems([createItem(1)]);
    setNextItemId(2);
    setError("");
    setPreparedUrl("");
    dialogRef.current?.querySelector("input")?.focus();
  }, [dealerQuotationOpen]);

  if (!dealerQuotationOpen) return null;

  function updateItem(id, key, value) {
    setItems((current) => current.map((item) => item.id === id ? { ...item, [key]: value } : item));
    setPreparedUrl("");
    setError("");
  }

  function addItem() {
    setItems((current) => [...current, createItem(nextItemId)]);
    setNextItemId((current) => current + 1);
    setPreparedUrl("");
    setError("");
  }

  function removeItem(id) {
    setItems((current) => current.filter((item) => item.id !== id));
    setPreparedUrl("");
    setError("");
  }

  function handleSubmit(event) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const customerName = String(formData.get("customerName") || "").trim();
    const city = String(formData.get("city") || "").trim();
    const additionalRequirements = String(formData.get("additionalRequirements") || "").trim();
    const requestedItems = items.map((item) => ({
      name: item.name.trim(),
      specification: item.specification.trim(),
      quantity: Number(item.quantity),
    }));

    if (!customerName || !city) {
      setError(t("Please enter your name and city."));
      return;
    }
    if (!requestedItems.length || requestedItems.some((item) => (
      !item.name || !Number.isInteger(item.quantity) || item.quantity < 1
    ))) {
      setError(t("Enter a product name and a whole-number quantity for every item."));
      return;
    }

    const message = createDealerQuotationMessage({
      customerName,
      city,
      items: requestedItems,
      additionalRequirements,
    });
    const url = getWhatsAppUrl(message, business);
    setError("");
    setPreparedUrl(url);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDealerQuotation(); }}>
      <section
        ref={dialogRef}
        className="dealer-quotation-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dealer-quotation-heading"
      >
        <button className="modal-close" type="button" onClick={closeDealerQuotation} aria-label={t("Close dealer quotation form")}><X size={21} /></button>
        <span className="eyebrow">{t("For dealers & contractors")}</span>
        <h2 id="dealer-quotation-heading">{t("Get Dealer Quotation")}</h2>
        <p>{t("Share your business details and requested items. Your quotation request will open in WhatsApp.")}</p>
        <form
          className="dealer-quotation-form"
          onChange={() => { setError(""); setPreparedUrl(""); }}
          onSubmit={handleSubmit}
        >
          <div className="dealer-quotation-customer-fields">
            <label>{t("Dealer / Customer Name")} <input name="customerName" autoComplete="name" required maxLength={120} /></label>
            <label>{t("City")} <input name="city" autoComplete="address-level2" required maxLength={100} /></label>
          </div>
          <div className="dealer-quotation-items">
            <h3>{t("Requested Items")}</h3>
            {items.map((item, index) => (
              <fieldset className="dealer-quotation-item" key={item.id}>
                <legend>{t("Item {number}", { number: index + 1 })}</legend>
                <label>
                  {t("Product / Item Name")}
                  <input
                    name={`product-${item.id}`}
                    value={item.name}
                    onChange={(event) => updateItem(item.id, "name", event.target.value)}
                    required
                    maxLength={160}
                  />
                </label>
                <label>
                  {t("Model / Size / Rating")}
                  <input
                    name={`specification-${item.id}`}
                    value={item.specification}
                    onChange={(event) => updateItem(item.id, "specification", event.target.value)}
                    maxLength={160}
                  />
                </label>
                <label>
                  {t("Quantity")}
                  <input
                    name={`quantity-${item.id}`}
                    type="number"
                    inputMode="numeric"
                    min="1"
                    step="1"
                    value={item.quantity}
                    onChange={(event) => updateItem(item.id, "quantity", event.target.value)}
                    required
                  />
                </label>
                <button
                  className="dealer-quotation-remove"
                  type="button"
                  onClick={() => removeItem(item.id)}
                  disabled={items.length === 1}
                  aria-label={t("Remove item {number}", { number: index + 1 })}
                >
                  <Trash2 size={16} aria-hidden="true" /> {t("Remove Item")}
                </button>
              </fieldset>
            ))}
            <button className="dealer-quotation-add" type="button" onClick={addItem}>
              <Plus size={16} aria-hidden="true" /> {t("Add Another Item")}
            </button>
          </div>
          <label>
            {t("Additional requirements (optional)")}
            <textarea name="additionalRequirements" rows="3" maxLength={1200} />
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          {preparedUrl && (
            <div className="dealer-quotation-confirmation" role="status">
              <span>{t("Your quotation message is ready to send in WhatsApp.")}</span>
              <a href={preparedUrl} target="_blank" rel="noopener noreferrer">{t("Open WhatsApp quotation")}</a>
            </div>
          )}
          <button className="button button-primary form-submit" type="submit">
            <WhatsAppIcon className="whatsapp-icon" /> {t("Submit Dealer Quotation")}
          </button>
        </form>
      </section>
    </div>
  );
}
