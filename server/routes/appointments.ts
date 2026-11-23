import { Router, Response } from 'express';
import { Appointment } from '../models/Appointment';
import { authenticate, AuthenticatedRequest, requireRole } from '../middleware/auth';
import {
  BookingError,
  cancelBooking,
  createAtomicBooking,
  rescheduleAtomicBooking,
} from '../services/bookingService';

const router = Router();

router.use(authenticate);

router.get('/my', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const appointments = await Appointment.find({ patientId: req.user!.userId })
      .populate('physiotherapistId', 'name specialization imageUrl qualifications')
      .populate('treatmentId', 'name category price durationMinutes imageUrl')
      .sort({ date: -1, startTime: -1 })
      .lean();

    res.json({ appointments });
  } catch (err) {
    console.error('[My Appointments Error]', err);
    res.status(500).json({ error: 'Failed to fetch your appointments.' });
  }
});

router.post(
  '/',
  requireRole('patient', 'admin'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { physiotherapistId, treatmentId, date, startTime, patientNotes, patientId } = req.body;

      if (!physiotherapistId || !treatmentId || !date || !startTime) {
        res.status(400).json({
          error: 'Physiotherapist, treatment, date, and startTime are required.',
        });
        return;
      }

      const targetPatientId =
        req.user!.role === 'admin' && patientId ? String(patientId) : req.user!.userId;

      const appointment = await createAtomicBooking({
        patientId: targetPatientId,
        physiotherapistId: String(physiotherapistId),
        treatmentId: String(treatmentId),
        date: String(date),
        startTime: String(startTime),
        patientNotes: patientNotes ? String(patientNotes) : '',
      });

      const populated = await Appointment.findById(appointment._id)
        .populate('physiotherapistId', 'name specialization imageUrl qualifications')
        .populate('treatmentId', 'name category price durationMinutes imageUrl')
        .lean();

      res.status(201).json({
        message: 'Appointment confirmed.',
        appointment: populated,
      });
    } catch (err) {
      if (err instanceof BookingError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      console.error('[Create Appointment Error]', err);
      res.status(500).json({ error: 'Could not complete appointment booking.' });
    }
  }
);

router.patch('/:id/reschedule', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { date, startTime } = req.body;
    if (!date || !startTime) {
      res.status(400).json({ error: 'New date and startTime are required.' });
      return;
    }

    const updated = await rescheduleAtomicBooking({
      appointmentId: req.params.id,
      actorUserId: req.user!.userId,
      actorRole: req.user!.role,
      newDate: String(date),
      newStartTime: String(startTime),
    });

    const populated = await Appointment.findById(updated._id)
      .populate('physiotherapistId', 'name specialization imageUrl qualifications')
      .populate('treatmentId', 'name category price durationMinutes imageUrl')
      .lean();

    res.json({
      message: 'Appointment rescheduled successfully.',
      appointment: populated,
    });
  } catch (err) {
    if (err instanceof BookingError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    console.error('[Reschedule Error]', err);
    res.status(500).json({ error: 'Failed to reschedule appointment.' });
  }
});

router.patch('/:id/cancel', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { reason } = req.body || {};
    const cancelled = await cancelBooking({
      appointmentId: req.params.id,
      actorUserId: req.user!.userId,
      actorRole: req.user!.role,
      reason: reason ? String(reason) : undefined,
    });

    const populated = await Appointment.findById(cancelled._id)
      .populate('physiotherapistId', 'name specialization imageUrl qualifications')
      .populate('treatmentId', 'name category price durationMinutes imageUrl')
      .lean();

    res.json({
      message: 'Appointment cancelled and slot released.',
      appointment: populated,
    });
  } catch (err) {
    if (err instanceof BookingError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    console.error('[Cancel Error]', err);
    res.status(500).json({ error: 'Failed to cancel appointment.' });
  }
});

export default router;
