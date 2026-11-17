import { Router } from 'express';
import { queryOne, query } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/summary', requireAuth, async (req, res, next) => {
  try {
    const totalProducts = await queryOne('SELECT COUNT(*) AS total FROM products');
    const totalCategories = await queryOne('SELECT COUNT(*) AS total FROM categories');
    const totalBrands = await queryOne('SELECT COUNT(*) AS total FROM brands');
    const totalEnquiries = await queryOne('SELECT COUNT(*) AS total FROM enquiries');
    const totalGalleryImages = await queryOne('SELECT COUNT(*) AS total FROM gallery');
    const activeEnquiries = await queryOne('SELECT COUNT(*) AS total FROM enquiries WHERE status IN ("new", "contacted", "quoted")');
    const recentEnquiries = await query(
      `SELECT id, enquiry_type, customer_name, customer_phone, customer_city, customer_shop,
              requirement, status, created_at
       FROM enquiries ORDER BY created_at DESC LIMIT 6`,
    );

    return res.json({
      success: true,
      data: {
        products: Number(totalProducts.total),
        categories: Number(totalCategories.total),
        brands: Number(totalBrands.total),
        enquiries: Number(totalEnquiries.total),
        galleryImages: Number(totalGalleryImages.total),
        activeEnquiries: Number(activeEnquiries.total),
        recentEnquiries,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
