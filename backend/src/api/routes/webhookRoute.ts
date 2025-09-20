import { Router } from 'express';
import { WebhookController } from '../controllers/webhookController';

const router = Router();
const webhookController = new WebhookController();

// Stripe webhook endpoint (no auth required, Stripe handles verification)
router.post('/stripe', webhookController.handleStripeWebhook);

export default router;