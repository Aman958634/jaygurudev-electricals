import { BUSINESS_NAME } from "./branding.js";

export function createDealerQuotationMessage({ customerName, city, items, additionalRequirements = "" }) {
  const itemLines = items.map(({ name, specification, quantity }, index) => (
    `${index + 1}. ${name}${specification ? ` - ${specification}` : ""} - Quantity: ${quantity}`
  ));

  return [
    "Dealer Quotation Request",
    `Business: ${BUSINESS_NAME}`,
    `Customer Name: ${customerName}`,
    `City: ${city}`,
    "",
    "Requested Items:",
    ...itemLines,
    additionalRequirements ? `Additional Requirements: ${additionalRequirements}` : "",
    "",
    "Please share your best dealer quotation.",
  ].join("\n");
}
