import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { Appointment } from './models/Appointment';
import { ClinicHoliday } from './models/ClinicHoliday';
import { Notification } from './models/Notification';
import { Physiotherapist, IWeeklyDaySchedule } from './models/Physiotherapist';
import { SlotLock } from './models/SlotLock';
import { Treatment } from './models/Treatment';
import { User } from './models/User';
import { addDaysIST, buildSlotKeys, getNowIST, minutesToTime, parseDateToDayOfWeekIST, timeToMinutes } from './utils/timezone';

function buildStandardSchedule(options?: {
  offDays?: number[];
  startTime?: string;
  endTime?: string;
  breakStart?: string;
  breakEnd?: string;
}): IWeeklyDaySchedule[] {
  const offDays = options?.offDays ?? [0]; // Sunday off by default
  const startTime = options?.startTime ?? '09:00';
  const endTime = options?.endTime ?? '18:00';
  const breakStart = options?.breakStart ?? '13:00';
  const breakEnd = options?.breakEnd ?? '14:00';

  return [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
    dayOfWeek,
    isWorking: !offDays.includes(dayOfWeek),
    startTime,
    endTime,
    breakStart,
    breakEnd,
  }));
}

export async function seedDatabaseIfEmpty(): Promise<void> {
  const existingUsers = await User.countDocuments();
  if (existingUsers > 0) {
    return;
  }

  console.log('[Seed] Initializing PhysioCare database with baseline clinic data...');

  const [adminHash, physioHash, patientHash] = await Promise.all([
    bcrypt.hash('Admin@123', 10),
    bcrypt.hash('Physio@123', 10),
    bcrypt.hash('Patient@123', 10),
  ]);

  // 1. Seed Users (1 Admin, 3 Physiotherapists, 2 Patients)
  const adminUser = await User.create({
    name: 'Vikram Deshmukh',
    email: 'admin@physiocare.in',
    passwordHash: adminHash,
    role: 'admin',
    phone: '+91 98201 11223',
    address: 'PhysioCare Central Clinic, Indiranagar, Bengaluru',
  });

  const [lakshmiUser, rohanUser, priyaUser] = await User.create([
    {
      name: 'Dr. Lakshmi Rao',
      email: 'lakshmi@physiocare.in',
      passwordHash: physioHash,
      role: 'physiotherapist',
      phone: '+91 98450 22334',
      address: 'Indiranagar, Bengaluru',
    },
    {
      name: 'Dr. Rohit Sharma',
      email: 'rohan@physiocare.in',
      passwordHash: physioHash,
      role: 'physiotherapist',
      phone: '+91 98450 33445',
      address: 'Koramangala, Bengaluru',
    },
    {
      name: 'Dr. Priya Sharma',
      email: 'priya@physiocare.in',
      passwordHash: physioHash,
      role: 'physiotherapist',
      phone: '+91 98450 44556',
      address: 'Jayanagar, Bengaluru',
    },
  ]);

  const [patientAarav, patientSneha] = await User.create([
    {
      name: 'Aarav Kulkarni',
      email: 'aarav@example.com',
      passwordHash: patientHash,
      role: 'patient',
      phone: '+91 99001 55667',
      dateOfBirth: '1994-06-14',
      gender: 'Male',
      address: 'HSR Layout Sector 2, Bengaluru',
      medicalHistory: 'Mild L4-L5 lumbar disc bulge; sedentary desk posture.',
      emergencyContact: 'Meera Kulkarni (+91 99001 55668)',
    },
    {
      name: 'Sneha Nair',
      email: 'sneha@example.com',
      passwordHash: patientHash,
      role: 'patient',
      phone: '+91 97412 88990',
      dateOfBirth: '1991-11-03',
      gender: 'Female',
      address: 'Domlur 2nd Stage, Bengaluru',
      medicalHistory: 'Right ACL reconstruction recovery (Week 10 post-op).',
      emergencyContact: 'Karthik Nair (+91 97412 88991)',
    },
  ]);

  // 2. Seed Treatments
  const treatments = await Treatment.create([
    {
      name: 'Orthopedic & Spine Rehabilitation',
      category: 'Spine & Posture',
      description:
        'Targeted spinal decompression, lumbar stabilization, and ergonomic posture correction for chronic neck, back, and sciatic pain.',
      price: 1200,
      durationMinutes: 30,
      imageUrl: '/src/assets/images/treatment_orthopedic_spine_1794932747804.jpg',
      highlights: ['McKenzie Spine Assessment', 'Core Stabilization Protocol', 'Postural Ergonomics Plan'],
      isActive: true,
    },
    {
      name: 'Sports Injury & Kinesiology Therapy',
      category: 'Sports Rehab',
      description:
        'Biomechanical gait evaluation, ligament recovery, dynamic taping, and return-to-sport strength conditioning for active athletes.',
      price: 1500,
      durationMinutes: 30,
      imageUrl: '/src/assets/images/treatment_sports_therapy_1794932748959.jpg',
      highlights: ['Kinesio Taping & Bracing', 'Isometric Strength Testing', 'Return-to-Play Clearance'],
      isActive: true,
    },
    {
      name: 'Manual Therapy & Myofascial Release',
      category: 'Manual Care',
      description:
        'Hands-on joint mobilization, trigger-point dry needling, and deep myofascial release to restore pain-free range of motion.',
      price: 1400,
      durationMinutes: 30,
      imageUrl: '/src/assets/images/treatment_manual_therapy_1794932748666.jpg',
      highlights: ['Joint Mobilization', 'Trigger Point Release', 'Cervical & Shoulder Relief'],
      isActive: true,
    },
    {
      name: 'Post-Surgical Joint Recovery (Extended)',
      category: 'Post-Op Rehab',
      description:
        'Comprehensive 60-minute progressive rehabilitation following ACL reconstruction, total knee replacement, or rotator cuff repair.',
      price: 2200,
      durationMinutes: 60,
      imageUrl: '/src/assets/images/treatment_joint_rehab_1794932749789.jpg',
      highlights: ['Progressive Resistance Loading', 'Swelling & Scar Management', 'Gait Retraining'],
      isActive: true,
    },
    {
      name: 'Neurological & Balance Physiotherapy',
      category: 'Neuro Rehab',
      description:
        'Evidence-based neuro-motor re-education, vestibular balance training, and functional mobility care for stroke and nerve recovery.',
      price: 1800,
      durationMinutes: 60,
      imageUrl: '/src/assets/images/treatment_orthopedic_spine_1794932747804.jpg',
      highlights: ['Vestibular Balance Drills', 'Functional Gait Support', 'Motor Control Training'],
      isActive: true,
    },
    {
      name: 'Cervical & Desk Ergonomics Assessment',
      category: 'Preventive Care',
      description:
        'Focused 30-minute cervical mobility session combined with personalized workstation adjustments and daily micro-break routines.',
      price: 950,
      durationMinutes: 30,
      imageUrl: '/src/assets/images/treatment_manual_therapy_1794932748666.jpg',
      highlights: ['Neck & Shoulder Mobility', 'Workstation Audit', 'Guided Stretch Routine'],
      isActive: true,
    },
  ]);

  const [tSpine, tSports, tManual, tPostOp, tNeuro, tCervical] = treatments;

  const nowIST = getNowIST();
  const sampleUnavailableDate = addDaysIST(nowIST.dateStr, 5);
  const sampleHolidayDate = addDaysIST(nowIST.dateStr, 10);

  // 3. Seed Physiotherapists with distinct schedules & assigned treatments
  const [physioLakshmi, physioRohan, physioPriya] = await Physiotherapist.create([
    {
      userId: lakshmiUser._id,
      name: 'Dr. Lakshmi Rao',
      email: lakshmiUser.email,
      specialization: 'Senior Orthopedic & Spine Specialist',
      qualifications: 'MPT (Orthopedics), MIAP, Certified McKenzie Therapist',
      experienceYears: 11,
      bio: 'Specializes in non-surgical disc rehabilitation, chronic cervical radiculopathy, and post-operative spine recovery.',
      imageUrl: '/src/assets/images/physio_dr_ananya_1794932748502.jpg',
      treatmentIds: [tSpine._id, tManual._id, tPostOp._id, tCervical._id],
      weeklySchedule: buildStandardSchedule({
        offDays: [0],
        startTime: '09:00',
        endTime: '18:00',
        breakStart: '13:00',
        breakEnd: '14:00',
      }),
      unavailableDates: [sampleUnavailableDate],
      isActive: true,
    },
    {
      userId: rohanUser._id,
      name: 'Dr. Rohit Sharma',
      email: rohanUser.email,
      specialization: 'Sports & Musculoskeletal Physiotherapist',
      qualifications: 'MPT (Sports Medicine), Certified Kinesio Taping Practitioner',
      experienceYears: 8,
      bio: 'Works with marathon runners, badminton players, and post-ACL patients to rebuild biomechanical resilience.',
      imageUrl: '/src/assets/images/physio_dr_rohan_1794932749842.jpg',
      treatmentIds: [tSports._id, tManual._id, tPostOp._id, tSpine._id],
      weeklySchedule: buildStandardSchedule({
        offDays: [0, 3], // Off Sun & Wed
        startTime: '10:00',
        endTime: '19:00',
        breakStart: '13:30',
        breakEnd: '14:30',
      }),
      unavailableDates: [],
      isActive: true,
    },
    {
      userId: priyaUser._id,
      name: 'Dr. Priya Sharma',
      email: priyaUser.email,
      specialization: 'Neurological & Joint Mobility Specialist',
      qualifications: 'MPT (Neurology), NDT Certified Clinician',
      experienceYears: 9,
      bio: 'Dedicated to neuro-motor recovery, vestibular rehabilitation, and structured geriatric balance restoration.',
      imageUrl: '/src/assets/images/physio_dr_meera_1794932750469.jpg',
      treatmentIds: [tNeuro._id, tPostOp._id, tCervical._id, tSpine._id],
      weeklySchedule: buildStandardSchedule({
        offDays: [0, 6], // Mon-Fri
        startTime: '09:30',
        endTime: '17:30',
        breakStart: '13:00',
        breakEnd: '14:00',
      }),
      unavailableDates: [],
      isActive: true,
    },
  ]);

  // 4. Seed Clinic Holiday
  await ClinicHoliday.create({
    date: sampleHolidayDate,
    title: 'Clinic Annual Maintenance & Staff CME',
    description: 'PhysioCare clinic closed for continuing medical education.',
  });

  // 5. Seed Past Completed & Future Confirmed Appointments + SlotLocks
  const seedAppointmentsData = [
    {
      dayOffset: -6,
      startTime: '10:00',
      patient: patientAarav,
      physio: physioLakshmi,
      treatment: tSpine,
      status: 'completed' as const,
      patientNotes: 'Lower back stiffness every morning.',
      sessionNotes: 'Completed McKenzie extension progression. Pain reduced significantly.',
      painScoreBefore: 7,
      painScoreAfter: 3,
      code: 'PC-2026-100101',
    },
    {
      dayOffset: -4,
      startTime: '11:30',
      patient: patientSneha,
      physio: physioRohan,
      treatment: tSports,
      status: 'completed' as const,
      patientNotes: 'Right knee stability check before jogging.',
      sessionNotes: 'Single-leg hop symmetry at 86%. Applied patellar kinesio tape.',
      painScoreBefore: 5,
      painScoreAfter: 2,
      code: 'PC-2026-100102',
    },
    {
      dayOffset: -2,
      startTime: '15:00',
      patient: patientAarav,
      physio: physioLakshmi,
      treatment: tManual,
      status: 'completed' as const,
      patientNotes: 'Upper trapezius tightness after travel.',
      sessionNotes: 'Myofascial release across C7-T4 paraspinal region. Assigned chin-tuck set.',
      painScoreBefore: 6,
      painScoreAfter: 2,
      code: 'PC-2026-100103',
    },
    {
      dayOffset: -1,
      startTime: '16:00',
      patient: patientSneha,
      physio: physioPriya,
      treatment: tNeuro,
      status: 'completed' as const,
      patientNotes: 'Balance and proprioception follow-up.',
      sessionNotes: 'Closed-eye tandem stance improved from 12s to 28s.',
      painScoreBefore: 4,
      painScoreAfter: 1,
      code: 'PC-2026-100104',
    },
    {
      dayOffset: -3,
      startTime: '12:00',
      patient: patientAarav,
      physio: physioRohan,
      treatment: tCervical,
      status: 'cancelled' as const,
      patientNotes: 'Desk posture follow-up.',
      sessionNotes: '',
      code: 'PC-2026-100105',
    },
  ];

  for (const item of seedAppointmentsData) {
    const dateStr = addDaysIST(nowIST.dateStr, item.dayOffset);
    const slotKeys = buildSlotKeys(item.startTime, item.treatment.durationMinutes);
    const endTime = minutesToTime(timeToMinutes(item.startTime) + item.treatment.durationMinutes);

    await Appointment.create({
      bookingCode: item.code,
      patientId: item.patient._id,
      physiotherapistId: item.physio._id,
      treatmentId: item.treatment._id,
      date: dateStr,
      startTime: item.startTime,
      endTime,
      durationMinutes: item.treatment.durationMinutes,
      slotKeys,
      status: item.status,
      price: item.treatment.price,
      patientNotes: item.patientNotes,
      sessionNotes: item.sessionNotes,
      painScoreBefore: item.painScoreBefore,
      painScoreAfter: item.painScoreAfter,
      cancelledBy: item.status === 'cancelled' ? 'patient' : undefined,
      cancellationReason: item.status === 'cancelled' ? 'Travel schedule conflict' : undefined,
    });
  }

  // Seed 2 upcoming confirmed appointments on working days (with real SlotLocks!)
  const findNextWorkingDay = (physio: typeof physioLakshmi, startOffset: number): string => {
    for (let offset = startOffset; offset < 14; offset++) {
      const candidate = addDaysIST(nowIST.dateStr, offset);
      if (candidate === sampleHolidayDate) continue;
      if (physio.unavailableDates.includes(candidate)) continue;
      const dow = parseDateToDayOfWeekIST(candidate);
      const sched = physio.weeklySchedule.find((s) => s.dayOfWeek === dow);
      if (sched?.isWorking) return candidate;
    }
    return addDaysIST(nowIST.dateStr, 1);
  };

  const upcomingDate1 = findNextWorkingDay(physioLakshmi, 1);
  const upcomingDate2 = findNextWorkingDay(physioRohan, 2);

  const upcomingSeeds = [
    {
      date: upcomingDate1,
      startTime: '10:30',
      patient: patientAarav,
      physio: physioLakshmi,
      treatment: tSpine,
      notes: 'Follow-up lumbar mobility progression.',
      code: 'PC-2026-100201',
    },
    {
      date: upcomingDate2,
      startTime: '11:00',
      patient: patientSneha,
      physio: physioRohan,
      treatment: tPostOp,
      notes: 'Week 11 ACL strength progression & step-down test.',
      code: 'PC-2026-100202',
    },
  ];

  for (const up of upcomingSeeds) {
    const apptId = new mongoose.Types.ObjectId();
    const slotKeys = buildSlotKeys(up.startTime, up.treatment.durationMinutes);
    const endTime = minutesToTime(timeToMinutes(up.startTime) + up.treatment.durationMinutes);

    await Appointment.create({
      _id: apptId,
      bookingCode: up.code,
      patientId: up.patient._id,
      physiotherapistId: up.physio._id,
      treatmentId: up.treatment._id,
      date: up.date,
      startTime: up.startTime,
      endTime,
      durationMinutes: up.treatment.durationMinutes,
      slotKeys,
      status: 'confirmed',
      price: up.treatment.price,
      patientNotes: up.notes,
    });

    for (const slotTime of slotKeys) {
      await SlotLock.create({
        physiotherapistId: up.physio._id,
        date: up.date,
        slotTime,
        appointmentId: apptId,
      });
    }
  }

  // Welcome notifications
  await Notification.create([
    {
      userId: patientAarav._id,
      title: 'Upcoming Session Confirmed',
      message: `Your Orthopedic & Spine Rehabilitation with Dr. Lakshmi Rao on ${upcomingDate1} at 10:30 AM IST (${upcomingSeeds[0].code}) is confirmed.`,
      type: 'booking',
      isRead: false,
    },
    {
      userId: patientSneha._id,
      title: 'Post-Op Rehab Scheduled',
      message: `Your 60-min Post-Surgical Joint Recovery with Dr. Rohit Sharma on ${upcomingDate2} at 11:00 AM IST (${upcomingSeeds[1].code}) is confirmed.`,
      type: 'booking',
      isRead: false,
    },
    {
      userId: adminUser._id,
      title: 'Clinic System Ready',
      message: 'PhysioCare clinic database initialized with 3 specialists, 6 treatments, and active IST slot scheduling.',
      type: 'system',
      isRead: false,
    },
  ]);

  console.log('[Seed] Seed complete.');
}
