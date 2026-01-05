import { Router } from 'express';
import type { Request, Response } from 'express';
import { Db, Collection } from 'mongodb';
import jwt from 'jsonwebtoken';
import argon2 from 'argon2';
import validator from 'validator';
import crypto from 'crypto';
import { requireApiKey, auth, AuthRequest } from '../middleware';

export function createAccountRoutes(db: Db, monks: Collection) {
    const router = Router();

    // Change username
    router.patch('/username', auth, async (req: Request, res: Response) => {
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
            const token = jwt.sign({ username: newUsername }, process.env.JWT_SECRET || '', { expiresIn: '7d' });

            res.json({ message: 'Username updated successfully', username: newUsername, token });
        } catch (err: any) {
            res.status(500).json({ error: 'Failed to update username', details: err.message });
        }
    });

    // Change password
    router.patch('/password', auth, async (req: Request, res: Response) => {
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
    router.delete('/account', auth, async (req: Request, res: Response) => {
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
    router.post('/recovery-codes', auth, async (req: Request, res: Response) => {
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
    router.get('/recovery-codes/status', auth, async (req: Request, res: Response) => {
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
    router.post('/recovery-reset', requireApiKey, async (req: Request, res: Response) => {
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

    return router;
}
