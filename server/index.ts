import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { MongoClient, Db, Collection } from 'mongodb';
import jwt from 'jsonwebtoken';
import argon2 from 'argon2';
import dotenv from 'dotenv';
import validator from 'validator';
import path from 'path';
import crypto from 'crypto';

dotenv.config({ path: path.resolve('./server/.env') });

const app = express();
const PORT = process.env.PORT || 3001;
const MONGO_URI = process.env.MONGO_URI || '';
const DB_NAME = 'ZenDB';
const COLLECTION_NAME = 'Monks';
const JWT_SECRET = process.env.JWT_SECRET || '';
const API_KEY = process.env.API_KEY || '';

app.use(cors());
app.use(express.json());

let db: Db;
let monks: Collection;

// Connect to MongoDB
MongoClient.connect(MONGO_URI)
    .then(client => {
        db = client.db(DB_NAME);
        monks = db.collection(COLLECTION_NAME);
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    })
    .catch(err => {
        console.error('Failed to connect to MongoDB', err);
        process.exit(1);
    });

// API key middleware
function requireApiKey(req: Request, res: Response, next: NextFunction) {
    const key = req.headers['x-api-key'] as string | undefined;
    if (!key || key !== API_KEY) return res.status(401).json({ error: 'Invalid API key' });
    next();
}

// Register a new user (Monk)
app.post('/api/register', requireApiKey, async (req: Request, res: Response) => {
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
    // Initialize user with default stats and goals
    const monk = {
        username,
        password: hash,
        theme: 'blue',
        language: 'en',
        stats: {
            totalSessions: 0,
            totalMinutes: 0,
            currentStreak: 0,
            longestStreak: 0,
            lastMeditationDate: null
        }
    };
    await monks.insertOne(monk);
    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ message: 'User registered', user: { username, theme: monk.theme, language: monk.language, stats: monk.stats }, token });
});

// Login
app.post('/api/login', requireApiKey, async (req: Request, res: Response) => {
    let { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
    username = validator.trim(username);
    password = validator.trim(password);
    const monk = await monks.findOne({ username });
    if (!monk) return res.status(401).json({ error: 'Invalid credentials' });
    const valid = await argon2.verify(monk.password, password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ message: 'Login successful', user: { username, theme: monk.theme || 'blue', language: monk.language || 'en' }, token });
});

// Auth middleware
interface AuthRequest extends Request {
    user?: any;
}
function auth(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No token' });
    const token = authHeader.split(' ')[1];
    try {
        const payload = jwt.verify(token, JWT_SECRET);
        (req as AuthRequest).user = payload;
        next();
    } catch {
        return res.status(401).json({ error: 'Invalid token' });
    }
}

// Get current user
app.get('/api/me', auth, async (req: Request, res: Response) => {
    const user = (req as AuthRequest).user;
    try {
        // Look up the full user document so we can return the stored theme, stats, and goals
        const monk = await monks.findOne({ username: user.username }, { projection: { password: 0 } });
        if (!monk) return res.status(404).json({ error: 'User not found' });
        res.json({
            user: {
                username: monk.username,
                theme: monk.theme || 'blue',
                language: monk.language || 'en',
                stats: monk.stats || { totalSessions: 0, totalMinutes: 0, currentStreak: 0, longestStreak: 0, lastMeditationDate: null },
                goals: monk.goals || { dailyMinutes: 10, weeklyMinutes: 70 }
            }
        });
    } catch (err: any) {
        res.status(500).json({ error: 'Database error', details: err.message });
    }
});

