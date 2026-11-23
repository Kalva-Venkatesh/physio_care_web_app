const IST_OFFSET_MS = 330 * 60 * 1000; // Asia/Kolkata is fixed UTC+05:30

export interface ISTNow {
  dateStr: string;
  timeStr: string;
  minutesSinceMidnight: number;
  dayOfWeek: number;
}

export function getNowIST(): ISTNow {
  const ist = new Date(Date.now() + IST_OFFSET_MS);
  const year = ist.getUTCFullYear();
  const month = String(ist.getUTCMonth() + 1).padStart(2, '0');
  const day = String(ist.getUTCDate()).padStart(2, '0');
  const hours = ist.getUTCHours();
  const minutes = ist.getUTCMinutes();

  return {
    dateStr: `${year}-${month}-${day}`,
    timeStr: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
    minutesSinceMidnight: hours * 60 + minutes,
    dayOfWeek: ist.getUTCDay(),
  };
}

export function parseDateToDayOfWeekIST(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  const utcDate = new Date(Date.UTC(y, m - 1, d));
  return utcDate.getUTCDay();
}

export function addDaysIST(dateStr: string, daysToAdd: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + daysToAdd));
  const year = dt.getUTCFullYear();
  const month = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const day = String(dt.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatDateLabelIST(dateStr: string): {
  shortDay: string;
  dayNum: string;
  monthShort: string;
  fullLabel: string;
} {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const shortDay = days[dt.getUTCDay()];
  const monthShort = months[dt.getUTCMonth()];
  const dayNum = String(d).padStart(2, '0');
  return {
    shortDay,
    dayNum,
    monthShort,
    fullLabel: `${shortDay}, ${dayNum} ${monthShort} ${y}`,
  };
}

export function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

export function minutesToTime(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function formatTime12h(timeStr: string): string {
  const [h, m] = timeStr.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(hour12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`;
}

export function buildSlotKeys(startTime: string, durationMinutes: number): string[] {
  const startMin = timeToMinutes(startTime);
  const blocks = Math.max(1, Math.ceil(durationMinutes / 30));
  const keys: string[] = [];
  for (let i = 0; i < blocks; i++) {
    keys.push(minutesToTime(startMin + i * 30));
  }
  return keys;
}

export interface DayScheduleConfig {
  dayOfWeek: number;
  isWorking: boolean;
  startTime: string;
  endTime: string;
  breakStart?: string;
  breakEnd?: string;
}

export interface GeneratedSlot {
  time: string;
  endTime: string;
  label: string;
  endLabel: string;
  slotKeys: string[];
}

export function generateAvailableSlotsForDay(params: {
  dateStr: string;
  schedule: DayScheduleConfig | undefined;
  bookedSlotSet: Set<string>;
  holidayTitle?: string;
  isPhysioUnavailable: boolean;
  durationMinutes: number;
  nowIST?: ISTNow;
}): {
  status: 'open' | 'holiday' | 'unavailable' | 'off' | 'past';
  reason?: string;
  slots: GeneratedSlot[];
} {
  const now = params.nowIST ?? getNowIST();

  if (params.dateStr < now.dateStr) {
    return { status: 'past', reason: 'Past date', slots: [] };
  }
  if (params.holidayTitle) {
    return { status: 'holiday', reason: params.holidayTitle, slots: [] };
  }
  if (params.isPhysioUnavailable) {
    return { status: 'unavailable', reason: 'Specialist unavailable', slots: [] };
  }
  if (!params.schedule || !params.schedule.isWorking) {
    return { status: 'off', reason: 'Weekly off', slots: [] };
  }

  const workStart = timeToMinutes(params.schedule.startTime);
  const workEnd = timeToMinutes(params.schedule.endTime);
  const hasBreak = Boolean(params.schedule.breakStart && params.schedule.breakEnd);
  const breakStart = hasBreak ? timeToMinutes(params.schedule.breakStart!) : -1;
  const breakEnd = hasBreak ? timeToMinutes(params.schedule.breakEnd!) : -1;

  const duration = Math.max(30, params.durationMinutes);
  const blocksNeeded = Math.ceil(duration / 30);
  const isToday = params.dateStr === now.dateStr;
  const minAllowedToday = now.minutesSinceMidnight + 15;

  const slots: GeneratedSlot[] = [];

  for (let cursor = workStart; cursor + duration <= workEnd; cursor += 30) {
    if (isToday && cursor < minAllowedToday) {
      continue;
    }

    let valid = true;
    const slotKeys: string[] = [];

    for (let b = 0; b < blocksNeeded; b++) {
      const blockStart = cursor + b * 30;
      const blockEnd = blockStart + 30;
      const blockTime = minutesToTime(blockStart);

      if (hasBreak && blockStart < breakEnd && blockEnd > breakStart) {
        valid = false;
        break;
      }

      if (params.bookedSlotSet.has(blockTime)) {
        valid = false;
        break;
      }

      slotKeys.push(blockTime);
    }

    if (valid) {
      const startStr = minutesToTime(cursor);
      const endStr = minutesToTime(cursor + duration);
      slots.push({
        time: startStr,
        endTime: endStr,
        label: formatTime12h(startStr),
        endLabel: formatTime12h(endStr),
        slotKeys,
      });
    }
  }

  return { status: 'open', slots };
}
