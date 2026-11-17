import { useSiteData } from "../../context/SiteDataContext.jsx";
import { useLanguage } from "../../context/LanguageContext.jsx";
import ResourceFeedback from "./ResourceFeedback.jsx";
import SectionTitle from "./SectionTitle.jsx";

export default function PageHeading({ slug, fallback }) {
  const { pages, refresh } = useSiteData();
  const { t } = useLanguage();
  const page = pages.data.find((item) => item.slug === slug);

  return (
    <section className="page-heading">
      <div className="container">
        <SectionTitle
          eyebrow={t(fallback.eyebrow)}
          title={t(page?.title || fallback.title)}
          highlight={t(page?.heading || fallback.highlight)}
          description={t(page?.description || fallback.description)}
        />
        {pages.error && <ResourceFeedback error={pages.error} onRetry={() => refresh("pages")} />}
      </div>
    </section>
  );
}
