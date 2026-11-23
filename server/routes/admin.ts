import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { Appointment } from '../models/Appointment';
import { ClinicHoliday } from '../models/ClinicHoliday';
import { Physiotherapist } from '../models/Physiotherapist';
import { SlotLock } from '../models/SlotLock';
import { Treatment } from '../models/Treatment';
import { User } from '../models/User';
import { authenticate, AuthenticatedRequest, requireRole } from '../middleware/auth';
import { addDaysIST, formatDateLabelIST, getNowIST } from '../utils/timezone';
import { cancelBooking, BookingError } from '../services/bookingService';

const router = Router();
router.use(authenticate, requireRole('admin'));

router.get('/analytics', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const [appointments, treatments, physiotherapists, patientCount] = await Promise.all([
      Appointment.find()
        .populate('treatmentId', 'name price category')
        .populate('physiotherapistId', 'name specialization')
        .lean(),
      Treatment.find({ isActive: true }).lean(),
      Physiotherapist.find({ isActive: true }).lean(),
      User.countDocuments({ role: 'patient' }),
    ]);

    let totalRevenue = 0;
    let completedRevenue = 0;
    let confirmedCount = 0;
    let inProgressCount = 0;
    let completedCount = 0;
    let cancelledCount = 0;

    const treatmentMap = new Map<string, { name: string; bookings: number; revenue: number }>();
    const physioMap = new Map<
      string,
      { name: string; bookings: number; completed: number; revenue: number }
    >();
    const dailyMap = new Map<string, { date: string; revenue: number; bookings: number }>();

    const nowIST = getNowIST();
    for (let i = -9; i <= 4; i++) {
      const d = addDaysIST(nowIST.dateStr, i);
      dailyMap.set(d, { date: d, revenue: 0, bookings: 0 });
    }

    for (const appt of appointments) {
      if (appt.status === 'confirmed') confirmedCount++;
      if (appt.status === 'in_progress') inProgressCount++;
      if (appt.status === 'completed') completedCount++;
      if (appt.status === 'cancelled') cancelledCount++;

      const isBillable = appt.status !== 'cancelled';
      if (isBillable) {
        totalRevenue += appt.price;
        if (appt.status === 'completed') {
          completedRevenue += appt.price;
        }

        const tObj = appt.treatmentId as unknown as { _id?: { toString(): string }; name?: string };
        const tName = tObj?.name || 'Treatment';
        const tEntry = treatmentMap.get(tName) || { name: tName, bookings: 0, revenue: 0 };
        tEntry.bookings += 1;
        tEntry.revenue += appt.price;
        treatmentMap.set(tName, tEntry);

        const pObj = appt.physiotherapistId as unknown as { name?: string };
        const pName = pObj?.name || 'Specialist';
        const pEntry = physioMap.get(pName) || {
          name: pName,
          bookings: 0,
          completed: 0,
          revenue: 0,
        };
        pEntry.bookings += 1;
        if (appt.status === 'completed') pEntry.completed += 1;
        pEntry.revenue += appt.price;
        physioMap.set(pName, pEntry);

        if (dailyMap.has(appt.date)) {
          const dayRow = dailyMap.get(appt.date)!;
          dayRow.revenue += appt.price;
          dayRow.bookings += 1;
        }
      }
    }

    const revenueByDay = Array.from(dailyMap.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((row) => ({
        ...row,
        label: `${formatDateLabelIST(row.date).dayNum} ${formatDateLabelIST(row.date).monthShort}`,
      }));

    res.json({
      summary: {
        totalRevenue,
        completedRevenue,
        totalAppointments: appointments.length,
        confirmedCount,
        inProgressCount,
        completedCount,
        cancelledCount,
        totalPatients: patientCount,
        totalPhysiotherapists: physiotherapists.length,
        activeTreatments: treatments.length,
      },
      revenueByDay,
      byTreatment: Array.from(treatmentMap.values()).sort((a, b) => b.revenue - a.revenue),
      byPhysiotherapist: Array.from(physioMap.values()).sort((a, b) => b.bookings - a.bookings),
      statusBreakdown: [
        { status: 'Confirmed', count: confirmedCount },
        { status: 'In Progress', count: inProgressCount },
        { status: 'Completed', count: completedCount },
        { status: 'Cancelled', count: cancelledCount },
      ],
    });
  } catch (err) {
    console.error('[Admin Analytics Error]', err);
    res.status(500).json({ error: 'Failed to load clinic analytics.' });
  }
});

