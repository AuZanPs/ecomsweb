import helmet from 'helmet';
import cors from 'cors';
import { RequestHandler } from 'express';

export const securityMiddleware: RequestHandler[] = [
  helmet(),
  cors(),
];
