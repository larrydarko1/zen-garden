import { Router } from 'express';
import type { Request, Response } from 'express';
import { Collection } from 'mongodb';
import jwt from 'jsonwebtoken';
import argon2 from 'argon2';
import validator from 'validator';
import { requireApiKey, auth, AuthRequest } from '../middleware';

export function createAuthRoutes(monks: Collection) {
    const router = Router();

    // Register a new user (Monk)
    router.post('/register', requireApiKey, async (req: Request, res: Response) => {
        let { username, password, theme } = req.body;
        if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
        username = validator.trim(username);
        password = validator.trim(password);
        if (!validator.isAlphanumeric(username) || !validator.isLength(username, { min: 3, max: 32 })) {
            return res.status(400).json({ error: 'Username must be 3-32 alphanumeric characters' });
        }
        if (!validator.isLength(password, { min: 6, max: 128 })) {
            return res.status(400).json({ error: 'Password must be 6-128 characters' });
        }
        const existing = await monks.findOne({ username });
        if (existing) return res.status(409).json({ error: 'Username already exists' });
        const hash = await argon2.hash(password);
        const monk = {
            username,
            password: hash,
            theme: 'blue',
            language: 'en'
        };
        await monks.insertOne(monk);
        const token = jwt.sign({ username }, process.env.JWT_SECRET || '', { expiresIn: '7d' });
        res.status(201).json({ message: 'User registered', user: { username, theme: monk.theme, language: monk.language }, token });
    });

    // Login
    router.post('/login', requireApiKey, async (req: Request, res: Response) => {
        let { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
        username = validator.trim(username);
        password = validator.trim(password);
        const monk = await monks.findOne({ username });
        if (!monk) return res.status(401).json({ error: 'Invalid credentials' });
        const valid = await argon2.verify(monk.password, password);
        if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
        const token = jwt.sign({ username }, process.env.JWT_SECRET || '', { expiresIn: '7d' });
        res.json({ message: 'Login successful', user: { username, theme: monk.theme || 'blue', language: monk.language || 'en' }, token });
    });

    // Get current user
    router.get('/me', auth, async (req: Request, res: Response) => {
        const user = (req as AuthRequest).user;
        try {
            const monk = await monks.findOne({ username: user.username }, { projection: { password: 0 } });
            if (!monk) return res.status(404).json({ error: 'User not found' });
            res.json({
                user: {
                    username: monk.username,
                    theme: monk.theme || 'blue',
                    language: monk.language || 'en'
                }
            });
        } catch (err: any) {
            res.status(500).json({ error: 'Database error', details: err.message });
        }
    });

    return router;
}