// Patients management
router.get('/patients', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const patients = await User.find({ role: 'patient' })
      .select('-passwordHash')
      .sort({ createdAt: -1 })
      .lean();

    const appts = await Appointment.find().select('patientId status price').lean();
    const statsMap = new Map<string, { totalBookings: number; totalSpent: number }>();

    for (const a of appts) {
      const pid = a.patientId.toString();
      const entry = statsMap.get(pid) || { totalBookings: 0, totalSpent: 0 };
      entry.totalBookings += 1;
      if (a.status !== 'cancelled') entry.totalSpent += a.price;
      statsMap.set(pid, entry);
    }

    const enriched = patients.map((p) => ({
      ...p,
      id: p._id.toString(),
      ...(statsMap.get(p._id.toString()) || { totalBookings: 0, totalSpent: 0 }),
    }));

    res.json({ patients: enriched });
  } catch (err) {
    console.error('[Admin Patients Error]', err);
    res.status(500).json({ error: 'Failed to fetch patients.' });
  }
});

router.patch('/patients/:id/status', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { isActive } = req.body;
    const updated = await User.findOneAndUpdate(
      { _id: req.params.id, role: 'patient' },
      { $set: { isActive: Boolean(isActive) } },
      { new: true }
    )
      .select('-passwordHash')
      .lean();

    if (!updated) {
      res.status(404).json({ error: 'Patient not found.' });
      return;
    }

    res.json({ patient: updated });
  } catch (err) {
    console.error('[Admin Patient Status Error]', err);
    res.status(500).json({ error: 'Failed to update patient status.' });
  }
});

// Treatments CRUD
router.get('/treatments', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const treatments = await Treatment.find().sort({ createdAt: -1 }).lean();
    res.json({ treatments });
  } catch (err) {
    console.error('[Admin Treatments Error]', err);
    res.status(500).json({ error: 'Failed to fetch treatments.' });
  }
});

router.post('/treatments', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, category, description, price, durationMinutes, imageUrl, highlights } =
      req.body;

    if (!name || !category || !description || price === undefined) {
      res.status(400).json({ error: 'Name, category, description, and price are required.' });
      return;
    }

    const dur = Number(durationMinutes || 30);
    if (dur < 30 || dur % 30 !== 0 || dur > 120) {
      res.status(400).json({ error: 'Duration must be 30, 60, 90, or 120 minutes.' });
      return;
    }

    const treatment = await Treatment.create({
      name: String(name).trim(),
      category: String(category).trim(),
      description: String(description).trim(),
      price: Number(price),
      durationMinutes: dur,
      imageUrl:
        imageUrl || '/src/assets/images/treatment_orthopedic_spine_1794932747804.jpg',
      highlights: Array.isArray(highlights)
        ? highlights
        : typeof highlights === 'string'
        ? highlights.split(',').map((s) => s.trim()).filter(Boolean)
        : [],
      isActive: true,
    });

    res.status(201).json({ treatment });
  } catch (err) {
    console.error('[Admin Create Treatment Error]', err);
    res.status(500).json({ error: 'Failed to create treatment.' });
  }
});

router.put('/treatments/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, category, description, price, durationMinutes, imageUrl, highlights, isActive } =
      req.body;

    const dur = durationMinutes !== undefined ? Number(durationMinutes) : undefined;
    if (dur !== undefined && (dur < 30 || dur % 30 !== 0 || dur > 120)) {
      res.status(400).json({ error: 'Duration must be 30, 60, 90, or 120 minutes.' });
      return;
    }

    const updateFields: Record<string, unknown> = {};
    if (name !== undefined) updateFields.name = String(name).trim();
    if (category !== undefined) updateFields.category = String(category).trim();
    if (description !== undefined) updateFields.description = String(description).trim();
    if (price !== undefined) updateFields.price = Number(price);
    if (dur !== undefined) updateFields.durationMinutes = dur;
    if (imageUrl !== undefined) updateFields.imageUrl = imageUrl;
    if (isActive !== undefined) updateFields.isActive = Boolean(isActive);
    if (highlights !== undefined) {
      updateFields.highlights = Array.isArray(highlights)
        ? highlights
        : String(highlights)
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
    }

    const updated = await Treatment.findByIdAndUpdate(
      req.params.id,
      { $set: updateFields },
      { new: true }
    ).lean();

    if (!updated) {
      res.status(404).json({ error: 'Treatment not found.' });
      return;
    }

    res.json({ treatment: updated });
  } catch (err) {
    console.error('[Admin Update Treatment Error]', err);
    res.status(500).json({ error: 'Failed to update treatment.' });
  }
});

