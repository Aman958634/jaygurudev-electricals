function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function getHeroContent(page) {
  return {
    title: text(page?.page_title) || text(page?.title) || "JAY GURUDEV",
    heading: text(page?.heading) || "ELECTRIICALS",
    description: text(page?.content) || text(page?.description) || "Complete Electrical & Home Appliances under one roof — for your home, shop and project.",
  };
}
