import { useEffect, useState } from "react";
import { Download, FileArchive, Play, X } from "lucide-react";
import { API_BASE_URL } from "../services/api.js";
import { adminRequest } from "./adminApi.js";

const url = (path) => `${API_BASE_URL}${path}`;
const activeImportKey = "jaygurudev:active-product-import";
const resumableImportKey = "jaygurudev:resumable-product-import";

async function download(token, path, name) {
  const response = await fetch(url(path), { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error("Download failed.");
  const objectUrl = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = objectUrl; link.download = name; link.click(); URL.revokeObjectURL(objectUrl);
}

function Thumbnail({ token, jobId, image }) {
  const [src, setSrc] = useState("");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true; let objectUrl = ""; const controller = new AbortController();
    setSrc(""); setFailed(false);
    fetch(url(`/admin/products/bulk-import/thumbnail/${jobId}/${image.id}`), { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal })
      .then((response) => response.ok ? response.blob() : null)
      .then((blob) => { if (live && blob) { objectUrl = URL.createObjectURL(blob); setSrc(objectUrl); } else if (live) setFailed(true); })
      .catch(() => { if (live) setFailed(true); });
    return () => { live = false; controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [token, jobId, image.id]);
  return src ? <img className="admin-import-thumb" src={src} alt={image.originalName} title="Click to enlarge" onClick={() => window.open(src, "_blank", "noopener,noreferrer")} onError={() => setFailed(true)} /> : <span className="admin-import-thumb" title={failed ? "Preview image is unavailable" : "Loading preview image"}>{failed ? "Unavailable" : "Loading"}</span>;
}

function PdfEvidence({ token, jobId }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let live = true; let objectUrl = "";
    fetch(url(`/admin/products/bulk-import/source/${jobId}`), { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => response.ok ? response.blob() : null)
      .then((blob) => { if (live && blob) { objectUrl = URL.createObjectURL(blob); setSrc(objectUrl); } })
      .catch(() => {});
    return () => { live = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [token, jobId]);
  return <aside className="admin-import-pdf-evidence"><strong>Source catalogue</strong>{src ? <iframe title="Original catalogue PDF" src={src} /> : <small>Loading authenticated PDF…</small>}</aside>;
}

function ImagePicker({ token, jobId, images, row, onChange }) {
  const [open, setOpen] = useState(false);
  const selectedIds = row.product.imageIds || row.product.images.map((entry) => entry.id);
  const candidates = [...images].sort((left, right) => {
    const score = (image) => selectedIds.includes(image.id) ? 0 : image.candidateSkus?.includes(row.product.sku) ? 1 : image.sourcePage === row.sourcePage ? 2 : 3;
    return score(left) - score(right) || Number(right.confidence || 0) - Number(left.confidence || 0);
  });
  return <details className="admin-image-picker" onToggle={(event) => setOpen(event.currentTarget.open)}><summary>Choose images</summary>{open && <div>{candidates.map((image) => {
    const selected = (row.product.imageIds || row.product.images.map((entry) => entry.id)).includes(image.id);
    return <label key={image.id}><input type="checkbox" checked={selected} onChange={(event) => { const current = row.product.imageIds || row.product.images.map((entry) => entry.id); onChange(event.target.checked ? [...current, image.id] : current.filter((id) => id !== image.id)); }} /><Thumbnail token={token} jobId={jobId} image={image} /><small>{image.needsReview ? "Review" : "Available"}</small></label>;
  })}</div>}</details>;
}

function ReviewField({ value, onChange, type = "text", placeholder = "" }) {
  return <input className="admin-import-field" aria-label={placeholder} type={type} value={value ?? ""} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />;
}

export default function AdminProductImport({ token, onClose, onImported }) {
  const [bundle, setBundle] = useState(null);
  const [dataFile, setDataFile] = useState(null);
  const [cataloguePdf, setCataloguePdf] = useState(null);
  const [imagesZip, setImagesZip] = useState(null);
  const [images, setImages] = useState([]);
  const [lookups, setLookups] = useState({ categories: [], brands: [] });
  const [defaults, setDefaults] = useState({ duplicateMode: "skip", createMissing: true });
  const [job, setJob] = useState(null);
  const [previewRows, setPreviewRows] = useState([]);
  const [status, setStatus] = useState(null);
  const [previewQuery, setPreviewQuery] = useState("");
  const [previewFilter, setPreviewFilter] = useState("valid");
  const [previewPage, setPreviewPage] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [resumableJob, setResumableJob] = useState(null);
  const [selectedRows, setSelectedRows] = useState([]);
  const [bulkCategory, setBulkCategory] = useState("");
  const [bulkBrand, setBulkBrand] = useState("");
  const [bulkImageId, setBulkImageId] = useState("");

  function resetImport() {
    sessionStorage.removeItem(activeImportKey);
    localStorage.removeItem(activeImportKey);
    sessionStorage.removeItem(resumableImportKey);
    localStorage.removeItem(resumableImportKey);
    setBundle(null); setDataFile(null); setCataloguePdf(null); setImagesZip(null); setImages([]);
    setJob(null); setPreviewRows([]); setStatus(null); setPreviewQuery(""); setPreviewFilter("valid"); setPreviewPage(0); setError(""); setBusy(false);
    setSelectedRows([]); setBulkCategory(""); setBulkBrand(""); setBulkImageId("");
  }

  function restoreSavedJob(data) {
    // A completed browser session may belong to an older parser. Do not show
    // that stale preview as current catalogue output.
    if (data.pdf && data.pdf.parserVersion !== data.currentPdfParserVersion) {
      sessionStorage.removeItem(activeImportKey);
      sessionStorage.removeItem(resumableImportKey);
      localStorage.removeItem(resumableImportKey);
      setResumableJob(null);
      setError(`The saved PDF preview used ${data.pdf.parserVersion || "an unknown parser version"}; upload the catalogue again to use ${data.currentPdfParserVersion}.`);
      return false;
    }
    setJob({ jobId: data.jobId, ...data });
    if (data.status === "validated") setPreviewRows(data.rows || []);
    else if (["queued", "processing", "extracting"].includes(data.status)) setStatus(data);
    return true;
  }

  useEffect(() => {
    let live = true;
    Promise.all([adminRequest(token, "/categories/admin/list"), adminRequest(token, "/brands/admin/list")])
      .then(([categories, brands]) => { if (live) setLookups({ categories: categories.data || [], brands: brands.data || [] }); })
      .catch((reason) => { if (live) setError(reason.message); });
    return () => { live = false; };
  }, [token]);

  // Opening Bulk Import is always a new upload. An unfinished server job is
  // discoverable, but never silently restored into the review screen.
  useEffect(() => {
    sessionStorage.removeItem(activeImportKey); localStorage.removeItem(activeImportKey);
    const savedJobId = sessionStorage.getItem(resumableImportKey) || localStorage.getItem(resumableImportKey);
    if (!savedJobId) return undefined;
    let live = true;
    adminRequest(token, `/admin/products/bulk-import/status/${savedJobId}`).then((result) => {
      if (!live) return;
      if (["completed", "cancelled", "failed", "interrupted"].includes(result.data.status)) {
        sessionStorage.removeItem(resumableImportKey); localStorage.removeItem(resumableImportKey);
        return;
      }
      setResumableJob(result.data);
    }).catch(() => { sessionStorage.removeItem(resumableImportKey); localStorage.removeItem(resumableImportKey); });
    return () => { live = false; };
  }, [token]);

  useEffect(() => {
    if (!job || !status || !["queued", "processing", "extracting"].includes(status.status)) return undefined;
    const timer = setInterval(() => adminRequest(token, `/admin/products/bulk-import/status/${job.jobId}`)
      .then((result) => { setStatus(result.data); if (result.data.status === "validated" && restoreSavedJob(result.data)) setStatus(null); }).catch((reason) => { if (reason.status === 404) resetImport(); else setError(reason.message); }), 1000);
    return () => clearInterval(timer);
  }, [token, job, status?.status]);
  useEffect(() => { if (status?.status === "completed") { sessionStorage.removeItem(activeImportKey); localStorage.removeItem(activeImportKey); sessionStorage.removeItem(resumableImportKey); localStorage.removeItem(resumableImportKey); onImported(); } }, [status?.status, onImported]);

  async function validate(event) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const form = new FormData();
      if (bundle) form.append("bundle", bundle);
      if (dataFile) form.append("dataFile", dataFile);
      if (cataloguePdf) form.append("cataloguePdf", cataloguePdf);
      if (imagesZip) form.append("imagesZip", imagesZip);
      images.forEach((image) => form.append("images", image));
      Object.entries(defaults).forEach(([key, value]) => form.append(key, String(value)));
      const result = await adminRequest(token, "/admin/products/bulk-import/validate", { method: "POST", body: form });
      setJob(result.data); sessionStorage.setItem(resumableImportKey, result.data.jobId); setResumableJob(null);
      if (result.data.status === "extracting") setStatus(result.data); else setPreviewRows(result.data.rows || []);
    } catch (reason) { setError(reason.message); } finally { setBusy(false); }
  }

  function updateProduct(rowNumber, field, value) {
    setPreviewRows((current) => current.map((row) => row.rowNumber === rowNumber ? { ...row, product: { ...row.product, [field]: value } } : row));
  }

  function updateImages(rowNumber, imageIds) {
    setPreviewRows((current) => current.map((row) => row.rowNumber === rowNumber ? { ...row, product: { ...row.product, imageIds } } : row));
  }

  function toggleRow(rowNumber, checked) { setSelectedRows((current) => checked ? [...new Set([...current, rowNumber])] : current.filter((value) => value !== rowNumber)); }
  function applyBulk() {
    if (!selectedRows.length) return;
    setPreviewRows((current) => current.map((row) => {
      if (!selectedRows.includes(row.rowNumber)) return row;
      const product = { ...row.product };
      if (bulkCategory) product.category = bulkCategory;
      if (bulkBrand) product.brand = bulkBrand;
      if (bulkImageId) product.imageIds = [...new Set([...(product.imageIds || product.images.map((image) => image.id)), bulkImageId])];
      return { ...row, product };
    }));
  }

  async function uploadManualImages(files) {
    if (!job || !files.length || busy) return;
    if (files.length > 12) { setError("Upload up to 12 images at a time."); return; }
    setBusy(true); setError("");
    try {
      const form = new FormData();
      files.slice(0, 12).forEach((file) => form.append("images", file));
      const result = await adminRequest(token, `/admin/products/bulk-import/images/${job.jobId}`, { method: "POST", body: form });
      setJob((current) => ({ ...current, images: result.data.images, unmatchedImages: result.data.unmatchedImages, summary: result.data.summary }));
    } catch (reason) { setError(reason.message); } finally { setBusy(false); }
  }

  async function start() {
    setBusy(true); setError("");
    try {
      const review = await adminRequest(token, `/admin/products/bulk-import/review/${job.jobId}`, {
        method: "PUT",
        body: JSON.stringify({ rows: previewRows.map(({ rowNumber, product }) => ({ rowNumber, product })) }),
      });
      setJob((current) => ({ ...current, ...review.data }));
      setPreviewRows(review.data.rows || []);
      if (!review.data.summary.ready) throw new Error("Correct the invalid rows before confirming this import.");
      const result = await adminRequest(token, `/admin/products/bulk-import/start/${job.jobId}`, { method: "POST", body: JSON.stringify({}) });
      setStatus({ ...result.data, progress: result.data.progress || review.data.progress || { total: review.data.summary?.ready || 0, processed: 0, created: 0, skipped: 0, failed: 0 } });
    } catch (reason) { setError(reason.message); } finally { setBusy(false); }
  }

  async function cancel() {
    try {
      await adminRequest(token, `/admin/products/bulk-import/cancel/${job.jobId}`, { method: "POST", body: JSON.stringify({}) });
      setStatus((current) => ({ ...current, status: "cancelled" }));
    } catch (reason) { setError(reason.message); }
  }

  const selectFile = (setter, clear) => (event) => { setter(event.target.files?.[0] || null); clear(); };
  const step = status ? 5 : job ? 4 : bundle || dataFile || cataloguePdf ? 3 : 1;
  const visibleRows = previewRows.filter((row) => {
    const matchesQuery = !previewQuery || `${row.product.name} ${row.product.sku} ${row.product.category} ${row.product.brand}`.toLowerCase().includes(previewQuery.toLowerCase());
    const matchesFilter = previewFilter === "all" || (previewFilter === "valid" && !row.errors.length) || (previewFilter === "invalid" && row.errors.length) || (previewFilter === "missing-images" && !row.product.images.length);
    return matchesQuery && matchesFilter;
  });
  const previewPageSize = 25;
  const previewPageCount = Math.max(1, Math.ceil(visibleRows.length / previewPageSize));
  const pagedRows = visibleRows.slice(previewPage * previewPageSize, (previewPage + 1) * previewPageSize);
  useEffect(() => { setPreviewPage(0); }, [previewQuery, previewFilter]);
  useEffect(() => { if (previewPage >= previewPageCount) setPreviewPage(previewPageCount - 1); }, [previewPage, previewPageCount]);
  useEffect(() => {
    const onKeyDown = (event) => {
      if (!job || status || event.target.matches("input,select,textarea")) return;
      if (event.altKey && event.key.toLowerCase() === "a") { event.preventDefault(); setSelectedRows(pagedRows.map((row) => row.rowNumber)); }
      if (event.altKey && event.key.toLowerCase() === "n") { event.preventDefault(); setPreviewFilter("invalid"); setPreviewPage((current) => Math.min(current + 1, previewPageCount - 1)); }
    };
    window.addEventListener("keydown", onKeyDown); return () => window.removeEventListener("keydown", onKeyDown);
  }, [job, status, pagedRows, previewPageCount]);
  return <div className="admin-modal-backdrop"><section className="admin-modal admin-import-modal" onPaste={(event) => {
    const clipboard = event.clipboardData;
    const files = [...(clipboard?.files || [])];
    if (!files.length) for (const item of clipboard?.items || []) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    }
    if (files.length && job && !status && !busy) { event.preventDefault(); uploadManualImages(files); }
  }}>
    <header className="admin-modal-header"><div><span className="admin-eyebrow">PRODUCT CATALOGUE</span><h2>Bulk Product Import</h2></div><button className="admin-icon-button" onClick={onClose}><X size={20} /></button></header>
    <ol className="admin-import-steps">{["Data", "Images", "Preview", "Confirm", "Results"].map((label, index) => <li className={step >= index + 1 ? "is-active" : ""} key={label}>{index + 1}. {label}</li>)}</ol>
    {error && <div className="admin-alert admin-alert--error">{error}</div>}
    {!job && <form className="admin-import-form" onSubmit={validate}>
      {resumableJob && <div className="admin-alert"><strong>Unfinished import available.</strong> <button type="button" className="admin-button admin-button--quiet" onClick={() => restoreSavedJob(resumableJob)}>Resume Previous Import</button><button type="button" className="admin-button admin-button--quiet" onClick={() => { sessionStorage.removeItem(resumableImportKey); localStorage.removeItem(resumableImportKey); setResumableJob(null); }}>Discard saved review</button></div>}
      <div className="admin-import-downloads"><button type="button" onClick={() => download(token, "/admin/products/bulk-import/template?type=xlsx", "products-template.xlsx")}><Download size={15} /> Excel template</button><button type="button" onClick={() => download(token, "/admin/products/bulk-import/template?type=csv", "products-template.csv")}><Download size={15} /> CSV template</button><button type="button" onClick={() => download(token, "/admin/products/bulk-import/sample-zip", "products-sample.zip")}><Download size={15} /> Sample ZIP</button></div>
      <label className="admin-import-drop"><FileArchive size={24} /><strong>Smart PDF Import</strong><span>{cataloguePdf?.name || "Upload an original manufacturer catalogue PDF"}</span><input type="file" accept="application/pdf,.pdf" onChange={selectFile(setCataloguePdf, () => { setBundle(null); setDataFile(null); })} /></label>
      <label className="admin-import-drop"><FileArchive size={24} /><strong>Single ZIP import</strong><span>{bundle?.name || "products.xlsx or products.csv plus images/"}</span><input type="file" accept=".zip" onChange={selectFile(setBundle, () => { setCataloguePdf(null); setDataFile(null); })} /></label>
      <p className="admin-muted">Or use the existing separate data and image options:</p>
      <div className="admin-import-files"><label>CSV/XLSX<input type="file" accept=".csv,.xlsx" onChange={selectFile(setDataFile, () => { setBundle(null); setCataloguePdf(null); })} /></label><label>Images ZIP<input type="file" accept=".zip" onChange={selectFile(setImagesZip, () => {})} /></label><label>Individual images<input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => setImages([...event.target.files])} /></label></div>
      <label className="admin-checkbox"><input type="checkbox" checked={defaults.createMissing} onChange={(event) => setDefaults((current) => ({ ...current, createMissing: event.target.checked }))} /> Create confirmed missing brands/categories</label>
      <label>Duplicates<select value={defaults.duplicateMode} onChange={(event) => setDefaults((current) => ({ ...current, duplicateMode: event.target.value }))}><option value="skip">Skip existing</option><option value="update">Update by SKU</option></select></label>
      <div className="admin-form-actions"><button type="button" className="admin-button admin-button--quiet" onClick={onClose}>Back</button><button className="admin-button admin-button--primary" disabled={busy || (!bundle && !dataFile && !cataloguePdf)}>{busy ? "Extracting..." : "Preview and validate"}</button></div>
    </form>}
    {job && !status && <div className="admin-import-preview">
      <div className="admin-import-summary">{Object.entries(job.summary).map(([key, value]) => <span key={key}><strong>{value}</strong>{key}</span>)}</div>
      <p className="admin-muted">Edit extracted values before confirmation. Catalogue MRP is retained as a specification, never used as the selling price, and PDF stock availability defaults to unverified/out of stock.</p>
      <div className="admin-import-filters"><input className="admin-import-field" value={previewQuery} placeholder="Search product or SKU" onChange={(event) => setPreviewQuery(event.target.value)} /><select className="admin-import-select" value={previewFilter} onChange={(event) => setPreviewFilter(event.target.value)}><option value="valid">Ready products</option><option value="all">All products</option><option value="invalid">Needs review</option><option value="missing-images">Missing images</option></select></div>
      <details className="admin-import-review"><summary>Needs Review ({job.summary.invalid || 0})</summary><p>These genuine source rows are retained for correction and are never imported until valid.</p><button type="button" className="admin-button admin-button--quiet" onClick={() => setPreviewFilter("invalid")}>Review unresolved products</button></details>
      <details className="admin-import-review"><summary>Image Review ({job.summary.unmatchedImages || 0} unassigned images)</summary><p>Unassigned source photographs remain available for matching or manual review.</p><button type="button" className="admin-button admin-button--quiet" onClick={() => setPreviewFilter("missing-images")}>Review products needing images</button></details>
      <div className="admin-import-review-actions"><strong>{selectedRows.length} selected</strong><select value={bulkCategory} onChange={(event) => setBulkCategory(event.target.value)}><option value="">Assign category</option>{lookups.categories.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}</select><select value={bulkBrand} onChange={(event) => setBulkBrand(event.target.value)}><option value="">Assign brand</option>{lookups.brands.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}</select><select value={bulkImageId} onChange={(event) => setBulkImageId(event.target.value)}><option value="">Assign verified family image</option>{(job.images || []).filter((image) => !image.needsReview).map((image) => <option key={image.id} value={image.id}>p. {image.sourcePage} · {image.originalName}</option>)}</select><button type="button" className="admin-button admin-button--quiet" onClick={applyBulk} disabled={!selectedRows.length}>Apply to selected</button><small>Alt+A selects this page · Alt+N reviews next unresolved page</small></div>
      <div className="admin-import-split"><PdfEvidence token={token} jobId={job.jobId} /><div className="admin-table-wrap admin-import-table-wrap"><table className="admin-table admin-import-table"><thead><tr><th><input type="checkbox" checked={pagedRows.length > 0 && pagedRows.every((row) => selectedRows.includes(row.rowNumber))} onChange={(event) => setSelectedRows(event.target.checked ? [...new Set([...selectedRows, ...pagedRows.map((row) => row.rowNumber)])] : selectedRows.filter((id) => !pagedRows.some((row) => row.rowNumber === id)))} /></th><th>Images</th><th>Product / SKU</th><th>Category / brand</th><th>Price</th><th>Source</th><th>Status</th></tr></thead><tbody>{pagedRows.map((row) => <tr key={row.rowNumber}>
        <td><input type="checkbox" checked={selectedRows.includes(row.rowNumber)} onChange={(event) => toggleRow(row.rowNumber, event.target.checked)} /></td>
        <td><div className="admin-import-thumbs">{row.product.images.map((image) => <Thumbnail key={image.id} token={token} jobId={job.jobId} image={image} />)}</div>{(job.images || []).length > 0 && <ImagePicker token={token} jobId={job.jobId} images={job.images} row={row} onChange={(imageIds) => updateImages(row.rowNumber, imageIds)} />}</td>
        <td><ReviewField value={row.product.name} placeholder="Product name" onChange={(value) => updateProduct(row.rowNumber, "name", value)} /><ReviewField value={row.product.sku} placeholder="SKU" onChange={(value) => updateProduct(row.rowNumber, "sku", value)} /></td>
        <td><select className="admin-import-select" aria-label="Category" value={row.product.category || ""} onChange={(event) => updateProduct(row.rowNumber, "category", event.target.value)}><option value="">No category</option>{row.product.category && !lookups.categories.some((item) => item.name === row.product.category) && <option value={row.product.category}>{row.product.category} (proposed)</option>}{lookups.categories.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}</select><select className="admin-import-select" aria-label="Brand" value={row.product.brand || ""} onChange={(event) => updateProduct(row.rowNumber, "brand", event.target.value)}><option value="">No brand</option>{row.product.brand && !lookups.brands.some((item) => item.name === row.product.brand) && <option value={row.product.brand}>{row.product.brand} (proposed)</option>}{lookups.brands.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}</select></td>
        <td><ReviewField type="number" value={row.product.price} placeholder="Selling price" onChange={(value) => updateProduct(row.rowNumber, "price", value)} /><select className="admin-import-select" aria-label="Availability" value={row.product.stock_status || "out_of_stock"} onChange={(event) => updateProduct(row.rowNumber, "stock_status", event.target.value)}><option value="in_stock">In stock</option><option value="out_of_stock">Out of stock / unverified</option><option value="limited">Limited</option><option value="price_on_request">Price on request</option></select></td>
        <td>{row.sourcePage ? <>p. {row.sourcePage}<br /><small>{Math.round((row.confidence || 0) * 100)}% confidence</small></> : "Spreadsheet"}</td>
        <td>{row.errors.join(" ") || row.warnings.join(" ") || "Ready"}</td>
      </tr>)}</tbody></table></div></div>
      {visibleRows.length > previewPageSize && <div className="admin-import-pagination"><span>{visibleRows.length} matching rows · page {previewPage + 1} of {previewPageCount}</span><button type="button" disabled={previewPage === 0} onClick={() => setPreviewPage((current) => current - 1)}>Previous</button><button type="button" disabled={previewPage + 1 >= previewPageCount} onClick={() => setPreviewPage((current) => current + 1)}>Next</button></div>}
      <div className="admin-import-files"><label>Upload verified product photos<input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={busy} onChange={(event) => { uploadManualImages([...event.target.files]); event.target.value = ""; }} /></label><small>Upload up to 12 at a time, or paste copied product images in this review to add them for manual assignment.</small></div>
      <div className="admin-form-actions"><button className="admin-button admin-button--quiet" onClick={resetImport}>Change files</button><button className="admin-button admin-button--primary" disabled={busy} onClick={start}><Play size={16} /> Save review & confirm</button></div>
    </div>}
    {status && <div className="admin-import-results"><div className="admin-import-progress"><div style={{ width: `${status.status === "extracting" ? (status.extractionProgress?.pageCount ? Math.round((status.extractionProgress?.processedPages || 0) / status.extractionProgress.pageCount * 100) : 0) : (status.progress?.total ? Math.round((status.progress?.processed || 0) / status.progress.total * 100) : 0)}%` }} /></div><p>{status.status === "extracting" ? `${status.extractionProgress?.stage || "extracting"}: ${status.extractionProgress?.processedPages || 0}/${status.extractionProgress?.pageCount || "?"} pages; ${status.extractionProgress?.totalProducts || 0} products, ${status.extractionProgress?.totalImages || 0} images.` : `${status.status}: ${status.progress?.processed || 0}/${status.progress?.total || 0}; ${status.progress?.created || 0} created, ${status.progress?.skipped || 0} skipped, ${status.progress?.failed || 0} failed.`}</p>{status.status === "extracting" && (status.partialProducts || []).length > 0 && <div className="admin-import-live-products"><strong>Detected for review</strong>{status.partialProducts.slice(-8).map((product) => <span key={`${product.sourcePage}-${product.sku}`}>{product.sku} — {product.name || "Name needs review"} <small>p. {product.sourcePage}</small></span>)}</div>}{["queued", "processing", "extracting"].includes(status.status) ? <button className="admin-button admin-button--quiet" onClick={cancel}>Cancel safely</button> : <div className="admin-form-actions"><button className="admin-button admin-button--quiet" onClick={() => download(token, `/admin/products/bulk-import/report/${job.jobId}`, "import-report.csv")}>Download report</button><button className="admin-button admin-button--quiet" onClick={resetImport}>Start New Import</button><button className="admin-button admin-button--primary" onClick={() => { resetImport(); onClose(); }}>Done</button></div>}</div>}
  </section></div>;
}
