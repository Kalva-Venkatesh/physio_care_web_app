import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  BarChart3,
  Calendar,
  CalendarOff,
  CheckCircle2,
  ClipboardList,
  Loader2,
  LogOut,
  Plus,
  Search,
  Stethoscope,
  Trash2,
  Users,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api, getApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  AdminAnalytics,
  Appointment,
  ClinicHoliday,
  Physiotherapist,
  Treatment,
  User,
  WeeklyDaySchedule,
} from '../types';
import { formatCurrencyINR, formatTime12hClient, StatusLabel } from './StatusBadge';

interface AdminDashboardProps {
  onBackToClinic: () => void;
  onDataChanged: () => void;
}

type AdminTab = 'analytics' | 'appointments' | 'treatments' | 'physiotherapists' | 'holidays_patients';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const IMAGE_PRESETS = [
  {
    label: 'Orthopedic Spine Therapy',
    url: '/src/assets/images/treatment_orthopedic_spine_1794932747804.jpg',
  },
  {
    label: 'Sports Kinesiology Rehab',
    url: '/src/assets/images/treatment_sports_therapy_1794932748959.jpg',
  },
  {
    label: 'Manual Myofascial Therapy',
    url: '/src/assets/images/treatment_manual_therapy_1794932748666.jpg',
  },
  {
    label: 'Joint Recovery Studio',
    url: '/src/assets/images/treatment_joint_rehab_1794932749789.jpg',
  },
];

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  onBackToClinic,
  onDataChanged,
}) => {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState<AdminTab>('analytics');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [physios, setPhysios] = useState<Physiotherapist[]>([]);
  const [holidays, setHolidays] = useState<ClinicHoliday[]>([]);
  const [patients, setPatients] = useState<
    Array<User & { _id: string; totalBookings: number; totalSpent: number }>
  >([]);

  // Appointment filters
  const [apptSearch, setApptSearch] = useState('');
  const [apptStatusFilter, setApptStatusFilter] = useState('all');

  // Treatment form state
  const [editingTreatmentId, setEditingTreatmentId] = useState<string | null>(null);
  const [tName, setTName] = useState('');
  const [tCategory, setTCategory] = useState('');
  const [tDesc, setTDesc] = useState('');
  const [tPrice, setTPrice] = useState('1200');
  const [tDuration, setTDuration] = useState('30');
  const [tImageUrl, setTImageUrl] = useState(IMAGE_PRESETS[0].url);
  const [tHighlights, setTHighlights] = useState('');
  const [savingTreatment, setSavingTreatment] = useState(false);

  // Physio editor & creation state
  const [selectedPhysio, setSelectedPhysio] = useState<Physiotherapist | null>(null);
  const [pTreatmentIds, setPTreatmentIds] = useState<string[]>([]);
  const [pSchedule, setPSchedule] = useState<WeeklyDaySchedule[]>([]);
  const [pUnavailable, setPUnavailable] = useState<string[]>([]);
  const [pNewUnavailable, setPNewUnavailable] = useState('');
  const [savingPhysio, setSavingPhysio] = useState(false);

  const [showNewPhysioForm, setShowNewPhysioForm] = useState(false);
  const [newPName, setNewPName] = useState('');
  const [newPEmail, setNewPEmail] = useState('');
  const [newPPassword, setNewPPassword] = useState('Physio@123');
  const [newPSpec, setNewPSpec] = useState('');
  const [newPQual, setNewPQual] = useState('');
  const [newPExp, setNewPExp] = useState('5');

  // Holiday form
  const [hDate, setHDate] = useState('');
  const [hTitle, setHTitle] = useState('');

  const loadAllAdmin = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [anaRes, appRes, trRes, phRes, holRes, patRes] = await Promise.all([
        api.get<AdminAnalytics>('/admin/analytics'),
        api.get<{ appointments: Appointment[] }>('/admin/appointments'),
        api.get<{ treatments: Treatment[] }>('/admin/treatments'),
        api.get<{ physiotherapists: Physiotherapist[] }>('/admin/physiotherapists'),
        api.get<{ holidays: ClinicHoliday[] }>('/admin/holidays'),
        api.get<{ patients: Array<User & { _id: string; totalBookings: number; totalSpent: number }> }>(
          '/admin/patients'
        ),
      ]);
      setAnalytics(anaRes.data);
      setAppointments(appRes.data.appointments);
      setTreatments(trRes.data.treatments);
      setPhysios(phRes.data.physiotherapists);
      setHolidays(holRes.data.holidays);
      setPatients(patRes.data.patients);

      if (phRes.data.physiotherapists.length > 0 && !selectedPhysio) {
        const first = phRes.data.physiotherapists[0];
        setSelectedPhysio(first);
        setPTreatmentIds(
          first.treatmentIds.map((t) => (typeof t === 'string' ? t : t._id))
        );
        setPSchedule(first.weeklySchedule);
        setPUnavailable(first.unavailableDates || []);
      }
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setLoading(false);
    }
  }, [selectedPhysio]);

  useEffect(() => {
    void loadAllAdmin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectPhysioForEdit = (p: Physiotherapist) => {
    setSelectedPhysio(p);
    setPTreatmentIds(p.treatmentIds.map((t) => (typeof t === 'string' ? t : t._id)));
    setPSchedule(p.weeklySchedule);
    setPUnavailable(p.unavailableDates || []);
    setNotice('');
  };

  const handleSaveTreatment = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingTreatment(true);
    setError('');
    setNotice('');
    try {
      const payload = {
        name: tName,
        category: tCategory,
        description: tDesc,
        price: Number(tPrice),
        durationMinutes: Number(tDuration),
        imageUrl: tImageUrl,
        highlights: tHighlights,
      };
      if (editingTreatmentId) {
        await api.put(`/admin/treatments/${editingTreatmentId}`, payload);
        setNotice('Treatment updated successfully.');
      } else {
        await api.post('/admin/treatments', payload);
        setNotice('New treatment added.');
      }
      setEditingTreatmentId(null);
      setTName('');
      setTCategory('');
      setTDesc('');
      setTPrice('1200');
      setTDuration('30');
      setTHighlights('');
      await loadAllAdmin();
      onDataChanged();
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setSavingTreatment(false);
    }
  };

  const startEditTreatment = (t: Treatment) => {
    setEditingTreatmentId(t._id);
    setTName(t.name);
    setTCategory(t.category);
    setTDesc(t.description);
    setTPrice(String(t.price));
    setTDuration(String(t.durationMinutes));
    setTImageUrl(t.imageUrl);
    setTHighlights((t.highlights || []).join(', '));
  };

  const handleToggleTreatmentActive = async (t: Treatment) => {
    try {
      await api.put(`/admin/treatments/${t._id}`, { isActive: !t.isActive });
      await loadAllAdmin();
      onDataChanged();
    } catch (err) {
      setError(getApiError(err));
    }
  };

  const handleSavePhysioSchedule = async () => {
    if (!selectedPhysio) return;
    setSavingPhysio(true);
    setError('');
    setNotice('');
    try {
      const { data } = await api.put<{ physiotherapist: Physiotherapist }>(
        `/admin/physiotherapists/${selectedPhysio._id}`,
        {
          treatmentIds: pTreatmentIds,
          weeklySchedule: pSchedule,
          unavailableDates: pUnavailable,
        }
      );
      setPhysios((prev) =>
        prev.map((p) => (p._id === data.physiotherapist._id ? data.physiotherapist : p))
      );
      setSelectedPhysio(data.physiotherapist);
      setNotice(`Saved assignments and weekly schedule for ${data.physiotherapist.name}.`);
      onDataChanged();
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setSavingPhysio(false);
    }
  };

  const handleCreatePhysio = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPhysio(true);
    setError('');
    try {
      const { data } = await api.post<{ physiotherapist: Physiotherapist }>(
        '/admin/physiotherapists',
        {
          name: newPName,
          email: newPEmail,
          password: newPPassword,
          specialization: newPSpec,
          qualifications: newPQual,
          experienceYears: Number(newPExp),
          treatmentIds: treatments.slice(0, 2).map((t) => t._id),
        }
      );
      setShowNewPhysioForm(false);
      setNewPName('');
      setNewPEmail('');
      setNewPSpec('');
      setNewPQual('');
      setNotice(`Added ${data.physiotherapist.name} to clinic roster.`);
      await loadAllAdmin();
      selectPhysioForEdit(data.physiotherapist);
      onDataChanged();
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setSavingPhysio(false);
    }
  };

  const handleAppointmentAction = async (id: string, status: 'completed' | 'cancelled') => {
    try {
      await api.patch(`/admin/appointments/${id}`, { status });
      setNotice(`Appointment marked as ${status}.`);
      await loadAllAdmin();
    } catch (err) {
      setError(getApiError(err));
    }
  };

  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hDate || !hTitle) return;
    try {
      await api.post('/admin/holidays', { date: hDate, title: hTitle });
      setHDate('');
      setHTitle('');
      setNotice('Clinic holiday added. Booking slots on that date are now blocked.');
      await loadAllAdmin();
      onDataChanged();
    } catch (err) {
      setError(getApiError(err));
    }
  };

  const handleDeleteHoliday = async (id: string) => {
    try {
      await api.delete(`/admin/holidays/${id}`);
      await loadAllAdmin();
      onDataChanged();
    } catch (err) {
      setError(getApiError(err));
    }
  };

  const handleTogglePatientStatus = async (id: string, current: boolean) => {
    try {
      await api.patch(`/admin/patients/${id}/status`, { isActive: !current });
      await loadAllAdmin();
    } catch (err) {
      setError(getApiError(err));
    }
  };

  const filteredAppts = appointments.filter((a) => {
    if (apptStatusFilter !== 'all' && a.status !== apptStatusFilter) return false;
    if (!apptSearch.trim()) return true;
    const q = apptSearch.toLowerCase();
    const patName = typeof a.patientId === 'object' ? a.patientId.name.toLowerCase() : '';
    const phyName =
      typeof a.physiotherapistId === 'object' ? a.physiotherapistId.name.toLowerCase() : '';
    return (
      a.bookingCode.toLowerCase().includes(q) || patName.includes(q) || phyName.includes(q)
    );
  });

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 flex flex-col lg:flex-row">
      <aside className="w-full lg:w-64 bg-white border-b lg:border-b-0 lg:border-r border-slate-200 p-5 flex flex-col justify-between shrink-0">
        <div className="space-y-6">
          <div>
            <div className="text-xs font-medium text-sky-700">Clinic Administration</div>
            <div className="font-display text-base font-bold text-slate-900 mt-0.5 truncate">
              {user?.name}
            </div>
            <div className="text-xs text-slate-500 truncate">{user?.email}</div>
          </div>

          <nav className="space-y-1">
            <button
              type="button"
              onClick={() => setTab('analytics')}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
                tab === 'analytics'
                  ? 'bg-sky-50 text-sky-800'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Analytics & Revenue</span>
            </button>
            <button
              type="button"
              onClick={() => setTab('appointments')}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
                tab === 'appointments'
                  ? 'bg-sky-50 text-sky-800'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>Appointments</span>
            </button>
            <button
              type="button"
              onClick={() => setTab('treatments')}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
                tab === 'treatments'
                  ? 'bg-sky-50 text-sky-800'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <ClipboardList className="w-4 h-4" />
              <span>Treatments & Pricing</span>
            </button>
            <button
              type="button"
              onClick={() => setTab('physiotherapists')}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
                tab === 'physiotherapists'
                  ? 'bg-sky-50 text-sky-800'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Stethoscope className="w-4 h-4" />
              <span>Specialists & Schedules</span>
            </button>
            <button
              type="button"
              onClick={() => setTab('holidays_patients')}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
                tab === 'holidays_patients'
                  ? 'bg-sky-50 text-sky-800'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Holidays & Patients</span>
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

      <main className="flex-1 p-5 sm:p-8 max-w-7xl space-y-6">
        {error && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-800">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
        {notice && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2.5 text-xs text-emerald-800">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{notice}</span>
          </div>
        )}

        {loading && !analytics ? (
          <div className="py-20 flex items-center justify-center gap-2 text-sm text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin text-sky-700" />
            <span>Loading clinic telemetry & records...</span>
          </div>
        ) : (
          <>
            {tab === 'analytics' && analytics && (
              <div className="space-y-6">
                <div>
                  <h1 className="font-display text-2xl font-bold text-slate-900">
                    Clinic Analytics & Revenue
                  </h1>
                  <p className="text-sm text-slate-500 mt-0.5">
                    Live aggregations from MongoDB appointments, treatments, and specialist schedules.
                  </p>
                </div>

                {/* KPI Strip */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white border border-slate-200 rounded-xl p-5">
                    <div className="text-xs font-medium text-slate-500">Booked Revenue</div>
                    <div className="text-2xl font-bold text-slate-900 tabular-nums mt-1">
                      {formatCurrencyINR(analytics.summary.totalRevenue)}
                    </div>
                    <div className="text-xs text-teal-700 tabular-nums mt-1">
                      Completed: {formatCurrencyINR(analytics.summary.completedRevenue)}
                    </div>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-xl p-5">
                    <div className="text-xs font-medium text-slate-500">Total Appointments</div>
                    <div className="text-2xl font-bold text-slate-900 tabular-nums mt-1">
                      {analytics.summary.totalAppointments}
                    </div>
                    <div className="text-xs text-slate-500 tabular-nums mt-1">
                      {analytics.summary.confirmedCount} upcoming · {analytics.summary.completedCount}{' '}
                      done
                    </div>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-xl p-5">
                    <div className="text-xs font-medium text-slate-500">Registered Patients</div>
                    <div className="text-2xl font-bold text-slate-900 tabular-nums mt-1">
                      {analytics.summary.totalPatients}
                    </div>
                    <div className="text-xs text-slate-500 tabular-nums mt-1">
                      {analytics.summary.cancelledCount} cancelled overall
                    </div>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-xl p-5">
                    <div className="text-xs font-medium text-slate-500">Active Roster</div>
                    <div className="text-2xl font-bold text-slate-900 tabular-nums mt-1">
                      {analytics.summary.totalPhysiotherapists} Specialists
                    </div>
                    <div className="text-xs text-slate-500 tabular-nums mt-1">
                      {analytics.summary.activeTreatments} active treatments
                    </div>
                  </div>
                </div>

                {/* Recharts Row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white border border-slate-200 rounded-2xl p-5">
                    <div className="text-sm font-bold text-slate-900 mb-1">
                      Daily Revenue (INR · Last 14-Day Window)
                    </div>
                    <p className="text-xs text-slate-500 mb-4">
                      Includes completed and confirmed billable sessions
                    </p>
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={analytics.revenueByDay}>
                          <defs>
                            <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#0284c7" stopOpacity={0.28} />
                              <stop offset="95%" stopColor="#0284c7" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} />
                          <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                          <Tooltip
                            formatter={(value) => [formatCurrencyINR(Number(value)), 'Revenue']}
                          />
                          <Area
                            type="monotone"
                            dataKey="revenue"
                            stroke="#0369a1"
                            strokeWidth={2}
                            fillOpacity={1}
                            fill="url(#revGrad)"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-2xl p-5">
                    <div className="text-sm font-bold text-slate-900 mb-1">
                      Revenue by Physiotherapy Treatment
                    </div>
                    <p className="text-xs text-slate-500 mb-4">
                      Top-performing clinical service lines
                    </p>
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={analytics.byTreatment} layout="vertical" margin={{ left: 10 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} />
                          <YAxis
                            type="category"
                            dataKey="name"
                            width={145}
                            tick={{ fontSize: 11, fill: '#334155' }}
                          />
                          <Tooltip
                            formatter={(value) => [formatCurrencyINR(Number(value)), 'Revenue']}
                          />
                          <Bar dataKey="revenue" fill="#0d9488" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* Specialist Utilization Table */}
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-200 text-sm font-bold text-slate-900">
                    Specialist Performance Breakdown
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 text-xs text-slate-500 border-b border-slate-200">
                        <tr>
                          <th className="text-left px-5 py-3 font-medium">Physiotherapist</th>
                          <th className="text-right px-5 py-3 font-medium">Total Bookings</th>
                          <th className="text-right px-5 py-3 font-medium">Completed</th>
                          <th className="text-right px-5 py-3 font-medium">Revenue</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {analytics.byPhysiotherapist.map((row) => (
                          <tr key={row.name} className="hover:bg-slate-50/70">
                            <td className="px-5 py-3 font-medium text-slate-900">{row.name}</td>
                            <td className="px-5 py-3 text-right tabular-nums text-slate-700">
                              {row.bookings}
                            </td>
                            <td className="px-5 py-3 text-right tabular-nums text-slate-700">
                              {row.completed}
                            </td>
                            <td className="px-5 py-3 text-right tabular-nums font-semibold text-slate-900">
                              {formatCurrencyINR(row.revenue)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {tab === 'appointments' && (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h1 className="font-display text-2xl font-bold text-slate-900">
                      Clinic Appointments
                    </h1>
                    <p className="text-sm text-slate-500 mt-0.5">
                      Monitor, complete, or cancel scheduled bookings across all specialists.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        value={apptSearch}
                        onChange={(e) => setApptSearch(e.target.value)}
                        placeholder="Search code, patient, doctor..."
                        className="pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-sky-600"
                      />
                    </div>
                    <select
                      value={apptStatusFilter}
                      onChange={(e) => setApptStatusFilter(e.target.value)}
                      className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                    >
                      <option value="all">All Statuses</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 text-xs text-slate-500 border-b border-slate-200">
                        <tr>
                          <th className="text-left px-4 py-3 font-medium">Code</th>
                          <th className="text-left px-4 py-3 font-medium">Date & IST Time</th>
                          <th className="text-left px-4 py-3 font-medium">Patient</th>
                          <th className="text-left px-4 py-3 font-medium">Physiotherapist</th>
                          <th className="text-left px-4 py-3 font-medium">Treatment</th>
                          <th className="text-right px-4 py-3 font-medium">Fee</th>
                          <th className="text-left px-4 py-3 font-medium">Status</th>
                          <th className="text-right px-4 py-3 font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredAppts.map((a) => {
                          const pat = typeof a.patientId === 'object' ? a.patientId : null;
                          const phy =
                            typeof a.physiotherapistId === 'object' ? a.physiotherapistId : null;
                          const tr = typeof a.treatmentId === 'object' ? a.treatmentId : null;

                          return (
                            <tr key={a._id} className="hover:bg-slate-50/70">
                              <td className="px-4 py-3 font-mono text-xs tabular-nums text-slate-700">
                                {a.bookingCode}
                              </td>
                              <td className="px-4 py-3 text-xs tabular-nums text-slate-700">
                                {a.date} · {formatTime12hClient(a.startTime)}
                              </td>
                              <td className="px-4 py-3 font-medium text-slate-900">
                                {pat?.name || 'Patient'}
                              </td>
                              <td className="px-4 py-3 text-slate-600">{phy?.name}</td>
                              <td className="px-4 py-3 text-slate-600">{tr?.name}</td>
                              <td className="px-4 py-3 text-right tabular-nums font-medium">
                                {formatCurrencyINR(a.price)}
                              </td>
                              <td className="px-4 py-3">
                                <StatusLabel status={a.status} />
                              </td>
                              <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                                {a.status === 'confirmed' && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => void handleAppointmentAction(a._id, 'completed')}
                                      className="text-xs font-medium text-emerald-700 hover:underline cursor-pointer"
                                    >
                                      Complete
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => void handleAppointmentAction(a._id, 'cancelled')}
                                      className="text-xs font-medium text-rose-700 hover:underline cursor-pointer"
                                    >
                                      Cancel
                                    </button>
                                  </>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {tab === 'treatments' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <form
                  onSubmit={handleSaveTreatment}
                  className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <h2 className="font-display text-lg font-bold text-slate-900">
                      {editingTreatmentId ? 'Edit Treatment' : 'Add Physiotherapy Treatment'}
                    </h2>
                    {editingTreatmentId && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingTreatmentId(null);
                          setTName('');
                          setTCategory('');
                          setTDesc('');
                        }}
                        className="text-xs text-slate-500 hover:text-slate-900 cursor-pointer"
                      >
                        Cancel Edit
                      </button>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Treatment Name
                    </label>
                    <input
                      type="text"
                      required
                      value={tName}
                      onChange={(e) => setTName(e.target.value)}
                      placeholder="e.g. Pelvic Floor Rehabilitation"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Category
                      </label>
                      <input
                        type="text"
                        required
                        value={tCategory}
                        onChange={(e) => setTCategory(e.target.value)}
                        placeholder="Orthopedic"
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Price (₹)
                      </label>
                      <input
                        type="number"
                        required
                        min={100}
                        value={tPrice}
                        onChange={(e) => setTPrice(e.target.value)}
                        className="w-full px-3 py-2 text-sm tabular-nums border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Duration
                      </label>
                      <select
                        value={tDuration}
                        onChange={(e) => setTDuration(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                      >
                        <option value="30">30 min</option>
                        <option value="60">60 min</option>
                        <option value="90">90 min</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Clinical Image
                    </label>
                    <select
                      value={tImageUrl}
                      onChange={(e) => setTImageUrl(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                    >
                      {IMAGE_PRESETS.map((img) => (
                        <option key={img.label} value={img.url}>
                          {img.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Description
                    </label>
                    <textarea
                      rows={3}
                      required
                      value={tDesc}
                      onChange={(e) => setTDesc(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Clinical Highlights (comma-separated)
                    </label>
                    <input
                      type="text"
                      value={tHighlights}
                      onChange={(e) => setTHighlights(e.target.value)}
                      placeholder="Posture Audit, Mobility Drills"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={savingTreatment}
                    className="w-full py-2.5 bg-sky-700 hover:bg-sky-800 text-white text-sm font-semibold rounded-lg flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {savingTreatment && <Loader2 className="w-4 h-4 animate-spin" />}
                    <span>{editingTreatmentId ? 'Update Treatment' : 'Create Treatment'}</span>
                  </button>
                </form>

                <div className="lg:col-span-7 space-y-3">
                  {treatments.map((t) => (
                    <div
                      key={t._id}
                      className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between gap-4"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-900 truncate">
                            {t.name}
                          </span>
                          {!t.isActive && (
                            <span className="text-xs text-rose-600 font-medium">Inactive</span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5 tabular-nums">
                          {t.category} · {t.durationMinutes} min · {formatCurrencyINR(t.price)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => startEditTreatment(t)}
                          className="px-3 py-1.5 text-xs font-medium text-sky-800 bg-sky-50 hover:bg-sky-100 rounded-lg cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleToggleTreatmentActive(t)}
                          className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                        >
                          {t.isActive ? 'Disable' : 'Enable'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === 'physiotherapists' && (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h1 className="font-display text-2xl font-bold text-slate-900">
                      Physiotherapists, Treatment Assignments & Schedules
                    </h1>
                    <p className="text-sm text-slate-500 mt-0.5">
                      Configure eligible treatments and weekly IST hours per specialist.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowNewPhysioForm((prev) => !prev)}
                    className="px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Physiotherapist</span>
                  </button>
                </div>

                {showNewPhysioForm && (
                  <form
                    onSubmit={handleCreatePhysio}
                    className="bg-white border border-slate-200 rounded-2xl p-6 grid grid-cols-1 sm:grid-cols-3 gap-4"
                  >
                    <input
                      type="text"
                      required
                      value={newPName}
                      onChange={(e) => setNewPName(e.target.value)}
                      placeholder="Full Name (e.g. Dr. Arjun Menon)"
                      className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                    <input
                      type="email"
                      required
                      value={newPEmail}
                      onChange={(e) => setNewPEmail(e.target.value)}
                      placeholder="Email Address"
                      className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                    <input
                      type="password"
                      required
                      value={newPPassword}
                      onChange={(e) => setNewPPassword(e.target.value)}
                      placeholder="Initial Password"
                      className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                    <input
                      type="text"
                      required
                      value={newPSpec}
                      onChange={(e) => setNewPSpec(e.target.value)}
                      placeholder="Specialization"
                      className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                    <input
                      type="text"
                      required
                      value={newPQual}
                      onChange={(e) => setNewPQual(e.target.value)}
                      placeholder="Qualifications (MPT, MIAP)"
                      className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={newPExp}
                        onChange={(e) => setNewPExp(e.target.value)}
                        placeholder="Years"
                        className="w-24 px-3 py-2 text-sm border border-slate-300 rounded-lg"
                      />
                      <button
                        type="submit"
                        disabled={savingPhysio}
                        className="flex-1 bg-sky-700 hover:bg-sky-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
                      >
                        Create Account
                      </button>
                    </div>
                  </form>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  <div className="lg:col-span-4 space-y-2">
                    {physios.map((p) => (
                      <button
                        key={p._id}
                        type="button"
                        onClick={() => selectPhysioForEdit(p)}
                        className={`w-full text-left p-4 rounded-xl border transition-colors cursor-pointer ${
                          selectedPhysio?._id === p._id
                            ? 'bg-sky-50 border-sky-600'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="text-sm font-bold text-slate-900">{p.name}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{p.specialization}</div>
                        <div className="text-xs text-teal-700 mt-1 tabular-nums">
                          {p.treatmentIds.length} assigned treatments
                        </div>
                      </button>
                    ))}
                  </div>

                  {selectedPhysio && (
                    <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl p-6 space-y-6">
                      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
                        <div>
                          <h2 className="font-display text-lg font-bold text-slate-900">
                            {selectedPhysio.name}
                          </h2>
                          <p className="text-xs text-slate-500">{selectedPhysio.qualifications}</p>
                        </div>
                        <button
                          type="button"
                          disabled={savingPhysio}
                          onClick={() => void handleSavePhysioSchedule()}
                          className="px-5 py-2 bg-sky-700 hover:bg-sky-800 text-white text-xs font-semibold rounded-lg flex items-center gap-2 cursor-pointer"
                        >
                          {savingPhysio && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                          <span>Save Schedule & Assignments</span>
                        </button>
                      </div>

                      <div>
                        <div className="text-xs font-semibold text-slate-700 mb-2">
                          Assigned Physiotherapy Treatments
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {treatments.map((t) => {
                            const checked = pTreatmentIds.includes(t._id);
                            return (
                              <label
                                key={t._id}
                                className="flex items-center gap-2.5 p-2.5 rounded-lg border border-slate-200 text-xs cursor-pointer hover:bg-slate-50"
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setPTreatmentIds([...pTreatmentIds, t._id]);
                                    } else {
                                      setPTreatmentIds(pTreatmentIds.filter((id) => id !== t._id));
                                    }
                                  }}
                                  className="w-4 h-4 accent-sky-700"
                                />
                                <span className="font-medium text-slate-800">{t.name}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <div className="text-xs font-semibold text-slate-700 mb-2">
                          Weekly Working Hours & Break Window (IST)
                        </div>
                        <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl">
                          {pSchedule.map((day, idx) => (
                            <div
                              key={day.dayOfWeek}
                              className="p-3 flex flex-wrap items-center justify-between gap-2 text-xs"
                            >
                              <label className="flex items-center gap-2 w-24 font-medium text-slate-800 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={day.isWorking}
                                  onChange={(e) => {
                                    const next = [...pSchedule];
                                    next[idx] = { ...day, isWorking: e.target.checked };
                                    setPSchedule(next);
                                  }}
                                  className="accent-sky-700"
                                />
                                <span>{DAY_NAMES[day.dayOfWeek]}</span>
                              </label>
                              {day.isWorking ? (
                                <div className="flex flex-wrap items-center gap-2 tabular-nums">
                                  <input
                                    type="time"
                                    value={day.startTime}
                                    onChange={(e) => {
                                      const next = [...pSchedule];
                                      next[idx] = { ...day, startTime: e.target.value };
                                      setPSchedule(next);
                                    }}
                                    className="px-2 py-1 border border-slate-300 rounded"
                                  />
                                  <span>to</span>
                                  <input
                                    type="time"
                                    value={day.endTime}
                                    onChange={(e) => {
                                      const next = [...pSchedule];
                                      next[idx] = { ...day, endTime: e.target.value };
                                      setPSchedule(next);
                                    }}
                                    className="px-2 py-1 border border-slate-300 rounded"
                                  />
                                  <span className="text-slate-400 ml-2">Break:</span>
                                  <input
                                    type="time"
                                    value={day.breakStart}
                                    onChange={(e) => {
                                      const next = [...pSchedule];
                                      next[idx] = { ...day, breakStart: e.target.value };
                                      setPSchedule(next);
                                    }}
                                    className="px-2 py-1 border border-slate-300 rounded"
                                  />
                                  <span>–</span>
                                  <input
                                    type="time"
                                    value={day.breakEnd}
                                    onChange={(e) => {
                                      const next = [...pSchedule];
                                      next[idx] = { ...day, breakEnd: e.target.value };
                                      setPSchedule(next);
                                    }}
                                    className="px-2 py-1 border border-slate-300 rounded"
                                  />
                                </div>
                              ) : (
                                <span className="text-slate-400">Off Day</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <div className="text-xs font-semibold text-slate-700 mb-2">
                          Unavailable Dates
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                          <input
                            type="date"
                            value={pNewUnavailable}
                            onChange={(e) => setPNewUnavailable(e.target.value)}
                            className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (pNewUnavailable && !pUnavailable.includes(pNewUnavailable)) {
                                setPUnavailable([...pUnavailable, pNewUnavailable].sort());
                                setPNewUnavailable('');
                              }
                            }}
                            className="px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                          >
                            Add Date
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {pUnavailable.map((d) => (
                            <span
                              key={d}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded text-xs font-mono"
                            >
                              {d}
                              <button
                                type="button"
                                onClick={() => setPUnavailable(pUnavailable.filter((x) => x !== d))}
                                className="text-slate-400 hover:text-rose-600 cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {tab === 'holidays_patients' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Clinic Holidays */}
                <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
                  <div className="flex items-center gap-2">
                    <CalendarOff className="w-5 h-5 text-sky-700" />
                    <h2 className="font-display text-lg font-bold text-slate-900">
                      Clinic-Wide Holidays
                    </h2>
                  </div>

                  <form onSubmit={handleAddHoliday} className="space-y-3">
                    <input
                      type="date"
                      required
                      value={hDate}
                      onChange={(e) => setHDate(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg tabular-nums"
                    />
                    <input
                      type="text"
                      required
                      value={hTitle}
                      onChange={(e) => setHTitle(e.target.value)}
                      placeholder="Holiday reason (e.g. Republic Day)"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                    <button
                      type="submit"
                      className="w-full py-2 bg-sky-700 hover:bg-sky-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
                    >
                      Add Clinic Holiday
                    </button>
                  </form>

                  <div className="divide-y divide-slate-100 border-t border-slate-100 pt-2">
                    {holidays.map((h) => (
                      <div key={h._id} className="py-2.5 flex items-center justify-between gap-2">
                        <div>
                          <div className="text-xs font-mono font-semibold text-slate-800 tabular-nums">
                            {h.date}
                          </div>
                          <div className="text-xs text-slate-500">{h.title}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleDeleteHoliday(h._id)}
                          aria-label="Delete holiday"
                          className="p-1.5 text-slate-400 hover:text-rose-600 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Patients Directory */}
                <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-200">
                    <h2 className="font-display text-lg font-bold text-slate-900">
                      Registered Patients ({patients.length})
                    </h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 text-xs text-slate-500 border-b border-slate-200">
                        <tr>
                          <th className="text-left px-4 py-3 font-medium">Patient</th>
                          <th className="text-left px-4 py-3 font-medium">Phone</th>
                          <th className="text-right px-4 py-3 font-medium">Visits</th>
                          <th className="text-right px-4 py-3 font-medium">Spent</th>
                          <th className="text-right px-4 py-3 font-medium">Account</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {patients.map((p) => (
                          <tr key={p._id} className="hover:bg-slate-50/70">
                            <td className="px-4 py-3">
                              <div className="font-medium text-slate-900">{p.name}</div>
                              <div className="text-xs text-slate-500">{p.email}</div>
                            </td>
                            <td className="px-4 py-3 text-xs tabular-nums text-slate-600">
                              {p.phone || '—'}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                              {p.totalBookings}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums font-medium text-slate-900">
                              {formatCurrencyINR(p.totalSpent)}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                type="button"
                                onClick={() =>
                                  void handleTogglePatientStatus(p._id, p.isActive !== false)
                                }
                                className={`text-xs font-medium hover:underline cursor-pointer ${
                                  p.isActive !== false ? 'text-emerald-700' : 'text-rose-700'
                                }`}
                              >
                                {p.isActive !== false ? 'Active (Disable)' : 'Inactive (Enable)'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};