router.delete('/treatments/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const updated = await Treatment.findByIdAndUpdate(
      req.params.id,
      { $set: { isActive: false } },
      { new: true }
    ).lean();
    if (!updated) {
      res.status(404).json({ error: 'Treatment not found.' });
      return;
    }
    res.json({ message: 'Treatment deactivated.', treatment: updated });
  } catch (err) {
    console.error('[Admin Delete Treatment Error]', err);
    res.status(500).json({ error: 'Failed to remove treatment.' });
  }
});

// Physiotherapists & Schedules CRUD
router.get('/physiotherapists', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const physiotherapists = await Physiotherapist.find()
      .populate('treatmentIds', 'name category price durationMinutes')
      .sort({ createdAt: -1 })
      .lean();
    res.json({ physiotherapists });
  } catch (err) {
    console.error('[Admin Physio List Error]', err);
    res.status(500).json({ error: 'Failed to fetch physiotherapists.' });
  }
});

router.post('/physiotherapists', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      name,
      email,
      password,
      phone,
      specialization,
      qualifications,
      experienceYears,
      bio,
      imageUrl,
      treatmentIds,
      weeklySchedule,
    } = req.body;

    if (!name || !email || !password || !specialization || !qualifications) {
      res.status(400).json({
        error: 'Name, email, password, specialization, and qualifications are required.',
      });
      return;
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      res.status(409).json({ error: 'A user with this email already exists.' });
      return;
    }

    const passwordHash = await bcrypt.hash(String(password), 10);
    const user = await User.create({
      name: String(name).trim(),
      email: normalizedEmail,
      passwordHash,
      role: 'physiotherapist',
      phone: phone || '',
    });

    const defaultSchedule = [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
      dayOfWeek,
      isWorking: dayOfWeek !== 0,
      startTime: '09:00',
      endTime: '18:00',
      breakStart: '13:00',
      breakEnd: '14:00',
    }));

    const physio = await Physiotherapist.create({
      userId: user._id,
      name: String(name).trim(),
      email: normalizedEmail,
      specialization: String(specialization).trim(),
      qualifications: String(qualifications).trim(),
      experienceYears: Number(experienceYears || 3),
      bio: bio || '',
      imageUrl: imageUrl || '/src/assets/images/physio_dr_rohan_1794932749842.jpg',
      treatmentIds: Array.isArray(treatmentIds) ? treatmentIds : [],
      weeklySchedule:
        Array.isArray(weeklySchedule) && weeklySchedule.length === 7
          ? weeklySchedule
          : defaultSchedule,
      unavailableDates: [],
      isActive: true,
    });

    const populated = await Physiotherapist.findById(physio._id)
      .populate('treatmentIds', 'name category price durationMinutes')
      .lean();

    res.status(201).json({ physiotherapist: populated });
  } catch (err) {
    console.error('[Admin Create Physio Error]', err);
    res.status(500).json({ error: 'Failed to create physiotherapist.' });
  }
});

