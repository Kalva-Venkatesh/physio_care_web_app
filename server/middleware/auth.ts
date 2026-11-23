import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User, UserRole } from '../models/User';

const JWT_SECRET = process.env.JWT_SECRET || 'physiocare-dev-jwt-secret-change-in-prod';

export interface AuthPayload {
  userId: string;
  role: UserRole;
  email: string;
}

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    role: UserRole;
    email: string;
    name: string;
  };
}

export function signToken(payload: AuthPayload): string {
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
  return jwt.sign(payload, JWT_SECRET, { expiresIn: expiresIn as jwt.SignOptions['expiresIn'] });
}

export async function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Authentication required. Please sign in.' });
      return;
    }

    const token = authHeader.slice(7).trim();
    const decoded = jwt.verify(token, JWT_SECRET) as AuthPayload;

    const user = await User.findById(decoded.userId).select('name email role isActive');
    if (!user || !user.isActive) {
      res.status(401).json({ error: 'Account is inactive or no longer exists.' });
      return;
    }

    req.user = {
      userId: user._id.toString(),
      role: user.role,
      email: user.email,
      name: user.name,
    };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired session token. Please sign in again.' });
  }
}

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: `Access denied. Required role: ${allowedRoles.join(' or ')}.`,
      });
      return;
    }
    next();
  };
}
