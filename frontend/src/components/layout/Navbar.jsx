import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { CircleHelp, ClipboardList, Grid3X3, Home, Images, Menu, Search, Sparkles, UserRound, X } from "lucide-react";
import { NAV_LINKS } from "../../utils/constants.js";
import MobileMenu from "./MobileMenu.jsx";
import { useLanguage } from "../../context/LanguageContext.jsx";
import { useEnquiry } from "../../context/EnquiryContext.jsx";
import logo from "../../assets/images/jay-gurudevv-logo.jpg";
import { useSiteData } from "../../context/SiteDataContext.jsx";

const navIcons = {
  "/": Home,
  "/about": UserRound,
  "/categories": Grid3X3,
  "/products": Grid3X3,
  "/brands": Sparkles,
  "/gallery": Images,
  "/contact": CircleHelp,
};

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const languageMenuRef = useRef(null);
  const { language, setLanguage, t } = useLanguage();
  const { business } = useSiteData();
  const { enquiryItems, openEnquiryList } = useEnquiry();
  const navigate = useNavigate();
  const languageOptions = [
    { code: "en", label: "English", shortLabel: "EN" },
    { code: "hi", label: "हिन्दी", shortLabel: "हि" },
    { code: "gu", label: "Gujarati", shortLabel: "GU" },
  ];

  useEffect(() => {
    function closeLanguageMenu(event) {
      if (!languageMenuRef.current?.contains(event.target)) setLanguageMenuOpen(false);
    }

    document.addEventListener("pointerdown", closeLanguageMenu);
    return () => document.removeEventListener("pointerdown", closeLanguageMenu);
  }, []);

  function submitSearch(event) {
    event.preventDefault();
    const query = search.trim();
    navigate(query ? `/products?search=${encodeURIComponent(query)}` : "/products");
    setMenuOpen(false);
  }

  return (
    <header className="site-header">
      <div className="container navbar">
        <Link className="brand-lockup" to="/" aria-label={t(`${business.name} home`)}>
          <img className="brand-logo" src={logo} alt={business.name} />
        </Link>
        <nav className="desktop-nav" aria-label={t("Main navigation")}>
          {NAV_LINKS.map((link) => {
            const Icon = navIcons[link.to];
            return (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === "/"}
                className={`nav-item nav-item--${link.to === "/" ? "home" : link.to.slice(1)}`}
              >
                <Icon size={15} aria-hidden="true" />
                <span>{t(link.label === "About" ? "About Us" : link.label)}</span>
              </NavLink>
            );
          })}
        </nav>
        <div className="navbar-tools">
          <form className="nav-search" role="search" onSubmit={submitSearch}>
            <Search size={16} aria-hidden="true" />
            <input aria-label={t("Search products")} value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("Search products...")} />
            <button type="submit" aria-label={t("Submit product search")}><Search size={16} /></button>
          </form>
          <div className="navbar-actions">
            <button
              className="nav-enquiry-list"
              type="button"
              onClick={openEnquiryList}
              aria-label={t("My Enquiry List ({count})", { count: enquiryItems.length })}
              aria-haspopup="dialog"
            >
              <ClipboardList size={17} aria-hidden="true" />
              <span className="nav-enquiry-list-label">{t("My Enquiry List")} ({enquiryItems.length})</span>
              <span className="nav-enquiry-list-count" aria-hidden="true">{enquiryItems.length}</span>
            </button>
            <div className="nav-language-picker" ref={languageMenuRef}>
              <button
                className="nav-language"
                type="button"
                aria-label={t("Select language")}
                aria-expanded={languageMenuOpen}
                aria-haspopup="menu"
                onClick={() => setLanguageMenuOpen((open) => !open)}
              >
                {languageOptions.find((option) => option.code === language)?.shortLabel}
              </button>
              {languageMenuOpen && (
                <div className="nav-language-menu" role="menu" aria-label={t("Select language")} onKeyDown={(event) => {
                  if (event.key === "Escape") setLanguageMenuOpen(false);
                }}>
                  {languageOptions.map((option) => (
                    <button
                      key={option.code}
                      type="button"
                      role="menuitemradio"
                      aria-checked={language === option.code}
                      className={language === option.code ? "active" : ""}
                      onClick={() => {
                        setLanguage(option.code);
                        setLanguageMenuOpen(false);
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button className="menu-toggle" type="button" aria-label={menuOpen ? t("Close menu") : t("Open menu")} aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>
              {menuOpen ? <X size={23} /> : <Menu size={23} />}
            </button>
          </div>
        </div>
      </div>
      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </header>
  );
}
