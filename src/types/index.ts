export type UserRole = 'patient' | 'physiotherapist' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
  dateOfBirth?: string;
  gender?: string;
  address?: string;
  medicalHistory?: string;
  emergencyContact?: string;
  physiotherapistId?: string;
  isActive?: boolean;
}

export interface Treatment {
  _id: string;
  name: string;
  category: string;
  description: string;
  price: number;
  durationMinutes: number;
  imageUrl: string;
  highlights: string[];
  isActive: boolean;
}

export interface WeeklyDaySchedule {
  dayOfWeek: number;
  isWorking: boolean;
  startTime: string;
  endTime: string;
  breakStart: string;
  breakEnd: string;
}

export interface Physiotherapist {
  _id: string;
  userId: string;
  name: string;
  email: string;
  specialization: string;
  qualifications: string;
  experienceYears: number;
  bio: string;
  imageUrl: string;
  treatmentIds: Array<Treatment | string>;
  weeklySchedule: WeeklyDaySchedule[];
  unavailableDates: string[];
  isActive: boolean;
}

export interface GeneratedSlot {
  time: string;
  endTime: string;
  label: string;
  endLabel: string;
  slotKeys: string[];
}

export interface DayAvailability {
  date: string;
  dayOfWeek: number;
  shortDay: string;
  dayNum: string;
  monthShort: string;
  fullLabel: string;
  isToday: boolean;
  status: 'open' | 'holiday' | 'unavailable' | 'off' | 'past';
  reason?: string;
  workingHours: string | null;
  breakHours: string | null;
  slots: GeneratedSlot[];
}

export interface WeeklyAvailabilityResponse {
  timezone: string;
  todayIST: string;
  currentTimeIST: string;
  durationMinutes: number;
  physiotherapistId: string;
  physiotherapistName: string;
  calendar: DayAvailability[];
}

export type AppointmentStatus = 'confirmed' | 'in_progress' | 'completed' | 'cancelled';

export interface Appointment {
  _id: string;
  bookingCode: string;
  patientId:
    | string
    | {
        _id: string;
        name: string;
        email: string;
        phone?: string;
        dateOfBirth?: string;
        gender?: string;
        medicalHistory?: string;
        emergencyContact?: string;
      };
  physiotherapistId:
    | string
    | {
        _id: string;
        name: string;
        specialization: string;
        imageUrl?: string;
        qualifications?: string;
      };
  treatmentId:
    | string
    | {
        _id: string;
        name: string;
        category: string;
        price: number;
        durationMinutes: number;
        imageUrl?: string;
      };
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  slotKeys: string[];
  status: AppointmentStatus;
  price: number;
  patientNotes?: string;
  sessionNotes?: string;
  painScoreBefore?: number;
  painScoreAfter?: number;
  cancelledBy?: string;
  cancellationReason?: string;
  rescheduledCount: number;
  createdAt: string;
}

export interface NotificationItem {
  _id: string;
  title: string;
  message: string;
  type: 'booking' | 'reschedule' | 'cancellation' | 'session_update' | 'system';
  isRead: boolean;
  createdAt: string;
}

export interface ClinicHoliday {
  _id: string;
  date: string;
  title: string;
  description?: string;
}

export interface AdminAnalytics {
  summary: {
    totalRevenue: number;
    completedRevenue: number;
    totalAppointments: number;
    confirmedCount: number;
    inProgressCount: number;
    completedCount: number;
    cancelledCount: number;
    totalPatients: number;
    totalPhysiotherapists: number;
    activeTreatments: number;
  };
  revenueByDay: Array<{ date: string; label: string; revenue: number; bookings: number }>;
  byTreatment: Array<{ name: string; bookings: number; revenue: number }>;
  byPhysiotherapist: Array<{
    name: string;
    bookings: number;
    completed: number;
    revenue: number;
  }>;
  statusBreakdown: Array<{ status: string; count: number }>;
}
