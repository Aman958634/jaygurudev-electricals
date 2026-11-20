import fs from 'node:fs';
import path from 'node:path';
import pool from '../config/db.js';

const root = path.resolve(process.cwd(), '..');
const imageSource = path.join(root, 'frontend', 'src', 'assets', 'images');
const uploadDirectory = path.resolve(process.cwd(), 'uploads');

const categories = [
  ['LED Lights', 'led-lights', 'Indoor & outdoor', 'sun', 'led-lights.webp'],
  ['Switches & Sockets', 'switches-sockets', 'Modular & standard', 'plug', 'switches-sockets.webp'],
  ['Wires & Cables', 'wires-cables', 'Havells, Polycab & more', 'cable', 'electrical-wiring.webp'],
  ['MCB & Electrical Safety', 'mcb-electrical-safety', 'MCB, RCCB, DB & more', 'shield', 'circuit-breaker.webp'],
  ['Fans', 'fans', 'Ceiling, wall & exhaust', 'fan', 'ceiling-fan.webp'],
  ['Air Conditioners', 'air-conditioners', 'Split, window & coolers', 'wind', 'air-conditioner.webp'],
  ['Home Appliances', 'home-appliances', 'TV, fridge, washing machine', 'house', 'home-appliance.webp'],
  ['Electrical Accessories', 'electrical-accessories', 'Conduits, boxes & more', 'settings', 'showroom-lighting.webp'],
];

const brands = [
  ['Havells', 'havells', 'Electricals'],
  ['Polycab', 'polycab', 'Wires & cables'],
  ['Philips', 'philips', 'Lighting'],
  ['Crompton', 'crompton', 'Fans & appliances'],
  ['Bajaj', 'bajaj', 'Electricals'],
  ['Voltas', 'voltas', 'Cooling'],
  ['LG', 'lg', 'Home appliances'],
  ['Samsung', 'samsung', 'Home appliances'],
  ['Anchor', 'anchor', 'Switches & sockets'],
  ['Legrand', 'legrand', 'Electricals'],
];

const products = [
  ['LED Bulb', 'led-bulb', 'JGE-LED-001', 'Philips', 'LED Lights', '9W / 12W', 'led-lights.webp', 'Lighting'],
  ['Modular Switch', 'modular-switch', 'JGE-SWITCH-001', 'Havells', 'Switches & Sockets', '1 Way, 2 Way', 'switches-sockets.webp', 'Switchgear'],
  ['FR Wire', 'fr-wire', 'JGE-WIRE-001', 'Polycab', 'Wires & Cables', '1.0 / 1.5 / 2.5 Sqmm', 'electrical-wiring.webp', 'Wiring'],
  ['MCB', 'mcb', 'JGE-MCB-001', 'Havells', 'MCB & Electrical Safety', '6A to 63A', 'circuit-breaker.webp', 'Safety'],
  ['Ceiling Fan', 'ceiling-fan', 'JGE-FAN-001', 'Crompton', 'Fans', '1200mm, High Speed', 'ceiling-fan.webp', 'Comfort'],
  ['Air Conditioner', 'air-conditioner', 'JGE-AC-001', 'Voltas', 'Air Conditioners', '1 Ton / 1.5 Ton', 'air-conditioner.webp', 'Cooling'],
  ['Refrigerator', 'refrigerator', 'JGE-APPLIANCE-001', 'LG', 'Home Appliances', 'Multiple capacities', 'home-appliance.webp', 'Appliance'],
  ['Washing Machine', 'washing-machine', 'JGE-APPLIANCE-002', 'Samsung', 'Home Appliances', 'Multiple models', 'washing-machine.webp', 'Appliance'],
  ['LED Panel Light', 'led-panel-light', 'JGE-LED-002', 'Philips', 'LED Lights', '12W / 18W / 24W', 'showroom-lighting.webp', 'Lighting'],
  ['DP MCB', 'dp-mcb', 'JGE-MCB-002', 'Havells', 'MCB & Electrical Safety', 'SP / DP / TP', 'circuit-breaker.webp', 'Safety'],
  ['Roma Socket', 'roma-socket', 'JGE-SOCKET-001', 'Anchor', 'Switches & Sockets', '6A / 16A', 'switches-sockets.webp', 'Switchgear'],
  ['Smart Switch', 'smart-switch', 'JGE-SWITCH-002', 'Legrand', 'Electrical Accessories', 'Ask for available models', 'switches-sockets.webp', 'Smart home'],
];

const gallery = [];

const banners = [
  ['Premium', 'Curated for your space', 'Lighting Solutions', 'Make your spaces brighter, smarter and more beautiful.', 'showroom-lighting.webp', 'LED Lights', 1],
  ['Complete', 'Complete home setup', 'Home Appliances', 'Explore appliances for a comfortable home.', 'home-appliance.webp', 'Home Appliances', 2],
];

