import { Router } from 'express';
import type { Request, Response } from 'express';
import { Db, Collection } from 'mongodb';
import { auth, AuthRequest } from '../middleware';

export function createMeditationRoutes(db: Db, monks: Collection) {
    const router = Router();

    // Create meditation
    router.post('/', auth, async (req: Request, res: Response) => {
        const user = (req as AuthRequest).user;
        const username = user.username;
        const { Date: dateValue, duration, notes } = req.body;
        if (!dateValue) {
            return res.status(400).json({ error: 'Date (string) required' });
        }

        const meditationDate = new Date(dateValue);
        const meditation: any = {
            Username: username,
            Date: meditationDate,
            duration: duration || 0,
            notes: notes || ''
        };

        try {
            // Insert meditation
            const result = await db.collection('Meditations').insertOne(meditation);
            if (!result.insertedId) {
                return res.status(500).json({ error: 'Failed to insert meditation' });
            }

            res.status(201).json({ message: 'Meditation saved', meditation });
        } catch (e: any) {
            res.status(500).json({ error: 'Failed to save meditation', details: e.message });
        }
    });

    // Get user's meditations
    router.get('/', auth, async (req: Request, res: Response) => {
        const user = (req as AuthRequest).user;
        const username = user.username;
        try {
            const meditations = await db.collection('Meditations')
                .find({ Username: username })
                .sort({ Date: -1 })
                .toArray();
            res.json({ meditations });
        } catch (err: any) {
            res.status(500).json({ error: 'Database error', details: err.message });
        }
    });

    return router;
}
