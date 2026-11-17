import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useProducts } from "../../hooks/useProducts.js";
import ProductCard from "./ProductCard.jsx";
import ProductSearch from "./ProductSearch.jsx";
import ProductFilters from "./ProductFilters.jsx";
import { useLanguage } from "../../context/LanguageContext.jsx";
import ResourceFeedback from "../common/ResourceFeedback.jsx";

export default function ProductGrid({ limit, featured = false, allProducts = false }) {
  const { t } = useLanguage();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get("search") || "");
  const [category, setCategory] = useState(params.get("category") || "All categories");
  const [brand, setBrand] = useState(params.get("brand") || "All brands");
  const [sort, setSort] = useState(params.get("sort") || "newest");
  const [page, setPage] = useState(Number(params.get("page")) || 1);
  const { products, pagination, loading, error, refresh } = useProducts({
    search,
    category,
    brand,
    page: limit ? 1 : page,
    limit: limit || 12,
    sort,
    featured: featured && !allProducts,
    allProducts,
  });

  useEffect(() => {
    setSearch(params.get("search") || "");
    setCategory(params.get("category") || "All categories");
    setBrand(params.get("brand") || "All brands");
    setSort(params.get("sort") || "newest");
    setPage(Number(params.get("page")) || 1);
  }, [params]);

  function updateParams(next) {
    const updated = new URLSearchParams(params);
    Object.entries(next).forEach(([key, value]) => {
      if (!value || value === "All categories" || value === "All brands" || (key === "sort" && value === "newest") || (key === "page" && value === 1)) updated.delete(key);
      else updated.set(key, value);
    });
    setParams(updated, { replace: true });
  }

  function clearFilters() {
    setSearch("");
    setCategory("All categories");
    setBrand("All brands");
    setSort("newest");
    setPage(1);
    setParams({}, { replace: true });
  }

  function changeFilter(setter, key, value) {
    setter(value);
    setPage(1);
    updateParams({ [key]: value, page: 1 });
  }

  return (
    <div className="product-catalog">
      <div className="catalog-controls">
        <ProductSearch value={search} onChange={(value) => changeFilter(setSearch, "search", value)} />
        <ProductFilters
          category={category}
          brand={brand}
          sort={sort}
          onCategoryChange={(value) => changeFilter(setCategory, "category", value)}
          onBrandChange={(value) => changeFilter(setBrand, "brand", value)}
          onSortChange={(value) => changeFilter(setSort, "sort", value)}
          onClear={clearFilters}
        />
      </div>
      {!featured && <div className="catalog-result-count">{pagination?.total || 0} {t((pagination?.total || 0) === 1 ? "results.product" : "results.products")} {t("results.toExplore")}</div>}
      <ResourceFeedback loading={false} error={error} empty={!products.length && !loading && !error} onRetry={refresh} emptyMessage={t("No matching products.")} />
      {loading && <div className="product-grid product-grid-skeleton" aria-label={t("Loading products")} role="status">{Array.from({ length: 8 }, (_, index) => <div className="product-skeleton-card" key={index}><span /><div><i /><i /><i /></div></div>)}</div>}
      {!loading && !error && products.length > 0 && (
        <>
          <div className={`product-grid${allProducts ? " home-products-grid" : ""}`}>
            {products.map((product) => <ProductCard key={product.id} product={product} variant={allProducts ? "featured" : "standard"} />)}
          </div>
          {!limit && !allProducts && pagination?.totalPages > 1 && (
            <nav className="catalog-pagination" aria-label={t("Product pages")}>
              <button className="button button-outline" type="button" disabled={page <= 1} onClick={() => { const next = page - 1; setPage(next); updateParams({ page: next }); }}>{t("Previous")}</button>
              <span>{t("Page")} {page} {t("of")} {pagination.totalPages}</span>
              <button className="button button-outline" type="button" disabled={page >= pagination.totalPages} onClick={() => { const next = page + 1; setPage(next); updateParams({ page: next }); }}>{t("Next")}</button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
