import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Bell,
  Calendar,
  CalendarPlus,
  Check,
  CheckCircle2,
  Loader2,
  LogOut,
  RefreshCw,
  User as UserIcon,
} from 'lucide-react';
import { api, getApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Appointment, NotificationItem, Physiotherapist, Treatment } from '../types';
import { RescheduleModal } from './RescheduleModal';
import { formatCurrencyINR, formatTime12hClient, StatusLabel } from './StatusBadge';
import { WeeklyBookingEngine } from './WeeklyBookingEngine';

interface PatientPortalProps {
  treatments: Treatment[];
  physiotherapists: Physiotherapist[];
  onBackToClinic: () => void;
  onRefreshPublicData: () => void;
}

type PatientTab = 'appointments' | 'book' | 'notifications' | 'profile';

export const PatientPortal: React.FC<PatientPortalProps> = ({
  treatments,
  physiotherapists,
  onBackToClinic,
  onRefreshPublicData,
}) => {
  const { user, logout, updateProfile } = useAuth();
  const [tab, setTab] = useState<PatientTab>('appointments');
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'completed' | 'cancelled'>('all');

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [rescheduleTarget, setRescheduleTarget] = useState<Appointment | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  // Profile form state
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [dateOfBirth, setDateOfBirth] = useState(user?.dateOfBirth || '');
  const [gender, setGender] = useState(user?.gender || '');
  const [address, setAddress] = useState(user?.address || '');
  const [emergencyContact, setEmergencyContact] = useState(user?.emergencyContact || '');
  const [medicalHistory, setMedicalHistory] = useState(user?.medicalHistory || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState('');

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setPhone(user.phone || '');
      setDateOfBirth(user.dateOfBirth || '');
      setGender(user.gender || '');
      setAddress(user.address || '');
      setEmergencyContact(user.emergencyContact || '');
      setMedicalHistory(user.medicalHistory || '');
    }
  }, [user]);

  const loadPortalData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [apptRes, notifRes] = await Promise.all([
        api.get<{ appointments: Appointment[] }>('/appointments/my'),
        api.get<{ notifications: NotificationItem[]; unreadCount: number }>('/notifications'),
      ]);
      setAppointments(apptRes.data.appointments);
      setNotifications(notifRes.data.notifications);
      setUnreadCount(notifRes.data.unreadCount);
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPortalData();
  }, [loadPortalData]);

  const handleCancel = async (apptId: string) => {
    setCancellingId(apptId);
    setError('');
    try {
      const { data } = await api.patch<{ appointment: Appointment }>(
        `/appointments/${apptId}/cancel`,
        { reason: 'Cancelled by patient from portal' }
      );
      setAppointments((prev) => prev.map((a) => (a._id === apptId ? data.appointment : a)));
      await loadPortalData();
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setCancellingId(null);
    }
  };

  const handleMarkRead = async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications((prev) => prev.map((n) => (n._id === id ? { ...n, isRead: true } : n)));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      // ignore minor notification error
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {
      // ignore
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileSaved(false);
    setProfileError('');
    try {
      await updateProfile({
        name,
        phone,
        dateOfBirth,
        gender,
        address,
        emergencyContact,
        medicalHistory,
      });
      setProfileSaved(true);
    } catch (err) {
      setProfileError(getApiError(err));
    } finally {
      setSavingProfile(false);
    }
  };

  const filteredAppointments = appointments.filter((a) => {
    if (filter === 'upcoming') return a.status === 'confirmed' || a.status === 'in_progress';
    if (filter === 'completed') return a.status === 'completed';
    if (filter === 'cancelled') return a.status === 'cancelled';
    return true;
  });

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 flex flex-col lg:flex-row">
      {/* Sidebar */}
      <aside className="w-full lg:w-64 bg-white border-b lg:border-b-0 lg:border-r border-slate-200 p-5 flex flex-col justify-between shrink-0">
        <div className="space-y-6">
          <div>
            <div className="text-xs font-medium text-teal-700">Patient Portal</div>
            <div className="font-display text-base font-bold text-slate-900 mt-0.5 truncate">
              {user?.name}
            </div>
            <div className="text-xs text-slate-500 truncate">{user?.email}</div>
          </div>

          <nav className="space-y-1">
            <button
              type="button"
              onClick={() => setTab('appointments')}
              className={`w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
                tab === 'appointments'
                  ? 'bg-sky-50 text-sky-800'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <Calendar className="w-4 h-4" />
                <span>My Appointments</span>
              </span>
              <span className="text-xs tabular-nums text-slate-500">{appointments.length}</span>
            </button>

            <button
              type="button"
              onClick={() => setTab('book')}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
                tab === 'book'
                  ? 'bg-sky-50 text-sky-800'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <CalendarPlus className="w-4 h-4" />
              <span>Book New Session</span>
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
                <span>Notifications</span>
              </span>
              {unreadCount > 0 && (
                <span className="text-xs font-semibold tabular-nums text-teal-700">
                  {unreadCount} new
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setTab('profile')}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
                tab === 'profile'
                  ? 'bg-sky-50 text-sky-800'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <UserIcon className="w-4 h-4" />
              <span>Profile & History</span>
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

      {/* Main Content */}
      <main className="flex-1 p-5 sm:p-8 max-w-6xl">
        {error && (
          <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-800">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {tab === 'appointments' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="font-display text-2xl font-bold text-slate-900">
                  My Appointments & Treatment History
                </h1>
                <p className="text-sm text-slate-500 mt-0.5">
                  All session times are shown in Asia/Kolkata (IST).
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void loadPortalData()}
                  className="px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Refresh</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTab('book')}
                  className="px-4 py-2 text-xs font-semibold text-white bg-sky-700 hover:bg-sky-800 rounded-lg cursor-pointer whitespace-nowrap"
                >
                  Book Session
                </button>
              </div>
            </div>

            <div className="inline-flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
              {(['all', 'upcoming', 'completed', 'cancelled'] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-colors cursor-pointer ${
                    filter === key
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {key}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="py-16 flex items-center justify-center gap-2 text-sm text-slate-500">
                <Loader2 className="w-5 h-5 animate-spin text-sky-700" />
                <span>Loading your appointments...</span>
              </div>
            ) : filteredAppointments.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-3">
                <Calendar className="w-8 h-8 text-slate-400 mx-auto" />
                <div className="text-sm font-semibold text-slate-900">
                  No appointments in this view
                </div>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Select a treatment and specialist from the live weekly calendar to reserve your 30-minute session.
                </p>
                <button
                  type="button"
                  onClick={() => setTab('book')}
                  className="px-4 py-2 text-xs font-semibold text-white bg-sky-700 hover:bg-sky-800 rounded-lg cursor-pointer"
                >
                  Schedule Appointment
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredAppointments.map((appt) => {
                  const physio =
                    typeof appt.physiotherapistId === 'object' ? appt.physiotherapistId : null;
                  const treatment =
                    typeof appt.treatmentId === 'object' ? appt.treatmentId : null;
                  const canModify = appt.status === 'confirmed';

                  return (
                    <div
                      key={appt._id}
                      className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-500">
                          <span className="font-mono font-semibold text-slate-700 tabular-nums">
                            {appt.bookingCode}
                          </span>
                          <span aria-hidden="true">·</span>
                          <StatusLabel status={appt.status} />
                          <span aria-hidden="true">·</span>
                          <span className="tabular-nums">
                            {appt.date} · {formatTime12hClient(appt.startTime)} –{' '}
                            {formatTime12hClient(appt.endTime)} IST
                          </span>
                        </div>

                        <div className="text-base font-bold text-slate-900">
                          {treatment?.name || 'Physiotherapy Session'}
                        </div>
                        <div className="text-xs text-slate-600">
                          Specialist: <span className="font-medium">{physio?.name}</span> ·{' '}
                          {physio?.specialization}
                        </div>

                        {appt.patientNotes && (
                          <div className="text-xs text-slate-500">
                            Your note: {appt.patientNotes}
                          </div>
                        )}

                        {appt.sessionNotes && (
                          <div className="mt-2 pt-2 border-t border-slate-100 text-xs text-slate-700">
                            <span className="font-semibold text-teal-800">Clinician Notes: </span>
                            {appt.sessionNotes}
                            {appt.painScoreBefore !== undefined &&
                              appt.painScoreAfter !== undefined && (
                                <span className="ml-2 font-mono tabular-nums text-slate-500">
                                  (Pain Score: {appt.painScoreBefore}/10 → {appt.painScoreAfter}/10)
                                </span>
                              )}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-row md:flex-col items-center md:items-end justify-between gap-3 shrink-0">
                        <div className="text-base font-bold text-slate-900 tabular-nums">
                          {formatCurrencyINR(appt.price)}
                        </div>
                        {canModify && (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setRescheduleTarget(appt)}
                              className="px-3 py-1.5 text-xs font-medium text-sky-800 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-lg cursor-pointer whitespace-nowrap"
                            >
                              Reschedule
                            </button>
                            <button
                              type="button"
                              disabled={cancellingId === appt._id}
                              onClick={() => void handleCancel(appt._id)}
                              className="px-3 py-1.5 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg cursor-pointer whitespace-nowrap flex items-center gap-1"
                            >
                              {cancellingId === appt._id && (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              )}
                              <span>Cancel</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tab === 'book' && (
          <div className="space-y-4">
            <div>
              <h1 className="font-display text-2xl font-bold text-slate-900">
                Schedule New Physiotherapy Session
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Confirmed bookings immediately appear in your appointment history and release real-time notifications.
              </p>
            </div>
            <WeeklyBookingEngine
              treatments={treatments}
              physiotherapists={physiotherapists}
              onRequestAuth={() => {}}
              onBookingConfirmed={() => {
                void loadPortalData();
                onRefreshPublicData();
              }}
            />
          </div>
        )}

        {tab === 'notifications' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="font-display text-2xl font-bold text-slate-900">Notifications</h1>
                <p className="text-sm text-slate-500 mt-0.5">
                  Booking confirmations, reschedules, and clinician updates.
                </p>
              </div>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => void handleMarkAllRead()}
                  className="px-3 py-1.5 text-xs font-medium text-sky-800 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-lg cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Mark all read</span>
                </button>
              )}
            </div>

            {notifications.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-sm text-slate-500">
                No notifications yet.
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100">
                {notifications.map((n) => (
                  <div
                    key={n._id}
                    className={`p-4 flex items-start justify-between gap-4 ${
                      n.isRead ? 'bg-white' : 'bg-sky-50/40'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="text-sm font-semibold text-slate-900">{n.title}</div>
                      <p className="text-xs text-slate-600">{n.message}</p>
                      <div className="text-[11px] text-slate-400 tabular-nums">
                        {new Date(n.createdAt).toLocaleString('en-IN', {
                          timeZone: 'Asia/Kolkata',
                        })}{' '}
                        IST
                      </div>
                    </div>
                    {!n.isRead && (
                      <button
                        type="button"
                        onClick={() => void handleMarkRead(n._id)}
                        className="text-xs font-medium text-sky-700 hover:underline shrink-0 cursor-pointer"
                      >
                        Mark read
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'profile' && (
          <div className="space-y-5 max-w-2xl">
            <div>
              <h1 className="font-display text-2xl font-bold text-slate-900">
                Profile & Medical History
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Keep your contact details and injury history updated for your physiotherapist.
              </p>
            </div>

            <form
              onSubmit={handleSaveProfile}
              className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4"
            >
              {profileError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800">
                  {profileError}
                </div>
              )}
              {profileSaved && (
                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Profile saved to MongoDB successfully.</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Gender</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-sky-600"
                  >
                    <option value="">Select</option>
                    <option value="Female">Female</option>
                    <option value="Male">Male</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Address</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Emergency Contact
                </label>
                <input
                  type="text"
                  value={emergencyContact}
                  onChange={(e) => setEmergencyContact(e.target.value)}
                  placeholder="Name & phone number"
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Medical History & Conditions
                </label>
                <textarea
                  rows={3}
                  value={medicalHistory}
                  onChange={(e) => setMedicalHistory(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="px-5 py-2.5 bg-sky-700 hover:bg-sky-800 disabled:bg-sky-400 text-white text-sm font-semibold rounded-lg flex items-center gap-2 cursor-pointer"
                >
                  {savingProfile && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Save Profile</span>
                </button>
              </div>
            </form>
          </div>
        )}
      </main>

      <RescheduleModal
        appointment={rescheduleTarget}
        onClose={() => setRescheduleTarget(null)}
        onRescheduled={(updated) => {
          setAppointments((prev) =>
            prev.map((a) => (a._id === updated._id ? updated : a))
          );
          void loadPortalData();
        }}
      />
    </div>
  );
};
