import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Bell,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  LogOut,
  Plus,
  Trash2,
} from 'lucide-react';
import { api, getApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  Appointment,
  AppointmentStatus,
  ClinicHoliday,
  NotificationItem,
  Physiotherapist,
  WeeklyDaySchedule,
} from '../types';
import { formatCurrencyINR, formatTime12hClient, StatusLabel } from './StatusBadge';

interface PhysioDashboardProps {
  onBackToClinic: () => void;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const PhysioDashboard: React.FC<PhysioDashboardProps> = ({ onBackToClinic }) => {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState<'queue' | 'availability' | 'notifications'>('queue');
  const [statusFilter, setStatusFilter] = useState<'all' | 'today' | 'confirmed' | 'completed'>('all');

  const [physio, setPhysio] = useState<Physiotherapist | null>(null);
  const [holidays, setHolidays] = useState<ClinicHoliday[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [todayIST, setTodayIST] = useState('');
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Selected appointment for clinical update
  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null);
  const [sessionStatus, setSessionStatus] = useState<AppointmentStatus>('confirmed');
  const [sessionNotes, setSessionNotes] = useState('');
  const [painBefore, setPainBefore] = useState<string>('');
  const [painAfter, setPainAfter] = useState<string>('');
  const [savingSession, setSavingSession] = useState(false);
  const [sessionSavedMsg, setSessionSavedMsg] = useState('');

  // Availability management state
  const [scheduleDraft, setScheduleDraft] = useState<WeeklyDaySchedule[]>([]);
  const [unavailableDates, setUnavailableDates] = useState<string[]>([]);
  const [newUnavailableDate, setNewUnavailableDate] = useState('');
  const [savingAvail, setSavingAvail] = useState(false);
  const [availSavedMsg, setAvailSavedMsg] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [profRes, apptRes, notifRes] = await Promise.all([
        api.get<{ physiotherapist: Physiotherapist; holidays: ClinicHoliday[] }>('/physio/profile'),
        api.get<{ appointments: Appointment[]; todayIST: string }>('/physio/appointments'),
        api.get<{ notifications: NotificationItem[] }>('/notifications'),
      ]);
      setPhysio(profRes.data.physiotherapist);
      setHolidays(profRes.data.holidays);
      setScheduleDraft(profRes.data.physiotherapist.weeklySchedule || []);
      setUnavailableDates(profRes.data.physiotherapist.unavailableDates || []);
      setAppointments(apptRes.data.appointments);
      setTodayIST(apptRes.data.todayIST);
      setNotifications(notifRes.data.notifications);

      if (apptRes.data.appointments.length > 0 && !selectedAppt) {
        const first = apptRes.data.appointments[0];
        setSelectedAppt(first);
        setSessionStatus(first.status);
        setSessionNotes(first.sessionNotes || '');
        setPainBefore(first.painScoreBefore !== undefined ? String(first.painScoreBefore) : '');
        setPainAfter(first.painScoreAfter !== undefined ? String(first.painScoreAfter) : '');
      }
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setLoading(false);
    }
  }, [selectedAppt]);

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectAppointment = (appt: Appointment) => {
    setSelectedAppt(appt);
    setSessionStatus(appt.status);
    setSessionNotes(appt.sessionNotes || '');
    setPainBefore(appt.painScoreBefore !== undefined ? String(appt.painScoreBefore) : '');
    setPainAfter(appt.painScoreAfter !== undefined ? String(appt.painScoreAfter) : '');
    setSessionSavedMsg('');
  };

  const handleSaveSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAppt) return;
    setSavingSession(true);
    setSessionSavedMsg('');
    setError('');
    try {
      const { data } = await api.patch<{ appointment: Appointment }>(
        `/physio/appointments/${selectedAppt._id}/session`,
        {
          status: sessionStatus,
          sessionNotes,
          painScoreBefore: painBefore === '' ? undefined : Number(painBefore),
          painScoreAfter: painAfter === '' ? undefined : Number(painAfter),
        }
      );
      setAppointments((prev) =>
        prev.map((a) => (a._id === data.appointment._id ? data.appointment : a))
      );
      setSelectedAppt(data.appointment);
      setSessionSavedMsg('Session status & clinical notes saved.');
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setSavingSession(false);
    }
  };

  const handleSaveAvailability = async () => {
    setSavingAvail(true);
    setAvailSavedMsg('');
    setError('');
    try {
      const { data } = await api.put<{ physiotherapist: Physiotherapist }>('/physio/availability', {
        weeklySchedule: scheduleDraft,
        unavailableDates,
      });
      setPhysio(data.physiotherapist);
      setAvailSavedMsg('Availability updated. Live booking calendar now reflects your changes.');
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setSavingAvail(false);
    }
  };

  const filteredAppointments = appointments.filter((a) => {
    if (statusFilter === 'today') return a.date === todayIST;
    if (statusFilter === 'confirmed') return a.status === 'confirmed' || a.status === 'in_progress';
    if (statusFilter === 'completed') return a.status === 'completed';
    return true;
  });

  const selectedPatient =
    selectedAppt && typeof selectedAppt.patientId === 'object' ? selectedAppt.patientId : null;
  const selectedTreatment =
    selectedAppt && typeof selectedAppt.treatmentId === 'object' ? selectedAppt.treatmentId : null;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 flex flex-col lg:flex-row">
      <aside className="w-full lg:w-64 bg-white border-b lg:border-b-0 lg:border-r border-slate-200 p-5 flex flex-col justify-between shrink-0">
        <div className="space-y-6">
          <div>
            <div className="text-xs font-medium text-teal-700">Physiotherapist Workspace</div>
            <div className="font-display text-base font-bold text-slate-900 mt-0.5 truncate">
              {physio?.name || user?.name}
            </div>
            <div className="text-xs text-slate-500 truncate">
              {physio?.specialization || user?.email}
            </div>
          </div>

          <nav className="space-y-1">
            <button
              type="button"
              onClick={() => setTab('queue')}
              className={`w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
                tab === 'queue'
                  ? 'bg-sky-50 text-sky-800'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <Calendar className="w-4 h-4" />
                <span>Assigned Queue</span>
              </span>
              <span className="text-xs tabular-nums text-slate-500">{appointments.length}</span>
            </button>

            <button
              type="button"
              onClick={() => setTab('availability')}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
                tab === 'availability'
                  ? 'bg-sky-50 text-sky-800'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>Schedule & Leave</span>
            </button>

            <button
              type="button"
              onClick={() => setTab('notifications')}
              className={`w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
                tab === 'notifications'
                  ? 'bg-sky-50 text-sky-800'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <Bell className="w-4 h-4" />
                <span>Alerts</span>
              </span>
              <span className="text-xs tabular-nums text-slate-500">{notifications.length}</span>
            </button>
          </nav>
        </div>

        <div className="pt-6 mt-6 border-t border-slate-200 space-y-1">
          <button
            type="button"
            onClick={onBackToClinic}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-lg cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Clinic Home</span>
          </button>
          <button
            type="button"
            onClick={logout}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-50 rounded-lg cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 p-5 sm:p-8 max-w-7xl">
        {error && (
          <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-800">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="py-20 flex items-center justify-center gap-2 text-sm text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin text-sky-700" />
            <span>Loading physiotherapist schedule...</span>
          </div>
        ) : (
          <>
            {tab === 'queue' && (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h1 className="font-display text-2xl font-bold text-slate-900">
                      Assigned Appointments & Clinical Notes
                    </h1>
                    <p className="text-sm text-slate-500 mt-0.5 tabular-nums">
                      Today IST: {todayIST} · Select an appointment to review patient history and update treatment notes.
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
                    {(['all', 'today', 'confirmed', 'completed'] as const).map((k) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => setStatusFilter(k)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize cursor-pointer ${
                          statusFilter === k
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {k}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* Appointments List */}
                  <div className="lg:col-span-6 space-y-2.5">
                    {filteredAppointments.length === 0 ? (
                      <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-sm text-slate-500">
                        No appointments match this filter.
                      </div>
                    ) : (
                      filteredAppointments.map((appt) => {
                        const pat = typeof appt.patientId === 'object' ? appt.patientId : null;
                        const tr = typeof appt.treatmentId === 'object' ? appt.treatmentId : null;
                        const isSelected = selectedAppt?._id === appt._id;

                        return (
                          <button
                            key={appt._id}
                            type="button"
                            onClick={() => selectAppointment(appt)}
                            className={`w-full text-left p-4 rounded-xl border transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-sky-50 border-sky-600'
                                : 'bg-white border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                              <span className="font-mono font-semibold text-slate-700 tabular-nums">
                                {appt.date} · {formatTime12hClient(appt.startTime)} IST
                              </span>
                              <StatusLabel status={appt.status} />
                            </div>
                            <div className="text-sm font-bold text-slate-900 mt-1">
                              {pat?.name || 'Patient'}
                            </div>
                            <div className="text-xs text-slate-600 mt-0.5 flex items-center justify-between">
                              <span>{tr?.name}</span>
                              <span className="tabular-nums font-medium">
                                {appt.durationMinutes} min · {formatCurrencyINR(appt.price)}
                              </span>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>

                  {/* Clinical Details & Session Editor */}
                  <div className="lg:col-span-6">
                    {selectedAppt ? (
                      <form
                        onSubmit={handleSaveSession}
                        className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5"
                      >
                        <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100">
                          <div>
                            <div className="text-xs font-mono text-slate-500 tabular-nums">
                              {selectedAppt.bookingCode} · {selectedAppt.date} (
                              {formatTime12hClient(selectedAppt.startTime)} –{' '}
                              {formatTime12hClient(selectedAppt.endTime)} IST)
                            </div>
                            <h2 className="font-display text-lg font-bold text-slate-900 mt-1">
                              {selectedPatient?.name}
                            </h2>
                            <div className="text-xs text-slate-600 mt-0.5">
                              {selectedTreatment?.name} · {selectedAppt.durationMinutes} min
                            </div>
                          </div>
                          <StatusLabel status={selectedAppt.status} />
                        </div>

                        {/* Patient Clinical Info */}
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 text-xs">
                          <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-teal-600" />
                            <span>Patient Intake & History</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-slate-600">
                            <div>
                              <span className="text-slate-400">Phone:</span>{' '}
                              {selectedPatient?.phone || 'N/A'}
                            </div>
                            <div>
                              <span className="text-slate-400">Gender:</span>{' '}
                              {selectedPatient?.gender || 'N/A'}
                            </div>
                            <div className="col-span-2">
                              <span className="text-slate-400">Medical History:</span>{' '}
                              {selectedPatient?.medicalHistory || 'None recorded'}
                            </div>
                            {selectedAppt.patientNotes && (
                              <div className="col-span-2">
                                <span className="text-slate-400">Booking Note:</span>{' '}
                                <span className="text-slate-800">{selectedAppt.patientNotes}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {sessionSavedMsg && (
                          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            <span>{sessionSavedMsg}</span>
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">
                              Session Status
                            </label>
                            <select
                              value={sessionStatus}
                              onChange={(e) => setSessionStatus(e.target.value as AppointmentStatus)}
                              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-sky-600"
                            >
                              <option value="confirmed">Confirmed</option>
                              <option value="in_progress">In Progress</option>
                              <option value="completed">Completed</option>
                              <option value="cancelled">Cancelled</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">
                              Pain Before (0–10)
                            </label>
                            <input
                              type="number"
                              min={0}
                              max={10}
                              value={painBefore}
                              onChange={(e) => setPainBefore(e.target.value)}
                              className="w-full px-3 py-2 text-sm tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">
                              Pain After (0–10)
                            </label>
                            <input
                              type="number"
                              min={0}
                              max={10}
                              value={painAfter}
                              onChange={(e) => setPainAfter(e.target.value)}
                              className="w-full px-3 py-2 text-sm tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">
                            Clinical Treatment Notes & Home Exercise Plan
                          </label>
                          <textarea
                            rows={4}
                            value={sessionNotes}
                            onChange={(e) => setSessionNotes(e.target.value)}
                            placeholder="Document range-of-motion observations, modalities applied, and prescribed home exercises..."
                            className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600"
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={savingSession}
                          className="w-full py-2.5 px-4 bg-sky-700 hover:bg-sky-800 disabled:bg-sky-400 text-white text-sm font-semibold rounded-lg flex items-center justify-center gap-2 cursor-pointer"
                        >
                          {savingSession && <Loader2 className="w-4 h-4 animate-spin" />}
                          <span>Save Session Update</span>
                        </button>
                      </form>
                    ) : (
                      <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-sm text-slate-500">
                        Select an appointment from the queue to view patient details and update clinical notes.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {tab === 'availability' && (
              <div className="space-y-6 max-w-4xl">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h1 className="font-display text-2xl font-bold text-slate-900">
                      Availability & Leave Dates
                    </h1>
                    <p className="text-sm text-slate-500 mt-0.5">
                      Adjust your weekly working hours, break window, and unavailable dates in Asia/Kolkata (IST).
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={savingAvail}
                    onClick={() => void handleSaveAvailability()}
                    className="px-5 py-2.5 bg-sky-700 hover:bg-sky-800 disabled:bg-sky-400 text-white text-sm font-semibold rounded-lg flex items-center gap-2 cursor-pointer"
                  >
                    {savingAvail && <Loader2 className="w-4 h-4 animate-spin" />}
                    <span>Save Availability</span>
                  </button>
                </div>

                {availSavedMsg && (
                  <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>{availSavedMsg}</span>
                  </div>
                )}

                {/* Weekly Schedule */}
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                  <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-700">
                    Weekly Working Hours & Lunch Breaks (IST)
                  </div>
                  <div className="divide-y divide-slate-100">
                    {scheduleDraft.map((day, idx) => (
                      <div
                        key={day.dayOfWeek}
                        className="p-4 grid grid-cols-1 sm:grid-cols-12 items-center gap-3 text-sm"
                      >
                        <div className="sm:col-span-3 flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={day.isWorking}
                            onChange={(e) => {
                              const next = [...scheduleDraft];
                              next[idx] = { ...day, isWorking: e.target.checked };
                              setScheduleDraft(next);
                            }}
                            className="w-4 h-4 accent-sky-700 rounded cursor-pointer"
                          />
                          <span className="font-medium text-slate-900">
                            {DAY_NAMES[day.dayOfWeek]}
                          </span>
                        </div>

                        {day.isWorking ? (
                          <>
                            <div className="sm:col-span-4 flex items-center gap-2 text-xs">
                              <span className="text-slate-500">Shift:</span>
                              <input
                                type="time"
                                value={day.startTime}
                                onChange={(e) => {
                                  const next = [...scheduleDraft];
                                  next[idx] = { ...day, startTime: e.target.value };
                                  setScheduleDraft(next);
                                }}
                                className="px-2 py-1 border border-slate-300 rounded tabular-nums"
                              />
                              <span>–</span>
                              <input
                                type="time"
                                value={day.endTime}
                                onChange={(e) => {
                                  const next = [...scheduleDraft];
                                  next[idx] = { ...day, endTime: e.target.value };
                                  setScheduleDraft(next);
                                }}
                                className="px-2 py-1 border border-slate-300 rounded tabular-nums"
                              />
                            </div>
                            <div className="sm:col-span-5 flex items-center gap-2 text-xs">
                              <span className="text-slate-500">Break:</span>
                              <input
                                type="time"
                                value={day.breakStart}
                                onChange={(e) => {
                                  const next = [...scheduleDraft];
                                  next[idx] = { ...day, breakStart: e.target.value };
                                  setScheduleDraft(next);
                                }}
                                className="px-2 py-1 border border-slate-300 rounded tabular-nums"
                              />
                              <span>–</span>
                              <input
                                type="time"
                                value={day.breakEnd}
                                onChange={(e) => {
                                  const next = [...scheduleDraft];
                                  next[idx] = { ...day, breakEnd: e.target.value };
                                  setScheduleDraft(next);
                                }}
                                className="px-2 py-1 border border-slate-300 rounded tabular-nums"
                              />
                            </div>
                          </>
                        ) : (
                          <div className="sm:col-span-9 text-xs text-slate-400">
                            Marked as Weekly Off
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Unavailable Dates */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
                  <div className="text-sm font-bold text-slate-900">
                    Specific Unavailable / Leave Dates
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="date"
                      value={newUnavailableDate}
                      onChange={(e) => setNewUnavailableDate(e.target.value)}
                      className="px-3 py-2 text-sm border border-slate-300 rounded-lg tabular-nums"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (newUnavailableDate && !unavailableDates.includes(newUnavailableDate)) {
                          setUnavailableDates([...unavailableDates, newUnavailableDate].sort());
                          setNewUnavailableDate('');
                        }
                      }}
                      className="px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Block Date</span>
                    </button>
                  </div>

                  {unavailableDates.length === 0 ? (
                    <p className="text-xs text-slate-500">No personal leave dates blocked.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {unavailableDates.map((d) => (
                        <div
                          key={d}
                          className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono tabular-nums text-slate-700"
                        >
                          <span>{d}</span>
                          <button
                            type="button"
                            onClick={() =>
                              setUnavailableDates(unavailableDates.filter((x) => x !== d))
                            }
                            aria-label={`Remove ${d}`}
                            className="text-slate-400 hover:text-rose-600 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {holidays.length > 0 && (
                    <div className="pt-3 border-t border-slate-100">
                      <div className="text-xs font-semibold text-slate-700 mb-1.5">
                        Upcoming Clinic-Wide Holidays (Managed by Admin):
                      </div>
                      <ul className="text-xs text-slate-500 space-y-1 tabular-nums">
                        {holidays.map((h) => (
                          <li key={h._id}>
                            {h.date} — {h.title}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            {tab === 'notifications' && (
              <div className="space-y-4 max-w-3xl">
                <h1 className="font-display text-2xl font-bold text-slate-900">
                  Schedule Alerts
                </h1>
                <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100">
                  {notifications.length === 0 ? (
                    <div className="p-8 text-center text-sm text-slate-500">No alerts yet.</div>
                  ) : (
                    notifications.map((n) => (
                      <div key={n._id} className="p-4 space-y-1">
                        <div className="text-sm font-semibold text-slate-900">{n.title}</div>
                        <p className="text-xs text-slate-600">{n.message}</p>
                        <div className="text-[11px] text-slate-400 tabular-nums">
                          {new Date(n.createdAt).toLocaleString('en-IN', {
                            timeZone: 'Asia/Kolkata',
                          })}{' '}
                          IST
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};
