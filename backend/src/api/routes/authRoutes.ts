import { Router } from 'express';
import { AuthController } from '../controllers/authController';
import { authenticateJWT } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { auditAuthAttempt } from '../middleware/securityAudit';
import { UserRegistrationSchema, UserLoginSchema, UserUpdateSchema } from '../../utils/validation';

const router = Router();
const authController = new AuthController();

// Public routes with security audit logging
router.post('/register', auditAuthAttempt, validate(UserRegistrationSchema), authController.register);
router.post('/login', auditAuthAttempt, validate(UserLoginSchema), authController.login);

// Protected routes
router.get('/profile', authenticateJWT, authController.profile);
router.put('/profile', authenticateJWT, validate(UserUpdateSchema), authController.updateProfile);
router.post('/logout', authController.logout);

export default router;