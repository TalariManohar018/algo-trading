import { Router } from 'express';
import authRoutes from './authRoutes';
import strategyRoutes from './strategyRoutes';
import orderRoutes from './orderRoutes';
import positionRoutes from './positionRoutes';
import tradeRoutes from './tradeRoutes';
import backtestRoutes from './backtestRoutes';
import walletRoutes from './walletRoutes';
import riskRoutes from './riskRoutes';
import dashboardRoutes from './dashboardRoutes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/strategies', strategyRoutes);
router.use('/orders', orderRoutes);
router.use('/positions', positionRoutes);
router.use('/trades', tradeRoutes);
router.use('/backtests', backtestRoutes);
router.use('/wallet', walletRoutes);
router.use('/risk', riskRoutes);
router.use('/dashboard', dashboardRoutes);

export default router;
