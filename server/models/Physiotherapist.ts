import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IWeeklyDaySchedule {
  dayOfWeek: number; // 0 (Sunday) to 6 (Saturday)
  isWorking: boolean;
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  breakStart: string;
  breakEnd: string;
}

export interface IPhysiotherapist extends Document {
  userId: Types.ObjectId;
  name: string;
  email: string;
  specialization: string;
  qualifications: string;
  experienceYears: number;
  bio: string;
  imageUrl: string;
  treatmentIds: Types.ObjectId[];
  weeklySchedule: IWeeklyDaySchedule[];
  unavailableDates: string[]; // YYYY-MM-DD in Asia/Kolkata
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const WeeklyDayScheduleSchema = new Schema<IWeeklyDaySchedule>(
  {
    dayOfWeek: { type: Number, required: true, min: 0, max: 6 },
    isWorking: { type: Boolean, default: true },
    startTime: { type: String, default: '09:00' },
    endTime: { type: String, default: '18:00' },
    breakStart: { type: String, default: '13:00' },
    breakEnd: { type: String, default: '14:00' },
  },
  { _id: false }
);

const PhysiotherapistSchema = new Schema<IPhysiotherapist>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    specialization: { type: String, required: true, trim: true },
    qualifications: { type: String, required: true, trim: true },
    experienceYears: { type: Number, default: 5, min: 0 },
    bio: { type: String, default: '' },
    imageUrl: { type: String, default: '' },
    treatmentIds: [{ type: Schema.Types.ObjectId, ref: 'Treatment' }],
    weeklySchedule: { type: [WeeklyDayScheduleSchema], default: [] },
    unavailableDates: [{ type: String }],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Physiotherapist = mongoose.model<IPhysiotherapist>(
  'Physiotherapist',
  PhysiotherapistSchema
);
