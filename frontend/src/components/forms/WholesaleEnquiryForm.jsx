import { useState } from "react";
import { X } from "lucide-react";
import { useEnquiry } from "../../context/EnquiryContext.jsx";
import { getWhatsAppUrl } from "../../utils/whatsapp.js";
import { apiRequest } from "../../services/api.js";
import WhatsAppIcon from "../common/WhatsAppIcon.jsx";
import { useLanguage } from "../../context/LanguageContext.jsx";
import { useSiteData } from "../../context/SiteDataContext.jsx";
import EnquiryItemsSection from "./EnquiryItemsSection.jsx";

export default function WholesaleEnquiryForm() {
  const {
    wholesaleOpen,
    closeWholesale,
    enquiryItems,
    updateEnquiryItem,
    removeEnquiryItem,
    clearEnquiryItems,
  } = useEnquiry();
  const { t } = useLanguage();
  const { business } = useSiteData();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [requirement, setRequirement] = useState("");
  const [whatsappPrepared, setWhatsappPrepared] = useState(false);

  if (!wholesaleOpen) return null;

  function clearList() {
    clearEnquiryItems();
    setWhatsappPrepared(false);
    setSuccess(t("Enquiry list cleared."));
  }

  function confirmSent() {
    clearEnquiryItems();
    setWhatsappPrepared(false);
    setSuccess(t("Thanks for confirming. Your enquiry list has been cleared."));
    setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") || "").trim();
    const shop = String(formData.get("shop") || "").trim();
    const city = String(formData.get("city") || "").trim();
    const phoneValue = String(formData.get("phone") || "").trim();
    const phone = phoneValue.replace(/\D/g, "");
    const additionalRequirements = String(formData.get("requirement") || "").trim();

    setError("");
    setSuccess("");
    if (!name || !city) {
      setError(t("Please enter your name and city."));
      return;
    }
    if (phone.length < 10 || phone.length > 13) {
      setError(t("Enter a valid mobile number (10–13 digits)."));
      return;
    }
    if (enquiryItems.some((item) => item.variantOptions.length > 1 && !item.variant)) {
      setError(t("Please select a configuration for each product."));
      return;
    }
    if (!enquiryItems.length && !additionalRequirements) {
      setError(t("Please enter a product requirement and quantity."));
      return;
    }

    const productLines = enquiryItems.map((item) => [
      `- ${item.name}`,
      item.brand && `Brand: ${item.brand}`,
      item.model && `Model: ${item.model}`,
      item.sku && item.sku !== item.model && `SKU: ${item.sku}`,
      item.variant && `Configuration: ${item.variant}`,
      `Quantity: ${item.quantity}`,
    ].filter(Boolean).join(" | "));
    const fullRequirement = [
      productLines.length ? `${t("Selected products")}:\n${productLines.join("\n")}` : "",
      additionalRequirements ? `${t("Additional requirements")}: ${additionalRequirements}` : "",
    ].filter(Boolean).join("\n");
    const message = [
      `${t("Wholesale enquiry")} - ${business.name}`,
      `${t("Name")}: ${name}`,
      `${t("Shop / firm")}: ${shop || t("Not provided")}`,
      `${t("City")}: ${city}`,
      `${t("Mobile")}: ${phoneValue}`,
      fullRequirement,
    ].filter(Boolean).join("\n");
    const enquiry = {
      name,
      shop,
      city,
      phone: phoneValue,
      requirement: fullRequirement,
      enquiry_type: "wholesale",
      items: enquiryItems.map((item) => ({
        product_id: item.productId,
        product_name: item.name,
        quantity: item.quantity,
        notes: [
          item.brand && `Brand: ${item.brand}`,
          item.model && `Model: ${item.model}`,
          item.sku && `SKU: ${item.sku}`,
          item.variant && `Configuration: ${item.variant}`,
        ].filter(Boolean).join(" | ") || null,
      })),
    };

    window.open(getWhatsAppUrl(message, business), "_blank", "noopener,noreferrer");
    setWhatsappPrepared(true);
    setSubmitting(true);
    try {
      await apiRequest("/enquiries", { method: "POST", body: JSON.stringify(enquiry) });
      setSuccess(t("Your enquiry has been saved. Review and send the prepared message in WhatsApp."));
    } catch (requestError) {
      setError(`${t("WhatsApp has opened, but your enquiry could not be saved.")} ${requestError.message}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeWholesale(); }}>
      <section className="wholesale-modal" role="dialog" aria-modal="true" aria-labelledby="wholesale-heading">
        <button className="modal-close" type="button" onClick={closeWholesale} aria-label={t("Close wholesale enquiry")}><X size={21} /></button>
        <span className="eyebrow">{t("For dealers & contractors")}</span>
        <h2 id="wholesale-heading">{t("Tell us what you need.")}</h2>
        <p>{t("Share your product and quantity requirements. Our team will respond on WhatsApp.")}</p>
        <EnquiryItemsSection
          items={enquiryItems}
          updateEnquiryItem={updateEnquiryItem}
          removeEnquiryItem={removeEnquiryItem}
          clearEnquiryItems={clearList}
          onContinueShopping={closeWholesale}
        />
        <form onSubmit={handleSubmit}>
          <div className="form-two-col">
            <label>{t("Name")} <input name="name" autoComplete="name" required /></label>
            <label>{t("Shop / firm")} <input name="shop" autoComplete="organization" /></label>
            <label>{t("Village / city")} <input name="city" autoComplete="address-level2" required /></label>
            <label>{t("Mobile number")} <input name="phone" type="tel" inputMode="tel" autoComplete="tel" required /></label>
          </div>
          <label>
            {t(enquiryItems.length ? "Additional requirements / delivery notes" : "Product requirements & quantities")}
            <textarea
              name="requirement"
              rows="3"
              value={requirement}
              onChange={(event) => setRequirement(event.target.value)}
              placeholder={t(enquiryItems.length ? "Add delivery details or any other requirements" : "For example: 20 switches, 30 LED bulbs")}
              required={!enquiryItems.length}
            />
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          {success && <p className="form-success" role="status">{success}</p>}
          {whatsappPrepared && enquiryItems.length > 0 && (
            <button className="button button-outline enquiry-confirm-sent" type="button" onClick={confirmSent}>
              {t("I sent it - clear enquiry list")}
            </button>
          )}
          <button className="button button-primary form-submit" type="submit" disabled={submitting}>
            <WhatsAppIcon className="whatsapp-icon" /> {submitting ? t("Saving enquiry…") : t("Send enquiry on WhatsApp")}
          </button>
        </form>
      </section>
    </div>
  );
}
