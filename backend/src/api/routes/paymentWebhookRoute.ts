import { Router } from 'express';
import { PaymentWebhookController } from '../controllers/paymentWebhookController';

const router = Router();
const paymentWebhookController = new PaymentWebhookController();

// Webhook endpoints - no authentication as they come from external services
// Raw body parsing is typically handled at the app level for webhooks
router.post('/stripe', paymentWebhookController.stripeWebhook);
router.post('/paypal', paymentWebhookController.paypalWebhook);

// Health and monitoring endpoints - could be protected in production
router.get('/health', paymentWebhookController.getWebhookHealth);
router.get('/summary', paymentWebhookController.getPaymentEventSummary);

export default router;