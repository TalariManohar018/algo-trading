// ============================================================
// AUTH SERVICE — Registration, Login, JWT management
// ============================================================
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/database';
import { env } from '../config/env';
import { AppError, AuthenticationError } from '../utils/errors';
import logger from '../utils/logger';
import type { JwtPayload } from '../middleware/auth';

const SALT_ROUNDS = 12;

export class AuthService {
    /**
     * Register a new user with wallet initialization
     */
    async register(data: { email: string; password: string; fullName: string }) {
        // Check if email already exists
        const existing = await prisma.user.findUnique({ where: { email: data.email } });
        if (existing) {
            throw new AppError('Email already registered', 409);
        }

        // Validate password strength
        if (data.password.length < 8) {
            throw new AppError('Password must be at least 8 characters', 400);
        }

        // Hash password
        const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);

        // Create user + wallet + risk state in a transaction
        const user = await prisma.$transaction(async (tx: any) => {
            const newUser = await tx.user.create({
                data: {
                    email: data.email,
                    passwordHash,
                    fullName: data.fullName,
                },
            });

            // Initialize paper trading wallet
            await tx.wallet.create({
                data: {
                    userId: newUser.id,
                    balance: 100000,
                    availableMargin: 100000,
                },
            });

            // Initialize risk state
            await tx.riskState.create({
                data: {
                    userId: newUser.id,
                    tradingDate: new Date(),
                },
            });

            return newUser;
        });

        const token = this.generateToken(user);
        logger.info(`User registered: ${user.email}`, { userId: user.id });

        return {
            token,
            user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role },
        };
    }

    /**
     * Authenticate user and return JWT
     */
    async login(data: { email: string; password: string }) {
        const user = await prisma.user.findUnique({ where: { email: data.email } });
        if (!user || !user.isActive) {
            throw new AuthenticationError('Invalid email or password');
        }

        const isValid = await bcrypt.compare(data.password, user.passwordHash);
        if (!isValid) {
            throw new AuthenticationError('Invalid email or password');
        }

        const token = this.generateToken(user);
        logger.info(`User logged in: ${user.email}`, { userId: user.id });

        return {
            token,
            user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role },
        };
    }

    /**
     * Get user profile
     */
    async getProfile(userId: string) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { wallet: true },
        });
        if (!user) throw new AppError('User not found', 404);

        return {
            id: user.id,
            email: user.email,
            fullName: user.fullName,
            role: user.role,
            wallet: user.wallet,
            createdAt: user.createdAt,
        };
    }

    private generateToken(user: { id: string; email: string; role: string }): string {
        const payload: JwtPayload = {
            userId: user.id,
            email: user.email,
            role: user.role,
        };
        return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN } as jwt.SignOptions);
    }
}

export const authService = new AuthService();
