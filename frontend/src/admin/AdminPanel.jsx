import { useEffect, useState } from "react";
import {
  Boxes, Building2, ChevronDown, FolderKanban, Image, LayoutDashboard,
  LogOut, Menu, MessageSquareText, Megaphone, PanelLeftClose, PanelLeftOpen,
  Settings, ShieldCheck, Tags, X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useSiteData } from "../context/SiteDataContext.jsx";
import { adminRequest } from "./adminApi.js";
import AdminDashboard from "./AdminDashboard.jsx";
import AdminEnquiries from "./AdminEnquiries.jsx";
import AdminLogin from "./AdminLogin.jsx";
import AdminResource from "./AdminResource.jsx";
import AdminWebsiteSettings from "./AdminWebsiteSettings.jsx";
import { resourceConfigs } from "./adminResources.js";
import "./admin.css";
import { BUSINESS_NAME } from "../utils/branding.js";
import logo from "../assets/images/jay-gurudev-electricals-logo.png";

const navigation = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "products", label: "Products", icon: Boxes },
  { id: "categories", label: "Categories", icon: FolderKanban },
  { id: "brands", label: "Brands", icon: Tags },
  { id: "gallery", label: "Gallery", icon: Image },
  { id: "banners", label: "Home banners", icon: Megaphone },
  { id: "enquiries", label: "Enquiries", icon: MessageSquareText },
  { id: "content", label: "Website content", icon: Building2 },
];

