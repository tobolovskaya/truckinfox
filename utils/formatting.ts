/**
 * Format currency in Norwegian Kroner (NOK)
 */
export const formatCurrency = (amount: number, locale = 'no-NO'): string => {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'NOK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

/**
 * Format date to locale-specific format
 */
export const formatDate = (date: Date | string, locale = 'no-NO'): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(dateObj);
};

/**
 * Format date and time to locale-specific format
 */
export const formatDateTime = (date: Date | string, locale = 'no-NO'): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(dateObj);
};

/**
 * Format relative time (e.g., "2 hours ago")
 */
export const formatRelativeTime = (date: Date | string, locale = 'no-NO'): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - dateObj.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return locale === 'no-NO' ? 'Akkurat nå' : 'Just now';
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return locale === 'no-NO'
      ? `${diffInMinutes} ${diffInMinutes === 1 ? 'minutt' : 'minutter'} siden`
      : `${diffInMinutes} ${diffInMinutes === 1 ? 'minute' : 'minutes'} ago`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return locale === 'no-NO'
      ? `${diffInHours} ${diffInHours === 1 ? 'time' : 'timer'} siden`
      : `${diffInHours} ${diffInHours === 1 ? 'hour' : 'hours'} ago`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return locale === 'no-NO'
      ? `${diffInDays} ${diffInDays === 1 ? 'dag' : 'dager'} siden`
      : `${diffInDays} ${diffInDays === 1 ? 'day' : 'days'} ago`;
  }

  return formatDate(dateObj, locale);
};

/**
 * Format distance in kilometers
 */
export const formatDistance = (distanceInKm: number, locale = 'no-NO'): string => {
  if (distanceInKm < 1) {
    return locale === 'no-NO'
      ? `${Math.round(distanceInKm * 1000)} m`
      : `${Math.round(distanceInKm * 1000)} m`;
  }
  return locale === 'no-NO' ? `${distanceInKm.toFixed(1)} km` : `${distanceInKm.toFixed(1)} km`;
};

/**
 * Format weight in kilograms or tons
 */
export const formatWeight = (weightInKg: number, locale = 'no-NO'): string => {
  if (weightInKg < 1000) {
    return locale === 'no-NO' ? `${weightInKg} kg` : `${weightInKg} kg`;
  }
  const weightInTons = weightInKg / 1000;
  return locale === 'no-NO'
    ? `${weightInTons.toFixed(2)} tonn`
    : `${weightInTons.toFixed(2)} tons`;
};

export default {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatRelativeTime,
  formatDistance,
  formatWeight,
};
