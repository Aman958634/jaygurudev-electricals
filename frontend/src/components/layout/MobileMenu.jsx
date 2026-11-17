import { NavLink } from "react-router-dom";
import { CircleHelp, Grid3X3, Home, Images, Sparkles, UserRound } from "lucide-react";
import { NAV_LINKS } from "../../utils/constants.js";
import { useLanguage } from "../../context/LanguageContext.jsx";
import logo from "../../assets/images/jay-gurudevv-logo.jpg";

const navIcons = {
  "/": Home,
  "/about": UserRound,
  "/categories": Grid3X3,
  "/products": Grid3X3,
  "/brands": Sparkles,
  "/gallery": Images,
  "/contact": CircleHelp,
};

export default function MobileMenu({ open, onClose }) {
  const { t } = useLanguage();
  if (!open) return null;
  return (
    <nav className="mobile-menu" aria-label={t("Mobile navigation")}>
      <div className="mobile-menu-brand">
        <img className="brand-logo" src={logo} alt="JAY GURUDEVV ELECTRIICALS" />
      </div>
      {NAV_LINKS.map((link) => {
        const Icon = navIcons[link.to];
        return (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === "/"}
            onClick={onClose}
            className={`mobile-nav-item nav-item--${link.to === "/" ? "home" : link.to.slice(1)}`}
          >
            <Icon size={18} aria-hidden="true" />
            <span>{t(link.label === "About" ? "About Us" : link.label)}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
