import { useState } from "react";
import { X } from "lucide-react";
import { useLanguage } from "../context/LanguageContext.jsx";
import SectionTitle from "../components/common/SectionTitle.jsx";
import ResourceFeedback from "../components/common/ResourceFeedback.jsx";
import { useSiteData } from "../context/SiteDataContext.jsx";
import { resolveMediaUrl } from "../services/api.js";
import Seo from "../components/common/Seo.jsx";
import { hasGalleryImage } from "../utils/galleryImages.js";

export default function Gallery() {
  const [selected, setSelected] = useState(null);
  const { t } = useLanguage();
  const { gallery, refresh } = useSiteData();
  const photos = gallery.data.filter(hasGalleryImage);
  return (
    <>
      <Seo
        title="Gallery | Jay Guru Dev Electricals"
        description="Explore electrical products, lighting and interior inspiration from Jay Guru Dev Electricals in Palanpur, Gujarat."
        canonicalPath="/gallery"
      />
      <section className="page-heading">
        <div className="container">
          <SectionTitle
            eyebrow="A little inspiration"
            title="Genuine"
            highlight="Gallery"
            description="Browse genuine showroom, workshop and project photos."
            headingLevel={1}
          />
        </div>
      </section>
      <section className="section section-soft gallery-page-section">
        <div className="container gallery-grid">
          <ResourceFeedback loading={gallery.loading} error={gallery.error} empty={!photos.length} onRetry={() => refresh("gallery")} emptyMessage={t("Genuine showroom and product photos will appear here when available.")} />
          {!gallery.loading && !gallery.error && photos.map((photo) => (
            <button className="gallery-card" type="button" key={photo.title} onClick={() => setSelected(photo)} aria-label={`${t("View")} ${t(photo.title)}`}>
              <img src={resolveMediaUrl(photo.image)} alt={t(photo.title)} loading="lazy" onError={(event) => { event.currentTarget.hidden = true; }} />
              <span className="gallery-card-info"><small>{t(photo.category === "Home" ? "Home category" : photo.category)}</small><strong>{t(photo.title)}</strong></span>
            </button>
          ))}
        </div>
      </section>
      {selected && (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label={t(selected.title)} onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}>
          <button type="button" aria-label={t("Close image")} onClick={() => setSelected(null)}><X size={23} /></button>
          <img src={resolveMediaUrl(selected.image)} alt={t(selected.title)} onError={(event) => { event.currentTarget.hidden = true; }} />
          <p>{t(selected.title)}</p>
        </div>
      )}
    </>
  );
}
