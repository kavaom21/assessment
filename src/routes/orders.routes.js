import { Router } from 'express';
import { uploadOrders } from '../controllers/orders.controller.js';

const router = Router();
router.post('/upload-orders', uploadOrders);
export default router;