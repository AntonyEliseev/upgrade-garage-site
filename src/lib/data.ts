import contactsJson from '@data/contacts.json';
import servicesJson from '@data/services.json';
import portfolioJson from '@data/portfolio.json';

export type Dir = 'kosmos' | 'garage';

export const contacts = contactsJson;
export const phones = contactsJson.phones;
export const primaryPhone = phones.find((p) => p.primary) ?? phones[0];

export const DIR_NAME: Record<Dir, string> = { kosmos: 'Космос Wrap', garage: 'Апгрейд Garage' };
export const DIR_SUB: Record<Dir, string> = {
  kosmos: 'Оклейка и защита',
  garage: 'Шумоизоляция, автозвук и дооснащение',
};

export const telegram = (dir: Dir = 'garage') => contactsJson.telegram[dir];
export const tgHandle = (dir: Dir) => '@' + contactsJson.telegram[dir].split('/').pop();

/** WhatsApp: пока в contacts.json заглушка — ссылка ведёт на общий wa.me. */
export const whatsappHref = (() => {
  const digits = contactsJson.whatsapp.replace(/\D/g, '');
  return digits.length >= 10 ? `https://wa.me/${digits}` : 'https://wa.me/';
})();

export const telHref = (tel: string) => `tel:${tel}`;
export const shortAddress = contactsJson.address.split(', бокс')[0];

export type Service = (typeof servicesJson)[number] & { slug: string; dir: Dir };
export const services: Service[] = servicesJson.map((s) => ({
  ...s,
  slug: s.url.split('/').pop()!,
  dir: s.direction as Dir,
}));
export const servicesByDir = (dir: Dir) => services.filter((s) => s.dir === dir);

type RawCase = (typeof portfolioJson)['cases'][number];
export type Case = Omit<RawCase, 'direction' | 'cover' | 'photos'> & {
  d: Dir;
  /** Обложка (первое фото), у кейсов без фото — undefined */
  img?: string;
  photos: string[];
};
export const cases: Case[] = portfolioJson.cases.map(({ direction, cover, photos, ...c }) => ({
  ...c,
  d: direction as Dir,
  img: cover ?? undefined,
  photos: photos ?? [],
}));
export const caseBySlug = (slug: string) => cases.find((c) => c.slug === slug);
export const portfolioFilters = portfolioJson.filters as { id: string; name: string; d?: Dir; sep?: boolean }[];

export const BRANDS = [
  { id: 'all', name: 'Все марки' },
  { id: 'hyundai', name: 'Hyundai' },
  { id: 'bmw', name: 'BMW' },
  { id: 'mercedes', name: 'Mercedes' },
  { id: 'mitsubishi', name: 'Mitsubishi' },
  { id: 'vw', name: 'Volkswagen' },
  { id: 'other', name: 'Другие' },
];

export const formatRub = (n: number) =>
  String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ₽';
