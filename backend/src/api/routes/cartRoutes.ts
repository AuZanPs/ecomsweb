import { Router } from 'express';
import { CartController } from '../controllers/cartController';
import { authenticateJWT } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { AddToCartSchema, UpdateCartItemSchema } from '../../utils/validation';

const router = Router();
const cartController = new CartController();

// All cart routes require authentication
router.use(authenticateJWT);

router.get('/', cartController.getCart);
router.post('/add', validate(AddToCartSchema), cartController.addToCart);
router.put('/update', validate(UpdateCartItemSchema), cartController.updateCartItem);
router.delete('/clear', cartController.clearCart);
router.delete('/:productId', cartController.removeFromCart);
router.get('/validate', cartController.validateCart);

export default router;