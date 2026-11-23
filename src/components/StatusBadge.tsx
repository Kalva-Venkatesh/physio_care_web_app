import React from 'react';
import { CheckCircle2, Clock, PlayCircle, XCircle } from 'lucide-react';
import { AppointmentStatus } from '../types';

export const StatusLabel: React.FC<{ status: AppointmentStatus }> = ({ status }) => {
  switch (status) {
    case 'confirmed':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-700 whitespace-nowrap">
          <Clock className="w-3.5 h-3.5 shrink-0" />
          <span>Confirmed</span>
        </span>
      );
    case 'in_progress':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 whitespace-nowrap">
          <PlayCircle className="w-3.5 h-3.5 shrink-0" />
          <span>In Progress</span>
        </span>
      );
    case 'completed':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 whitespace-nowrap">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span>Completed</span>
        </span>
      );
    case 'cancelled':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-700 whitespace-nowrap">
          <XCircle className="w-3.5 h-3.5 shrink-0" />
          <span>Cancelled</span>
        </span>
      );
  }
};

export function formatTime12hClient(time24: string): string {
  if (!time24 || !time24.includes(':')) return time24;
  const [hStr, mStr] = time24.split(':');
  const h = Number(hStr);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(hour12).padStart(2, '0')}:${mStr} ${period}`;
}

export function formatCurrencyINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}
