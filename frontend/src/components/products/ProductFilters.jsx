import { useSiteData } from "../../context/SiteDataContext.jsx";
import { useLanguage } from "../../context/LanguageContext.jsx";
import ResourceFeedback from "../common/ResourceFeedback.jsx";

export default function ProductFilters({ category, brand, sort, onCategoryChange, onBrandChange, onSortChange, onClear }) {
  const { t } = useLanguage();
  const { categories, brands, refresh } = useSiteData();
  const selectedCategory = categories.data.find((item) => item.slug === category || item.name === category)?.slug || category;
  const selectedBrand = brands.data.find((item) => item.slug === brand || item.name === brand)?.slug || brand;
  return (
    <div className="catalog-filters">
      {categories.error && <ResourceFeedback error={categories.error} onRetry={() => refresh("categories")} />}
      {brands.error && <ResourceFeedback error={brands.error} onRetry={() => refresh("brands")} />}
      <label className="sr-only" htmlFor="category-filter">{t("Filter by category")}</label>
      <select id="category-filter" value={selectedCategory} onChange={(event) => onCategoryChange(event.target.value)} disabled={categories.loading || !!categories.error}>
        <option value="All categories">{t("All categories")}</option>
        {categories.data.map(({ id, slug, name }) => <option key={id || slug || name} value={slug || name}>{t(name)}</option>)}
      </select>
      <label className="sr-only" htmlFor="brand-filter">{t("Filter by brand")}</label>
      <select id="brand-filter" value={selectedBrand} onChange={(event) => onBrandChange(event.target.value)} disabled={brands.loading || !!brands.error}>
        <option value="All brands">{t("All brands")}</option>
        {brands.data.map(({ id, slug, name }) => <option key={id || slug || name} value={slug || name}>{name}</option>)}
      </select>
      <label className="sr-only" htmlFor="product-sort">{t("Sort products")}</label>
      <select id="product-sort" value={sort} onChange={(event) => onSortChange(event.target.value)}>
        <option value="newest">{t("Newest first")}</option>
        <option value="name_asc">{t("Name: A to Z")}</option>
        <option value="name_desc">{t("Name: Z to A")}</option>
      </select>
      <button className="clear-filters" type="button" onClick={onClear}>{t("Clear filters")}</button>
    </div>
  );
}
