/**
 * Shared formatting utilities.
 * Use these instead of defining the same functions in each Vue component.
 */

export function formatDateDisplay(val: unknown): string {
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val)) {
    const parts = val.split('-');
    return parts[2] + '/' + parts[1] + '/' + parts[0];
  }
  return val != null ? String(val) : '';
}

export function formatTimeAgo(dateStr: string): string {
  if (!dateStr) return 'Just now';
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  return Math.floor(diff / 86400) + 'd ago';
}

export function formatCurrency(amount: number, locale = 'en-BD'): string {
  return new Intl.NumberFormat(locale).format(amount);
}

export function dash(val: unknown): string {
  if (val === null || val === undefined || val === '') return '-';
  return String(val);
}