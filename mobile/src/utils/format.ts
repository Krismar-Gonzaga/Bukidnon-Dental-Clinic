export const formatPrice = (amount: number, currency = 'PHP') => {
  const symbol = currency === 'PHP' ? '₱' : `${currency} `;
  return `${symbol}${Math.round(amount).toLocaleString('en-US')}`;
};

export const timeAgo = (timestamp: number | null | undefined) => {
  if (!timestamp) {
    return 'never';
  }
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 60) {
    return 'just now';
  }
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${minutes} min ago`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours} hr${hours === 1 ? '' : 's'} ago`;
  }
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
};

const parseClock = (value: string | null | undefined) => {
  const match = value?.match(/^(\d{1,2}):(\d{2})/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
};

export const formatClock = (value: string | null | undefined) => {
  const minutes = parseClock(value);
  if (minutes === null) {
    return null;
  }
  const hours24 = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const suffix = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 || 12;
  return `${hours12}:${String(mins).padStart(2, '0')} ${suffix}`;
};

/** Open/closed right now, from the clinic's daily opening and closing time. */
export const getOpenStatus = (
  openingTime: string | null | undefined,
  closingTime: string | null | undefined,
  now: Date = new Date(),
): { isOpen: boolean; label: string } | null => {
  const open = parseClock(openingTime);
  const close = parseClock(closingTime);
  if (open === null || close === null) {
    return null;
  }
  const current = now.getHours() * 60 + now.getMinutes();
  const isOpen = open <= close ? current >= open && current < close : current >= open || current < close;
  return isOpen
    ? { isOpen, label: `Open · until ${formatClock(closingTime)}` }
    : { isOpen, label: `Closed · opens ${formatClock(openingTime)}` };
};
