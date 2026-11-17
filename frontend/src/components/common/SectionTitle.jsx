import { useLanguage } from "../../context/LanguageContext.jsx";

export default function SectionTitle({ eyebrow, title, highlight, description, centered = false }) {
  const { t } = useLanguage();
  return (
    <div className={`section-title${centered ? " section-title-centered" : ""}`}>
      {eyebrow && <span className="eyebrow">{t(eyebrow)}</span>}
      <h2>{t(title)} {highlight && <span>{t(highlight)}</span>}</h2>
      {description && <p>{t(description)}</p>}
    </div>
  );
}