function PasswordDialog({ token, onClose }) {
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const currentPassword = form.get("current_password");
    const newPassword = form.get("new_password");
    if (newPassword !== form.get("confirm_password")) {
      setError("New password and confirmation do not match.");
      return;
    }
    if (newPassword.length < 12) {
      setError("New password must contain at least 12 characters.");
      return;
    }
    setBusy(true);
    try {
      await adminRequest(token, "/admin/change-password", {
        method: "POST",
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      });
      setNotice("Password changed successfully.");
      formElement.reset();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return <div className="admin-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="admin-modal admin-password-modal" role="dialog" aria-modal="true" aria-labelledby="password-title">
      <header className="admin-modal-header"><div><span className="admin-eyebrow">ACCOUNT SECURITY</span><h2 id="password-title">Change password</h2></div><button className="admin-icon-button" aria-label="Close" onClick={onClose}><X size={20} /></button></header>
      {notice && <div className="admin-alert admin-alert--success">{notice}</div>}
      {error && <div className="admin-alert admin-alert--error" role="alert">{error}</div>}
      <form className="admin-form admin-form--single" onSubmit={submit}>
        <label className="admin-field"><span>Current password</span><input name="current_password" type="password" autoComplete="current-password" required /></label>
        <label className="admin-field"><span>New password</span><input name="new_password" type="password" autoComplete="new-password" minLength="12" required /></label>
        <label className="admin-field"><span>Confirm new password</span><input name="confirm_password" type="password" autoComplete="new-password" minLength="12" required /></label>
        <div className="admin-form-actions"><button type="button" className="admin-button admin-button--quiet" onClick={onClose}>Close</button><button className="admin-button admin-button--primary" disabled={busy}>{busy ? "Updating..." : "Update password"}</button></div>
      </form>
    </section>
  </div>;
}

export default function AdminPanel() {
  const navigateHome = useNavigate();
  const { refresh } = useSiteData();
  const [token, setToken] = useState(() => window.localStorage.getItem("jgd-admin-token") || "");
  const [admin, setAdmin] = useState(null);
  const [activeSection, setActiveSection] = useState("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [authLoading, setAuthLoading] = useState(Boolean(token));
  const [authNotice, setAuthNotice] = useState("");
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    const onExpired = () => {
      window.localStorage.removeItem("jgd-admin-token");
      setToken("");
      setAdmin(null);
      setAuthLoading(false);
      setAuthNotice("Your admin session expired. Please sign in again.");
    };
    const onStorage = (event) => {
      if (event.key !== "jgd-admin-token" || event.newValue !== null) return;
      setToken("");
      setAdmin(null);
      setAuthLoading(false);
      setAccountMenuOpen(false);
      setPasswordOpen(false);
      navigateHome("/", { replace: true });
    };
    window.addEventListener("admin:session-expired", onExpired);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("admin:session-expired", onExpired);
      window.removeEventListener("storage", onStorage);
    };
  }, [navigateHome]);

  useEffect(() => {
    if (!token) {
      setAuthLoading(false);
      return undefined;
    }
    let active = true;
    setAuthLoading(true);
    adminRequest(token, "/admin/me")
      .then((response) => { if (active) { setAdmin(response.admin); setAuthError(""); } })
      .catch((requestError) => { if (active) { setAdmin(null); setAuthError(requestError.status === 401 ? "" : requestError.message); } })
      .finally(() => { if (active) setAuthLoading(false); });
    return () => { active = false; };
  }, [token]);

  function onLogin(result) {
    window.localStorage.setItem("jgd-admin-token", result.token);
    setToken(result.token);
    setAdmin(result.admin);
    setAuthNotice("");
    setAuthError("");
  }

  function logout() {
    window.localStorage.removeItem("jgd-admin-token");
    setToken("");
    setAdmin(null);
    setActiveSection("dashboard");
    setMobileNavOpen(false);
    setAccountMenuOpen(false);
    setPasswordOpen(false);
    setAuthError("");
    setAuthNotice("");
    navigateHome("/", { replace: true });
  }

  if (authLoading) return <main className="admin-login-page"><div className="admin-auth-loading">Verifying administrator session...</div></main>;
  if (!token || !admin) return <AdminLogin onLogin={onLogin} notice={authNotice || authError} />;

  const activeItem = navigation.find((item) => item.id === activeSection) || navigation[0];
  const ActiveIcon = activeItem.icon;
  const navigate = (section) => { setActiveSection(section); setMobileNavOpen(false); };
  const onChanged = () => refresh();

  return (
    <div className={`admin-shell${sidebarCollapsed ? " admin-shell--collapsed" : ""}`}>
      {mobileNavOpen && <button className="admin-sidebar-scrim" aria-label="Close menu" onClick={() => setMobileNavOpen(false)} />}
      <aside id="admin-sidebar" className={`admin-sidebar${mobileNavOpen ? " admin-sidebar--open" : ""}`}>
        <div className="admin-brand-lockup">
          <img className="admin-brand-logo" src={logo} alt={BUSINESS_NAME} />
          <span><strong>ADMIN CONSOLE</strong><small>WEBSITE MANAGEMENT</small></span>
          <button className="admin-mobile-close" aria-label="Close menu" onClick={() => setMobileNavOpen(false)}><X size={19} /></button>
        </div>
        <div className="admin-sidebar-label">WORKSPACE</div>
        <nav className="admin-nav" aria-label="Admin sections">{navigation.map(({ id, label, icon: Icon }) => <button key={id} title={label} aria-label={label} aria-current={activeSection === id ? "page" : undefined} className={`admin-nav-item${activeSection === id ? " is-active" : ""}`} onClick={() => navigate(id)}><Icon size={18} /><span>{label}</span>{id === "dashboard" && <span className="admin-nav-indicator" />}</button>)}</nav>
        <div className="admin-sidebar-bottom"><ShieldCheck size={17} /><span>Protected administrator area</span></div>
      </aside>
      <div className="admin-workspace">
        <header className="admin-topbar">
          <button className="admin-mobile-menu" aria-label="Open menu" aria-controls="admin-sidebar" aria-expanded={mobileNavOpen} onClick={() => setMobileNavOpen(true)}><Menu size={21} /></button>
          <button className="admin-collapse-toggle" aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"} aria-controls="admin-sidebar" aria-pressed={sidebarCollapsed} title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}>
            {sidebarCollapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}
          </button>
          <div className="admin-breadcrumb"><ActiveIcon size={17} /><span>{activeItem.label}</span></div>
          <div className="admin-account-wrap">
            <button className="admin-account-button" aria-label={`Account: ${admin.full_name || admin.email}`} onClick={() => setAccountMenuOpen((open) => !open)} aria-expanded={accountMenuOpen}><span className="admin-account-avatar">{(admin.full_name || admin.email || "A").slice(0, 1).toUpperCase()}</span><span className="admin-account-copy"><strong>{admin.full_name || "Administrator"}</strong><small>{admin.role?.replaceAll("_", " ")}</small></span><ChevronDown size={16} /></button>
            {accountMenuOpen && <div className="admin-account-menu"><button onClick={() => { setPasswordOpen(true); setAccountMenuOpen(false); }}><Settings size={16} /> Change password</button><button onClick={logout}><LogOut size={16} /> Sign out</button></div>}
          </div>
        </header>
        <main className="admin-main">
          {activeSection === "dashboard" && <AdminDashboard token={token} onNavigate={navigate} />}
          {resourceConfigs[activeSection] && <AdminResource key={activeSection} resource={activeSection} config={resourceConfigs[activeSection]} token={token} onChanged={onChanged} />}
          {activeSection === "enquiries" && <AdminEnquiries token={token} />}
          {activeSection === "content" && <WebsiteContent token={token} onChanged={onChanged} />}
        </main>
      </div>
      {passwordOpen && <PasswordDialog token={token} onClose={() => setPasswordOpen(false)} />}
    </div>
  );
}

function WebsiteContent({ token, onChanged }) {
  const [tab, setTab] = useState("pages");
  return <>
    <div className="admin-content-tabs" role="tablist" aria-label="Website content sections">
      <button role="tab" aria-selected={tab === "pages"} className={tab === "pages" ? "is-active" : ""} onClick={() => setTab("pages")}>Pages & copy</button>
      <button role="tab" aria-selected={tab === "settings"} className={tab === "settings" ? "is-active" : ""} onClick={() => setTab("settings")}>Business & social settings</button>
    </div>
    {tab === "pages"
      ? <AdminResource config={resourceConfigs.pages} resource="pages" token={token} onChanged={onChanged} />
      : <AdminWebsiteSettings token={token} onChanged={onChanged} />}
  </>;
}
