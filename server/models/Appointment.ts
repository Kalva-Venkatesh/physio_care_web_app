import mongoose, { Schema, Document, Types } from 'mongoose';

export type AppointmentStatus = 'confirmed' | 'in_progress' | 'completed' | 'cancelled';

export interface IAppointment extends Document {
  bookingCode: string;
  patientId: Types.ObjectId;
  physiotherapistId: Types.ObjectId;
  treatmentId: Types.ObjectId;
  date: string; // YYYY-MM-DD in Asia/Kolkata
  startTime: string; // HH:mm in Asia/Kolkata
  endTime: string;   // HH:mm in Asia/Kolkata
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
  createdAt: Date;
  updatedAt: Date;
}

const AppointmentSchema = new Schema<IAppointment>(
  {
    bookingCode: { type: String, required: true, unique: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    physiotherapistId: {
      type: Schema.Types.ObjectId,
      ref: 'Physiotherapist',
      required: true,
      index: true,
    },
    treatmentId: { type: Schema.Types.ObjectId, ref: 'Treatment', required: true },
    date: { type: String, required: true, index: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    durationMinutes: { type: Number, required: true },
    slotKeys: [{ type: String, required: true }],
    status: {
      type: String,
      enum: ['confirmed', 'in_progress', 'completed', 'cancelled'],
      default: 'confirmed',
      index: true,
    },
    price: { type: Number, required: true },
    patientNotes: { type: String, default: '' },
    sessionNotes: { type: String, default: '' },
    painScoreBefore: { type: Number, min: 0, max: 10 },
    painScoreAfter: { type: Number, min: 0, max: 10 },
    cancelledBy: { type: String },
    cancellationReason: { type: String },
    rescheduledCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

AppointmentSchema.index(
  { physiotherapistId: 1, date: 1, startTime: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ['confirmed', 'in_progress'] } },
  }
);

export const Appointment = mongoose.model<IAppointment>('Appointment', AppointmentSchema);
