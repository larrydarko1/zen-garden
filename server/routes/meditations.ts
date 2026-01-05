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

            // Update user stats
            const monk = await monks.findOne({ username });
            if (monk) {
                const stats = monk.stats || { totalSessions: 0, totalMinutes: 0, currentStreak: 0, longestStreak: 0, lastMeditationDate: null };

                // Update totals
                stats.totalSessions = (stats.totalSessions || 0) + 1;
                stats.totalMinutes = (stats.totalMinutes || 0) + (duration || 0);

                // Calculate streak
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const lastDate = stats.lastMeditationDate ? new Date(stats.lastMeditationDate) : null;

                if (lastDate) {
                    lastDate.setHours(0, 0, 0, 0);
                    const diffDays = Math.floor((today.getTime() - lastDate.getTime()) / 86400000);

                    if (diffDays === 0) {
                        // Same day, keep streak
                    } else if (diffDays === 1) {
                        // Consecutive day, increment streak
                        stats.currentStreak = (stats.currentStreak || 0) + 1;
                    } else {
                        // Streak broken, reset to 1
                        stats.currentStreak = 1;
                    }
                } else {
                    // First meditation
                    stats.currentStreak = 1;
                }

                // Update longest streak
                stats.longestStreak = Math.max(stats.longestStreak || 0, stats.currentStreak || 0);
                stats.lastMeditationDate = meditationDate;

                await monks.updateOne({ username }, { $set: { stats } });
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
