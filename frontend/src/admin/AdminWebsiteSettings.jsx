import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { adminRequest } from "./adminApi.js";

const fields = [
  { key: "name", label: "Business name", required: true },
  { key: "phone", label: "Phone number", required: true },
  { key: "phoneDigits", label: "WhatsApp number (digits only)", required: true, pattern: "[0-9]{10,13}" },
  { key: "email", label: "Business email", type: "email", required: true },
  { key: "address", label: "Address", type: "textarea", required: true },
  { key: "hours", label: "Business hours", required: true },
  { key: "mapsUrl", label: "Google Maps URL", type: "url", required: true },
  { key: "socialFacebook", label: "Facebook URL", type: "url" },
  { key: "socialInstagram", label: "Instagram URL", type: "url" },
  { key: "socialYouTube", label: "YouTube URL", type: "url" },
  { key: "socialWhatsApp", label: "WhatsApp URL", type: "url" },
];

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
        setValues(Object.fromEntries(rows.map((row) => [row.key_name, row.key_value])));
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
      for (const field of fields) {
        const value = values[field.key] || "";
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
      <div className="admin-page-heading"><div><span className="admin-eyebrow">WEBSITE CONTENT</span><h1>Business settings</h1><p>Manage public contact details and social links. Do not enter credentials or secrets here.</p></div></div>
      {notice && <div className="admin-alert admin-alert--success">{notice}</div>}
      {error && <div className="admin-alert admin-alert--error" role="alert">{error}</div>}
      {loading ? <div className="admin-card admin-muted">Loading website settings...</div> : <form className="admin-settings-form admin-card" onSubmit={save}>
        {fields.map((field) => <label className="admin-field" key={field.key}><span>{field.label}</span>{field.type === "textarea"
          ? <textarea rows="3" required={field.required} value={values[field.key] || ""} onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))} />
          : <input type={field.type || "text"} pattern={field.pattern} required={field.required} title={field.pattern ? "Enter 10 to 13 digits without spaces or symbols." : undefined} value={values[field.key] || ""} onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))} />}</label>)}
        <div className="admin-form-actions"><button className="admin-button admin-button--primary" disabled={busy}><Save size={16} />{busy ? "Saving..." : "Save settings"}</button></div>
      </form>}
    </section>
  );
}
