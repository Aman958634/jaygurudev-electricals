import { useState } from "react";
import { X } from "lucide-react";
import { useEnquiry } from "../../context/EnquiryContext.jsx";
import { getWhatsAppUrl } from "../../utils/whatsapp.js";
import { apiRequest } from "../../services/api.js";
import WhatsAppIcon from "../common/WhatsAppIcon.jsx";
import { useLanguage } from "../../context/LanguageContext.jsx";
import { useSiteData } from "../../context/SiteDataContext.jsx";

export default function WholesaleEnquiryForm() {
  const { wholesaleOpen, closeWholesale } = useEnquiry();
  const { t } = useLanguage();
  const { business } = useSiteData();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!wholesaleOpen) return null;

  async function handleSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const phone = String(formData.get("phone") || "").replace(/\D/g, "");
    setError("");
    setSuccess("");
    if (phone.length < 10 || phone.length > 13) {
      setError(t("Enter a valid mobile number (10–13 digits)."));
      return;
    }
    const message = [
      t("Wholesale enquiry"),
      `${t("Name")}: ${formData.get("name")}`,
      `${t("Shop / firm")}: ${formData.get("shop") || t("Not provided")}`,
      `${t("City")}: ${formData.get("city")}`,
      `${t("Mobile")}: ${formData.get("phone")}`,
      `${t("Requirement and quantity")}: ${formData.get("requirement")}`,
    ].join("\n");
    const enquiry = {
      name: String(formData.get("name") || "").trim(),
      shop: String(formData.get("shop") || "").trim(),
      city: String(formData.get("city") || "").trim(),
      phone: String(formData.get("phone") || "").trim(),
      requirement: String(formData.get("requirement") || "").trim(),
      enquiry_type: "wholesale",
    };

    window.open(getWhatsAppUrl(message, business), "_blank", "noopener,noreferrer");
    setSubmitting(true);
    try {
      await apiRequest("/enquiries", { method: "POST", body: JSON.stringify(enquiry) });
      setSuccess(t("Your enquiry has been saved and WhatsApp has opened."));
      form.reset();
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
        <form onSubmit={handleSubmit}>
          <div className="form-two-col">
            <label>{t("Name")} <input name="name" autoComplete="name" required /></label>
            <label>{t("Shop / firm")} <input name="shop" autoComplete="organization" /></label>
            <label>{t("Village / city")} <input name="city" autoComplete="address-level2" required /></label>
            <label>{t("Mobile number")} <input name="phone" type="tel" inputMode="tel" autoComplete="tel" required /></label>
          </div>
          <label>{t("Product requirements & quantities")} <textarea name="requirement" rows="4" placeholder={t("For example: 20 switches, 30 LED bulbs")} required /></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          {success && <p className="form-success" role="status">{success}</p>}
          <button className="button button-primary form-submit" type="submit" disabled={submitting}><WhatsAppIcon className="whatsapp-icon" /> {submitting ? t("Saving enquiry…") : t("Send enquiry on WhatsApp")}</button>
        </form>
      </section>
    </div>
  );
}
