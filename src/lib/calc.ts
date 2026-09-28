import data from '@data/configurator.json';

// Логика расчёта — как в renderVals() артборда ConfigDesktop, данные — data/configurator.json.

export type TabId = 'noise' | 'film' | 'salon' | 'equip';
export type DirId = 'kosmos' | 'garage';
export interface Zone {
  id: string;
  tab: TabId;
  /** Направление зоны: от него цвет точки, строки в сводке и группа в расчёте */
  dir: DirId;
  name: string;
  desc: string;
  /** Короткое название плитки на «Плёнке» */
  short?: string;
  /** Подпись у точки, если отличается от name */
  label?: string;
  /** Доли (0–1) от области фото 760×420 */
  x?: number;
  y?: number;
}
export interface Shape { id: string; tab: TabId; d: string; line: boolean; w?: number }

export const CFG = data.cfg;
export const ZONES = data.cfg.zones as Zone[];
export const TABS = data.cfg.tabs as { id: TabId; name: string; dir: DirId }[];
export const BODIES = data.cfg.bodies;
export const NOISE_PKGS = data.cfg.noisePkgs;
export const FILM_PKGS = data.cfg.filmPkgs;
export const PRICES = data.pricesFromSedan as Record<string, number>;
export const BODY_COEF = data.bodyCoef as Record<string, number>;
export const FILM_PACKAGES = data.filmPackages as Record<string, { p: number; z: string[] }>;
export const DAYS = data.daysPerZone as Record<string, number>;
export const NOISE_COEF = data.noisePackages.priceCoef as Record<string, number>;
export const NOISE_MATERIALS = data.noisePackages.materials as Record<string, Record<string, string>>;
export const SHAPES = data.zoneShapes.shapes as Shape[];
export const SHAPE_STYLE = data.zoneShapes;
export const HEADLIGHT = data.overlays.headlight;
/** Доводчики на 2 двери — из notes в configurator.json */
export const CLOSERS_2_PRICE = 38000;

export const tabById = Object.fromEntries(TABS.map((t) => [t.id, t])) as Record<TabId, (typeof TABS)[number]>;
export const dirOfTab = (tab: TabId): DirId => tabById[tab].dir;
export const zoneById = Object.fromEntries(ZONES.map((z) => [z.id, z])) as Record<string, Zone>;

export interface CalcState {
  body: string | null;
  tab: TabId;
  sel: string[];
  active: string | null;
  noisePkg: string;
  filmPkg: string | null;
  finish: 'gloss' | 'matte';
  closers: 2 | 4;
}

export const INITIAL: CalcState = {
  body: null, tab: 'noise', sel: [], active: null, noisePkg: 'opt', filmPkg: null, finish: 'gloss', closers: 4,
};

export const fmt = (n: number) => 'от ' + String(Math.round(n / 500) * 500).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ₽';

export function zonePrice(id: string, s: CalcState) {
  let p = PRICES[id] || 0;
  if (id === 'e_closers' && s.closers === 2) p = CLOSERS_2_PRICE;
  if (id.startsWith('n_') || id.startsWith('f_')) p *= BODY_COEF[s.body ?? ''] || 1;
  if (id.startsWith('n_')) p *= NOISE_COEF[s.noisePkg] || 1;
  return p;
}

/** Действующий пакет плёнки: выбран и все его зоны отмечены */
export function activeFilmPackage(s: CalcState) {
  const pk = s.filmPkg ? FILM_PACKAGES[s.filmPkg] : undefined;
  return pk && pk.z.every((k) => s.sel.includes(k)) ? pk : null;
}

export function totals(s: CalcState) {
  const selected = ZONES.filter((z) => s.sel.includes(z.id));
  const pk = activeFilmPackage(s);
  let sum = 0;
  let days = 0;
  for (const z of selected) {
    if (!(pk && pk.z.includes(z.id))) sum += zonePrice(z.id, s);
    days = Math.max(days, DAYS[z.id] || 1);
  }
  if (pk) sum += pk.p;
  return { selected, sum, days, pk };
}

