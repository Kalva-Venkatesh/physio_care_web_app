import mongoose, { Schema, Document } from 'mongoose';

export type UserRole = 'patient' | 'physiotherapist' | 'admin';

export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  phone: string;
  dateOfBirth?: string;
  gender?: string;
  address?: string;
  medicalHistory?: string;
  emergencyContact?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: ['patient', 'physiotherapist', 'admin'],
      default: 'patient',
      required: true,
    },
    phone: { type: String, default: '', trim: true },
    dateOfBirth: { type: String, default: '' },
    gender: { type: String, default: '' },
    address: { type: String, default: '' },
    medicalHistory: { type: String, default: '' },
    emergencyContact: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>('User', UserSchema);
