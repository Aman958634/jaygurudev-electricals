import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";

const frontendDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = path.join(frontendDirectory, "dist");
const siteUrl = "https://jaygurudevelectricals.com";
const socialImageUrl = `${siteUrl}/social-preview.png`;
const productApiBaseUrl = process.env.VITE_API_BASE_URL
  || loadEnv("production", frontendDirectory, "VITE_").VITE_API_BASE_URL
  || "http://localhost:5000/api";
const requireProducts = process.argv.includes("--require-products")
  && process.env.PRERENDER_PRODUCTS_REQUIRED !== "false";

const publicPages = [
  {
    path: "/",
    title: "Jay Guru Dev Electricals | Electrical Products & Solutions",
    description: "Explore quality electrical products, brands and electrical solutions at Jay Guru Dev Electricals.",
  },
  {
    path: "/about",
    title: "About Jay Guru Dev Electricals | Palanpur",
    description: "Learn about Jay Guru Dev Electricals, a local destination for electrical products, lighting and home appliances in Palanpur, Gujarat.",
  },
  {
    path: "/products",
    title: "Electrical Products | Jay Guru Dev Electricals",
    description: "Browse electrical products, lighting and home appliances. Search by product, brand or category, and enquire about availability.",
  },
  {
    path: "/categories",
    title: "Electrical Product Categories | Jay Guru Dev Electricals",
    description: "Explore electrical product categories at Jay Guru Dev Electricals and find products for your home or business.",
  },
  {
    path: "/brands",
    title: "Electrical Brands | Jay Guru Dev Electricals",
    description: "Browse brand names and official websites. Contact Jay Guru Dev Electricals in Palanpur to confirm product availability.",
  },
  {
    path: "/gallery",
    title: "Gallery | Jay Guru Dev Electricals",
    description: "Browse genuine showroom, workshop and project photos from Jay Guru Dev Electricals in Palanpur.",
  },
  {
    path: "/contact",
    title: "Contact Jay Guru Dev Electricals | Palanpur",
    description: "Contact Jay Guru Dev Electricals about electrical products, home appliances or a visit to our showroom in Palanpur, Gujarat.",
  },
];

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function absoluteProductImage(image) {
  if (!image) return socialImageUrl;
  const value = String(image).trim();
  if (value.startsWith("/uploads/") || value.startsWith("uploads/")) {
    return new URL(value.replace(/^\/+/, ""), `${siteUrl}/`).href;
  }
  try {
    const url = new URL(value, `${siteUrl}/`);
    return url.protocol === "https:" ? url.href : socialImageUrl;
  } catch {
    return socialImageUrl;
  }
}

function renderPage(template, { title, description, canonicalUrl, image = socialImageUrl, imageAlt = title, type = "website", schema }) {
  let html = template
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`)
    .replace(/<meta\s+name="description"[^>]*\/?>/i, `<meta name="description" content="${escapeHtml(description)}" />`)
    .replace(/<meta\s+name="robots"[^>]*\/?>/i, '<meta name="robots" content="index,follow" />')
    .replace(/<link\s+rel="canonical"[^>]*\/?>/i, "")
    .replace(/<meta\s+property="og:[^"]*"[^>]*\/?>/gi, "")
    .replace(/<meta\s+name="twitter:[^"]*"[^>]*\/?>/gi, "")
    .replace(/<script\s+type="application\/ld\+json"\s+id="page-structured-data">[\s\S]*?<\/script>/i, "");

  const tags = [
    `<link rel="canonical" href="${escapeHtml(canonicalUrl)}" />`,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    `<meta property="og:image" content="${escapeHtml(image)}" />`,
    `<meta property="og:image:alt" content="${escapeHtml(imageAlt)}" />`,
    `<meta property="og:url" content="${escapeHtml(canonicalUrl)}" />`,
    `<meta property="og:type" content="${escapeHtml(type)}" />`,
    '<meta property="og:site_name" content="Jay Guru Dev Electricals" />',
    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:title" content="${escapeHtml(title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(description)}" />`,
    `<meta name="twitter:image" content="${escapeHtml(image)}" />`,
  ];

  if (schema) {
    tags.push(`<script type="application/ld+json" id="page-structured-data">${JSON.stringify(schema).replaceAll("<", "\\u003c")}</script>`);
  }

  return html.replace("</head>", `    ${tags.join("\n    ")}\n  </head>`);
}

