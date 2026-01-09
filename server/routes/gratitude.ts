import { Router } from 'express';
import type { Request, Response } from 'express';
import { Db } from 'mongodb';
import { auth, AuthRequest } from '../middleware';

export function createGratitudeRoutes(db: Db) {
    const router = Router();

    // Create or update gratitude entry
    router.post('/', auth, async (req: Request, res: Response) => {
        const user = (req as AuthRequest).user;
        const username = user.username;
        const { date, text } = req.body;

        if (!date || !text) {
            return res.status(400).json({ error: 'Date and text required' });
        }

        const gratitudeDate = new Date(date);
        gratitudeDate.setHours(0, 0, 0, 0);

        try {
            const gratitudeEntry = {
                username,
                date: gratitudeDate,
                text: text.trim(),
                updatedAt: new Date()
            };

            // Upsert: update if exists for this date, insert if not
            await db.collection('GratitudeEntries').updateOne(
                { username, date: gratitudeDate },
                { $set: gratitudeEntry },
                { upsert: true }
            );

            res.status(201).json({ message: 'Gratitude entry saved', entry: gratitudeEntry });
        } catch (err: any) {
            res.status(500).json({ error: 'Failed to save gratitude entry', details: err.message });
        }
    });

    // Get user's gratitude entries
    router.get('/', auth, async (req: Request, res: Response) => {
        const user = (req as AuthRequest).user;
        const username = user.username;
        const { startDate, endDate, limit } = req.query;

        try {
            const query: any = { username };

            if (startDate || endDate) {
                query.date = {};
                if (startDate) query.date.$gte = new Date(startDate as string);
                if (endDate) query.date.$lte = new Date(endDate as string);
            }

            let cursor = db.collection('GratitudeEntries')
                .find(query)
                .sort({ date: -1 });

            if (limit) {
                cursor = cursor.limit(parseInt(limit as string));
            }

            const entries = await cursor.toArray();
            res.json({ entries });
        } catch (err: any) {
            res.status(500).json({ error: 'Database error', details: err.message });
        }
    });

    return router;
}
