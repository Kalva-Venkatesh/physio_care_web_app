import mongoose, { Types } from 'mongoose';
import { Appointment, IAppointment } from '../models/Appointment';
import { ClinicHoliday } from '../models/ClinicHoliday';
import { Notification } from '../models/Notification';
import { Physiotherapist } from '../models/Physiotherapist';
import { SlotLock } from '../models/SlotLock';
import { Treatment } from '../models/Treatment';
import {
  addDaysIST,
  buildSlotKeys,
  formatDateLabelIST,
  formatTime12h,
  generateAvailableSlotsForDay,
  getNowIST,
  minutesToTime,
  parseDateToDayOfWeekIST,
  timeToMinutes,
} from '../utils/timezone';

export class BookingError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

export async function getWeeklyAvailability(params: {
  physiotherapistId: string;
  treatmentId?: string;
  startDate?: string;
  days?: number;
  excludeAppointmentId?: string;
}) {
  const { physiotherapistId, treatmentId, startDate, days = 7, excludeAppointmentId } = params;

  const physio = await Physiotherapist.findById(physiotherapistId);
  if (!physio || !physio.isActive) {
    throw new BookingError('Physiotherapist not found or inactive.', 404);
  }

  let durationMinutes = 30;
  if (treatmentId) {
    const treatment = await Treatment.findById(treatmentId);
    if (!treatment || !treatment.isActive) {
      throw new BookingError('Treatment not found or inactive.', 404);
    }
    const isAssigned = physio.treatmentIds.some((id) => id.toString() === treatmentId);
    if (!isAssigned) {
      throw new BookingError(
        `${physio.name} does not currently offer ${treatment.name}.`,
        400
      );
    }
    durationMinutes = treatment.durationMinutes;
  }

  const nowIST = getNowIST();
  const baseDate = startDate && startDate >= nowIST.dateStr ? startDate : nowIST.dateStr;
  const clampedDays = Math.min(Math.max(days, 1), 14);

  const dateList: string[] = [];
  for (let i = 0; i < clampedDays; i++) {
    dateList.push(addDaysIST(baseDate, i));
  }

  const [holidays, locks] = await Promise.all([
    ClinicHoliday.find({ date: { $in: dateList } }).lean(),
    SlotLock.find({
      physiotherapistId: physio._id,
      date: { $in: dateList },
      ...(excludeAppointmentId
        ? { appointmentId: { $ne: new mongoose.Types.ObjectId(excludeAppointmentId) } }
        : {}),
    }).lean(),
  ]);

  const holidayMap = new Map<string, string>();
  holidays.forEach((h) => holidayMap.set(h.date, h.title));

  const unavailableSet = new Set(physio.unavailableDates || []);

  const locksByDate = new Map<string, Set<string>>();
  locks.forEach((lock) => {
    if (!locksByDate.has(lock.date)) {
      locksByDate.set(lock.date, new Set());
    }
    locksByDate.get(lock.date)!.add(lock.slotTime);
  });

  const calendar = dateList.map((dateStr) => {
    const dayOfWeek = parseDateToDayOfWeekIST(dateStr);
    const daySchedule = physio.weeklySchedule.find((s) => s.dayOfWeek === dayOfWeek);
    const bookedSlotSet = locksByDate.get(dateStr) ?? new Set<string>();
    const holidayTitle = holidayMap.get(dateStr);
    const isPhysioUnavailable = unavailableSet.has(dateStr);

    const generated = generateAvailableSlotsForDay({
      dateStr,
      schedule: daySchedule,
      bookedSlotSet,
      holidayTitle,
      isPhysioUnavailable,
      durationMinutes,
      nowIST,
    });

    const labels = formatDateLabelIST(dateStr);

    return {
      date: dateStr,
      dayOfWeek,
      ...labels,
      isToday: dateStr === nowIST.dateStr,
      status: generated.status,
      reason: generated.reason,
      workingHours:
        daySchedule && daySchedule.isWorking
          ? `${formatTime12h(daySchedule.startTime)} – ${formatTime12h(daySchedule.endTime)}`
          : null,
      breakHours:
        daySchedule && daySchedule.isWorking && daySchedule.breakStart && daySchedule.breakEnd
          ? `${formatTime12h(daySchedule.breakStart)} – ${formatTime12h(daySchedule.breakEnd)}`
          : null,
      slots: generated.slots,
    };
  });

  return {
    timezone: 'Asia/Kolkata',
    todayIST: nowIST.dateStr,
    currentTimeIST: nowIST.timeStr,
    durationMinutes,
    physiotherapistId: physio._id.toString(),
    physiotherapistName: physio.name,
    calendar,
  };
}

