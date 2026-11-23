import mongoose, { Schema, Document } from 'mongoose';

export interface ITreatment extends Document {
  name: string;
  category: string;
  description: string;
  price: number;
  durationMinutes: number;
  imageUrl: string;
  highlights: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const TreatmentSchema = new Schema<ITreatment>(
  {
    name: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    durationMinutes: {
      type: Number,
      required: true,
      default: 30,
      validate: {
        validator: (v: number) => v >= 30 && v % 30 === 0 && v <= 120,
        message: 'Duration must be a 30-minute increment (30, 60, 90, or 120 mins)',
      },
    },
    imageUrl: { type: String, default: '' },
    highlights: [{ type: String }],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Treatment = mongoose.model<ITreatment>('Treatment', TreatmentSchema);
