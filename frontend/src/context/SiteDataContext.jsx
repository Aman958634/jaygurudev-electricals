import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { apiRequest } from "../services/api.js";
import { BUSINESS as DEFAULT_BUSINESS, isLegacyShopAddress } from "../utils/constants.js";
import { formatBusinessHours, parseBusinessHours, phoneDigits, validUrl } from "../utils/businessSettings.js";

const resourcePaths = {
  categories: "/categories",
  brands: "/brands",
  gallery: "/gallery",
  banners: "/banners",
  pages: "/pages/",
  homePage: "/pages/home",
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
      apiRequest(path, { signal: controller.signal, cache: "no-store" })
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
      // A deployed settings row can still contain the retired showroom address.
      // Keep the public site correct until an administrator saves the canonical value.
      address: isLegacyShopAddress(configured.address) ? DEFAULT_BUSINESS.address : configured.address,
      name: configured.name || DEFAULT_BUSINESS.name,
      phone: configured.phone || DEFAULT_BUSINESS.phone,
      phoneDigits: phoneDigits(configured.phoneDigits || configured.phone, DEFAULT_BUSINESS.phoneDigits),
      hours: configured.businessHours ? formatBusinessHours(parseBusinessHours(configured.businessHours, configured.hours)) : (configured.hours || DEFAULT_BUSINESS.hours),
      businessHours: parseBusinessHours(configured.businessHours, configured.hours),
      mapsUrl: validUrl(configured.mapsUrl) || DEFAULT_BUSINESS.mapsUrl,
      mapsDirectionsUrl: validUrl(configured.mapsDirectionsUrl) || validUrl(configured.mapsUrl) || DEFAULT_BUSINESS.mapsUrl,
      mapsEmbedUrl: validUrl(configured.mapsEmbedUrl),
      googleReviewVerified: String(configured.googleReviewVerified ?? DEFAULT_BUSINESS.googleReviewVerified).toLowerCase(),
    };
  }, [resources.settings.data]);

  const value = useMemo(() => ({
    categories: resources.categories,
    brands: resources.brands,
    gallery: resources.gallery,
    banners: resources.banners,
    pages: resources.pages,
    homePage: resources.homePage,
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