function generateBookingCode(): string {
  const num = Math.floor(100000 + Math.random() * 900000);
  const year = getNowIST().dateStr.slice(0, 4);
  return `PC-${year}-${num}`;
}

async function acquireSlotLocksAtomically(params: {
  physiotherapistId: Types.ObjectId;
  date: string;
  slotKeys: string[];
  appointmentId: Types.ObjectId;
}): Promise<string[]> {
  const insertedKeys: string[] = [];
  try {
    for (const slotTime of params.slotKeys) {
      await SlotLock.create({
        physiotherapistId: params.physiotherapistId,
        date: params.date,
        slotTime,
        appointmentId: params.appointmentId,
      });
      insertedKeys.push(slotTime);
    }
    return insertedKeys;
  } catch (err: unknown) {
    if (insertedKeys.length > 0) {
      await SlotLock.deleteMany({
        physiotherapistId: params.physiotherapistId,
        date: params.date,
        slotTime: { $in: insertedKeys },
        appointmentId: params.appointmentId,
      });
    }
    const mongoErr = err as { code?: number };
    if (mongoErr?.code === 11000) {
      throw new BookingError(
        'This time slot was just reserved by another patient. Please select a different slot.',
        409
      );
    }
    throw err;
  }
}

export async function createAtomicBooking(params: {
  patientId: string;
  physiotherapistId: string;
  treatmentId: string;
  date: string;
  startTime: string;
  patientNotes?: string;
}): Promise<IAppointment> {
  const { patientId, physiotherapistId, treatmentId, date, startTime, patientNotes } = params;

  const [physio, treatment] = await Promise.all([
    Physiotherapist.findById(physiotherapistId),
    Treatment.findById(treatmentId),
  ]);

  if (!physio || !physio.isActive) {
    throw new BookingError('Selected physiotherapist is unavailable.', 404);
  }
  if (!treatment || !treatment.isActive) {
    throw new BookingError('Selected treatment is unavailable.', 404);
  }

  const assigned = physio.treatmentIds.some((id) => id.toString() === treatmentId);
  if (!assigned) {
    throw new BookingError(
      `${physio.name} is not assigned to perform ${treatment.name}.`,
      400
    );
  }

  const availability = await getWeeklyAvailability({
    physiotherapistId,
    treatmentId,
    startDate: date,
    days: 1,
  });

  const dayEntry = availability.calendar[0];
  if (!dayEntry || dayEntry.status !== 'open') {
    throw new BookingError(
      dayEntry?.reason
        ? `Cannot book on ${date}: ${dayEntry.reason}.`
        : 'Selected date is unavailable.',
      400
    );
  }

  const matchingSlot = dayEntry.slots.find((s) => s.time === startTime);
  if (!matchingSlot) {
    throw new BookingError(
      'Selected 30-minute time slot is no longer available or falls outside clinic hours.',
      409
    );
  }

  const appointmentId = new mongoose.Types.ObjectId();
  const slotKeys = buildSlotKeys(startTime, treatment.durationMinutes);
  const endTime = minutesToTime(timeToMinutes(startTime) + treatment.durationMinutes);

  // Step 1: Atomically lock all consecutive 30-min slots via unique index
  await acquireSlotLocksAtomically({
    physiotherapistId: physio._id,
    date,
    slotKeys,
    appointmentId,
  });

  // Step 2: Persist auto-confirmed appointment
  try {
    const appointment = await Appointment.create({
      _id: appointmentId,
      bookingCode: generateBookingCode(),
      patientId: new mongoose.Types.ObjectId(patientId),
      physiotherapistId: physio._id,
      treatmentId: treatment._id,
      date,
      startTime,
      endTime,
      durationMinutes: treatment.durationMinutes,
      slotKeys,
      status: 'confirmed',
      price: treatment.price,
      patientNotes: patientNotes?.trim() || '',
    });

    await Promise.all([
      Notification.create({
        userId: new mongoose.Types.ObjectId(patientId),
        title: 'Appointment Confirmed',
        message: `Your ${treatment.name} session with ${physio.name} is confirmed for ${formatDateLabelIST(date).fullLabel} at ${formatTime12h(startTime)} IST (${appointment.bookingCode}).`,
        type: 'booking',
        appointmentId: appointment._id,
      }),
      Notification.create({
        userId: physio.userId,
        title: 'New Appointment Scheduled',
        message: `New ${treatment.name} booking on ${formatDateLabelIST(date).fullLabel} at ${formatTime12h(startTime)} IST (${appointment.bookingCode}).`,
        type: 'booking',
        appointmentId: appointment._id,
      }),
    ]);

    return appointment;
  } catch (err) {
    // Rollback slot locks if appointment creation fails
    await SlotLock.deleteMany({ appointmentId });
    throw err;
  }
}

