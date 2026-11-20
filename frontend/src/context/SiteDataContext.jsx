import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { apiRequest } from "../services/api.js";
import { BUSINESS as DEFAULT_BUSINESS, LEGACY_BUSINESS, normalizeBusinessHours } from "../utils/constants.js";
import { BUSINESS_NAME } from "../utils/branding.js";

const resourcePaths = {
  categories: "/categories",
  brands: "/brands",
  gallery: "/gallery",
  banners: "/banners",
  pages: "/pages/",
  settings: "/settings",
  statistics: "/statistics",
};

const SiteDataContext = createContext(null);

export function SiteDataProvider({ children }) {
  const [resources, setResources] = useState(() => Object.fromEntries(
    Object.keys(resourcePaths).map((key) => [key, { data: [], loading: true, error: null }]),
  ));
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    Object.entries(resourcePaths).forEach(([key, path]) => {
      setResources((current) => ({
        ...current,
        [key]: { ...current[key], loading: true, error: null },
      }));
      apiRequest(path, { signal: controller.signal })
        .then((response) => {
          setResources((current) => ({
            ...current,
            [key]: {
              data: key === "settings"
                ? { business: response.business, settings: response.settings, rows: response.data || [] }
                : response.data || [],
              loading: false,
              error: null,
            },
          }));
        })
        .catch((error) => {
          if (error.name === "AbortError") return;
          setResources((current) => ({
            ...current,
            [key]: { ...current[key], loading: false, error: error.message },
          }));
        });
    });
    return () => controller.abort();
  }, [reloadKey]);

  const refresh = useCallback((key) => {
    if (key && !resourcePaths[key]) return;
    setReloadKey((value) => value + 1);
  }, []);

  const business = useMemo(() => {
    const configured = resources.settings.data?.business || {};
    return {
      ...DEFAULT_BUSINESS,
      ...configured,
      name: BUSINESS_NAME,
      address: !configured.address || configured.address === LEGACY_BUSINESS.address ? DEFAULT_BUSINESS.address : configured.address,
      hours: normalizeBusinessHours(configured.hours),
      mapsUrl: !configured.mapsUrl || configured.mapsUrl === LEGACY_BUSINESS.mapsUrl ? DEFAULT_BUSINESS.mapsUrl : configured.mapsUrl,
      googleReviewVerified: String(configured.googleReviewVerified ?? DEFAULT_BUSINESS.googleReviewVerified).toLowerCase(),
    };
  }, [resources.settings.data]);

  const value = useMemo(() => ({
    categories: resources.categories,
    brands: resources.brands,
    gallery: resources.gallery,
    banners: resources.banners,
    pages: resources.pages,
    settings: resources.settings,
    statistics: resources.statistics,
    business,
    refresh,
  }), [resources, business, refresh]);

  return <SiteDataContext.Provider value={value}>{children}</SiteDataContext.Provider>;
}

export function useSiteData() {
  const context = useContext(SiteDataContext);
  if (!context) throw new Error("useSiteData must be used within a SiteDataProvider");
  return context;
}
