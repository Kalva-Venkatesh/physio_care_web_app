import React, { useState } from 'react';
import { Activity } from 'lucide-react';

interface ClinicImageProps {
  src?: string;
  alt: string;
  className?: string;
  fallbackLabel?: string;
}

export const ClinicImage: React.FC<ClinicImageProps> = ({
  src,
  alt,
  className = '',
  fallbackLabel,
}) => {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-sky-50 via-white to-teal-50 text-sky-800 border border-slate-200 ${className}`}
        role="img"
        aria-label={alt}
      >
        <Activity className="w-8 h-8 text-teal-600 mb-2" strokeWidth={1.75} />
        {fallbackLabel && (
          <span className="text-xs font-medium text-slate-600 px-3 text-center">
            {fallbackLabel}
          </span>
        )}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
};
