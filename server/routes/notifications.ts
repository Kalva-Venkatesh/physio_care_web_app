import { Router, Response } from 'express';
import { Notification } from '../models/Notification';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const notifications = await Notification.find({ userId: req.user!.userId })
      .sort({ createdAt: -1 })
      .limit(40)
      .lean();

    const unreadCount = notifications.filter((n) => !n.isRead).length;
    res.json({ notifications, unreadCount });
  } catch (err) {
    console.error('[Notifications Fetch Error]', err);
    res.status(500).json({ error: 'Failed to fetch notifications.' });
  }
});

router.patch('/read-all', async (req: AuthenticatedRequest, res: Response) => {
  try {
    await Notification.updateMany(
      { userId: req.user!.userId, isRead: false },
      { $set: { isRead: true } }
    );
    res.json({ success: true });
  } catch (err) {
    console.error('[Notifications Read All Error]', err);
    res.status(500).json({ error: 'Failed to update notifications.' });
  }
});

router.patch('/:id/read', async (req: AuthenticatedRequest, res: Response) => {
  try {
    await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user!.userId },
      { $set: { isRead: true } }
    );
    res.json({ success: true });
  } catch (err) {
    console.error('[Notification Read Error]', err);
    res.status(500).json({ error: 'Failed to mark notification as read.' });
  }
});

export default router;
