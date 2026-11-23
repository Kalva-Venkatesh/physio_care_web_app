import { Router, Request, Response } from 'express';
import { ClinicHoliday } from '../models/ClinicHoliday';
import { Physiotherapist } from '../models/Physiotherapist';
import { Treatment } from '../models/Treatment';
import { BookingError, getWeeklyAvailability } from '../services/bookingService';
import { getNowIST } from '../utils/timezone';

const router = Router();

router.get('/treatments', async (_req: Request, res: Response) => {
  try {
    const treatments = await Treatment.find({ isActive: true }).sort({ price: 1 }).lean();
    res.json({ treatments });
  } catch (err) {
    console.error('[Public Treatments Error]', err);
    res.status(500).json({ error: 'Failed to load treatments.' });
  }
});

router.get('/physiotherapists', async (req: Request, res: Response) => {
  try {
    const { treatmentId } = req.query;
    const filter: Record<string, unknown> = { isActive: true };
    if (treatmentId && typeof treatmentId === 'string') {
      filter.treatmentIds = treatmentId;
    }

    const physiotherapists = await Physiotherapist.find(filter)
      .populate('treatmentIds', 'name category price durationMinutes')
      .sort({ experienceYears: -1 })
      .lean();

    res.json({ physiotherapists });
  } catch (err) {
    console.error('[Public Physiotherapists Error]', err);
    res.status(500).json({ error: 'Failed to load physiotherapists.' });
  }
});

router.get('/holidays', async (_req: Request, res: Response) => {
  try {
    const today = getNowIST().dateStr;
    const holidays = await ClinicHoliday.find({ date: { $gte: today } }).sort({ date: 1 }).lean();
    res.json({ holidays });
  } catch (err) {
    console.error('[Public Holidays Error]', err);
    res.status(500).json({ error: 'Failed to load clinic holidays.' });
  }
});

router.get('/availability', async (req: Request, res: Response) => {
  try {
    const { physiotherapistId, treatmentId, startDate, days, excludeAppointmentId } = req.query;

    if (!physiotherapistId || typeof physiotherapistId !== 'string') {
      res.status(400).json({ error: 'physiotherapistId is required.' });
      return;
    }

    const result = await getWeeklyAvailability({
      physiotherapistId,
      treatmentId: typeof treatmentId === 'string' && treatmentId ? treatmentId : undefined,
      startDate: typeof startDate === 'string' && startDate ? startDate : undefined,
      days: days ? Number(days) : 7,
      excludeAppointmentId:
        typeof excludeAppointmentId === 'string' && excludeAppointmentId
          ? excludeAppointmentId
          : undefined,
    });

    res.json(result);
  } catch (err) {
    if (err instanceof BookingError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    console.error('[Availability Error]', err);
    res.status(500).json({ error: 'Failed to compute available slots.' });
  }
});

export default router;
