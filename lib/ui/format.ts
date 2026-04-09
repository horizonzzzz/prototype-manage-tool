import dayjs from 'dayjs';

export function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return '—';
  }

  return dayjs(value).format('YYYY-MM-DD HH:mm:ss');
}

