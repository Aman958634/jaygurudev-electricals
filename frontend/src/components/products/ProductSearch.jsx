import { Search } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext.jsx";

export default function ProductSearch({ value, onChange, placeholder = "Search products, brands or types..." }) {
  const { t } = useLanguage();
  return (
    <label className="catalog-search">
      <Search size={18} />
      <input type="search" value={value} onChange={(event) => onChange(event.target.value)} placeholder={t(placeholder)} />
    </label>
  );
}
