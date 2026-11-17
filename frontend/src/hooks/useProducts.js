import { useCallback, useEffect, useMemo, useState } from "react";
import { apiRequest } from "../services/api.js";

export function useProducts({
  search = "",
  category = "",
  brand = "",
  page = 1,
  limit = 12,
  sort = "newest",
  featured = false,
  allProducts = false,
} = {}) {
  const [resource, setResource] = useState({ products: [], pagination: null, loading: true, error: null });
  const [retryKey, setRetryKey] = useState(0);
  const query = useMemo(() => {
    const params = new URLSearchParams({
      page: String(allProducts ? 1 : page),
      limit: String(allProducts ? 100 : limit),
      sort,
    });
    if (search.trim()) params.set("search", search.trim());
    if (category && category !== "All categories") params.set("category", category);
    if (brand && brand !== "All brands") params.set("brand", brand);
    if (featured && !allProducts) params.set("featured", "true");
    return params.toString();
  }, [search, category, brand, page, limit, sort, featured, allProducts]);

  useEffect(() => {
    const controller = new AbortController();
    setResource((current) => ({ ...current, loading: true, error: null }));
    const loadProducts = async () => {
      const response = await apiRequest(`/products?${query}`, { signal: controller.signal });
      let products = response.data || [];

      if (allProducts && response.pagination?.totalPages > 1) {
        const pageQueries = Array.from({ length: response.pagination.totalPages - 1 }, (_, index) => {
          const params = new URLSearchParams(query);
          params.set("page", String(index + 2));
          return apiRequest(`/products?${params}`, { signal: controller.signal });
        });
        const remainingPages = await Promise.all(pageQueries);
        products = products.concat(...remainingPages.map((pageResponse) => pageResponse.data || []));
      }

      if (allProducts) {
        products = Array.from(new Map(products.map((product) => [product.id, product])).values());
      }

      setResource({
        products,
        pagination: response.pagination || null,
        loading: false,
        error: null,
      });
    };

    loadProducts().catch((error) => {
      if (error.name === "AbortError") return;
      setResource((current) => ({ ...current, loading: false, error: error.message }));
    });
    return () => controller.abort();
  }, [query, retryKey, allProducts]);

  const refresh = useCallback(() => setRetryKey((value) => value + 1), []);
  return { ...resource, refresh };
}
