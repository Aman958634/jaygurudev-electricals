import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { adminRequest } from "./adminApi.js";
import { BUSINESS, LEGACY_BUSINESS } from "../utils/constants.js";

const businessFields = [
  { key: "name", label: "Business name", required: true, defaultValue: BUSINESS.name },
  { key: "phone", label: "Phone number", required: true },
  { key: "phoneDigits", label: "WhatsApp number (digits only)", required: true, pattern: "[0-9]{10,13}" },
  { key: "email", label: "Business email", type: "email", required: true },
  { key: "address", label: "Address", type: "textarea", required: true, defaultValue: BUSINESS.address },
  { key: "hours", label: "Business hours", required: true, defaultValue: BUSINESS.hours },
  { key: "mapsUrl", label: "Google Maps URL", type: "url", required: true, defaultValue: BUSINESS.mapsUrl },
];

const socialFields = [
  { key: "socialFacebook", label: "Facebook URL", type: "url" },
  { key: "socialInstagram", label: "Instagram URL", type: "url" },
  { key: "socialYouTube", label: "YouTube URL", type: "url" },
  { key: "socialWhatsApp", label: "WhatsApp URL", type: "url" },
];

const catalogueAndReviewsFields = [
  { key: "catalogueUrl", label: "Public catalogue URL (leave blank to request via WhatsApp)", type: "url" },
  { key: "googleReviewUrl", label: "Google Business Profile reviews URL", type: "url" },
  { key: "googleRating", label: "Verified Google rating (0–5)", type: "number", min: 0, max: 5, step: 0.1 },
  { key: "googleReviewCount", label: "Verified Google review count", type: "number", min: 0, step: 1 },
  { key: "googleReviewVerified", label: "I have verified the Google review data", type: "checkbox", defaultValue: false },
];

const allFields = [...businessFields, ...socialFields, ...catalogueAndReviewsFields];

export default function AdminWebsiteSettings({ token, onChanged }) {
  const [values, setValues] = useState({});
  const [existing, setExisting] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    adminRequest(token, "/settings/admin/list")
      .then((response) => {
        if (!active) return;
        const rows = response.data || [];
        const nextValues = Object.fromEntries(rows.map((row) => [row.key_name, row.key_value]));
        if (nextValues.name === "JAY GURUDEVV ELECTRIICALS") nextValues.name = BUSINESS.name;
        if (nextValues.address === LEGACY_BUSINESS.address) nextValues.address = BUSINESS.address;
        if (nextValues.hours === LEGACY_BUSINESS.hours) nextValues.hours = BUSINESS.hours;
        if (nextValues.mapsUrl === LEGACY_BUSINESS.mapsUrl) nextValues.mapsUrl = BUSINESS.mapsUrl;
        nextValues.googleReviewVerified = String(nextValues.googleReviewVerified || "false").toLowerCase() === "true";
        setValues(nextValues);
        setExisting(new Set(rows.map((row) => row.key_name)));
      })
      .catch((requestError) => { if (active) setError(requestError.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token]);

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      for (const field of allFields) {
        const currentValue = values[field.key] ?? field.defaultValue ?? "";
        const value = field.type === "checkbox" ? String(currentValue === true || currentValue === "true") : String(currentValue);
        if (!existing.has(field.key) && !value.trim()) continue;
        const method = existing.has(field.key) ? "PUT" : "POST";
        const path = method === "PUT" ? `/settings/${encodeURIComponent(field.key)}` : "/settings";
        const body = method === "PUT"
          ? { key_value: value }
          : { key_name: field.key, key_value: value, description: field.label };
        await adminRequest(token, path, { method, body: JSON.stringify(body) });
        existing.add(field.key);
      }
      setNotice("Website settings saved.");
      onChanged();
    } catch (requestError) {
      setError(`${requestError.message} Some settings may have already been saved; reload to verify.`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="admin-page">
      <div className="admin-page-heading"><div><span className="admin-eyebrow">WEBSITE CONTENT</span><h1>Business settings</h1><p>Manage public contact details, catalogue and verified review information. Do not enter credentials or secrets here.</p></div></div>
      {notice && <div className="admin-alert admin-alert--success">{notice}</div>}
      {error && <div className="admin-alert admin-alert--error" role="alert">{error}</div>}
      {loading ? <div className="admin-card admin-muted">Loading website settings...</div> : <form className="admin-settings-form admin-card" onSubmit={save}>
        <fieldset className="admin-settings-group"><legend>Business contact</legend>{renderFields(businessFields, values, setValues)}</fieldset>
        <fieldset className="admin-settings-group"><legend>Social links</legend>{renderFields(socialFields, values, setValues)}</fieldset>
        <fieldset className="admin-settings-group"><legend>Catalogue and Google reviews</legend>
          <p className="admin-muted">Review ratings and counts are shown publicly only when verification is enabled and each value is valid.</p>
          {renderFields(catalogueAndReviewsFields, values, setValues)}
        </fieldset>
        <div className="admin-form-actions"><button className="admin-button admin-button--primary" disabled={busy}><Save size={16} />{busy ? "Saving..." : "Save settings"}</button></div>
      </form>}
    </section>
  );
}

function renderFields(fields, values, setValues) {
  return fields.map((field) => {
    const value = values[field.key] ?? field.defaultValue ?? "";
    return (
      <label className={`admin-field${field.type === "checkbox" ? " admin-field-checkbox" : ""}`} key={field.key}>
        <span>{field.label}</span>
        {field.type === "textarea"
          ? <textarea rows="3" required={field.required} value={value} onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))} />
          : <input
            type={field.type || "text"}
            pattern={field.pattern}
            min={field.min}
            max={field.max}
            step={field.step}
            required={field.required}
            title={field.pattern ? "Enter 10 to 13 digits without spaces or symbols." : undefined}
            checked={field.type === "checkbox" ? value === true || value === "true" : undefined}
            value={field.type === "checkbox" ? undefined : value}
            onChange={(event) => setValues((current) => ({
              ...current,
              [field.key]: field.type === "checkbox" ? event.target.checked : event.target.value,
            }))}
          />}
      </label>
    );
  });
}