export async function rescheduleAtomicBooking(params: {
  appointmentId: string;
  actorUserId: string;
  actorRole: string;
  newDate: string;
  newStartTime: string;
}): Promise<IAppointment> {
  const { appointmentId, actorUserId, actorRole, newDate, newStartTime } = params;

  const appointment = await Appointment.findById(appointmentId);
  if (!appointment) {
    throw new BookingError('Appointment not found.', 404);
  }

  if (actorRole === 'patient' && appointment.patientId.toString() !== actorUserId) {
    throw new BookingError('You do not have permission to reschedule this appointment.', 403);
  }

  if (appointment.status !== 'confirmed') {
    throw new BookingError(
      `Only confirmed appointments can be rescheduled (current status: ${appointment.status}).`,
      400
    );
  }

  if (appointment.date === newDate && appointment.startTime === newStartTime) {
    throw new BookingError('Please choose a different date or time slot to reschedule.', 400);
  }

  const physio = await Physiotherapist.findById(appointment.physiotherapistId);
  const treatment = await Treatment.findById(appointment.treatmentId);
  if (!physio || !treatment) {
    throw new BookingError('Associated specialist or treatment not found.', 404);
  }

  const availability = await getWeeklyAvailability({
    physiotherapistId: physio._id.toString(),
    treatmentId: treatment._id.toString(),
    startDate: newDate,
    days: 1,
    excludeAppointmentId: appointment._id.toString(),
  });

  const dayEntry = availability.calendar[0];
  if (!dayEntry || dayEntry.status !== 'open') {
    throw new BookingError(
      dayEntry?.reason ? `Cannot reschedule to ${newDate}: ${dayEntry.reason}.` : 'Date unavailable.',
      400
    );
  }

  const matchingSlot = dayEntry.slots.find((s) => s.time === newStartTime);
  if (!matchingSlot) {
    throw new BookingError('Selected reschedule time slot is not available.', 409);
  }

  const newSlotKeys = buildSlotKeys(newStartTime, appointment.durationMinutes);
  const newEndTime = minutesToTime(timeToMinutes(newStartTime) + appointment.durationMinutes);

  const isSameDate = appointment.date === newDate;
  const oldSlotKeys = appointment.slotKeys;

  const keysToAcquire = isSameDate
    ? newSlotKeys.filter((k) => !oldSlotKeys.includes(k))
    : newSlotKeys;

  const keysToRelease = isSameDate
    ? oldSlotKeys.filter((k) => !newSlotKeys.includes(k))
    : oldSlotKeys;

  // Step 1: Acquire new non-overlapping locks atomically
  if (keysToAcquire.length > 0) {
    await acquireSlotLocksAtomically({
      physiotherapistId: physio._id,
      date: newDate,
      slotKeys: keysToAcquire,
      appointmentId: appointment._id,
    });
  }

  // Step 2: Update appointment record
  const previousDate = appointment.date;
  const previousStart = appointment.startTime;

  try {
    appointment.date = newDate;
    appointment.startTime = newStartTime;
    appointment.endTime = newEndTime;
    appointment.slotKeys = newSlotKeys;
    appointment.rescheduledCount = (appointment.rescheduledCount || 0) + 1;
    await appointment.save();
  } catch (err) {
    // Rollback newly acquired locks on failure
    if (keysToAcquire.length > 0) {
      await SlotLock.deleteMany({
        physiotherapistId: physio._id,
        date: newDate,
        slotTime: { $in: keysToAcquire },
        appointmentId: appointment._id,
      });
    }
    throw err;
  }

  // Step 3: Release obsolete old slot locks so they immediately become available
  if (keysToRelease.length > 0) {
    await SlotLock.deleteMany({
      physiotherapistId: physio._id,
      date: previousDate,
      slotTime: { $in: keysToRelease },
      appointmentId: appointment._id,
    });
  }

  await Promise.all([
    Notification.create({
      userId: appointment.patientId,
      title: 'Appointment Rescheduled',
      message: `Booking ${appointment.bookingCode} moved from ${formatDateLabelIST(previousDate).fullLabel} ${formatTime12h(previousStart)} to ${formatDateLabelIST(newDate).fullLabel} at ${formatTime12h(newStartTime)} IST.`,
      type: 'reschedule',
      appointmentId: appointment._id,
    }),
    Notification.create({
      userId: physio.userId,
      title: 'Appointment Rescheduled',
      message: `Patient rescheduled ${appointment.bookingCode} to ${formatDateLabelIST(newDate).fullLabel} at ${formatTime12h(newStartTime)} IST.`,
      type: 'reschedule',
      appointmentId: appointment._id,
    }),
  ]);

  return appointment;
}

