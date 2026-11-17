import { useState } from "react";
import { X } from "lucide-react";
import { useLanguage } from "../context/LanguageContext.jsx";
import PageHeading from "../components/common/PageHeading.jsx";
import ResourceFeedback from "../components/common/ResourceFeedback.jsx";
import { useSiteData } from "../context/SiteDataContext.jsx";
import { resolveMediaUrl } from "../services/api.js";

export default function Gallery() {
  const [selected, setSelected] = useState(null);
  const { t } = useLanguage();
  const { gallery, refresh } = useSiteData();
  return (
    <>
      <PageHeading slug="gallery" fallback={{ eyebrow: "A little inspiration", title: "Ideas for brighter", highlight: "spaces", description: "Explore lighting and interior inspiration. Visit the showroom to see our product selection in person." }} />
      <section className="section section-soft gallery-page-section">
        <div className="container gallery-grid">
          <ResourceFeedback loading={gallery.loading} error={gallery.error} empty={!gallery.data.length} onRetry={() => refresh("gallery")} emptyMessage={t("The gallery is empty for now.")} />
          {!gallery.loading && !gallery.error && gallery.data.map((photo) => (
            <button className="gallery-card" type="button" key={photo.title} onClick={() => setSelected(photo)} aria-label={`${t("View")} ${t(photo.title)}`}>
              <img src={resolveMediaUrl(photo.image)} alt={t(photo.title)} loading="lazy" />
              <span className="gallery-card-info"><small>{t(photo.category === "Home" ? "Home category" : photo.category)}</small><strong>{t(photo.title)}</strong></span>
            </button>
          ))}
        </div>
      </section>
      {selected && (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label={t(selected.title)} onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}>
          <button type="button" aria-label={t("Close image")} onClick={() => setSelected(null)}><X size={23} /></button>
          <img src={resolveMediaUrl(selected.image)} alt={t(selected.title)} />
          <p>{t(selected.title)}</p>
        </div>
      )}
    </>
  );
}
