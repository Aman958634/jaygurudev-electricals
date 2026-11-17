import { useEffect, useState } from "react";
import { resolveMediaUrl } from "../../services/api.js";

export default function BrandLogo({ brand, className }) {
  const [failed, setFailed] = useState(false);
  const name = brand.name || "Brand";
  const src = brand.logo_url || brand.image;

  useEffect(() => setFailed(false), [src]);

  if (!src || failed) {
    return <span className={`${className} brand-logo-fallback`} role="img" aria-label={name}>{name}</span>;
  }

  return (
    <img
      className={className}
      src={resolveMediaUrl(src)}
      alt={name}
      title={name}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
