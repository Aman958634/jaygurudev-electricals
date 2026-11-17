import { useEffect, useState } from "react";
import { Eye, Search, Trash2, X } from "lucide-react";
import { adminRequest } from "./adminApi.js";

const statuses = [
  ["new", "New"],
  ["contacted", "Contacted"],
  ["quoted", "Quoted"],
  ["closed", "Completed"],
  ["rejected", "Rejected"],
];

export default function AdminEnquiries({ token }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await adminRequest(token, "/enquiries");
      setRows(response.data || []);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [token]);

  const filteredRows = rows.filter((row) => {
    const matchesStatus = statusFilter === "all" || row.status === statusFilter;
    const term = search.trim().toLocaleLowerCase();
    const matchesSearch = !term || [
      row.customer_name,
      row.customer_phone,
      row.customer_email,
      row.customer_shop,
      row.customer_city,
      row.requirement,
      row.enquiry_type,
    ].some((value) => String(value || "").toLocaleLowerCase().includes(term));
    return matchesStatus && matchesSearch;
  });

  async function updateStatus(id, status) {
    setBusyId(id);
    setError("");
    setNotice("");
    try {
      await adminRequest(token, `/enquiries/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
      setRows((current) => current.map((row) => row.id === id ? { ...row, status } : row));
      setNotice("Enquiry status updated.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyId(null);
    }
  }

  async function remove(row) {
    if (!window.confirm(`Permanently delete the enquiry from ${row.customer_name}?`)) return;
    setBusyId(row.id);
    setError("");
    setNotice("");
    try {
      await adminRequest(token, `/enquiries/${row.id}`, { method: "DELETE" });
      setRows((current) => current.filter((item) => item.id !== row.id));
      setSelected((current) => current?.id === row.id ? null : current);
      setNotice("Enquiry deleted.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="admin-page">
      <div className="admin-page-heading"><div><span className="admin-eyebrow">CUSTOMER MESSAGES</span><h1>Enquiries</h1><p>Review and follow up on wholesale and product requests.</p></div></div>
      {notice && <div className="admin-alert admin-alert--success">{notice}</div>}
      {error && <div className="admin-alert admin-alert--error" role="alert">{error}</div>}
      <div className="admin-table-tools">
        <label className="admin-search"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search customer, contact, city, requirement..." /></label>
        <label className="admin-enquiry-filter"><span className="sr-only">Filter enquiries by status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All statuses</option>{statuses.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <span>{filteredRows.length} of {rows.length} enquiries</span>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table admin-enquiry-table">
          <thead><tr><th>Customer</th><th>Contact</th><th>Shop & city</th><th>Requirement</th><th>Date</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {loading ? <tr><td className="admin-table-message" colSpan="7">Loading enquiries...</td></tr>
              : filteredRows.length ? filteredRows.map((row) => <tr key={row.id}>
                <td><strong>{row.customer_name}</strong><small className="admin-table-subtext">{row.enquiry_type || "general"}</small></td>
                <td>{row.customer_phone}<small className="admin-table-subtext">{row.customer_email || ""}</small></td>
                <td>{row.customer_shop || "—"}<small className="admin-table-subtext">{row.customer_city || "—"}</small></td>
                <td className="admin-requirement-cell">{row.requirement || "—"}</td>
                <td>{row.created_at ? new Date(row.created_at).toLocaleDateString() : "—"}</td>
                <td><select className="admin-status-select" aria-label={`Status for ${row.customer_name}`} value={row.status} disabled={busyId === row.id} onChange={(event) => updateStatus(row.id, event.target.value)}>{statuses.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></td>
                <td className="admin-row-actions"><button className="admin-icon-button" aria-label={`View enquiry from ${row.customer_name}`} onClick={() => setSelected(row)}><Eye size={16} /></button><button className="admin-icon-button admin-icon-button--danger" aria-label={`Delete enquiry from ${row.customer_name}`} disabled={busyId === row.id} onClick={() => remove(row)}><Trash2 size={16} /></button></td>
              </tr>)
                : <tr><td className="admin-table-message" colSpan="7">No enquiries found.</td></tr>}
          </tbody>
        </table>
      </div>
      {selected && (
        <div className="admin-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}>
          <section className="admin-modal admin-enquiry-detail" role="dialog" aria-modal="true" aria-labelledby="enquiry-detail-title">
            <header className="admin-modal-header"><div><span className="admin-eyebrow">CUSTOMER MESSAGE</span><h2 id="enquiry-detail-title">{selected.customer_name}</h2></div><button className="admin-icon-button" aria-label="Close enquiry details" onClick={() => setSelected(null)}><X size={20} /></button></header>
            <dl className="admin-enquiry-detail-list">
              <div><dt>Phone</dt><dd>{selected.customer_phone || "—"}</dd></div>
              <div><dt>Email</dt><dd>{selected.customer_email || "—"}</dd></div>
              <div><dt>Shop</dt><dd>{selected.customer_shop || "—"}</dd></div>
              <div><dt>City</dt><dd>{selected.customer_city || "—"}</dd></div>
              <div><dt>Type</dt><dd>{selected.enquiry_type || "General"}</dd></div>
              <div><dt>Date</dt><dd>{selected.created_at ? new Date(selected.created_at).toLocaleString() : "—"}</dd></div>
              <div><dt>Status</dt><dd>{statuses.find(([value]) => value === selected.status)?.[1] || selected.status}</dd></div>
              <div className="admin-enquiry-detail-requirement"><dt>Requirement</dt><dd>{selected.requirement || "—"}</dd></div>
            </dl>
          </section>
        </div>
      )}
    </section>
  );
}