router.put('/physiotherapists/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      name,
      specialization,
      qualifications,
      experienceYears,
      bio,
      imageUrl,
      treatmentIds,
      weeklySchedule,
      unavailableDates,
      isActive,
    } = req.body;

    const physio = await Physiotherapist.findById(req.params.id);
    if (!physio) {
      res.status(404).json({ error: 'Physiotherapist not found.' });
      return;
    }

    if (name !== undefined) {
      physio.name = String(name).trim();
      await User.findByIdAndUpdate(physio.userId, { $set: { name: physio.name } });
    }
    if (specialization !== undefined) physio.specialization = String(specialization).trim();
    if (qualifications !== undefined) physio.qualifications = String(qualifications).trim();
    if (experienceYears !== undefined) physio.experienceYears = Number(experienceYears);
    if (bio !== undefined) physio.bio = String(bio);
    if (imageUrl !== undefined) physio.imageUrl = String(imageUrl);
    if (Array.isArray(treatmentIds)) physio.treatmentIds = treatmentIds;
    if (Array.isArray(weeklySchedule) && weeklySchedule.length === 7) {
      physio.weeklySchedule = weeklySchedule;
    }
    if (Array.isArray(unavailableDates)) {
      physio.unavailableDates = Array.from(
        new Set(unavailableDates.map((d) => String(d).trim()).filter(Boolean))
      ).sort();
    }
    if (isActive !== undefined) {
      physio.isActive = Boolean(isActive);
      await User.findByIdAndUpdate(physio.userId, { $set: { isActive: physio.isActive } });
    }

    await physio.save();

    const populated = await Physiotherapist.findById(physio._id)
      .populate('treatmentIds', 'name category price durationMinutes')
      .lean();

    res.json({ physiotherapist: populated });
  } catch (err) {
    console.error('[Admin Update Physio Error]', err);
    res.status(500).json({ error: 'Failed to update physiotherapist.' });
  }
});

// Holidays management
router.get('/holidays', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const holidays = await ClinicHoliday.find().sort({ date: 1 }).lean();
    res.json({ holidays });
  } catch (err) {
    console.error('[Admin Holidays Error]', err);
    res.status(500).json({ error: 'Failed to fetch holidays.' });
  }
});

router.post('/holidays', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { date, title, description } = req.body;
    if (!date || !title) {
      res.status(400).json({ error: 'Holiday date and title are required.' });
      return;
    }

    const existing = await ClinicHoliday.findOne({ date: String(date) });
    if (existing) {
      res.status(409).json({ error: 'A clinic holiday already exists for this date.' });
      return;
    }

    const holiday = await ClinicHoliday.create({
      date: String(date),
      title: String(title).trim(),
      description: description ? String(description).trim() : '',
    });

    res.status(201).json({ holiday });
  } catch (err) {
    console.error('[Admin Create Holiday Error]', err);
    res.status(500).json({ error: 'Failed to create holiday.' });
  }
});

router.delete('/holidays/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    await ClinicHoliday.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('[Admin Delete Holiday Error]', err);
    res.status(500).json({ error: 'Failed to delete holiday.' });
  }
});

// Appointments management
router.get('/appointments', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const appointments = await Appointment.find()
      .populate('patientId', 'name email phone')
      .populate('physiotherapistId', 'name specialization')
      .populate('treatmentId', 'name category price durationMinutes')
      .sort({ date: -1, startTime: -1 })
      .lean();

    res.json({ appointments });
  } catch (err) {
    console.error('[Admin Appointments Error]', err);
    res.status(500).json({ error: 'Failed to fetch appointments.' });
  }
});

router.patch('/appointments/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status, reason } = req.body;
    if (status === 'cancelled') {
      const cancelled = await cancelBooking({
        appointmentId: req.params.id,
        actorUserId: req.user!.userId,
        actorRole: 'admin',
        reason: reason || 'Cancelled by clinic administrator',
      });
      const populated = await Appointment.findById(cancelled._id)
        .populate('patientId', 'name email phone')
        .populate('physiotherapistId', 'name specialization')
        .populate('treatmentId', 'name category price durationMinutes')
        .lean();
      res.json({ appointment: populated });
      return;
    }

    const appt = await Appointment.findById(req.params.id);
    if (!appt) {
      res.status(404).json({ error: 'Appointment not found.' });
      return;
    }
    if (status) {
      appt.status = status;
      if (status === 'completed') {
        await SlotLock.deleteMany({ appointmentId: appt._id });
      }
      await appt.save();
    }

    const populated = await Appointment.findById(appt._id)
      .populate('patientId', 'name email phone')
      .populate('physiotherapistId', 'name specialization')
      .populate('treatmentId', 'name category price durationMinutes')
      .lean();
    res.json({ appointment: populated });
  } catch (err) {
    if (err instanceof BookingError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    console.error('[Admin Update Appointment Error]', err);
    res.status(500).json({ error: 'Failed to update appointment.' });
  }
});

export default router;
