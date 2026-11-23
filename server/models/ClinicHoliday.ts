import mongoose, { Schema, Document } from 'mongoose';

export interface IClinicHoliday extends Document {
  date: string; // YYYY-MM-DD in Asia/Kolkata
  title: string;
  description?: string;
  createdAt: Date;
}

const ClinicHolidaySchema = new Schema<IClinicHoliday>(
  {
    date: { type: String, required: true, unique: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
  },
  { timestamps: true }
);

export const ClinicHoliday = mongoose.model<IClinicHoliday>('ClinicHoliday', ClinicHolidaySchema);
