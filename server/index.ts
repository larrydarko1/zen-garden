import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env BEFORE importing any modules that use process.env
dotenv.config({ path: path.join(__dirname, '.env') });

import express from 'express';
import cors from 'cors';
import { MongoClient, Db, Collection } from 'mongodb';
import { createAuthRoutes } from './routes/auth';
import { createMeditationRoutes } from './routes/meditations';
import { createEmotionRoutes } from './routes/emotions';
import { createSettingsRoutes } from './routes/settings';
import { createAccountRoutes } from './routes/account';
import { createEightfoldPathRoutes } from './routes/eightfold-path';
import { createGratitudeRoutes } from './routes/gratitude';
import { createInsightsRoutes } from './routes/insights';

const app = express();
const PORT = process.env.PORT || 3001;
const MONGO_URI = process.env.MONGO_URI || '';
const DB_NAME = 'ZenDB';
const COLLECTION_NAME = 'Monks';

app.use(cors());
app.use(express.json());

let db: Db;
let monks: Collection;

// Connect to MongoDB
MongoClient.connect(MONGO_URI)
    .then(client => {
        db = client.db(DB_NAME);
        monks = db.collection(COLLECTION_NAME);

        // Initialize routes
        app.use('/api', createAuthRoutes(monks));
        app.use('/api/meditations', createMeditationRoutes(db, monks));
        app.use('/api/emotions', createEmotionRoutes(db));
        app.use('/api/eightfold-path', createEightfoldPathRoutes(db));
        app.use('/api/gratitude', createGratitudeRoutes(db));
        app.use('/api/insights', createInsightsRoutes(db));
        app.use('/api', createSettingsRoutes(monks));
        app.use('/api/user', createAccountRoutes(db, monks));

        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    })
    .catch(err => {
        console.error('Failed to connect to MongoDB', err);
        process.exit(1);
    });

export default app;
