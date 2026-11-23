import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { MotionConfig, motion } from 'motion/react';
import {
  ArrowRight,
  CalendarCheck,
  Clock,
  Loader2,
  MapPin,
  ShieldCheck,
  Stethoscope,
} from 'lucide-react';
import { api, getApiError } from './api/client';
import { AdminDashboard } from './components/AdminDashboard';
import { AuthModal } from './components/AuthModal';
import { ClinicImage } from './components/ClinicImage';
import { Navbar } from './components/Navbar';
import { PatientPortal } from './components/PatientPortal';
import { PhysioDashboard } from './components/PhysioDashboard';
import { formatCurrencyINR } from './components/StatusBadge';
import { WeeklyBookingEngine } from './components/WeeklyBookingEngine';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ClinicHoliday, Physiotherapist, Treatment } from './types';

const HERO_CLINIC_IMG = '/src/assets/images/hero_physio_clinic_1794932747135.jpg';

const PhysioCareShell: React.FC = () => {
  const { user, loading: authLoading } = useAuth();

  const [activeView, setActiveView] = useState<'clinic' | 'portal'>('clinic');
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authContextMsg, setAuthContextMsg] = useState<string | undefined>(undefined);

  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [physiotherapists, setPhysiotherapists] = useState<Physiotherapist[]>([]);
  const [holidays, setHolidays] = useState<ClinicHoliday[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState('');

  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [preselectedTreatmentId, setPreselectedTreatmentId] = useState<string | undefined>(
    undefined
  );
  const [preselectedPhysioId, setPreselectedPhysioId] = useState<string | undefined>(undefined);

  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true);
    setCatalogError('');
    try {
      const [trRes, phRes, holRes] = await Promise.all([
        api.get<{ treatments: Treatment[] }>('/treatments'),
        api.get<{ physiotherapists: Physiotherapist[] }>('/physiotherapists'),
        api.get<{ holidays: ClinicHoliday[] }>('/holidays'),
      ]);
      setTreatments(trRes.data.treatments);
      setPhysiotherapists(phRes.data.physiotherapists);
      setHolidays(holRes.data.holidays);
    } catch (err) {
      setCatalogError(getApiError(err, 'Unable to load clinic catalog.'));
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  const categories = useMemo(() => {
    const cats = Array.from(new Set(treatments.map((t) => t.category)));
    return ['All', ...cats];
  }, [treatments]);

  const visibleTreatments = useMemo(() => {
    if (categoryFilter === 'All') return treatments;
    return treatments.filter((t) => t.category === categoryFilter);
  }, [treatments, categoryFilter]);

  const scrollToSection = (sectionId: string) => {
    if (activeView !== 'clinic') {
      setActiveView('clinic');
      setTimeout(() => {
        if (sectionId === 'top') {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
          document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
        }
      }, 60);
      return;
    }

    if (sectionId === 'top') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleSelectTreatmentForBooking = (treatmentId: string) => {
    setPreselectedTreatmentId(treatmentId);
    scrollToSection('book');
  };

  const handleSelectPhysioForBooking = (physio: Physiotherapist) => {
    setPreselectedPhysioId(physio._id);
    if (physio.treatmentIds.length > 0) {
      const firstId =
        typeof physio.treatmentIds[0] === 'string'
          ? physio.treatmentIds[0]
          : physio.treatmentIds[0]._id;
      setPreselectedTreatmentId(firstId);
    }
    scrollToSection('book');
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white text-slate-600 gap-2 text-sm">
        <Loader2 className="w-5 h-5 animate-spin text-sky-700" />
        <span>Loading PhysioCare...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-white text-slate-900">
      <Navbar
        user={user}
        activeView={activeView}
        onNavigateSection={scrollToSection}
        onOpenPortal={() => setActiveView('portal')}
        onOpenAuth={() => {
          setAuthContextMsg(undefined);
          setAuthModalOpen(true);
        }}
      />

      {activeView === 'portal' && user ? (
        user.role === 'admin' ? (
          <AdminDashboard
            onBackToClinic={() => setActiveView('clinic')}
            onDataChanged={() => void loadCatalog()}
          />
        ) : user.role === 'physiotherapist' ? (
          <PhysioDashboard onBackToClinic={() => setActiveView('clinic')} />
        ) : (
          <PatientPortal
            treatments={treatments}
            physiotherapists={physiotherapists}
            onBackToClinic={() => setActiveView('clinic')}
            onRefreshPublicData={() => void loadCatalog()}
          />
        )
      ) : (
        <main className="flex-1">
          {/* Hero Split Section */}
          <section className="border-b border-slate-200 bg-gradient-to-b from-sky-50/50 via-white to-white">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                  className="lg:col-span-6 flex flex-col justify-center space-y-6"
                >
                  <div className="text-xs font-semibold tracking-wide text-teal-700">
                    PhysioCare Rehabilitation Center · Bengaluru (IST)
                  </div>

                  <h1
                    className="font-display font-bold tracking-tight text-slate-900 leading-[1.12]"
                    style={{
                      fontSize: 'clamp(2.25rem, 4vw, 3.5rem)',
                      textWrap: 'balance',
                    }}
                  >
                    Targeted Physiotherapy & Clinical Recovery on Your Schedule
                  </h1>

                  <p className="text-base text-slate-600 leading-relaxed max-w-xl">
                    Book verified 30-minute and 60-minute sessions with board-certified orthopedic,
                    sports, and neurological physiotherapists. Real-time Asia/Kolkata availability
                    prevents double-bookings and confirms your appointment immediately.
                  </p>

                  <div className="flex flex-wrap items-center gap-4 pt-1">
                    <button
                      type="button"
                      onClick={() => scrollToSection('book')}
                      className="px-6 py-3 bg-sky-700 hover:bg-sky-800 text-white text-sm font-semibold rounded-xl transition-colors inline-flex items-center gap-2 cursor-pointer whitespace-nowrap"
                    >
                      <span>Schedule Your Session</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => scrollToSection('treatments')}
                      className="px-4 py-3 text-sm font-semibold text-sky-800 hover:text-sky-950 hover:underline underline-offset-4 cursor-pointer whitespace-nowrap"
                    >
                      Browse Treatments
                    </button>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.05 }}
                  className="lg:col-span-6"
                >
                  <div className="h-72 sm:h-96 lg:h-full min-h-[340px] rounded-2xl overflow-hidden border border-slate-200 bg-slate-100">
                    <ClinicImage
                      src={HERO_CLINIC_IMG}
                      alt="PhysioCare modern rehabilitation clinic treatment suite"
                      className="w-full h-full object-cover"
                      fallbackLabel="PhysioCare Rehabilitation Suite"
                    />
                  </div>
                </motion.div>
              </div>

              {/* 4-column Proof Strip below Hero Split */}
              <div className="mt-12 pt-8 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-sm font-bold text-slate-900">Dynamic 30-Min Slots</div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Generated live from each specialist’s working hours and lunch breaks.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 text-sky-700 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-sm font-bold text-slate-900">Atomic Slot Locking</div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Server-side concurrency locks guarantee zero overlapping bookings.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CalendarCheck className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-sm font-bold text-slate-900">Instant Confirmation</div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Reschedule or cancel anytime with immediate calendar updates.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Stethoscope className="w-5 h-5 text-sky-700 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-sm font-bold text-slate-900">Tracked Outcomes</div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Clinicians log pain-score changes and home exercise notes after visits.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Treatments Catalog Section */}
          <section id="treatments" className="py-16 border-b border-slate-200 bg-white">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-900">
                    Evidence-Based Physiotherapy Treatments
                  </h2>
                  <p className="text-sm text-slate-600 mt-1 max-w-2xl">
                    Transparent session pricing and durations. Select any treatment to inspect
                    available weekly slots with qualified specialists.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategoryFilter(cat)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                        categoryFilter === cat
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {catalogLoading ? (
                <div className="py-16 flex items-center justify-center gap-2 text-sm text-slate-500">
                  <Loader2 className="w-5 h-5 animate-spin text-sky-700" />
                  <span>Loading clinical treatments...</span>
                </div>
              ) : catalogError ? (
                <div className="p-6 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-800">
                  {catalogError}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {visibleTreatments.map((treatment) => (
                    <article
                      key={treatment._id}
                      className="bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col justify-between hover:border-sky-300 transition-colors"
                    >
                      <div>
                        <div className="aspect-[4/3] bg-slate-100 overflow-hidden">
                          <ClinicImage
                            src={treatment.imageUrl}
                            alt={treatment.name}
                            className="w-full h-full object-cover"
                            fallbackLabel={treatment.name}
                          />
                        </div>
                        <div className="p-6 space-y-3">
                          <div className="flex items-center gap-2 text-xs text-slate-500 tabular-nums">
                            <span>{treatment.category}</span>
                            <span aria-hidden="true">·</span>
                            <span>{treatment.durationMinutes} min</span>
                            <span aria-hidden="true">·</span>
                            <span className="font-semibold text-sky-800">
                              {formatCurrencyINR(treatment.price)}
                            </span>
                          </div>

                          <h3 className="font-display text-lg font-bold text-slate-900">
                            {treatment.name}
                          </h3>

                          <p className="text-sm text-slate-600 leading-relaxed">
                            {treatment.description}
                          </p>

                          {treatment.highlights && treatment.highlights.length > 0 && (
                            <ul className="pt-2 space-y-1 text-xs text-slate-500 border-t border-slate-100">
                              {treatment.highlights.map((item) => (
                                <li key={item}>• {item}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>

                      <div className="px-6 pb-6 pt-2">
                        <button
                          type="button"
                          onClick={() => handleSelectTreatmentForBooking(treatment._id)}
                          className="w-full py-2.5 px-4 text-xs font-semibold text-sky-800 bg-sky-50 hover:bg-sky-700 hover:text-white border border-sky-200 hover:border-sky-700 rounded-xl transition-colors cursor-pointer"
                        >
                          Check Availability & Book
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Specialists Section */}
          <section id="specialists" className="py-16 border-b border-slate-200 bg-slate-50/70">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
              <div>
                <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-900">
                  Meet Our Physiotherapists
                </h2>
                <p className="text-sm text-slate-600 mt-1 max-w-2xl">
                  Experienced clinical specialists across orthopedic spine care, sports injury
                  biomechanics, and neurological balance recovery.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {physiotherapists.map((physio) => {
                  const assignedNames = physio.treatmentIds
                    .map((t) => (typeof t === 'object' ? t.name : ''))
                    .filter(Boolean);

                  return (
                    <article
                      key={physio._id}
                      className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col justify-between space-y-5"
                    >
                      <div className="space-y-4">
                        <div className="flex items-center gap-4">
                          <div className="w-20 h-20 rounded-xl overflow-hidden border border-slate-200 shrink-0 bg-slate-100">
                            <ClinicImage
                              src={physio.imageUrl}
                              alt={physio.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-display text-lg font-bold text-slate-900 truncate">
                              {physio.name}
                            </h3>
                            <div className="text-xs font-medium text-teal-700">
                              {physio.specialization}
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5 tabular-nums">
                              {physio.experienceYears} years experience
                            </div>
                          </div>
                        </div>

                        <div className="text-xs font-medium text-slate-700">
                          {physio.qualifications}
                        </div>

                        <p className="text-sm text-slate-600 leading-relaxed">{physio.bio}</p>

                        {assignedNames.length > 0 && (
                          <div className="pt-3 border-t border-slate-100 text-xs text-slate-500">
                            <span className="font-semibold text-slate-700">Treatments: </span>
                            {assignedNames.join(' · ')}
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleSelectPhysioForBooking(physio)}
                        className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition-colors cursor-pointer"
                      >
                        Book with {physio.name.split(' ').slice(0, 2).join(' ')}
                      </button>
                    </article>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Interactive Weekly Booking Section */}
          <section id="book" className="py-16 bg-white">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-900">
                    Book an Appointment
                  </h2>
                  <p className="text-sm text-slate-600 mt-1">
                    Only genuinely open 30-minute time slots are displayed after excluding lunch
                    breaks, clinic holidays, and existing appointments.
                  </p>
                </div>

                {holidays.length > 0 && (
                  <div className="text-xs text-slate-500 tabular-nums">
                    Upcoming Clinic Holiday: {holidays[0].date} ({holidays[0].title})
                  </div>
                )}
              </div>

              <WeeklyBookingEngine
                treatments={treatments}
                physiotherapists={physiotherapists}
                preselectedTreatmentId={preselectedTreatmentId}
                preselectedPhysioId={preselectedPhysioId}
                onRequestAuth={(msg) => {
                  setAuthContextMsg(msg);
                  setAuthModalOpen(true);
                }}
              />
            </div>
          </section>
        </main>
      )}

      {/* Quiet Footer */}
      {activeView === 'clinic' && (
        <footer className="bg-slate-50 border-t border-slate-200 py-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="space-y-1">
              <div className="font-display text-base font-bold text-sky-900">PhysioCare</div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <MapPin className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                <span>100 Feet Road, Indiranagar, Bengaluru · Asia/Kolkata (IST)</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-6 text-xs font-medium text-slate-600">
              <button
                type="button"
                onClick={() => scrollToSection('treatments')}
                className="hover:text-sky-800 cursor-pointer"
              >
                Treatments
              </button>
              <button
                type="button"
                onClick={() => scrollToSection('specialists')}
                className="hover:text-sky-800 cursor-pointer"
              >
                Specialists
              </button>
              <button
                type="button"
                onClick={() => scrollToSection('book')}
                className="hover:text-sky-800 cursor-pointer"
              >
                Book Appointment
              </button>
              <button
                type="button"
                onClick={() => {
                  if (user) {
                    setActiveView('portal');
                  } else {
                    setAuthModalOpen(true);
                  }
                }}
                className="hover:text-sky-800 cursor-pointer"
              >
                {user ? 'Open Portal' : 'Staff & Patient Login'}
              </button>
            </div>

            <div className="text-xs text-slate-400">
              © {new Date().getFullYear()} PhysioCare Clinic. All rights reserved.
            </div>
          </div>
        </footer>
      )}

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        contextMessage={authContextMsg}
        onSuccess={(loggedUser) => {
          if (loggedUser.role === 'admin' || loggedUser.role === 'physiotherapist') {
            setActiveView('portal');
          }
        }}
      />
    </div>
  );
};

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <AuthProvider>
        <PhysioCareShell />
      </AuthProvider>
    </MotionConfig>
  );
}
