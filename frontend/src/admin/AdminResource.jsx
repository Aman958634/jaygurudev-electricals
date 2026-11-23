import { useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { resolveMediaUrl } from "../services/api.js";
import { adminRequest } from "./adminApi.js";
import { getImagePath } from "./adminResources.js";

function isChecked(value) {
  return value === true || value === 1 || value === "1" || value === "true";
}

function displayValue(value, key) {
  if (key === "is_active") return isChecked(value) ? "Active" : "Inactive";
  if (key === "is_featured") return isChecked(value) ? "Featured" : "—";
  if (key === "stock_status") return String(value || "—").replaceAll("_", " ");
  return value === null || value === undefined || value === "" ? "—" : String(value);
}

function additionalSpecifications(specifications) {
  return (Array.isArray(specifications) ? specifications : []).filter(({ name }) => !/^(?:model(?:\s*(?:number|no\.?)?)?|capacity(?:\s*unit)?|unit|size(?:\s*\/\s*(?:specification|rating))?|(?:electrical\s*)?rating|packing(?:\s*\/\s*unit)?|unit\s*packing)$/i.test(String(name || "")));
}

export default function AdminResource({ config, resource, token, onChanged }) {
  const singularTitle = config.title === "Categories" ? "Category" : config.title.replace(/s$/, "");
  const [rows, setRows] = useState([]);
  const [lookups, setLookups] = useState({ categories: [], brands: [] });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [editing, setEditing] = useState(null);
  const [filePreviews, setFilePreviews] = useState({});
  const loadSequence = useRef(0);

  async function load() {
    const sequence = ++loadSequence.current;
    setLoading(true);
    setError("");
    try {
      const listEndpoint = resource === "brands"
        ? `${config.listEndpoint}?page=${page}&limit=20&search=${encodeURIComponent(search.trim())}`
        : config.listEndpoint;
      const results = await Promise.all([
        adminRequest(token, listEndpoint),
        ...(resource === "products"
          ? [adminRequest(token, "/categories/admin/list"), adminRequest(token, "/brands/admin/list")]
          : []),
      ]);
      if (sequence !== loadSequence.current) return;
      setRows(results[0].data || []);
      setPagination(resource === "brands" ? results[0].pagination || null : null);
      if (resource === "products") {
        setLookups({ categories: results[1].data || [], brands: results[2].data || [] });
      }
    } catch (requestError) {
      if (sequence !== loadSequence.current) return;
      setError(requestError.message);
    } finally {
      if (sequence === loadSequence.current) setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [config.listEndpoint, token, resource, page, search]);

  function openEditor(row) {
    setFilePreviews({});
    setEditing(row);
  }

  function closeEditor() {
    setFilePreviews({});
    setEditing(null);
  }

  const filteredRows = useMemo(() => {
    if (resource === "brands") return rows;
    const term = search.trim().toLocaleLowerCase();
    if (!term) return rows;
    return rows.filter((row) => Object.values(row).some((value) => String(value ?? "").toLocaleLowerCase().includes(term)));
  }, [rows, search, resource]);

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    const form = new FormData(event.currentTarget);
    const payload = new FormData();
    const hasFileFields = config.fields.some((field) => field.type === "file");
    for (const field of config.fields) {
      if (field.type === "file") {
        const selectedFiles = form.getAll(field.name).filter((value) => value instanceof File && value.size > 0);
        selectedFiles.forEach((file) => payload.append(config.uploadField, file));
        continue;
      }
      if (field.type === "checkbox") {
        payload.append(field.name, form.get(field.name) === "on" ? "true" : "false");
        continue;
      }
      const value = form.get(field.name);
      if (["model", "capacity", "capacity_unit", "size", "rating", "packing"].includes(field.name)) {
        payload.append(field.name, value || "");
        continue;
      }
      if (field.name === "specifications" && field.format === "json") {
        try {
          const parsed = value ? JSON.parse(value) : [];
          if (!Array.isArray(parsed)) throw new Error("Specifications must be a JSON array.");
          payload.append(field.name, JSON.stringify(parsed));
        } catch {
          setError("Specifications must be a valid JSON array.");
          setBusy(false);
          return;
        }
      } else if (value !== null && value !== "") {
        payload.append(field.name, value);
      }
    }

    const hasUploadedFile = config.fields
      .filter((field) => field.type === "file")
      .some((field) => form.getAll(field.name).some((value) => value instanceof File && value.size > 0));
    if (config.requireImageOnCreate && !editing?.id && !hasUploadedFile) {
      setError(`${singularTitle} image is required.`);
      setBusy(false);
      return;
    }

    try {
      const isEditing = Boolean(editing?.id);
      const path = isEditing ? `${config.endpoint}/${editing.id}` : config.endpoint;
      // Page copy has no upload field. Sending it as multipart leaves req.body
      // empty because the pages API intentionally accepts JSON only.
      const body = hasFileFields ? payload : JSON.stringify(Object.fromEntries(payload.entries()));
      await adminRequest(token, path, { method: isEditing ? "PUT" : "POST", body });
      setEditing(null);
      setFilePreviews({});
      setNotice(`${singularTitle} saved.`);
      await load();
      onChanged();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(row) {
    if (!window.confirm(`Delete "${row.name || row.title || row.id}"? This cannot be undone.`)) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await adminRequest(token, `${config.endpoint}/${row.id}`, { method: "DELETE" });
      setNotice("Item deleted.");
      if (resource === "brands" && rows.length === 1 && page > 1) setPage((currentPage) => currentPage - 1);
      else await load();
      onChanged();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="admin-page">
      <div className="admin-page-heading">
        <div><span className="admin-eyebrow">CONTENT MANAGEMENT</span><h1>{config.title}</h1><p>{config.description}</p></div>
        <button className="admin-button admin-button--primary" onClick={() => openEditor({})}><Plus size={17} /> Add {singularTitle}</button>
      </div>
      {notice && <div className="admin-alert admin-alert--success">{notice}</div>}
      {error && <div className="admin-alert admin-alert--error" role="alert">{error}</div>}
      <div className="admin-table-tools">
        <label className="admin-search"><Search size={17} /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder={`Search ${config.title.toLowerCase()}...`} /></label>
        <span>{pagination?.total ?? filteredRows.length} items</span>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr>{config.columns.map((column) => <th key={column.key}>{column.label}</th>)}<th className="admin-actions-heading">Actions</th></tr></thead>
          <tbody>
            {loading ? <tr><td className="admin-table-message" colSpan={config.columns.length + 1}>Loading {config.title.toLowerCase()}...</td></tr>
              : filteredRows.length ? filteredRows.map((row) => (
                <tr key={row.id}>
                  {config.columns.map((column) => (
                    <td key={column.key}>
                      {column.key === "image" || column.key === "logo_url"
                        ? getImagePath(resource, row)
                          ? <img className={`admin-table-image${resource === "brands" ? " admin-table-image--logo" : ""}`} src={resolveMediaUrl(getImagePath(resource, row))} alt={resource === "brands" ? `${row.name} logo` : ""} />
                          : <span className="admin-image-placeholder"><ImagePlus size={17} /></span>
                        : displayValue(row[column.key] ?? (column.key === "category_name" ? row.category : column.key === "brand_name" ? row.brand : undefined), column.key)}
                    </td>
                  ))}
                  <td className="admin-row-actions">
                    <button className="admin-icon-button" aria-label="Edit" onClick={() => openEditor(row)}><Pencil size={16} /></button>
                    <button className="admin-icon-button admin-icon-button--danger" aria-label="Delete" onClick={() => remove(row)} disabled={busy}><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))
                : <tr><td className="admin-table-message" colSpan={config.columns.length + 1}>No items found.</td></tr>}
          </tbody>
        </table>
      </div>
      {resource === "brands" && pagination?.totalPages > 1 && (
        <nav className="admin-pagination" aria-label="Brand pages">
          <button className="admin-button admin-button--quiet" type="button" disabled={loading || page <= 1} onClick={() => setPage((currentPage) => currentPage - 1)}>Previous</button>
          <span>Page {page} of {pagination.totalPages}</span>
          <button className="admin-button admin-button--quiet" type="button" disabled={loading || page >= pagination.totalPages} onClick={() => setPage((currentPage) => currentPage + 1)}>Next</button>
        </nav>
      )}
      {editing !== null && (
        <div className="admin-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeEditor(); }}>
          <section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="admin-form-title">
            <header className="admin-modal-header"><div><span className="admin-eyebrow">MANAGE CONTENT</span><h2 id="admin-form-title">{editing.id ? "Edit" : "Add"} {singularTitle}</h2></div><button className="admin-icon-button" aria-label="Close" onClick={closeEditor}><X size={20} /></button></header>
            {error && <div className="admin-alert admin-alert--error" role="alert">{error}</div>}
            <form className="admin-form" onSubmit={save}>
              {config.fields.map((field) => {
                const current = editing[field.previewField || field.name];
                const value = field.name === "specifications"
                  ? JSON.stringify(additionalSpecifications(editing.specifications), null, 2)
                  : editing[field.name] ?? "";
                if (field.type === "file") {
                  const preview = filePreviews[field.name];
                  const currentImage = typeof current === "string" && current ? resolveMediaUrl(current) : "";
                  return (
                    <label className="admin-field" key={field.name}>
                      <span>{field.label}</span>
                      {(preview?.dataUrl || currentImage) && (
                        <div className="admin-upload-preview">
                          <img className={`admin-form-preview${resource === "brands" ? " admin-form-preview--logo" : ""}`} src={preview?.dataUrl || currentImage} alt={`${editing.name || singularTitle} logo preview`} />
                          <small>{preview ? `Preview: ${preview.name} (not saved yet)` : "Current uploaded logo"}</small>
                        </div>
                      )}
                      <input
                        name={field.name}
                        type="file"
                        accept={field.accept}
                        multiple={field.multiple}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          setError("");
                          if (!file) {
                            setFilePreviews((currentPreviews) => {
                              const next = { ...currentPreviews };
                              delete next[field.name];
                              return next;
                            });
                            return;
                          }
                          if (file.size > 5 * 1024 * 1024) {
                            setError("Brand logo must be 5 MB or smaller.");
                            event.target.value = "";
                            setFilePreviews((currentPreviews) => {
                              const next = { ...currentPreviews };
                              delete next[field.name];
                              return next;
                            });
                            return;
                          }
                          if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
                            setError("Choose a JPG, PNG, or WEBP image for the brand logo.");
                            event.target.value = "";
                            setFilePreviews((currentPreviews) => {
                              const next = { ...currentPreviews };
                              delete next[field.name];
                              return next;
                            });
                            return;
                          }
                          const reader = new FileReader();
                          reader.onload = () => {
                            if (typeof reader.result === "string") {
                              setFilePreviews((currentPreviews) => ({
                                ...currentPreviews,
                                [field.name]: { dataUrl: reader.result, name: file.name },
                              }));
                            }
                          };
                          reader.onerror = () => setError(`Unable to preview ${field.label.toLowerCase()}.`);
                          reader.readAsDataURL(file);
                        }}
                      />
                    </label>
                  );
                }
                if (field.type === "checkbox") {
                  if (field.name === "remove_logo" && (!editing.id || !editing.logo_url)) return null;
                  return <label className="admin-checkbox" key={field.name}><input name={field.name} type="checkbox" defaultChecked={editing.id ? isChecked(current) : field.name === "is_active"} /><span>{field.label}</span></label>;
                }
                if (field.type === "lookup") {
                  return <label className="admin-field" key={field.name}><span>{field.label}</span><select name={field.name} defaultValue={current ?? ""}><option value="">Select {field.label.toLowerCase()}</option>{lookups[field.lookup].map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>;
                }
                if (field.type === "select") {
                  return <label className="admin-field" key={field.name}><span>{field.label}</span><select name={field.name} defaultValue={current ?? field.options[0][0]}>{field.options.map(([option, label]) => <option key={option} value={option}>{label}</option>)}</select></label>;
                }
                if (field.type === "textarea") {
                  return <label className="admin-field admin-field--wide" key={field.name}><span>{field.label}</span><textarea name={field.name} defaultValue={value} required={field.required} rows={field.format === "json" ? 6 : 4} /></label>;
                }
                return <label className="admin-field" key={field.name}><span>{field.label}</span><input name={field.name} type={field.type || "text"} step={field.step} placeholder={field.placeholder} defaultValue={value} required={field.required} /></label>;
              })}
              <div className="admin-form-actions"><button type="button" className="admin-button admin-button--quiet" onClick={closeEditor}>Cancel</button><button type="submit" className="admin-button admin-button--primary" disabled={busy}>{busy ? "Saving..." : "Save changes"}</button></div>
            </form>
          </section>
        </div>
      )}
    </section>
  );
}
