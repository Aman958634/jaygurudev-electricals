import { useEffect, useState } from "react";
import { ArrowUpRight, Boxes, FolderKanban, Image, MessageSquareText, Tags } from "lucide-react";
import { adminRequest } from "./adminApi.js";

const cards = [
  { key: "products", label: "Products", icon: Boxes },
  { key: "categories", label: "Categories", icon: FolderKanban },
  { key: "brands", label: "Brands", icon: Tags },
  { key: "galleryImages", label: "Gallery images", icon: Image },
  { key: "enquiries", label: "Total enquiries", icon: MessageSquareText },
];

export default function AdminDashboard({ token, onNavigate }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    adminRequest(token, "/dashboard/summary")
      .then((response) => { if (active) setSummary(response.data); })
      .catch((requestError) => { if (active) setError(requestError.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token]);

  return (
    <section className="admin-page">
      <div className="admin-page-heading"><div><span className="admin-eyebrow">OVERVIEW</span><h1>Dashboard</h1><p>Here is what is happening across your website.</p></div></div>
      {error && <div className="admin-alert admin-alert--error" role="alert">{error}</div>}
      <div className="admin-stat-grid">
        {cards.map(({ key, label, icon: Icon }) => <article className="admin-stat-card" key={key}><span className="admin-stat-icon"><Icon size={20} /></span><span className="admin-stat-label">{label}</span><strong>{summary ? summary[key] ?? 0 : "—"}</strong></article>)}
      </div>
      <div className="admin-dashboard-grid">
        <section className="admin-card admin-recent-card">
          <div className="admin-card-heading"><div><h2>Recent enquiries</h2><p>Latest customer requests</p></div><button className="admin-text-button" onClick={() => onNavigate("enquiries")}>View all <ArrowUpRight size={16} /></button></div>
          {loading ? <div className="admin-skeleton-list" aria-label="Loading enquiries"><span /><span /><span /></div>
            : error ? <p className="admin-empty">Recent enquiries are unavailable. Retry by refreshing this page.</p>
            : summary?.recentEnquiries?.length ? <div className="admin-recent-list">{summary.recentEnquiries.map((item) => <article className="admin-recent-item" key={item.id}><div className="admin-avatar">{(item.customer_name || "?").slice(0, 1).toUpperCase()}</div><div className="admin-recent-copy"><strong>{item.customer_name}</strong><span>{item.customer_phone} · {item.customer_city || "City not provided"}</span><small>{item.requirement}</small></div><span className={`admin-status admin-status--${item.status}`}>{item.status === "closed" ? "Completed" : item.status}</span></article>)}</div>
              : <p className="admin-empty">No enquiries received yet.</p>}
        </section>
        <section className="admin-card admin-dashboard-note"><span className="admin-eyebrow">SITE MANAGEMENT</span><h2>Keep your catalog current</h2><p>Changes to active products, brands, categories, banners and settings are reflected on the public website after saving.</p><button className="admin-button admin-button--primary" onClick={() => onNavigate("products")}>Manage products <ArrowUpRight size={16} /></button></section>
      </div>
    </section>
  );
}
