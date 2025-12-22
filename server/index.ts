import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { MongoClient, Db, Collection } from 'mongodb';
import jwt from 'jsonwebtoken';
import argon2 from 'argon2';
import dotenv from 'dotenv';
import validator from 'validator';
import path from 'path';

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
        stats: {
            totalSessions: 0,
            totalMinutes: 0,
            currentStreak: 0,
            longestStreak: 0,
            lastMeditationDate: null
        },
        goals: {
            dailyMinutes: 10,
            weeklyMinutes: 70
        }
    };
    await monks.insertOne(monk);
    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ message: 'User registered', user: { username, theme: monk.theme, stats: monk.stats, goals: monk.goals }, token });
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
    res.json({ message: 'Login successful', user: { username, theme: monk.theme || 'blue' }, token });
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

export default app;
