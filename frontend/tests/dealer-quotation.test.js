import test from "node:test";
import assert from "node:assert/strict";
import { BUSINESS, normalizeBusinessHours } from "../src/utils/constants.js";
import { BUSINESS_NAME, normalizeBusinessCopy } from "../src/utils/branding.js";
import { createDealerQuotationMessage } from "../src/utils/dealerQuotation.js";
import { getWhatsAppUrl } from "../src/utils/whatsapp.js";

test("formats a single dealer quotation item with the canonical business name", () => {
  const message = createDealerQuotationMessage({
    customerName: "Asha Electricals",
    city: "Palanpur",
    items: [{ name: "GreatWhite Trivo Switch", specification: "1 Way", quantity: 12 }],
    additionalRequirements: "Delivery this week",
  });

  assert.match(message, new RegExp(`Business: ${BUSINESS_NAME}`));
  assert.match(message, /Customer Name: Asha Electricals/);
  assert.match(message, /City: Palanpur/);
  assert.match(message, /1\. GreatWhite Trivo Switch - 1 Way - Quantity: 12/);
  assert.match(message, /Additional Requirements: Delivery this week/);
});

test("keeps every multi-item quantity in the encoded configured WhatsApp link", () => {
  const message = createDealerQuotationMessage({
    customerName: "Asha Electricals",
    city: "Palanpur",
    items: [
      { name: "Polycab FR Wire", specification: "1.5 Sqmm", quantity: 50 },
      { name: "Altech MCB / DB", specification: "Details to confirm", quantity: 8 },
    ],
  });
  const url = new URL(getWhatsAppUrl(message, BUSINESS));

  assert.equal(url.host, "wa.me");
  assert.equal(url.pathname, `/${BUSINESS.phoneDigits}`);
  assert.equal(url.searchParams.get("text"), message);
  assert.match(message, /1\. Polycab FR Wire - 1\.5 Sqmm - Quantity: 50/);
  assert.match(message, /2\. Altech MCB \/ DB - Details to confirm - Quantity: 8/);
  assert.match(message, /Please share your best dealer quotation\./);
});

test("normalizes the legacy schedule to Sunday closed and corrects legacy brand copy", () => {
  assert.equal(
    normalizeBusinessHours("Mon – Sun · 9:00 AM – 9:00 PM"),
    "Monday – Saturday · 8:00 AM – 8:00 PM · Sunday: CLOSED",
  );
  assert.equal(normalizeBusinessCopy("Jay Gurudev Electricals"), BUSINESS_NAME);
});
