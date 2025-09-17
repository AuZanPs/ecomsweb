import { Router } from 'express';
import { AuthController } from '../controllers/authController';
import { authenticateJWT } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { UserRegistrationSchema, UserLoginSchema, UserUpdateSchema } from '../../utils/validation';

const router = Router();
const authController = new AuthController();

// Public routes
router.post('/register', validate(UserRegistrationSchema), authController.register);
router.post('/login', validate(UserLoginSchema), authController.login);

// Protected routes
router.get('/profile', authenticateJWT, authController.profile);
router.put('/profile', authenticateJWT, validate(UserUpdateSchema), authController.updateProfile);
router.post('/logout', authController.logout);

export default router;