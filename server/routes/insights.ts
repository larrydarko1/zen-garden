import { Router } from 'express';
import type { Request, Response } from 'express';
import { Db } from 'mongodb';
import { auth, AuthRequest } from '../middleware';

interface DayData {
    date: string;
    positiveCount: number;
    negativeCount: number;
    pnRatio: number;
    meditationMinutes: number;
}

export function createInsightsRoutes(db: Db) {
    const router = Router();

    // Get meditation-emotion correlation insights
    router.get('/correlation', auth, async (req: Request, res: Response) => {
        const user = (req as AuthRequest).user;
        const username = user.username;
        const days = parseInt(req.query.days as string) || 90;

        try {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);
            startDate.setHours(0, 0, 0, 0);

            // Fetch meditations
            const meditations = await db.collection('Meditations')
                .find({
                    Username: username,
                    Date: { $gte: startDate }
                })
                .toArray();

            // Fetch emotion logs
            const emotionLogs = await db.collection('EmotionLogs')
                .find({
                    username,
                    date: { $gte: startDate }
                })
                .toArray();

            // Create date-indexed maps
            const meditationsByDate = new Map();
            meditations.forEach(m => {
                const dateStr = (m.Date.$date ? new Date(m.Date.$date) : new Date(m.Date)).toISOString().split('T')[0];
                if (!meditationsByDate.has(dateStr)) {
                    meditationsByDate.set(dateStr, []);
                }
                meditationsByDate.get(dateStr).push(m);
            });

            const emotionsByDate = new Map();
            emotionLogs.forEach(e => {
                const dateStr = new Date(e.date).toISOString().split('T')[0];
                emotionsByDate.set(dateStr, e);
            });

            // Calculate stats
            const daysWithMeditation: DayData[] = [];
            const daysWithoutMeditation: DayData[] = [];
            const daysWithBoth: DayData[] = [];

            // Get all unique dates from both collections
            const allDates = new Set([...meditationsByDate.keys(), ...emotionsByDate.keys()]);

            allDates.forEach(dateStr => {
                const hasMeditation = meditationsByDate.has(dateStr);
                const hasEmotions = emotionsByDate.has(dateStr);

                if (hasEmotions) {
                    const emotions = emotionsByDate.get(dateStr);
                    const dayData = {
                        date: dateStr,
                        positiveCount: emotions.positiveCount || 0,
                        negativeCount: emotions.negativeCount || 0,
                        pnRatio: emotions.pnRatio || 0,
                        meditationMinutes: 0
                    };

                    if (hasMeditation) {
                        const medSessions = meditationsByDate.get(dateStr);
                        dayData.meditationMinutes = medSessions.reduce((sum: number, m: any) => sum + (m.duration || 0), 0);
                        daysWithBoth.push(dayData);
                        daysWithMeditation.push(dayData);
                    } else {
                        daysWithoutMeditation.push(dayData);
                    }
                }
            });

            // Calculate averages
            const calcAvg = (arr: DayData[], field: keyof DayData): number => {
                if (arr.length === 0) return 0;
                return arr.reduce((sum, item) => sum + (item[field] as number), 0) / arr.length;
            };

            const withMeditationStats = {
                avgPositive: calcAvg(daysWithMeditation, 'positiveCount'),
                avgNegative: calcAvg(daysWithMeditation, 'negativeCount'),
                pnRatio: calcAvg(daysWithMeditation, 'pnRatio')
            };

            const withoutMeditationStats = {
                avgPositive: calcAvg(daysWithoutMeditation, 'positiveCount'),
                avgNegative: calcAvg(daysWithoutMeditation, 'negativeCount'),
                pnRatio: calcAvg(daysWithoutMeditation, 'pnRatio')
            };

            // Calculate correlation score (simple: difference in P/N ratio)
            const correlationScore = daysWithMeditation.length > 0 && daysWithoutMeditation.length > 0
                ? Math.min(1, Math.max(0, withMeditationStats.pnRatio - withoutMeditationStats.pnRatio + 0.5))
                : 0.5;

            // Duration impact analysis
            const durationRanges = [
                { min: 0, max: 10, range: '0-10 min' },
                { min: 10, max: 20, range: '10-20 min' },
                { min: 20, max: 30, range: '20-30 min' },
                { min: 30, max: 999, range: '30+ min' }
            ];

            const durationImpact = durationRanges.map(range => {
                const daysInRange = daysWithBoth.filter(d =>
                    d.meditationMinutes >= range.min && d.meditationMinutes < range.max
                );
                return {
                    range: range.range,
                    count: daysInRange.length,
                    pnRatio: daysInRange.length > 0 ? calcAvg(daysInRange, 'pnRatio') : 0
                };
            }).filter(r => r.count > 0);

            // Best days (highest P/N ratio with meditation)
            const bestDays = [...daysWithBoth]
                .sort((a, b) => b.pnRatio - a.pnRatio)
                .slice(0, 5);

            // Generate insight message
            let message = '';
            if (correlationScore >= 0.7) {
                message = 'Excellent! Your meditation practice shows a strong positive impact on your emotional well-being. Keep up the great work!';
            } else if (correlationScore >= 0.4) {
                message = 'Good progress! There\'s a moderate positive correlation between your meditation and emotions. Consider increasing frequency or duration.';
            } else {
                message = 'Your meditation journey is just beginning. With consistent practice, you may see greater emotional benefits over time.';
            }

            res.json({
                correlationScore,
                meditationDays: meditationsByDate.size,
                emotionTrackedDays: emotionsByDate.size,
                avgMeditationMinutes: meditations.length > 0
                    ? Math.round(meditations.reduce((sum, m) => sum + (m.duration || 0), 0) / meditations.length)
                    : 0,
                avgPNRatio: calcAvg([...daysWithMeditation, ...daysWithoutMeditation], 'pnRatio'),
                withMeditation: withMeditationStats,
                withoutMeditation: withoutMeditationStats,
                durationImpact,
                bestDays,
                message
            });
        } catch (err: any) {
            console.error('Insights error:', err);
            res.status(500).json({ error: 'Failed to calculate insights', details: err.message });
        }
    });

    return router;
}
