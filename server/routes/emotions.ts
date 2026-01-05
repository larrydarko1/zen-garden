import { Router } from 'express';
import type { Request, Response } from 'express';
import { Db } from 'mongodb';
import { auth, AuthRequest } from '../middleware';

export function createEmotionRoutes(db: Db) {
    const router = Router();

    // Create or update emotion log for today
    router.post('/', auth, async (req: Request, res: Response) => {
        const user = (req as AuthRequest).user;
        const username = user.username;
        const { date, emotions } = req.body;

        if (!date || !emotions || !Array.isArray(emotions)) {
            return res.status(400).json({ error: 'Date and emotions array required' });
        }

        const emotionDate = new Date(date);
        emotionDate.setHours(0, 0, 0, 0);

        try {
            const emotionLog = {
                username,
                date: emotionDate,
                emotions,
                positiveCount: emotions.filter((e: any) => e.type === 'positive').length,
                negativeCount: emotions.filter((e: any) => e.type === 'negative').length,
                pnRatio: 0,
                updatedAt: new Date()
            };

            // Calculate P/N ratio
            const total = emotionLog.positiveCount + emotionLog.negativeCount;
            emotionLog.pnRatio = total > 0 ? emotionLog.positiveCount / total : 0;

            // Upsert: update if exists for this date, insert if not
            await db.collection('EmotionLogs').updateOne(
                { username, date: emotionDate },
                { $set: emotionLog },
                { upsert: true }
            );

            res.status(201).json({ message: 'Emotions saved', emotionLog });
        } catch (err: any) {
            res.status(500).json({ error: 'Failed to save emotions', details: err.message });
        }
    });

    // Get user's emotion logs
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

            let cursor = db.collection('EmotionLogs')
                .find(query)
                .sort({ date: -1 });

            if (limit) {
                cursor = cursor.limit(parseInt(limit as string));
            }

            const emotionLogs = await cursor.toArray();
            res.json({ emotionLogs });
        } catch (err: any) {
            res.status(500).json({ error: 'Database error', details: err.message });
        }
    });

    // Get emotion analytics
    router.get('/analytics', auth, async (req: Request, res: Response) => {
        const user = (req as AuthRequest).user;
        const username = user.username;
        const { days = 30 } = req.query;

        try {
            const daysNum = parseInt(days as string);
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - daysNum);
            startDate.setHours(0, 0, 0, 0);

            const emotionLogs = await db.collection('EmotionLogs')
                .find({ username, date: { $gte: startDate } })
                .sort({ date: -1 })
                .toArray();

            if (emotionLogs.length === 0) {
                return res.json({
                    totalDays: 0,
                    averagePNRatio: 0,
                    topEmotions: [],
                    emotionDiversity: 0,
                    positiveDays: 0,
                    negativeDays: 0,
                    trends: []
                });
            }

            // Calculate analytics
            const totalDays = emotionLogs.length;
            const avgPNRatio = emotionLogs.reduce((sum, log) => sum + log.pnRatio, 0) / totalDays;

            // Count all emotions
            const emotionCounts: { [key: string]: { name: string; count: number; type: string } } = {};
            emotionLogs.forEach(log => {
                log.emotions.forEach((emotion: any) => {
                    if (!emotionCounts[emotion.name]) {
                        emotionCounts[emotion.name] = { name: emotion.name, count: 0, type: emotion.type };
                    }
                    emotionCounts[emotion.name].count++;
                });
            });

            const topEmotions = Object.values(emotionCounts)
                .sort((a, b) => b.count - a.count)
                .slice(0, 10);

            const emotionDiversity = Object.keys(emotionCounts).length;
            const positiveDays = emotionLogs.filter(log => log.pnRatio >= 0.5).length;
            const negativeDays = emotionLogs.filter(log => log.pnRatio < 0.5).length;

            res.json({
                totalDays,
                averagePNRatio: Math.round(avgPNRatio * 100) / 100,
                topEmotions,
                emotionDiversity,
                positiveDays,
                negativeDays,
                trends: emotionLogs.map(log => ({
                    date: log.date,
                    pnRatio: log.pnRatio,
                    positiveCount: log.positiveCount,
                    negativeCount: log.negativeCount
                }))
            });
        } catch (err: any) {
            res.status(500).json({ error: 'Analytics error', details: err.message });
        }
    });

    return router;
}
