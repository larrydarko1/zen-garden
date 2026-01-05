import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
    user?: any;
}

// API key middleware
export function requireApiKey(req: Request, res: Response, next: NextFunction) {
    const key = req.headers['x-api-key'] as string | undefined;
    const API_KEY = process.env.API_KEY || '';
    if (!key || key !== API_KEY) return res.status(401).json({ error: 'Invalid API key' });
    next();
}

// Auth middleware
export function auth(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No token' });
    const token = authHeader.split(' ')[1];
    try {
        const JWT_SECRET = process.env.JWT_SECRET || '';
        const payload = jwt.verify(token, JWT_SECRET);
        (req as AuthRequest).user = payload;
        next();
    } catch {
        return res.status(401).json({ error: 'Invalid token' });
    }
}