export async function cancelBooking(params: {
  appointmentId: string;
  actorUserId: string;
  actorRole: string;
  reason?: string;
}): Promise<IAppointment> {
  const { appointmentId, actorUserId, actorRole, reason } = params;

  const appointment = await Appointment.findById(appointmentId);
  if (!appointment) {
    throw new BookingError('Appointment not found.', 404);
  }

  const physio = await Physiotherapist.findById(appointment.physiotherapistId);

  if (actorRole === 'patient' && appointment.patientId.toString() !== actorUserId) {
    throw new BookingError('You cannot cancel another patient’s appointment.', 403);
  }
  if (
    actorRole === 'physiotherapist' &&
    (!physio || physio.userId.toString() !== actorUserId)
  ) {
    throw new BookingError('You can only cancel your own assigned appointments.', 403);
  }

  if (appointment.status === 'cancelled') {
    throw new BookingError('Appointment is already cancelled.', 400);
  }
  if (appointment.status === 'completed') {
    throw new BookingError('Completed appointments cannot be cancelled.', 400);
  }

  appointment.status = 'cancelled';
  appointment.cancelledBy = actorRole;
  appointment.cancellationReason = reason?.trim() || `Cancelled by ${actorRole}`;
  await appointment.save();

  // Immediately release locked slots back into availability pool
  await SlotLock.deleteMany({ appointmentId: appointment._id });

  const notifs = [
    Notification.create({
      userId: appointment.patientId,
      title: 'Appointment Cancelled',
      message: `Booking ${appointment.bookingCode} on ${formatDateLabelIST(appointment.date).fullLabel} at ${formatTime12h(appointment.startTime)} IST has been cancelled.`,
      type: 'cancellation',
      appointmentId: appointment._id,
    }),
  ];

  if (physio) {
    notifs.push(
      Notification.create({
        userId: physio.userId,
        title: 'Appointment Cancelled',
        message: `Booking ${appointment.bookingCode} on ${formatDateLabelIST(appointment.date).fullLabel} at ${formatTime12h(appointment.startTime)} IST was cancelled.`,
        type: 'cancellation',
        appointmentId: appointment._id,
      })
    );
  }

  await Promise.all(notifs);

  return appointment;
}
