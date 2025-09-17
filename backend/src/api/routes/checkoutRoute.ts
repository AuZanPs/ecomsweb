import { Router } from 'express';
import { CheckoutController } from '../controllers/checkoutController';
import { authenticateJWT } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { CheckoutInitiateSchema, CheckoutConfirmSchema } from '../../utils/validation';

const router = Router();
const checkoutController = new CheckoutController();

// All checkout routes require authentication
router.use(authenticateJWT);

router.get('/validate', checkoutController.validateCheckout);
router.post('/initiate', validate(CheckoutInitiateSchema), checkoutController.initiateCheckout);
router.post('/confirm', validate(CheckoutConfirmSchema), checkoutController.confirmCheckout);
router.post('/calculate-total', checkoutController.calculateOrderTotal);
router.post('/cancel', checkoutController.cancelCheckout);
router.post('/express', checkoutController.expressCheckout);

export default router;