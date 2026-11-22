import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getProductCardSpecifications } from "../utils/productPresentation.js";

const STORAGE_KEY = "jay-gurudev-enquiry-list-v1";
const EnquiryContext = createContext(null);

function itemKey(productId, variant = "") {
  return `${encodeURIComponent(String(productId))}::${encodeURIComponent(variant)}`;
}

function productModel(product) {
  const directModel = product.model || product.model_number || product.modelNumber;
  const specificationModel = Array.isArray(product.specifications)
    ? product.specifications.find((specification) => /model/i.test(specification.name || ""))?.value
    : "";
  return String(directModel || specificationModel || "").trim();
}

function positiveQuantity(value) {
  const quantity = Number(value);
  return Number.isFinite(quantity) && quantity >= 1 ? Math.floor(quantity) : 1;
}

function normalizeSavedItem(saved) {
  if (!saved || typeof saved !== "object" || Array.isArray(saved)) return null;
  const productId = saved.productId;
  if ((typeof productId !== "number" && typeof productId !== "string") || !String(productId).trim()) return null;

  const variant = typeof saved.variant === "string" ? saved.variant.trim() : "";
  const variantOptions = Array.isArray(saved.variantOptions)
    ? [...new Set(saved.variantOptions.filter((option) => typeof option === "string" && option.trim()).map((option) => option.trim()))]
    : [];
  const text = (value) => typeof value === "string" || typeof value === "number" ? String(value).trim() : "";

  return {
    key: itemKey(productId, variant),
    productId,
    name: text(saved.name) || "Previously selected product",
    model: text(saved.model),
    sku: text(saved.sku),
    image: text(saved.image),
    brand: text(saved.brand),
    details: text(saved.details),
    variant,
    variantOptions,
    quantity: positiveQuantity(saved.quantity),
  };
}

function readSavedItems() {
  if (typeof window === "undefined") return [];
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      console.warn("Saved enquiry list is not an array; starting with an empty list.");
      return [];
    }

    return parsed.reduce((items, saved) => {
      const item = normalizeSavedItem(saved);
      if (!item) return items;
      const duplicate = items.find((entry) => (
        String(entry.productId) === String(item.productId) && entry.variant === item.variant
      ));
      if (duplicate) duplicate.quantity += item.quantity;
      else items.push(item);
      return items;
    }, []);
  } catch (error) {
    console.error("Could not restore the saved enquiry list.", error);
    return [];
  }
}

function toEnquiryItem(product, variant, variantOptions, quantity = 1) {
  return {
    key: itemKey(product.id, variant),
    productId: product.id,
    name: String(product.name || "Previously selected product"),
    model: productModel(product),
    sku: String(product.sku || "").trim(),
    image: String(product.image || product.image_url || ""),
    brand: String(product.brand || ""),
    details: getProductCardSpecifications(product)
      .filter(({ name }) => ["Capacity", "Size / Rating", "Packing"].includes(name))
      .map(({ name, value }) => `${name}: ${value}`)
      .join("; ") || String(product.short_description || product.description || ""),
    variant,
    variantOptions,
    quantity,
  };
}

export function EnquiryProvider({ children }) {
  const [wholesaleOpen, setWholesaleOpen] = useState(false);
  const [dealerQuotationOpen, setDealerQuotationOpen] = useState(false);
  const [enquiryListOpen, setEnquiryListOpen] = useState(false);
  const [enquiryItems, setEnquiryItems] = useState(readSavedItems);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(enquiryItems));
    } catch (error) {
      console.error("Could not save the enquiry list in this browser.", error);
    }
  }, [enquiryItems]);

  function addEnquiryItem(product, variant = "", variantOptions = []) {
    if (!product || (typeof product.id !== "number" && typeof product.id !== "string") || !String(product.id).trim()) {
      throw new Error("Cannot add a product without a valid product ID to the enquiry list.");
    }

    const options = Array.isArray(variantOptions)
      ? [...new Set(variantOptions.filter((option) => typeof option === "string" && option.trim()).map((option) => option.trim()))]
      : [];
    const selectedVariant = String(variant || (options.length === 1 ? options[0] : "")).trim();
    const newItem = toEnquiryItem(product, selectedVariant, options);

    setEnquiryItems((current) => {
      const existing = current.find((item) => (
        String(item.productId) === String(product.id) && item.variant === selectedVariant
      ));
      if (existing) {
        return current.map((item) => item.key === existing.key
          ? { ...newItem, key: item.key, quantity: item.quantity + 1 }
          : item);
      }

      const unselected = selectedVariant && current.find((item) => (
        String(item.productId) === String(product.id)
        && !item.variant
        && item.variantOptions.includes(selectedVariant)
      ));
      if (unselected) {
        return current.map((item) => item.key === unselected.key
          ? { ...newItem, quantity: item.quantity }
          : item);
      }

      return [...current, newItem];
    });
  }

  function updateEnquiryItem(key, updates) {
    setEnquiryItems((current) => {
      const index = current.findIndex((item) => item.key === key);
      if (index < 0) return current;

      const item = current[index];
      const variant = updates.variant === undefined ? item.variant : String(updates.variant || "").trim();
      const quantity = updates.quantity === undefined ? item.quantity : positiveQuantity(updates.quantity);
      const duplicateIndex = current.findIndex((entry, entryIndex) => (
        entryIndex !== index
        && String(entry.productId) === String(item.productId)
        && entry.variant === variant
      ));

      if (duplicateIndex >= 0) {
        return current
          .filter((_, entryIndex) => entryIndex !== index)
          .map((entry) => entry.key === current[duplicateIndex].key
            ? { ...entry, quantity: entry.quantity + quantity }
            : entry);
      }

      return current.map((entry, entryIndex) => entryIndex === index
        ? { ...entry, ...updates, key: itemKey(item.productId, variant), variant, quantity }
        : entry);
    });
  }

  function removeEnquiryItem(key) {
    setEnquiryItems((current) => current.filter((item) => item.key !== key));
  }

  function clearEnquiryItems() {
    setEnquiryItems([]);
  }

  const value = useMemo(() => ({
    wholesaleOpen,
    openWholesale: () => {
      setDealerQuotationOpen(false);
      setEnquiryListOpen(false);
      setWholesaleOpen(true);
    },
    closeWholesale: () => setWholesaleOpen(false),
    dealerQuotationOpen,
    openDealerQuotation: () => {
      setWholesaleOpen(false);
      setEnquiryListOpen(false);
      setDealerQuotationOpen(true);
    },
    closeDealerQuotation: () => setDealerQuotationOpen(false),
    enquiryItems,
    addEnquiryItem,
    updateEnquiryItem,
    removeEnquiryItem,
    clearEnquiryItems,
    enquiryListOpen,
    openEnquiryList: () => {
      setWholesaleOpen(false);
      setDealerQuotationOpen(false);
      setEnquiryListOpen(true);
    },
    closeEnquiryList: () => setEnquiryListOpen(false),
  }), [wholesaleOpen, dealerQuotationOpen, enquiryItems, enquiryListOpen]);

  return <EnquiryContext.Provider value={value}>{children}</EnquiryContext.Provider>;
}

export function useEnquiry() {
  const context = useContext(EnquiryContext);
  if (!context) throw new Error("useEnquiry must be used within an EnquiryProvider");
  return context;
}