const pages = [
  ['home', 'JAY GURUDEV', 'ELECTRIICALS', 'Complete Electrical & Home Appliances under one roof — for your home, shop and project.'],
  ['about', 'Rooted in', 'Palanpur', 'A local destination for electrical essentials and home appliances.'],
  ['products', 'Find the right', 'products', 'Search our selection by product, brand or category. Ask us about variants, pricing and availability.'],
  ['brands', 'Brands we', 'offer', 'Browse selected brands available across electricals, lighting and home appliances. Contact us to confirm current availability.'],
  ['gallery', 'Genuine showroom and workshop', 'project photos', 'Browse genuine photos uploaded by the team.'],
  ['contact', 'Get in', 'touch', 'Questions about a product? Contact our team or visit the showroom in Palanpur.'],
];

function mediaPath(filename) {
  const source = path.join(imageSource, filename);
  if (!fs.existsSync(source)) throw new Error(`Frontend image is missing: ${source}`);
  const destination = path.join(uploadDirectory, filename);
  if (!fs.existsSync(destination)) fs.copyFileSync(source, destination);
  return `/uploads/${filename}`;
}

async function seed() {
  fs.mkdirSync(uploadDirectory, { recursive: true });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    for (const [index, [name, slug, subtitle, icon, filename]] of categories.entries()) {
      await connection.execute(
        `INSERT IGNORE INTO categories (name, slug, subtitle, icon, image, display_order, is_active)
         VALUES (?, ?, ?, ?, ?, ?, 1)`,
        [name, slug, subtitle, icon, mediaPath(filename), index + 1],
      );
    }

    for (const [name, slug, category] of brands) {
      await connection.execute(
        'INSERT IGNORE INTO brands (name, slug, category, is_active) VALUES (?, ?, ?, 1)',
        [name, slug, category],
      );
    }

    for (const [index, [name, slug, sku, brandName, categoryName, size, filename, badge]] of products.entries()) {
      const image = mediaPath(filename);
      const [[category]] = await connection.execute('SELECT id FROM categories WHERE name = ? LIMIT 1', [categoryName]);
      const [[brand]] = await connection.execute('SELECT id FROM brands WHERE name = ? LIMIT 1', [brandName]);
      if (!category || !brand) throw new Error(`Missing catalog relation for ${name}.`);

      await connection.execute(
        `INSERT IGNORE INTO products
         (name, slug, sku, short_description, category_id, brand_id, price_on_request, stock_status,
          is_featured, is_best_selling, is_active, badge, size, image)
         VALUES (?, ?, ?, ?, ?, ?, 1, 'price_on_request', ?, ?, 1, ?, ?, ?)`,
        [name, slug, sku, `${name} by ${brandName}`, category.id, brand.id, index < 4 ? 1 : 0, index < 4 ? 1 : 0, badge, size, image],
      );

      const [[product]] = await connection.execute('SELECT id FROM products WHERE slug = ?', [slug]);
      const [[existingImage]] = await connection.execute('SELECT id FROM product_images WHERE product_id = ? AND image_path = ?', [product.id, image]);
      if (!existingImage) {
        await connection.execute(
          'INSERT INTO product_images (product_id, image_path, is_primary, display_order) VALUES (?, ?, 1, 0)',
          [product.id, image],
        );
      }
      const [[existingSpec]] = await connection.execute('SELECT id FROM product_specifications WHERE product_id = ? AND name = ?', [product.id, 'Size']);
      if (!existingSpec) {
        await connection.execute('INSERT INTO product_specifications (product_id, name, value) VALUES (?, ?, ?)', [product.id, 'Size', size]);
      }
    }

    for (const [index, [title, category, filename]] of gallery.entries()) {
      const image = mediaPath(filename);
      const [[existing]] = await connection.execute('SELECT id FROM gallery WHERE title = ? AND category = ? LIMIT 1', [title, category]);
      if (!existing) {
        await connection.execute('INSERT INTO gallery (title, category, image, display_order, is_active) VALUES (?, ?, ?, ?, 1)', [title, category, image, index + 1]);
      }
    }

    for (const [title, subtitle, highlight, description, filename, category, order] of banners) {
      const image = mediaPath(filename);
      const [[existing]] = await connection.execute('SELECT id FROM banners WHERE title = ? AND category = ? LIMIT 1', [title, category]);
      if (!existing) {
        await connection.execute(
          'INSERT INTO banners (title, subtitle, highlight, description, image, link_url, category, display_order, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)',
          [title, subtitle, highlight, description, image, `/products?category=${encodeURIComponent(category)}`, category, order],
        );
      }
    }

    for (const [slug, title, heading, description] of pages) {
      await connection.execute(
        'INSERT IGNORE INTO pages (slug, title, heading, description, is_active) VALUES (?, ?, ?, ?, 1)',
        [slug, title, heading, description],
      );
    }

    await connection.commit();
    console.log(`Frontend content seeded: ${categories.length} categories, ${brands.length} brands, ${products.length} products, ${gallery.length} gallery images, ${banners.length} banners, ${pages.length} pages.`);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }
}

seed().catch((error) => {
  console.error('Frontend content seed failed:', error.message);
  process.exitCode = 1;
});
