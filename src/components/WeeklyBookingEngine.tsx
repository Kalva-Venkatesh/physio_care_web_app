import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  Stethoscope,
} from 'lucide-react';
import { api, getApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  Appointment,
  GeneratedSlot,
  Physiotherapist,
  Treatment,
  WeeklyAvailabilityResponse,
} from '../types';
import { ClinicImage } from './ClinicImage';
import { formatCurrencyINR, formatTime12hClient } from './StatusBadge';

interface WeeklyBookingEngineProps {
  treatments: Treatment[];
  physiotherapists: Physiotherapist[];
  preselectedTreatmentId?: string;
  preselectedPhysioId?: string;
  onRequestAuth: (message: string) => void;
  onBookingConfirmed?: (appointment: Appointment) => void;
}

export const WeeklyBookingEngine: React.FC<WeeklyBookingEngineProps> = ({
  treatments,
  physiotherapists,
  preselectedTreatmentId,
  preselectedPhysioId,
  onRequestAuth,
  onBookingConfirmed,
}) => {
  const { user } = useAuth();

  const [selectedTreatmentId, setSelectedTreatmentId] = useState<string>('');
  const [selectedPhysioId, setSelectedPhysioId] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedSlot, setSelectedSlot] = useState<GeneratedSlot | null>(null);
  const [patientNotes, setPatientNotes] = useState('');

  const [availability, setAvailability] = useState<WeeklyAvailabilityResponse | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotError, setSlotError] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState('');
  const [confirmedBooking, setConfirmedBooking] = useState<Appointment | null>(null);

  // Sync external pre-selections
  useEffect(() => {
    if (preselectedTreatmentId) {
      setSelectedTreatmentId(preselectedTreatmentId);
      setConfirmedBooking(null);
    }
  }, [preselectedTreatmentId]);

  useEffect(() => {
    if (preselectedPhysioId) {
      setSelectedPhysioId(preselectedPhysioId);
      setConfirmedBooking(null);
    }
  }, [preselectedPhysioId]);

  // Default to first treatment if unset
  useEffect(() => {
    if (!selectedTreatmentId && treatments.length > 0) {
      setSelectedTreatmentId(treatments[0]._id);
    }
  }, [treatments, selectedTreatmentId]);

  // Eligible physiotherapists for selected treatment
  const eligiblePhysios = useMemo(() => {
    if (!selectedTreatmentId) return physiotherapists;
    return physiotherapists.filter((p) =>
      p.treatmentIds.some((t) => (typeof t === 'string' ? t : t._id) === selectedTreatmentId)
    );
  }, [physiotherapists, selectedTreatmentId]);

  // Ensure selected physio belongs to eligiblePhysios
  useEffect(() => {
    if (eligiblePhysios.length === 0) {
      setSelectedPhysioId('');
      return;
    }
    const stillValid = eligiblePhysios.some((p) => p._id === selectedPhysioId);
    if (!stillValid) {
      setSelectedPhysioId(eligiblePhysios[0]._id);
    }
  }, [eligiblePhysios, selectedPhysioId]);

  const fetchAvailability = useCallback(async () => {
    if (!selectedPhysioId || !selectedTreatmentId) {
      setAvailability(null);
      return;
    }
    setLoadingSlots(true);
    setSlotError('');
    try {
      const { data } = await api.get<WeeklyAvailabilityResponse>('/availability', {
        params: {
          physiotherapistId: selectedPhysioId,
          treatmentId: selectedTreatmentId,
          startDate: startDate || undefined,
          days: 7,
        },
      });
      setAvailability(data);
      setSelectedDate((prev) => {
        const stillInWeek = data.calendar.find((d) => d.date === prev);
        if (stillInWeek && stillInWeek.status === 'open' && stillInWeek.slots.length > 0) {
          return prev;
        }
        const firstOpen = data.calendar.find((d) => d.status === 'open' && d.slots.length > 0);
        return firstOpen ? firstOpen.date : data.calendar[0]?.date || '';
      });
      setSelectedSlot(null);
    } catch (err) {
      setSlotError(getApiError(err));
    } finally {
      setLoadingSlots(false);
    }
  }, [selectedPhysioId, selectedTreatmentId, startDate]);

  useEffect(() => {
    void fetchAvailability();
  }, [fetchAvailability]);

  const selectedTreatment = treatments.find((t) => t._id === selectedTreatmentId);
  const selectedPhysio = physiotherapists.find((p) => p._id === selectedPhysioId);
  const activeDay = availability?.calendar.find((d) => d.date === selectedDate);

  const morningSlots = (activeDay?.slots || []).filter((s) => s.time < '13:00');
  const afternoonSlots = (activeDay?.slots || []).filter((s) => s.time >= '13:00');

  const shiftWeek = (direction: number) => {
    if (!availability?.calendar.length) return;
    const base = availability.calendar[0].date;
    const [y, m, d] = base.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d + direction * 7));
    const nextStr = dt.toISOString().slice(0, 10);
    setStartDate(nextStr < availability.todayIST ? availability.todayIST : nextStr);
  };

  const handleBook = async () => {
    setBookingError('');
    if (!user) {
      onRequestAuth('Sign in or register as a patient to confirm this time slot.');
      return;
    }
    if (user.role === 'physiotherapist') {
      setBookingError('Please sign in with a Patient account to book an appointment.');
      return;
    }
    if (!selectedTreatmentId || !selectedPhysioId || !selectedDate || !selectedSlot) {
      setBookingError('Please select a treatment, physiotherapist, date, and time slot.');
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await api.post<{ appointment: Appointment }>('/appointments', {
        treatmentId: selectedTreatmentId,
        physiotherapistId: selectedPhysioId,
        date: selectedDate,
        startTime: selectedSlot.time,
        patientNotes,
      });
      setConfirmedBooking(data.appointment);
      setPatientNotes('');
      setSelectedSlot(null);
      // Immediately refresh availability so the newly booked slot is removed
      await fetchAvailability();
      if (onBookingConfirmed) {
        onBookingConfirmed(data.appointment);
      }
    } catch (err) {
      setBookingError(getApiError(err));
      // Refresh slots in case of 409 conflict
      await fetchAvailability();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      {/* Top Context Strip */}
      <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="font-display text-lg font-bold text-slate-900">
            Weekly Appointment Scheduler
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Live 30-minute availability synchronized in Asia/Kolkata (IST) timezone
          </p>
        </div>
        {availability && (
          <div className="text-xs font-mono tabular-nums text-slate-600">
            IST Now: {availability.todayIST} · {formatTime12hClient(availability.currentTimeIST)}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12">
        {/* Left Configuration Column: Treatment + Physiotherapist */}
        <div className="lg:col-span-5 p-6 border-b lg:border-b-0 lg:border-r border-slate-200 space-y-6">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              1. Select Physiotherapy Treatment
            </label>
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {treatments.map((t) => {
                const active = t._id === selectedTreatmentId;
                return (
                  <button
                    key={t._id}
                    type="button"
                    onClick={() => {
                      setSelectedTreatmentId(t._id);
                      setConfirmedBooking(null);
                    }}
                    className={`w-full text-left p-3 rounded-xl border transition-colors cursor-pointer flex items-center justify-between gap-3 ${
                      active
                        ? 'bg-sky-50 border-sky-600 text-slate-900'
                        : 'bg-white border-slate-200 hover:border-slate-300 text-slate-800'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">{t.name}</div>
                      <div className="text-xs text-slate-500 mt-0.5 tabular-nums">
                        {t.category} · {t.durationMinutes} min
                      </div>
                    </div>
                    <div className="text-sm font-bold text-sky-800 tabular-nums shrink-0">
                      {formatCurrencyINR(t.price)}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              2. Select Physiotherapist ({eligiblePhysios.length} available)
            </label>
            {eligiblePhysios.length === 0 ? (
              <div className="p-4 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-xl">
                No physiotherapists are currently assigned to this treatment.
              </div>
            ) : (
              <div className="space-y-2">
                {eligiblePhysios.map((p) => {
                  const active = p._id === selectedPhysioId;
                  return (
                    <button
                      key={p._id}
                      type="button"
                      onClick={() => {
                        setSelectedPhysioId(p._id);
                        setConfirmedBooking(null);
                      }}
                      className={`w-full text-left p-3 rounded-xl border transition-colors cursor-pointer flex items-center gap-3 ${
                        active
                          ? 'bg-teal-50 border-teal-600'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <ClinicImage
                        src={p.imageUrl}
                        alt={p.name}
                        className="w-11 h-11 rounded-lg object-cover shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-slate-900 truncate">
                          {p.name}
                        </div>
                        <div className="text-xs text-slate-500 truncate">
                          {p.specialization} · {p.experienceYears} yrs
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Weekly Calendar & Slot Confirmation */}
        <div className="lg:col-span-7 p-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-sky-700" />
              <span className="text-xs font-semibold text-slate-700">
                3. Choose Date & Available 30-Min Slot
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={
                  !availability ||
                  !availability.calendar[0] ||
                  availability.calendar[0].date <= availability.todayIST
                }
                onClick={() => shiftWeek(-1)}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 cursor-pointer flex items-center gap-1 whitespace-nowrap"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Previous Week</span>
              </button>
              <button
                type="button"
                onClick={() => shiftWeek(1)}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer flex items-center gap-1 whitespace-nowrap"
              >
                <span>Next Week</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {slotError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 flex items-start gap-2 text-xs text-rose-800">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{slotError}</span>
            </div>
          )}

          {loadingSlots ? (
            <div className="py-16 flex flex-col items-center justify-center gap-2 text-sm text-slate-500">
              <Loader2 className="w-6 h-6 animate-spin text-sky-700" />
              <span>Calculating real-time IST schedule & slot locks...</span>
            </div>
          ) : (
            <>
              {/* 7-Day Calendar Strip */}
              <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                {availability?.calendar.map((day) => {
                  const isSelected = day.date === selectedDate;
                  const unavailable = day.status !== 'open' || day.slots.length === 0;
                  return (
                    <button
                      key={day.date}
                      type="button"
                      disabled={unavailable}
                      onClick={() => {
                        setSelectedDate(day.date);
                        setSelectedSlot(null);
                      }}
                      className={`p-2.5 rounded-xl border text-center transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-sky-700 border-sky-700 text-white'
                          : unavailable
                          ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed'
                          : 'bg-white border-slate-200 hover:border-sky-400 text-slate-800'
                      }`}
                    >
                      <div className="text-[11px] font-medium opacity-80">
                        {day.isToday ? 'Today' : day.shortDay}
                      </div>
                      <div className="text-base font-bold tabular-nums my-0.5">{day.dayNum}</div>
                      <div className="text-[11px] opacity-80">{day.monthShort}</div>
                      <div className="mt-1 text-[11px] font-medium tabular-nums truncate">
                        {day.status === 'open'
                          ? `${day.slots.length} open`
                          : day.status === 'holiday'
                          ? 'Holiday'
                          : day.status === 'off'
                          ? 'Off'
                          : 'Busy'}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Active Day Info & Time Slots */}
              {activeDay && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
                    <div className="text-sm font-semibold text-slate-900">
                      {activeDay.fullLabel}
                    </div>
                    <div className="text-xs text-slate-500 tabular-nums">
                      {activeDay.workingHours ? `Hours: ${activeDay.workingHours} IST` : activeDay.reason}
                      {activeDay.breakHours ? ` · Lunch: ${activeDay.breakHours}` : ''}
                    </div>
                  </div>

                  {activeDay.status !== 'open' || activeDay.slots.length === 0 ? (
                    <div className="p-6 text-center bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600">
                      {activeDay.reason || 'All slots are currently booked for this date.'}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {morningSlots.length > 0 && (
                        <div>
                          <div className="text-xs font-medium text-slate-500 mb-2">
                            Morning Sessions (IST)
                          </div>
                          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                            {morningSlots.map((slot) => {
                              const active = selectedSlot?.time === slot.time;
                              return (
                                <button
                                  key={slot.time}
                                  type="button"
                                  onClick={() => setSelectedSlot(slot)}
                                  className={`py-2 px-2.5 rounded-lg border text-xs font-medium tabular-nums transition-colors cursor-pointer flex items-center justify-center gap-1 whitespace-nowrap ${
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
                        </div>
                      )}

                      {afternoonSlots.length > 0 && (
                        <div>
                          <div className="text-xs font-medium text-slate-500 mb-2">
                            Afternoon & Evening Sessions (IST)
                          </div>
                          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                            {afternoonSlots.map((slot) => {
                              const active = selectedSlot?.time === slot.time;
                              return (
                                <button
                                  key={slot.time}
                                  type="button"
                                  onClick={() => setSelectedSlot(slot)}
                                  className={`py-2 px-2.5 rounded-lg border text-xs font-medium tabular-nums transition-colors cursor-pointer flex items-center justify-center gap-1 whitespace-nowrap ${
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
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Confirmation Bar or Verified Booking Card */}
              {confirmedBooking && (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-bold text-emerald-900">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <span>Appointment Automatically Confirmed</span>
                  </div>
                  <p className="text-xs text-emerald-800 tabular-nums">
                    Booking Code: <span className="font-mono font-semibold">{confirmedBooking.bookingCode}</span>{' '}
                    · {confirmedBooking.date} from {formatTime12hClient(confirmedBooking.startTime)} to{' '}
                    {formatTime12hClient(confirmedBooking.endTime)} IST
                  </p>
                </div>
              )}

              {bookingError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 flex items-start gap-2 text-xs text-rose-800">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{bookingError}</span>
                </div>
              )}

              {selectedSlot && selectedTreatment && selectedPhysio && (
                <div className="pt-4 border-t border-slate-200 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-4 text-sm">
                    <div>
                      <div className="font-semibold text-slate-900">
                        {selectedTreatment.name} with {selectedPhysio.name}
                      </div>
                      <div className="text-xs text-slate-500 tabular-nums mt-0.5">
                        {activeDay?.fullLabel} · {selectedSlot.label} – {selectedSlot.endLabel} IST (
                        {selectedTreatment.durationMinutes} min)
                      </div>
                    </div>
                    <div className="text-lg font-bold text-sky-800 tabular-nums">
                      {formatCurrencyINR(selectedTreatment.price)}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Symptoms or Notes for Physiotherapist (Optional)
                    </label>
                    <input
                      type="text"
                      value={patientNotes}
                      onChange={(e) => setPatientNotes(e.target.value)}
                      placeholder="e.g. Left shoulder tightness when lifting overhead..."
                      className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600"
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Stethoscope className="w-4 h-4 text-teal-600" />
                      <span>Instant confirmation & atomic slot lock</span>
                    </div>
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={handleBook}
                      className="px-6 py-2.5 bg-sky-700 hover:bg-sky-800 disabled:bg-sky-400 text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap"
                    >
                      {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                      <span>{user ? 'Confirm Appointment' : 'Sign In & Confirm Slot'}</span>
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
