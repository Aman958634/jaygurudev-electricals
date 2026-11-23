import { BUSINESS } from "./constants.js";
import { getProductCardSpecifications } from "./productPresentation.js";

export function getWhatsAppUrl(message, business = BUSINESS) {
  const text = message || `Hello ${business.name}, I would like to know more.`;
  return `https://wa.me/${business.phoneDigits}?text=${encodeURIComponent(text)}`;
}

export function getRetailEnquiryMessage(business = BUSINESS) {
  return `Hello ${business.name}, I would like to know the price and availability of your electrical products. Please share the latest price and stock details.`;
}

export function getProductEnquiryMessage(product, business = BUSINESS, variant = "") {
  if (!product) return getRetailEnquiryMessage(business);
  const details = [
    product.brand && `Brand: ${product.brand}`,
    ...getProductCardSpecifications(product)
      .filter(({ name }) => ["Model", "Capacity", "Size", "Electrical rating", "Packing"].includes(name))
      .map(({ name, value }) => `${name}: ${value}`),
    variant && `Pole configuration: ${variant}`,
  ].filter(Boolean);
  return `Hello ${business.name}, I would like to enquire about ${product.name}${details.length ? ` (${details.join(", ")})` : ""}. Please share the price and availability for this exact product.`;
}

export function openWhatsApp(message, business = BUSINESS) {
  window.open(getWhatsAppUrl(message, business), "_blank", "noopener,noreferrer");
}
