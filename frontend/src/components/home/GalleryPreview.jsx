import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useLanguage } from "../../context/LanguageContext.jsx";
import { useSiteData } from "../../context/SiteDataContext.jsx";
import { resolveMediaUrl } from "../../services/api.js";
import ResourceFeedback from "../common/ResourceFeedback.jsx";
import { hasGalleryImage } from "../../utils/galleryImages.js";

export default function GalleryPreview() {
  const { t } = useLanguage();
  const { gallery, refresh } = useSiteData();
  const photos = gallery.data.filter(hasGalleryImage);
  return (
    <section className="section gallery-preview-section">
      <div className="container">
        <div className="section-heading-row">
          <div className="section-title"><span className="eyebrow">{t("A little inspiration")}</span><h2>{t("Explore the")} <span>{t("gallery")}</span></h2><p>{t("Browse genuine showroom, workshop and project photos.")}</p></div>
          <Link className="text-link" to="/gallery">{t("View gallery")} <ArrowUpRight size={17} /></Link>
        </div>
        <div className="gallery-preview-grid">
          <ResourceFeedback loading={gallery.loading} error={gallery.error} empty={!photos.length} onRetry={() => refresh("gallery")} emptyMessage={t("Genuine showroom and product photos will appear here when available.")} />
          {!gallery.loading && !gallery.error && photos.map((photo) => (
            <Link className="gallery-preview-card" key={photo.id} to="/gallery">
              <img src={resolveMediaUrl(photo.image)} alt={t(photo.title)} loading="lazy" decoding="async" onError={(event) => { event.currentTarget.hidden = true; }} />
              <span>{t(photo.title)}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
