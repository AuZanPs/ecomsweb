import { Router } from 'express';
import { OrderController } from '../controllers/orderController';
import { authenticateJWT } from '../middleware/auth';

const router = Router();
const orderController = new OrderController();

// All order routes require authentication
router.use(authenticateJWT);

router.get('/', orderController.getOrders);
router.get('/statistics', orderController.getOrderStatistics);
router.get('/status/:status', orderController.getOrdersByStatus);
router.get('/tracking/:orderNumber', orderController.getOrderTracking);
router.get('/:orderId', orderController.getOrder);
router.put('/:orderId/cancel', orderController.cancelOrder);

export default router;