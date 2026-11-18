import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const SITE_URL = "https://jaygurudevelectricals.com";
const SOCIAL_IMAGE_URL = `${SITE_URL}/social-preview.png`;

export function getPublicImageUrl(image) {
  if (!image) return SOCIAL_IMAGE_URL;
  const value = String(image).trim();
  if (value.startsWith("/uploads/") || value.startsWith("uploads/")) {
    return new URL(value.replace(/^\/+/, ""), `${SITE_URL}/`).href;
  }
  try {
    const url = new URL(value, `${SITE_URL}/`);
    return url.protocol === "https:" ? url.href : SOCIAL_IMAGE_URL;
  } catch {
    return SOCIAL_IMAGE_URL;
  }
}

function setMeta(attribute, key, content) {
  let element = document.head.querySelector(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.append(element);
  }
  element.setAttribute("content", content);
}

export default function Seo({
  title,
  description,
  canonicalPath,
  image,
  imageAlt,
  type = "website",
  schema,
  noindex = false,
}) {
  const location = useLocation();

  useEffect(() => {
    const canonicalUrl = new URL(canonicalPath || location.pathname, `${SITE_URL}/`).href;
    const imageUrl = getPublicImageUrl(image);
    const pageTitle = title || "Jay Guru Dev Electricals | Electrical Products & Solutions";
    const pageDescription = description || "Explore quality electrical products, brands and electrical solutions at Jay Guru Dev Electricals.";

    document.title = pageTitle;
    setMeta("name", "description", pageDescription);
    setMeta("name", "robots", noindex ? "noindex,nofollow" : "index,follow");
    setMeta("property", "og:title", pageTitle);
    setMeta("property", "og:description", pageDescription);
    setMeta("property", "og:image", imageUrl);
    setMeta("property", "og:image:alt", imageAlt || pageTitle);
    setMeta("property", "og:url", canonicalUrl);
    setMeta("property", "og:type", type);
    setMeta("property", "og:site_name", "Jay Guru Dev Electricals");
    setMeta("name", "twitter:card", "summary_large_image");
    setMeta("name", "twitter:title", pageTitle);
    setMeta("name", "twitter:description", pageDescription);
    setMeta("name", "twitter:image", imageUrl);

    let canonical = document.head.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.append(canonical);
    }
    canonical.href = canonicalUrl;

    const structuredData = document.getElementById("page-structured-data");
    if (schema) {
      const script = structuredData || document.createElement("script");
      script.id = "page-structured-data";
      script.type = "application/ld+json";
      script.textContent = JSON.stringify({ ...schema, url: canonicalUrl, image: imageUrl });
      if (!structuredData) document.head.append(script);
    } else {
      structuredData?.remove();
    }
  }, [canonicalPath, description, image, imageAlt, location.pathname, noindex, schema, title, type]);

  return null;
}
