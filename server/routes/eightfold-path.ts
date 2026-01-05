import { Router } from 'express';
import type { Request, Response } from 'express';
import { Db } from 'mongodb';
import { auth, AuthRequest } from '../middleware';

export function createEightfoldPathRoutes(db: Db) {
    const router = Router();

    // Create or update Eightfold Path log for a specific date
    router.post('/', auth, async (req: Request, res: Response) => {
        const user = (req as AuthRequest).user;
        const username = user.username;
        const { date, paths } = req.body;

        if (!date || !paths || !Array.isArray(paths)) {
            return res.status(400).json({ error: 'Date and paths array required' });
        }

        const pathDate = new Date(date);
        pathDate.setHours(0, 0, 0, 0);

        try {
            const pathLog = {
                username,
                date: pathDate,
                paths, // Array of { path: string, note: string }
                completedCount: paths.length,
                progressPercentage: Math.round((paths.length / 8) * 100),
                updatedAt: new Date()
            };

            // Upsert: update if exists for this date, insert if not
            await db.collection('EightfoldPathLogs').updateOne(
                { username, date: pathDate },
                { $set: pathLog },
                { upsert: true }
            );

            res.status(201).json({ message: 'Eightfold Path saved', pathLog });
        } catch (err: any) {
            res.status(500).json({ error: 'Failed to save Eightfold Path', details: err.message });
        }
    });

    // Get user's Eightfold Path logs
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

            let cursor = db.collection('EightfoldPathLogs')
                .find(query)
                .sort({ date: -1 });

            if (limit) {
                cursor = cursor.limit(parseInt(limit as string));
            }

            const pathLogs = await cursor.toArray();
            res.json({ pathLogs });
        } catch (err: any) {
            res.status(500).json({ error: 'Database error', details: err.message });
        }
    });

    // Get Eightfold Path analytics
    router.get('/analytics', auth, async (req: Request, res: Response) => {
        const user = (req as AuthRequest).user;
        const username = user.username;
        const { days = 30 } = req.query;

        try {
            const daysNum = parseInt(days as string);
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - daysNum);
            startDate.setHours(0, 0, 0, 0);

            const pathLogs = await db.collection('EightfoldPathLogs')
                .find({ username, date: { $gte: startDate } })
                .sort({ date: -1 })
                .toArray();

            if (pathLogs.length === 0) {
                return res.json({
                    totalDays: 0,
                    averageCompletion: 0,
                    perfectDays: 0,
                    mostFollowedPaths: [],
                    trends: []
                });
            }

            // Calculate statistics
            const totalDays = pathLogs.length;
            const totalCompletion = pathLogs.reduce((sum: number, log: any) =>
                sum + log.completedCount, 0);
            const averageCompletion = (totalCompletion / (totalDays * 8) * 100).toFixed(1);

            // Count perfect days (all 8 paths followed)
            const perfectDays = pathLogs.filter((log: any) => log.completedCount === 8).length;

            // Count most followed paths
            const pathCounts: Record<string, number> = {};
            pathLogs.forEach((log: any) => {
                log.paths.forEach((p: any) => {
                    pathCounts[p.path] = (pathCounts[p.path] || 0) + 1;
                });
            });

            const mostFollowedPaths = Object.entries(pathCounts)
                .map(([path, count]) => ({ path, count }))
                .sort((a, b) => b.count - a.count);

            // Generate trend data
            const trends = pathLogs.slice(0, 30).map((log: any) => ({
                date: log.date,
                completedCount: log.completedCount,
                progressPercentage: log.progressPercentage
            }));

            res.json({
                totalDays,
                averageCompletion,
                perfectDays,
                mostFollowedPaths,
                trends
            });
        } catch (err: any) {
            res.status(500).json({ error: 'Failed to fetch analytics', details: err.message });
        }
    });

    return router;
}
