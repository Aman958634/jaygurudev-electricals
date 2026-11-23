import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { adminRequest } from "./adminApi.js";
import { BUSINESS, isLegacyShopAddress } from "../utils/constants.js";
import { DEFAULT_BUSINESS_HOURS, formatBusinessHours, parseBusinessHours } from "../utils/businessSettings.js";

const groups = [
  { legend: "Business information", fields: [
    ["name", "Business display name", "text", true], ["tagline", "Business tagline"],
  ] },
  { legend: "Contact details", fields: [
    ["address", "Full showroom address", "textarea", true], ["city", "City"], ["state", "State"], ["pinCode", "PIN code", "text", false, "[0-9]{6}"],
    ["phone", "Primary phone number", "tel", true], ["secondaryPhone", "Secondary phone number", "tel"], ["phoneDigits", "WhatsApp number (digits only)", "text", true, "[0-9]{10,13}"], ["email", "Business email", "email", true],
  ] },
  { legend: "Google Maps & location", fields: [
    ["mapsUrl", "Showroom Google Maps URL", "url", true], ["mapsDirectionsUrl", "Google Maps directions URL", "url"], ["mapsSearchUrl", "Google Maps search URL", "url"], ["mapsEmbedUrl", "Google Maps embed URL", "url"], ["latitude", "Latitude", "number", false, undefined, "any"], ["longitude", "Longitude", "number", false, undefined, "any"],
  ] },
  { legend: "Social media", fields: [
    ["socialInstagram", "Instagram URL", "url"], ["socialFacebook", "Facebook URL", "url"], ["socialYouTube", "YouTube URL", "url"], ["socialLinkedIn", "LinkedIn URL", "url"], ["socialWhatsApp", "WhatsApp social URL", "url"], ["googleBusinessUrl", "Google Business Profile URL", "url"],
  ] },
  { legend: "Footer information", fields: [["footerDescription", "Footer description", "textarea"], ["footerNote", "Footer note", "textarea"], ["catalogueUrl", "Public catalogue URL", "url"], ["googleReviewUrl", "Google review URL", "url"]] },
];
const settingKeys = groups.flatMap(({ fields }) => fields.map(([key]) => key));

export default function AdminWebsiteSettings({ token, onChanged }) {
  const [values, setValues] = useState({});
  const [schedule, setSchedule] = useState(DEFAULT_BUSINESS_HOURS);
  const [existing, setExisting] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    adminRequest(token, "/settings/admin/list").then((response) => {
      if (!active) return;
      const rows = response.data || [];
      const next = Object.fromEntries(rows.map((row) => [row.key_name, row.key_value]));
      if (isLegacyShopAddress(next.address)) next.address = BUSINESS.address;
      setValues(next);
      setSchedule(parseBusinessHours(next.businessHours, next.hours));
      setExisting(new Set(rows.map((row) => row.key_name)));
    }).catch((requestError) => active && setError(requestError.message)).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [token]);

  async function save(event) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    const payload = { ...values, businessHours: JSON.stringify(schedule), hours: formatBusinessHours(schedule) };
    const keys = [...new Set([...settingKeys, "businessHours", "hours"])];
    try {
      for (const key of keys) {
        const value = String(payload[key] ?? "").trim();
        if (!existing.has(key) && !value) continue;
        const field = groups.flatMap((group) => group.fields).find(([fieldKey]) => fieldKey === key);
        const body = existing.has(key) ? { key_value: value } : { key_name: key, key_value: value, description: field?.[1] || key };
        await adminRequest(token, existing.has(key) ? `/settings/${encodeURIComponent(key)}` : "/settings", { method: existing.has(key) ? "PUT" : "POST", body: JSON.stringify(body) });
        existing.add(key);
      }
      setValues(payload); setNotice("Website settings saved."); onChanged();
    } catch (requestError) {
      setError(`${requestError.message} Reload to verify any settings saved before the error.`);
    } finally { setBusy(false); }
  }

  return <section className="admin-page">
    <div className="admin-page-heading"><div><span className="admin-eyebrow">WEBSITE SETTINGS</span><h1>Website Settings</h1><p>Changes are saved in MySQL and appear publicly after refresh.</p></div></div>
    {notice && <div className="admin-alert admin-alert--success">{notice}</div>}{error && <div className="admin-alert admin-alert--error" role="alert">{error}</div>}
    {loading ? <div className="admin-card admin-muted">Loading website settings...</div> : <form className="admin-settings-form admin-card" onSubmit={save}>
      {groups.map(({ legend, fields }) => <fieldset className="admin-settings-group" key={legend}><legend>{legend}</legend>{fields.map(([key, label, type = "text", required, pattern, step]) => <label className={`admin-field${type === "textarea" ? " admin-field--wide" : ""}`} key={key}><span>{label}</span>{type === "textarea" ? <textarea rows="3" required={required} value={values[key] ?? ""} onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))} /> : <input type={type} required={required} pattern={pattern} step={step} value={values[key] ?? ""} onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))} />}</label>)}</fieldset>)}
      <fieldset className="admin-settings-group"><legend>Opening hours</legend><p className="admin-muted">Set Monday through Sunday independently. Closed days remain visible as CLOSED on the public site.</p>{schedule.map((day, index) => <div className="admin-hours-row" key={day.day}><strong>{day.day}</strong><label><input type="checkbox" checked={day.closed} onChange={(event) => setSchedule((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, closed: event.target.checked } : item))} /> Closed</label><input type="time" disabled={day.closed} value={day.open} onChange={(event) => setSchedule((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, open: event.target.value } : item))} /><span>to</span><input type="time" disabled={day.closed} value={day.close} onChange={(event) => setSchedule((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, close: event.target.value } : item))} /></div>)}</fieldset>
      <div className="admin-form-actions"><button className="admin-button admin-button--primary" disabled={busy}><Save size={16} />{busy ? "Saving..." : "Save settings"}</button></div>
    </form>}
  </section>;
}
