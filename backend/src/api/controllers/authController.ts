import { Request, Response } from 'express';
import { UserService } from '../../services/UserService';
import { AuthRequest } from '../middleware/auth';

export class AuthController {
  register = async (req: Request, res: Response) => {
    try {
      const { email, password, name } = req.body;
      const result = await UserService.register({ email, password, name });
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  };

  login = async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      const result = await UserService.authenticate({ email, password });
      res.json(result);
    } catch (error: any) {
      res.status(401).json({ message: error.message });
    }
  };

  profile = async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user._id;
      const profile = await UserService.getProfile(userId);
      res.json(profile);
    } catch (error: any) {
      res.status(404).json({ message: error.message });
    }
  };

  updateProfile = async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user._id;
      const updates = req.body;
      const profile = await UserService.updateProfile(userId, updates);
      res.json(profile);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  };

  logout = async (req: Request, res: Response) => {
    try {
      // For JWT tokens, logout is typically handled client-side by removing the token
      // However, for completeness, we can implement token blacklisting here if needed
      res.status(204).send();
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  };
}