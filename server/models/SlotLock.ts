import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ISlotLock extends Document {
  physiotherapistId: Types.ObjectId;
  date: string; // YYYY-MM-DD in Asia/Kolkata
  slotTime: string; // HH:mm in Asia/Kolkata
  appointmentId: Types.ObjectId;
  createdAt: Date;
}

const SlotLockSchema = new Schema<ISlotLock>(
  {
    physiotherapistId: { type: Schema.Types.ObjectId, ref: 'Physiotherapist', required: true },
    date: { type: String, required: true },
    slotTime: { type: String, required: true },
    appointmentId: { type: Schema.Types.ObjectId, ref: 'Appointment', required: true, index: true },
  },
  { timestamps: true }
);

// Atomic guarantee: no two active appointments can occupy the same 30-min slot for a physiotherapist on a date
SlotLockSchema.index({ physiotherapistId: 1, date: 1, slotTime: 1 }, { unique: true });

export const SlotLock = mongoose.model<ISlotLock>('SlotLock', SlotLockSchema);
