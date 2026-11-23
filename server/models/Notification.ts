import mongoose, { Schema, Document, Types } from 'mongoose';

export interface INotification extends Document {
  userId: Types.ObjectId;
  title: string;
  message: string;
  type: 'booking' | 'reschedule' | 'cancellation' | 'session_update' | 'system';
  isRead: boolean;
  appointmentId?: Types.ObjectId;
  createdAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: {
      type: String,
      enum: ['booking', 'reschedule', 'cancellation', 'session_update', 'system'],
      default: 'system',
    },
    isRead: { type: Boolean, default: false },
    appointmentId: { type: Schema.Types.ObjectId, ref: 'Appointment' },
  },
  { timestamps: true }
);

export const Notification = mongoose.model<INotification>('Notification', NotificationSchema);
