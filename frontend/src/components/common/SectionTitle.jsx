import { useLanguage } from "../../context/LanguageContext.jsx";

export default function SectionTitle({ eyebrow, title, highlight, description, centered = false, headingLevel = 2 }) {
  const { t } = useLanguage();
  const Heading = headingLevel === 1 ? "h1" : "h2";
  return (
    <div className={`section-title${centered ? " section-title-centered" : ""}`}>
      {eyebrow && <span className="eyebrow">{t(eyebrow)}</span>}
      <Heading>{t(title)} {highlight && <span>{t(highlight)}</span>}</Heading>
      {description && <p>{t(description)}</p>}
    </div>
  );
}
