import { Router } from 'express';
import type { Request, Response } from 'express';
import { Collection } from 'mongodb';
import { auth, AuthRequest } from '../middleware';

export function createSettingsRoutes(monks: Collection) {
    const router = Router();

    // Update theme
    router.patch('/theme', auth, async (req: Request, res: Response) => {
        const user = (req as AuthRequest).user;
        const username = user.username;
        const { theme } = req.body;

        const validThemes = ['blue', 'white', 'dark'];
        if (!theme || !validThemes.includes(theme)) {
            return res.status(400).json({ error: 'Valid theme required (blue, white, dark)' });
        }

        try {
            await monks.updateOne({ username }, { $set: { theme } });
            res.json({ message: 'Theme updated', theme });
        } catch (err: any) {
            res.status(500).json({ error: 'Database error', details: err.message });
        }
    });

    // Update language
    router.patch('/language', auth, async (req: Request, res: Response) => {
        const user = (req as AuthRequest).user;
        const username = user.username;
        const { language } = req.body;

        const validLanguages = ['en', 'es', 'it', 'fr', 'de', 'pt', 'zh', 'ja'];
        if (!language || !validLanguages.includes(language)) {
            return res.status(400).json({ error: 'Valid language required (en, es, it, fr, de, pt, zh, ja)' });
        }

        try {
            await monks.updateOne({ username }, { $set: { language } });
            res.json({ message: 'Language updated', language });
        } catch (err: any) {
            res.status(500).json({ error: 'Database error', details: err.message });
        }
    });

    return router;
}