async function fetchProducts() {
  const products = [];
  let page = 1;
  let totalPages = 1;

  do {
    const response = await fetch(`${productApiBaseUrl.replace(/\/+$/, "")}/products?limit=100&page=${page}`, {
      signal: AbortSignal.timeout(30000),
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`Product API returned HTTP ${response.status}.`);
    const payload = await response.json();
    if (payload?.success !== true || !Array.isArray(payload.data)) {
      throw new Error("Product API returned an unexpected response.");
    }
    products.push(...payload.data);
    totalPages = Number(payload.pagination?.totalPages) || 1;
    page += 1;
  } while (page <= totalPages);

  return products;
}

async function main() {
  const template = await readFile(path.join(outputDirectory, "index.html"), "utf8");
  const sitemapUrls = [];

  for (const page of publicPages) {
    const canonicalUrl = new URL(page.path, `${siteUrl}/`).href;
    const html = renderPage(template, { ...page, canonicalUrl });
    const outputPath = page.path === "/"
      ? path.join(outputDirectory, "index.html")
      : path.join(outputDirectory, page.path.slice(1), "index.html");
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, html, "utf8");
    sitemapUrls.push(canonicalUrl);
  }

  let products = [];
  try {
    products = await fetchProducts();
  } catch (error) {
    if (requireProducts) {
      throw new Error(`Unable to prerender product metadata from ${productApiBaseUrl}: ${error.message}`);
    }
    console.warn(`Product metadata prerendering skipped: ${error.message}`);
  }

  for (const product of products) {
    const id = String(product.id ?? "");
    if (!/^\d+$/.test(id) || !product.name) continue;

    const canonicalPath = `/products/${id}`;
    const canonicalUrl = new URL(canonicalPath, `${siteUrl}/`).href;
    const title = product.meta_title || `${product.name} | Jay Guru Dev Electricals`;
    const description = String(product.meta_description || product.short_description || product.description || `Enquire about ${product.name} at Jay Guru Dev Electricals.`).slice(0, 300);
    const image = absoluteProductImage(product.image);
    const schema = {
      "@context": "https://schema.org",
      "@type": "Product",
      name: product.name,
      description,
      image,
      url: canonicalUrl,
      ...(product.sku ? { sku: product.sku } : {}),
      ...(product.brand ? { brand: { "@type": "Brand", name: product.brand } } : {}),
      ...(product.category ? { category: product.category } : {}),
      ...(Number(product.price) > 0 && !product.price_on_request && product.stock_status !== "price_on_request" ? {
        offers: {
          "@type": "Offer",
          priceCurrency: "INR",
          price: Number(product.price),
          availability: product.stock_status === "out_of_stock" ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
        },
      } : {}),
    };
    const html = renderPage(template, {
      title,
      description,
      canonicalUrl,
      image,
      imageAlt: product.name,
      type: "product",
      schema,
    });
    const outputPath = path.join(outputDirectory, "products", id, "index.html");
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, html, "utf8");
    sitemapUrls.push(canonicalUrl);
  }

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapUrls.map((url) => `  <url><loc>${escapeHtml(url)}</loc></url>`).join("\n")}\n</urlset>\n`;
  await writeFile(path.join(outputDirectory, "sitemap.xml"), sitemap, "utf8");
  console.log(`SEO pages generated: ${publicPages.length} public routes, ${products.length} active products.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
