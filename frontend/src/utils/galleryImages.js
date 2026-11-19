const illustrativeImageNames = new Set([
  "reference-showroom-hero.webp",
  "lighting-interior.webp",
  "living-room.webp",
  "led-lights.webp",
  "home-appliance.webp",
  "modern-interior.webp",
]);

export function isGenuineGalleryPhoto(photo) {
  const imagePath = String(photo?.image || "").split(/[?#]/, 1)[0];
  const filename = imagePath.split("/").pop()?.toLowerCase();
  return Boolean(filename) && !illustrativeImageNames.has(filename);
}
