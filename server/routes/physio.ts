import { Router, Response } from 'express';
import { Appointment } from '../models/Appointment';
import { ClinicHoliday } from '../models/ClinicHoliday';
import { Notification } from '../models/Notification';
import { Physiotherapist } from '../models/Physiotherapist';
import { SlotLock } from '../models/SlotLock';
import { authenticate, AuthenticatedRequest, requireRole } from '../middleware/auth';
import { formatDateLabelIST, formatTime12h, getNowIST } from '../utils/timezone';

const router = Router();
router.use(authenticate, requireRole('physiotherapist'));

router.get('/profile', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const physio = await Physiotherapist.findOne({ userId: req.user!.userId })
      .populate('treatmentIds', 'name category price durationMinutes')
      .lean();

    if (!physio) {
      res.status(404).json({ error: 'Physiotherapist profile not found.' });
      return;
    }

    const today = getNowIST().dateStr;
    const holidays = await ClinicHoliday.find({ date: { $gte: today } }).sort({ date: 1 }).lean();

    res.json({ physiotherapist: physio, holidays });
  } catch (err) {
    console.error('[Physio Profile Error]', err);
    res.status(500).json({ error: 'Failed to load physiotherapist profile.' });
  }
});

router.put('/availability', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { unavailableDates, weeklySchedule } = req.body;
    const physio = await Physiotherapist.findOne({ userId: req.user!.userId });
    if (!physio) {
      res.status(404).json({ error: 'Physiotherapist profile not found.' });
      return;
    }

    if (Array.isArray(unavailableDates)) {
      const cleaned = Array.from(
        new Set(unavailableDates.map((d) => String(d).trim()).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)))
      ).sort();
      physio.unavailableDates = cleaned;
    }

    if (Array.isArray(weeklySchedule) && weeklySchedule.length === 7) {
      physio.weeklySchedule = weeklySchedule.map((day) => ({
        dayOfWeek: Number(day.dayOfWeek),
        isWorking: Boolean(day.isWorking),
        startTime: String(day.startTime || '09:00'),
        endTime: String(day.endTime || '18:00'),
        breakStart: String(day.breakStart || '13:00'),
        breakEnd: String(day.breakEnd || '14:00'),
      }));
    }

    await physio.save();
    res.json({ message: 'Availability preferences saved.', physiotherapist: physio });
  } catch (err) {
    console.error('[Physio Availability Error]', err);
    res.status(500).json({ error: 'Failed to update availability.' });
  }
});

router.get('/appointments', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const physio = await Physiotherapist.findOne({ userId: req.user!.userId }).select('_id');
    if (!physio) {
      res.status(404).json({ error: 'Physiotherapist profile not found.' });
      return;
    }

    const appointments = await Appointment.find({ physiotherapistId: physio._id })
      .populate('patientId', 'name email phone dateOfBirth gender medicalHistory emergencyContact')
      .populate('treatmentId', 'name category price durationMinutes')
      .sort({ date: -1, startTime: 1 })
      .lean();

    res.json({ appointments, todayIST: getNowIST().dateStr });
  } catch (err) {
    console.error('[Physio Appointments Error]', err);
    res.status(500).json({ error: 'Failed to fetch assigned appointments.' });
  }
});

router.patch('/appointments/:id/session', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status, sessionNotes, painScoreBefore, painScoreAfter } = req.body;

    const physio = await Physiotherapist.findOne({ userId: req.user!.userId }).select('_id name');
    if (!physio) {
      res.status(404).json({ error: 'Physiotherapist profile not found.' });
      return;
    }

    const appointment = await Appointment.findOne({
      _id: req.params.id,
      physiotherapistId: physio._id,
    });

    if (!appointment) {
      res.status(404).json({ error: 'Assigned appointment not found.' });
      return;
    }

    const allowedStatuses = ['confirmed', 'in_progress', 'completed', 'cancelled'];
    if (status && !allowedStatuses.includes(status)) {
      res.status(400).json({ error: 'Invalid appointment status.' });
      return;
    }

    if (status) {
      appointment.status = status;
    }
    if (sessionNotes !== undefined) {
      appointment.sessionNotes = String(sessionNotes);
    }
    if (painScoreBefore !== undefined && painScoreBefore !== '') {
      appointment.painScoreBefore = Number(painScoreBefore);
    }
    if (painScoreAfter !== undefined && painScoreAfter !== '') {
      appointment.painScoreAfter = Number(painScoreAfter);
    }

    if (status === 'cancelled') {
      appointment.cancelledBy = 'physiotherapist';
      appointment.cancellationReason = sessionNotes || 'Cancelled by physiotherapist';
      await SlotLock.deleteMany({ appointmentId: appointment._id });
    } else if (status === 'completed') {
      // Completed appointments retain historical record; release future SlotLock if any
      await SlotLock.deleteMany({ appointmentId: appointment._id });
    }

    await appointment.save();

    if (status === 'completed' || status === 'in_progress') {
      await Notification.create({
        userId: appointment.patientId,
        title:
          status === 'completed' ? 'Treatment Session Completed' : 'Session In Progress',
        message: `${physio.name} updated your session on ${formatDateLabelIST(appointment.date).fullLabel} (${formatTime12h(appointment.startTime)} IST)${sessionNotes ? ' with clinical notes.' : '.'}`,
        type: 'session_update',
        appointmentId: appointment._id,
      });
    }

    const populated = await Appointment.findById(appointment._id)
      .populate('patientId', 'name email phone dateOfBirth gender medicalHistory emergencyContact')
      .populate('treatmentId', 'name category price durationMinutes')
      .lean();

    res.json({ message: 'Session updated.', appointment: populated });
  } catch (err) {
    console.error('[Physio Session Update Error]', err);
    res.status(500).json({ error: 'Failed to update treatment session.' });
  }
});

export default router;
