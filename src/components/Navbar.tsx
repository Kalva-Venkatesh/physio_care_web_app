import React, { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { User } from '../types';

interface NavbarProps {
  user: User | null;
  activeView: 'clinic' | 'portal';
  onNavigateSection: (sectionId: string) => void;
  onOpenPortal: () => void;
  onOpenAuth: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  activeView,
  onNavigateSection,
  onOpenPortal,
  onOpenAuth,
}) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  const portalLabel =
    user?.role === 'admin'
      ? 'Admin Console'
      : user?.role === 'physiotherapist'
      ? 'Doctor Portal'
      : 'My Portal';

  const handleLinkClick = (id: string) => {
    setMobileOpen(false);
    onNavigateSection(id);
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single text element wordmark */}
        <button
          type="button"
          onClick={() => handleLinkClick('top')}
          className="font-display text-xl font-bold tracking-tight text-sky-900 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 rounded"
        >
          PhysioCare
        </button>

        {/* Zone 2: 4 concise single-line navigation links */}
        <nav
          aria-label="Primary"
          className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600"
        >
          <button
            type="button"
            onClick={() => handleLinkClick('treatments')}
            className="hover:text-sky-800 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Treatments
          </button>
          <button
            type="button"
            onClick={() => handleLinkClick('specialists')}
            className="hover:text-sky-800 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Specialists
          </button>
          <button
            type="button"
            onClick={() => handleLinkClick('book')}
            className="hover:text-sky-800 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Book Session
          </button>
          <button
            type="button"
            onClick={() => (user ? onOpenPortal() : onOpenAuth())}
            className={`hover:text-sky-800 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeView === 'portal' ? 'text-sky-800 font-semibold' : ''
            }`}
          >
            {user ? portalLabel : 'Patient Portal'}
          </button>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
          {user ? (
            <button
              type="button"
              onClick={onOpenPortal}
              className="hidden md:inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-white bg-sky-700 hover:bg-sky-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600"
            >
              {activeView === 'portal' ? user.name.split(' ')[0] : `Open ${portalLabel}`}
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenAuth}
              className="hidden md:inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-white bg-sky-700 hover:bg-sky-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600"
            >
              Sign In
            </button>
          )}

          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-label="Toggle menu"
            className="md:hidden p-2 text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 py-4 space-y-2">
          <button
            type="button"
            onClick={() => handleLinkClick('treatments')}
            className="block w-full text-left px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg"
          >
            Treatments
          </button>
          <button
            type="button"
            onClick={() => handleLinkClick('specialists')}
            className="block w-full text-left px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg"
          >
            Specialists
          </button>
          <button
            type="button"
            onClick={() => handleLinkClick('book')}
            className="block w-full text-left px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg"
          >
            Book Session
          </button>
          <button
            type="button"
            onClick={() => {
              setMobileOpen(false);
              if (user) {
                onOpenPortal();
              } else {
                onOpenAuth();
              }
            }}
            className="block w-full text-center px-4 py-2.5 text-sm font-semibold text-white bg-sky-700 hover:bg-sky-800 rounded-lg"
          >
            {user ? `Open ${portalLabel}` : 'Sign In / Register'}
          </button>
        </div>
      )}
    </header>
  );
};
