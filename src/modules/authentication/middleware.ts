// src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import { auth } from './auth';
import { fromNodeHeaders } from 'better-auth/node';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        name?: string;
        role?: string;
        [key: string]: any;
      };
      session?: {
        id: string;
        userId: string;
        expiresAt: Date;
        [key: string]: any;
      };
    }
  }
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'UNAUTHORIZED',
        message: 'Missing or invalid authorization header' 
      });
    }


    // Verify session using better-auth
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers)
    });

    if (!session?.session || !session?.user) {
      return res.status(401).json({ 
        error: 'INVALID_SESSION',
        message: 'Session expired or invalid' 
      });
    }

    // Attach user and session to request
    req.user = session.user as any;
    req.session = session.session;

    next();
  } catch (error: any) {
    console.error('Auth middleware error:', error);
    return res.status(401).json({ 
      error: 'AUTH_ERROR',
      message: 'Authentication failed',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

// Optional: Role-based middleware
export function requireRole(roles: string | string[]) {
  const allowedRoles = Array.isArray(roles) ? roles : [roles];
  
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'UNAUTHORIZED',
        message: 'Authentication required' 
      });
    }

    const userRole = req.user.role || 'user';
    
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({ 
        error: 'FORBIDDEN',
        message: 'Insufficient permissions' 
      });
    }

    next();
  };
}