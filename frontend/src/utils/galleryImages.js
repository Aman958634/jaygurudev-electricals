export function hasGalleryImage(photo) {
  const imagePath = String(photo?.image || "").split(/[?#]/, 1)[0];
  const filename = imagePath.split("/").pop()?.toLowerCase();
  return Boolean(filename);
}
