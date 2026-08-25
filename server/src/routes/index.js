/**
 * routes/index.js — mounts every route group under /api.
 */

import { Router } from 'express';
import authRoutes from './authRoutes.js';
import examRoutes from './examRoutes.js';
import attemptRoutes from './attemptRoutes.js';
import submissionRoutes from './submissionRoutes.js';
import aiRoutes from './aiRoutes.js';
import analyticsRoutes from './analyticsRoutes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/exams', examRoutes);
router.use('/attempts', attemptRoutes);
router.use('/submissions', submissionRoutes);
router.use('/ai', aiRoutes);
router.use('/analytics', analyticsRoutes);

export default router;
