// Настройки сайта, которые меняются без правки разметки.

export const SITE_NAME = 'Космос Wrap × Апгрейд Garage';

// Яндекс Метрика. 0 — заглушка: счётчик не грузится, цели пишутся в консоль в dev.
export const METRIKA_ID = 0;

// Цели Метрики — docs/spec.md, раздел «Аналитика».
export const GOALS = {
  phone: 'phone_click',
  telegram: 'telegram_click',
  whatsapp: 'whatsapp_click',
  calcOpen: 'calc_open',
  calcCopy: 'calc_copy_link',
  calcContact: 'calc_contact_master',
} as const;

export type GoalName = (typeof GOALS)[keyof typeof GOALS];