app.post('/api/meditations', auth, async (req: Request, res: Response) => {
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
app.get('/api/meditations', auth, async (req: Request, res: Response) => {
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

app.patch('/api/theme', auth, async (req: Request, res: Response) => {
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

app.patch('/api/language', auth, async (req: Request, res: Response) => {
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

// Create or update emotion log for today
app.post('/api/emotions', auth, async (req: Request, res: Response) => {
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
app.get('/api/emotions', auth, async (req: Request, res: Response) => {
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
app.get('/api/emotions/analytics', auth, async (req: Request, res: Response) => {
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

// Change username
app.patch('/api/user/username', auth, async (req: Request, res: Response) => {
    const user = (req as AuthRequest).user;
    const oldUsername = user.username;
    let { newUsername } = req.body;

    if (!newUsername) return res.status(400).json({ error: 'New username required' });

    newUsername = validator.trim(newUsername);

    if (!validator.isAlphanumeric(newUsername) || !validator.isLength(newUsername, { min: 3, max: 32 })) {
        return res.status(400).json({ error: 'Username must be 3-32 alphanumeric characters' });
    }

    if (oldUsername === newUsername) {
        return res.status(400).json({ error: 'New username must be different from current username' });
    }

    try {
        // Check if new username already exists
        const existing = await monks.findOne({ username: newUsername });
        if (existing) return res.status(409).json({ error: 'Username already exists' });

        // Update username in Monks collection
        await monks.updateOne({ username: oldUsername }, { $set: { username: newUsername } });

        // Update username in Meditations collection
        await db.collection('Meditations').updateMany({ Username: oldUsername }, { $set: { Username: newUsername } });

        // Update username in EmotionLogs collection
        await db.collection('EmotionLogs').updateMany({ username: oldUsername }, { $set: { username: newUsername } });

        // Generate new token with new username
        const token = jwt.sign({ username: newUsername }, JWT_SECRET, { expiresIn: '7d' });

        res.json({ message: 'Username updated successfully', username: newUsername, token });
    } catch (err: any) {
        res.status(500).json({ error: 'Failed to update username', details: err.message });
    }
});

// Change password
app.patch('/api/user/password', auth, async (req: Request, res: Response) => {
    const user = (req as AuthRequest).user;
    const username = user.username;
    let { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Current password and new password required' });
    }

    currentPassword = validator.trim(currentPassword);
    newPassword = validator.trim(newPassword);

    if (!validator.isLength(newPassword, { min: 6, max: 128 })) {
        return res.status(400).json({ error: 'New password must be 6-128 characters' });
    }

    try {
        // Verify current password
        const monk = await monks.findOne({ username });
        if (!monk) return res.status(404).json({ error: 'User not found' });

        const valid = await argon2.verify(monk.password, currentPassword);
        if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

        // Hash and update new password
        const hash = await argon2.hash(newPassword);
        await monks.updateOne({ username }, { $set: { password: hash } });

        res.json({ message: 'Password updated successfully' });
    } catch (err: any) {
        res.status(500).json({ error: 'Failed to update password', details: err.message });
    }
});

// Delete account
app.delete('/api/user/account', auth, async (req: Request, res: Response) => {
    const user = (req as AuthRequest).user;
    const username = user.username;
    let { password } = req.body;

    if (!password) {
        return res.status(400).json({ error: 'Password required to delete account' });
    }

    password = validator.trim(password);

    try {
        // Verify password
        const monk = await monks.findOne({ username });
        if (!monk) return res.status(404).json({ error: 'User not found' });

        const valid = await argon2.verify(monk.password, password);
        if (!valid) return res.status(401).json({ error: 'Password is incorrect' });

        // Delete user data from all collections
        await monks.deleteOne({ username });
        await db.collection('Meditations').deleteMany({ Username: username });
        await db.collection('EmotionLogs').deleteMany({ username });

        res.json({ message: 'Account deleted successfully' });
    } catch (err: any) {
        res.status(500).json({ error: 'Failed to delete account', details: err.message });
    }
});

// Generate recovery codes
app.post('/api/user/recovery-codes', auth, async (req: Request, res: Response) => {
    const user = (req as AuthRequest).user;
    const username = user.username;
    let { password } = req.body;

    if (!password) {
        return res.status(400).json({ error: 'Password required to generate recovery codes' });
    }

    password = validator.trim(password);

    try {
        // Verify password
        const monk = await monks.findOne({ username });
        if (!monk) return res.status(404).json({ error: 'User not found' });

        const valid = await argon2.verify(monk.password, password);
        if (!valid) return res.status(401).json({ error: 'Password is incorrect' });

        // Generate 12 random recovery codes (8 characters each, alphanumeric)
        const recoveryCodes: string[] = [];
        const hashedCodes: { code: string; used: boolean }[] = [];

        for (let i = 0; i < 12; i++) {
            // Generate a random code
            const code = crypto.randomBytes(4).toString('hex').toUpperCase();
            recoveryCodes.push(code);

            // Hash the code before storing
            const hashedCode = await argon2.hash(code);
            hashedCodes.push({ code: hashedCode, used: false });
        }

        // Store hashed codes in database
        await monks.updateOne(
            { username },
            { $set: { recoveryCodes: hashedCodes, recoveryCodesGeneratedAt: new Date() } }
        );

        // Return plain codes to user (only time they'll see them)
        res.json({
            message: 'Recovery codes generated successfully',
            codes: recoveryCodes,
            warning: 'Save these codes in a safe place. You will not be able to see them again.'
        });
    } catch (err: any) {
        res.status(500).json({ error: 'Failed to generate recovery codes', details: err.message });
    }
});

// Get recovery codes status
app.get('/api/user/recovery-codes/status', auth, async (req: Request, res: Response) => {
    const user = (req as AuthRequest).user;
    const username = user.username;

    try {
        const monk = await monks.findOne({ username });
        if (!monk) return res.status(404).json({ error: 'User not found' });

        const recoveryCodes = monk.recoveryCodes || [];
        const totalCodes = recoveryCodes.length;
        const usedCodes = recoveryCodes.filter((c: any) => c.used).length;
        const remainingCodes = totalCodes - usedCodes;

        res.json({
            hasRecoveryCodes: totalCodes > 0,
            totalCodes,
            usedCodes,
            remainingCodes,
            generatedAt: monk.recoveryCodesGeneratedAt || null
        });
    } catch (err: any) {
        res.status(500).json({ error: 'Failed to get recovery codes status', details: err.message });
    }
});

// Reset password with recovery code (no auth required)
app.post('/api/user/recovery-reset', requireApiKey, async (req: Request, res: Response) => {
    let { username, recoveryCode, newPassword } = req.body;

    if (!username || !recoveryCode || !newPassword) {
        return res.status(400).json({ error: 'Username, recovery code, and new password required' });
    }

    username = validator.trim(username);
    recoveryCode = validator.trim(recoveryCode).toUpperCase();
    newPassword = validator.trim(newPassword);

    if (!validator.isLength(newPassword, { min: 6, max: 128 })) {
        return res.status(400).json({ error: 'New password must be 6-128 characters' });
    }

    try {
        const monk = await monks.findOne({ username });
        if (!monk) return res.status(401).json({ error: 'Invalid credentials' });

        const recoveryCodes = monk.recoveryCodes || [];
        if (recoveryCodes.length === 0) {
            return res.status(400).json({ error: 'No recovery codes available for this account' });
        }

        // Find and verify the recovery code
        let codeIndex = -1;
        let isValidCode = false;

        for (let i = 0; i < recoveryCodes.length; i++) {
            if (!recoveryCodes[i].used) {
                try {
                    const valid = await argon2.verify(recoveryCodes[i].code, recoveryCode);
                    if (valid) {
                        isValidCode = true;
                        codeIndex = i;
                        break;
                    }
                } catch {
                    // Continue checking other codes
                }
            }
        }

        if (!isValidCode || codeIndex === -1) {
            return res.status(401).json({ error: 'Invalid or already used recovery code' });
        }

        // Mark code as used
        recoveryCodes[codeIndex].used = true;

        // Hash new password
        const hash = await argon2.hash(newPassword);

        // Update password and recovery codes
        await monks.updateOne(
            { username },
            { $set: { password: hash, recoveryCodes: recoveryCodes } }
        );

        // Calculate remaining codes
        const remainingCodes = recoveryCodes.filter((c: any) => !c.used).length;

        res.json({
            message: 'Password reset successfully',
            remainingCodes,
            warning: remainingCodes === 0 ? 'All recovery codes have been used. Please generate new codes after logging in.' : undefined
        });
    } catch (err: any) {
        res.status(500).json({ error: 'Failed to reset password', details: err.message });
    }
});

export default app;
