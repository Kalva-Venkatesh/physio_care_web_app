import React, { useEffect, useState } from 'react';
import { AlertCircle, Calendar, ChevronLeft, ChevronRight, Clock, Loader2, X } from 'lucide-react';
import { api, getApiError } from '../api/client';
import { Appointment, WeeklyAvailabilityResponse } from '../types';
import { formatTime12hClient } from './StatusBadge';

interface RescheduleModalProps {
  appointment: Appointment | null;
  onClose: () => void;
  onRescheduled: (updated: Appointment) => void;
}

export const RescheduleModal: React.FC<RescheduleModalProps> = ({
  appointment,
  onClose,
  onRescheduled,
}) => {
  const [availability, setAvailability] = useState<WeeklyAvailabilityResponse | null>(null);
  const [startDate, setStartDate] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedSlot, setSelectedSlot] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const physioId =
    appointment && typeof appointment.physiotherapistId === 'object'
      ? appointment.physiotherapistId._id
      : (appointment?.physiotherapistId as string);
  const treatmentId =
    appointment && typeof appointment.treatmentId === 'object'
      ? appointment.treatmentId._id
      : (appointment?.treatmentId as string);

  useEffect(() => {
    if (!appointment || !physioId) return;
    let active = true;

    const loadAvailability = async () => {
      setLoading(true);
      setError('');
      try {
        const { data } = await api.get<WeeklyAvailabilityResponse>('/availability', {
          params: {
            physiotherapistId: physioId,
            treatmentId,
            startDate: startDate || undefined,
            days: 7,
            excludeAppointmentId: appointment._id,
          },
        });
        if (!active) return;
        setAvailability(data);
        const firstOpen = data.calendar.find((d) => d.status === 'open' && d.slots.length > 0);
        setSelectedDate(firstOpen ? firstOpen.date : data.calendar[0]?.date || '');
        setSelectedSlot('');
      } catch (err) {
        if (active) setError(getApiError(err));
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadAvailability();
    return () => {
      active = false;
    };
  }, [appointment, physioId, treatmentId, startDate]);

  if (!appointment) return null;

  const activeDay = availability?.calendar.find((d) => d.date === selectedDate);

  const shiftWeek = (direction: number) => {
    if (!availability) return;
    const base = availability.calendar[0]?.date;
    if (!base) return;
    const [y, m, d] = base.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d + direction * 7));
    const nextStr = dt.toISOString().slice(0, 10);
    if (nextStr < availability.todayIST) {
      setStartDate(availability.todayIST);
    } else {
      setStartDate(nextStr);
    }
  };

  const handleConfirmReschedule = async () => {
    if (!selectedDate || !selectedSlot) return;
    setSaving(true);
    setError('');
    try {
      const { data } = await api.patch<{ appointment: Appointment }>(
        `/appointments/${appointment._id}/reschedule`,
        {
          date: selectedDate,
          startTime: selectedSlot,
        }
      );
      onRescheduled(data.appointment);
      onClose();
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl shadow-xl overflow-hidden my-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900">
              Reschedule Appointment
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
              Current: {appointment.bookingCode} · {appointment.date} at{' '}
              {formatTime12hClient(appointment.startTime)} IST
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-800">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
              <Calendar className="w-4 h-4 text-teal-600" />
              <span>Select New Date & 30-Min IST Slot</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={!availability || availability.calendar[0]?.date <= availability.todayIST}
                onClick={() => shiftWeek(-1)}
                className="px-2.5 py-1.5 text-xs font-medium border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 cursor-pointer flex items-center gap-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Prev</span>
              </button>
              <button
                type="button"
                onClick={() => shiftWeek(1)}
                className="px-2.5 py-1.5 text-xs font-medium border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer flex items-center gap-1"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="py-12 flex items-center justify-center gap-2 text-sm text-slate-500">
              <Loader2 className="w-5 h-5 animate-spin text-sky-700" />
              <span>Loading real-time specialist availability...</span>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-7 gap-2">
                {availability?.calendar.map((day) => {
                  const isSelected = day.date === selectedDate;
                  const disabled = day.status !== 'open' || day.slots.length === 0;
                  return (
                    <button
                      key={day.date}
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        setSelectedDate(day.date);
                        setSelectedSlot('');
                      }}
                      className={`p-2.5 rounded-xl border text-center transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-sky-700 border-sky-700 text-white'
                          : disabled
                          ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed'
                          : 'bg-white border-slate-200 hover:border-sky-400 text-slate-800'
                      }`}
                    >
                      <div className="text-[11px] font-medium opacity-80">{day.shortDay}</div>
                      <div className="text-base font-bold tabular-nums my-0.5">{day.dayNum}</div>
                      <div className="text-[11px] tabular-nums">
                        {day.status === 'open' ? `${day.slots.length} free` : day.status}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-700">
                    {activeDay?.fullLabel || 'Select a date'}
                  </span>
                  {activeDay?.breakHours && (
                    <span className="text-xs text-slate-500 tabular-nums">
                      Break: {activeDay.breakHours} IST
                    </span>
                  )}
                </div>

                {activeDay?.status !== 'open' || activeDay.slots.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-slate-200">
                    {activeDay?.reason || 'No open slots on this date. Please pick another day.'}
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-56 overflow-y-auto pr-1">
                    {activeDay.slots.map((slot) => {
                      const active = selectedSlot === slot.time;
                      return (
                        <button
                          key={slot.time}
                          type="button"
                          onClick={() => setSelectedSlot(slot.time)}
                          className={`py-2 px-3 rounded-lg border text-xs font-medium tabular-nums transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                            active
                              ? 'bg-teal-600 border-teal-600 text-white'
                              : 'bg-white border-slate-200 text-slate-700 hover:border-teal-500 hover:bg-teal-50'
                          }`}
                        >
                          <Clock className="w-3 h-3 shrink-0" />
                          <span>{slot.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
            >
              Keep Original
            </button>
            <button
              type="button"
              disabled={!selectedDate || !selectedSlot || saving}
              onClick={handleConfirmReschedule}
              className="px-5 py-2 text-sm font-semibold text-white bg-sky-700 hover:bg-sky-800 disabled:bg-slate-300 rounded-lg transition-colors flex items-center gap-2 cursor-pointer"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>Confirm Reschedule</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