export const daysWord = (d: number) => (d === 1 ? 'день' : d < 5 ? 'дня' : 'дней');
export const positionsWord = (n: number) => {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return 'позиция';
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'позиции';
  return 'позиций';
};

// Материал в карточке зоны — как MAT в renderVals()
const MATERIAL: Record<string, string> = {
  e_hu: 'Wide Media, Teyes', e_ambient: 'комплект 18+ точек', e_audio: 'Helix, Focal, Hertz',
  e_closers: 'SlamStop или под модель', e_tail: 'комплект под модель', e_lights: 'Optima Phantom bi-LED',
  e_cam: 'скрытая проводка', e_washer: 'форсунка + клапан', f_glass: 'гидрофобный состав',
  s_screen: 'матовая статика', s_dash: 'матовая статика',
};
export function zoneMaterial(z: Zone) {
  return MATERIAL[z.id] ?? (z.tab === 'noise' ? 'Шумофф' : z.tab === 'film' ? 'Hexis Bodyfence X' : 'полиуретан по лекалам');
}

export const noiseMaterial = (id: string, pkg: string) => (NOISE_MATERIALS[pkg] ?? NOISE_MATERIALS.opt)[id] ?? '';

export function zoneSub(z: Zone, s: CalcState) {
  if (z.tab === 'noise') return NOISE_PKGS.find((p) => p.id === s.noisePkg)?.name ?? '';
  if (z.tab === 'film') return z.id === 'f_glass' ? 'Стёкла' : s.finish === 'matte' ? 'Матовая плёнка' : 'Глянцевая плёнка';
  if (z.id === 'e_closers') return `${s.closers} двери`;
  if (z.tab === 'salon') return z.dir === 'garage' ? 'Установка' : 'По лекалам';
  return 'Установка';
}

/* ---------- Состояние в адресе: ?body=crossover&z=n_doors,f_hood&pkg=plus ---------- */

const zoneIds = new Set(ZONES.map((z) => z.id));
const bodyIds = new Set(BODIES.map((b) => b.id));

export function fromQuery(q: URLSearchParams, base: CalcState = INITIAL): CalcState {
  const s: CalcState = { ...base, sel: [...base.sel] };
  const body = q.get('body');
  if (body && bodyIds.has(body)) s.body = body;
  const z = q.get('z');
  // Неизвестные зоны (например, удалённая f_body из старых ссылок) просто пропускаем
  if (z) s.sel = [...new Set(z.split(',').filter((id) => zoneIds.has(id)))];
  const pkg = q.get('pkg');
  if (pkg && FILM_PKGS.some((p) => p.id === pkg)) s.filmPkg = pkg;
  const np = q.get('np');
  if (np && NOISE_PKGS.some((p) => p.id === np)) s.noisePkg = np;
  if (q.get('fin') === 'matte') s.finish = 'matte';
  if (q.get('cl') === '2') s.closers = 2;
  const tab = q.get('tab') as TabId | null;
  if (tab && tab in tabById) s.tab = tab;
  else if (s.sel.length) s.tab = zoneById[s.sel[0]].tab;
  return s;
}

export function toQuery(s: CalcState) {
  const q = new URLSearchParams();
  if (s.body) q.set('body', s.body);
  if (s.sel.length) q.set('z', s.sel.join(','));
  if (s.filmPkg) q.set('pkg', s.filmPkg);
  if (s.noisePkg !== INITIAL.noisePkg) q.set('np', s.noisePkg);
  if (s.finish === 'matte') q.set('fin', 'matte');
  if (s.closers === 2) q.set('cl', '2');
  if (s.tab !== INITIAL.tab) q.set('tab', s.tab);
  // Запятые в z оставляем читаемыми
  return q.toString().replace(/%2C/g, ',');
}
