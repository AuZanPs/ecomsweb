import { Router } from 'express';
import { ProductController } from '../controllers/productController';

const router = Router();
const productController = new ProductController();

// Public routes - no authentication required for browsing products
router.get('/', productController.getProducts);
router.get('/search', productController.searchProducts);
router.get('/featured', productController.getFeaturedProducts);
router.get('/top-selling', productController.getTopSellingProducts);
router.get('/price-range', productController.getProductsByPriceRange);
router.get('/:id', productController.getProduct);

export default router;