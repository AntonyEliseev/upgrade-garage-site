import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { url } from '../lib/url';
import Icon from './Icon';
import {
  BODIES, CFG, FILM_PKGS, HEADLIGHT, INITIAL, NOISE_PKGS, SHAPES, SHAPE_STYLE, TABS, ZONES,
  daysWord, dirOfTab, fmt, fromQuery, noiseMaterial, positionsWord, toQuery, totals, zoneMaterial, zonePrice, zoneSub,
  type CalcState, type DirId, type Shape, type TabId, type Zone,
} from '../lib/calc';
import { goal, GOALS } from '../lib/analytics';
import cfgData from '@data/configurator.json';
import './configurator.css';

// Калькулятор: ничего не отправляет. Выбор хранится в адресе, кнопка копирует ссылку на расчёт.

export interface TabPhoto {
  src: string;
  srcset: string;
  alt: string;
  caption: string;
  /** object-position из configurator.json */
  position: string;
  fit: 'cover' | 'contain';
}
export interface Thumb { src: string; alt: string }
interface Phone { name: string; tel: string; display: string; primary?: boolean }
interface Props {
  photos: Record<TabId, TabPhoto>;
  thumbs: Record<string, Thumb>;
  phones: Phone[];
  hours: string;
  /** page — страница /calculator: состояние синхронизируется с адресом, итог на мобайле — в фиксированной панели */
  mode?: 'embed' | 'page';
  initialTab?: TabId;
  /** Пакет плёнки, выбранный заранее (страница антигравийной плёнки) */
  initialFilmPkg?: string;
}

const MOBILE_Q = '(max-width: 767.98px)';
const FILM_SHAPES = SHAPES.filter((f) => f.tab === 'film');
const NOISE_SHAPES = SHAPES.filter((f) => f.tab === 'noise');
const NOISE = SHAPE_STYLE.noise as typeof SHAPE_STYLE.noise & { textures: Record<string, { svgPattern: string }> };
const NOISE_TEXTURE = NOISE.byZone as Record<string, string>;
// Короткие подписи точек для мобайла (configurator.json → mobileLabels)
const MOBILE_LABELS = cfgData.mobileLabels.short as Record<string, string>;
const MOBILE_LABEL_TABS = cfgData.mobileLabels.tabs as TabId[];

function useMedia(q: string) {
  const [m, setM] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => setM(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [q]);
  return m;
}

function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Запасной путь без полей ввода: выделяем текстовый узел
    const span = document.createElement('span');
    span.textContent = text;
    span.style.cssText = 'position:fixed;left:-9999px;white-space:pre';
    document.body.appendChild(span);
    const range = document.createRange();
    range.selectNodeContents(span);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    let ok = false;
    // Устаревший, но единственный способ без Clipboard API (http, старые браузеры)
    try { ok = (Reflect.get(document, 'execCommand') as (c: string) => boolean).call(document, 'copy'); } catch { ok = false; }
    sel?.removeAllRanges();
    span.remove();
    return ok;
  }
}

function lockScroll(on: boolean, cls: string) {
  document.documentElement.classList.toggle(cls, on);
}

interface Box { x: number; y: number; w: number; h: number }
const overlap = (a: Box, b: Box, pad: number) =>
  a.x < b.x + b.w + pad && b.x < a.x + a.w + pad && a.y < b.y + b.h + pad && b.y < a.y + a.h + pad;

/**
 * Подписи без наложений: для каждой точки слева направо пробуем позиции по очереди и берём первую,
 * которая помещается в границы и не задевает точки, плашку фото и уже поставленные подписи.
 * Ширина — по getBoundingClientRect().
 * Десктоп — renderVals() ConfigDesktop, «Подписи без наложений»: если места нет, подпись всё равно ставится справа.
 * Мобайл — renderVals() ConfigMobile, «Подписи на мобайле»: подписи могут выходить за фото в пределах блока 358×300,
 * а если места нет — подпись скрыта, точка остаётся.
 */
function placeLabels(area: HTMLElement, zones: Zone[], labels: Record<string, HTMLElement | null>, caption: HTMLElement | null, mobile: boolean) {
  const W = area.clientWidth, H = area.clientHeight;
  if (!W || !H) return;
  const ar = area.getBoundingClientRect();
  const stage = area.parentElement!.getBoundingClientRect();
  const pad = mobile ? 2 : 4;
  const edge = mobile ? 4 : 6;
  // Границы в координатах области фото
  const minY = mobile ? stage.top - ar.top + edge : edge;
  const maxY = mobile ? stage.bottom - ar.top - edge : H - edge;
  const boxes: Box[] = zones.map((z) => ({ x: z.x! * W - 16, y: z.y! * H - 16, w: 32, h: 32 }));
  if (caption && caption.offsetParent) {
    const r = caption.getBoundingClientRect();
    boxes.push({ x: r.left - ar.left, y: r.top - ar.top, w: r.width, h: r.height });
  }
  [...zones].sort((a, b) => a.x! - b.x!).forEach((z) => {
    const el = labels[z.id];
    if (!el) return;
    const { width: w, height: h } = el.getBoundingClientRect();
    const cx = z.x! * W, cy = z.y! * H;
    // G — отступ от центра точки: радиус 16 + зазор + запас на дробные координаты
    const G = mobile ? 21 : 22;
    const cand: [number, number][] = mobile
      ? [
          [cx + G, cy - h / 2], [cx - G - w, cy - h / 2], [cx - w / 2, cy - G - h], [cx - w / 2, cy + G],
          [cx + 14, cy - G - h], [cx + 14, cy + G - 1], [cx - 14 - w, cy - G - h], [cx - 14 - w, cy + G - 1],
          [cx - w + 12, cy - G - h], [cx - w + 12, cy + G], [cx - 4, cy - G - h], [cx - 4, cy + G],
        ]
      : [
          [cx + G, cy - h / 2], [cx - G - w, cy - h / 2], [cx - w / 2, cy - G - h], [cx - w / 2, cy + G],
          [cx + 10, cy - G - h], [cx + 10, cy + G], [cx - 10 - w, cy - G - h], [cx - 10 - w, cy + G],
        ];
    let pick: Box | null = null;
    for (const [x, y] of cand) {
      const b = { x: Math.round(x), y: Math.round(y), w, h };
      if (b.x < edge || b.x + w > W - edge || b.y < minY || b.y + h > maxY) continue;
      if (boxes.some((o) => overlap(b, o, pad))) continue;
      pick = b;
      break;
    }
    if (!pick && mobile) {
      el.style.visibility = 'hidden';
      return;
    }
    if (!pick) pick = { x: Math.round(Math.max(edge, Math.min(W - edge - w, cx + G))), y: Math.round(cy - h / 2), w, h };
    boxes.push(pick);
    el.style.transform = `translate(${pick.x}px, ${pick.y}px)`;
    el.style.visibility = 'visible';
  });
}

export default function Configurator({ photos, thumbs, phones, hours, mode = 'embed', initialTab, initialFilmPkg }: Props) {
  const isPage = mode === 'page';
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const initial = useMemo<CalcState>(() => {
    const s: CalcState = { ...INITIAL, tab: initialTab ?? INITIAL.tab };
    if (initialFilmPkg) {
      const p = FILM_PKGS.find((x) => x.id === initialFilmPkg);
      if (p) Object.assign(s, { filmPkg: p.id, sel: [...p.z], tab: 'film' as TabId });
    }
    return s;
  }, [initialTab, initialFilmPkg]);

  const [s, setS] = useState<CalcState>(initial);
  const [modal, setModal] = useState<'none' | 'form' | 'sheet'>('none');
  const [copied, setCopied] = useState(false);
  const [fontsReady, setFontsReady] = useState(false);
  const isMobile = useMedia(MOBILE_Q);
  const [areaRef, area] = useSize<HTMLDivElement>();
  const labelRefs = useRef<Record<string, HTMLSpanElement | null>>({});
  const captionRef = useRef<HTMLSpanElement>(null);
  const touched = useRef(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => { document.fonts?.ready.then(() => setFontsReady(true)); }, []);

  // Страница калькулятора: читаем расчёт из адреса
  useEffect(() => {
    if (!isPage) return;
    const q = new URLSearchParams(location.search);
    if ([...q.keys()].length) setS((prev) => fromQuery(q, prev));
  }, [isPage]);

  // …и пишем обратно при каждом изменении
  useEffect(() => {
    if (!isPage) return;
    const qs = toQuery(s);
    const next = location.pathname + (qs ? `?${qs}` : '') + location.hash;
    if (next !== location.pathname + location.search + location.hash) history.replaceState(null, '', next);
  }, [s, isPage]);

  const update = useCallback((patch: Partial<CalcState> | ((p: CalcState) => Partial<CalcState>)) => {
    if (!touched.current) {
      touched.current = true;
      if (!isPage) goal(GOALS.calcOpen, { from: 'embed' });
    }
    setCopied(false);
    setS((prev) => ({ ...prev, ...(typeof patch === 'function' ? patch(prev) : patch) }));
  }, [isPage]);

  const toggle = (id: string) =>
    update((p) => {
      const on = p.sel.includes(id);
      return {
        sel: on ? p.sel.filter((x) => x !== id) : [...p.sel, id],
        active: id,
        ...(id.startsWith('f_') ? { filmPkg: null } : {}),
      };
    });

  const { selected, sum, days, pk } = totals(s);
  const on = (id: string) => s.sel.includes(id);
  const count = selected.length;
  const isEmpty = count === 0;
  const curDir: DirId = dirOfTab(s.tab);
  const isFilm = s.tab === 'film';
  const isNoise = s.tab === 'noise';
  const isConstructor = isFilm || isNoise;
  const bodyObj = BODIES.find((b) => b.id === s.body);
  const carLine = bodyObj ? bodyObj.name : 'Кузов не выбран';
  const totalText = isEmpty ? '—' : fmt(sum);
  const daysText = isEmpty ? '' : `≈ ${days} ${daysWord(days)}`;
  const noisePkgName = NOISE_PKGS.find((p) => p.id === s.noisePkg)?.name ?? '';

  const shareUrl = () => {
    const qs = toQuery(s);
    return `${location.origin}${url('/calculator')}${qs ? `?${qs}` : ''}`;
  };

  const onCopy = async () => {
    const ok = await copyText(shareUrl());
    if (!ok) return;
    setCopied(true);
    goal(GOALS.calcCopy, { positions: count });
    document.dispatchEvent(new CustomEvent('ug:toast', { detail: { title: 'Ссылка скопирована', sub: 'По ней откроется тот же расчёт' } }));
  };

  const openModal = (m: 'form' | 'sheet', e?: { currentTarget: EventTarget | null }) => {
    if (m === 'form') goal(GOALS.calcContact, { positions: count });
    if (e && modal === 'none') openerRef.current = e.currentTarget as HTMLElement;
    setModal(m);
  };
  const closeModal = () => {
    setModal('none');
    openerRef.current?.focus();
  };

  // Модалка/шторка: Esc, фокус внутри, прокрутка страницы заблокирована
  useEffect(() => {
    const open = modal !== 'none';
    lockScroll(open, 'sheet-open');
    if (!open) return;
    const el = dialogRef.current;
    el?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal();
      if (e.key === 'Tab' && el) {
        const f = el.querySelectorAll<HTMLElement>('a[href], button:not([disabled])');
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); lockScroll(false, 'sheet-open'); };
  }, [modal]);

  // На десктопе шторка не нужна
  useEffect(() => { if (!isMobile && modal === 'sheet') setModal('none'); }, [isMobile, modal]);

  /* ---------- Точки и подписи (Салон, Оснащение) ---------- */
  const dotZones = isConstructor ? [] : ZONES.filter((z) => z.tab === s.tab && z.x !== undefined);
  if (Object.keys(labelRefs.current).some((id) => !dotZones.some((z) => z.id === id))) labelRefs.current = {};
  const showLabels = dotZones.length > 0 && (!isMobile || MOBILE_LABEL_TABS.includes(s.tab));

  useLayoutEffect(() => {
    const el = areaRef.current;
    if (!showLabels || !el) return;
    const place = () => placeLabels(el, dotZones, labelRefs.current, captionRef.current, isMobile);
    place();
    // Шрифт может догрузиться после первой раскладки — тогда ширина подписей меняется, раскладываем заново
    let raf = 0;
    const ro = new ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(place); });
    Object.values(labelRefs.current).forEach((l) => l && ro.observe(l));
    if (captionRef.current) ro.observe(captionRef.current);
    return () => { ro.disconnect(); cancelAnimationFrame(raf); };
  }, [s.tab, showLabels, area.w, area.h, fontsReady, isMobile]);

  const photo = photos[s.tab];
  const az = ZONES.find((z) => z.id === s.active && z.tab === s.tab);
  const card = !isConstructor && az ? az : null;
  const thumb = card ? thumbs[card.id] : undefined;

  /* ---------- Контуры деталей на фото (Плёнка, Шумоизоляция) ---------- */
  const filmShape = (f: Shape) => {
    const sel = on(f.id), act = f.id === s.active && !sel;
    const base = { mixBlendMode: sel ? SHAPE_STYLE.selected.mixBlendMode : 'normal' } as const;
    if (f.line) {
      return { style: { ...base, opacity: sel ? 0.95 : 1 }, fill: 'none', stroke: sel ? SHAPE_STYLE.selected.fill : act ? 'rgba(242,244,247,0.55)' : 'transparent', sw: f.w ?? 4 };
    }
    return {
      style: { ...base, opacity: sel ? (f.id === 'f_glass' ? SHAPE_STYLE.selected.glassOpacity : SHAPE_STYLE.selected.opacity) : 1 },
      fill: sel ? SHAPE_STYLE.selected.fill : act ? SHAPE_STYLE.active.fill : 'transparent',
      stroke: act ? SHAPE_STYLE.active.stroke : 'none',
      sw: act ? SHAPE_STYLE.active.strokeWidth : 0,
    };
  };
  const noiseShape = (f: Shape) => {
    const sel = on(f.id), act = f.id === s.active && !sel;
    // Текстура — по группе зоны (zoneShapes.noise.byZone), от пакета не зависит
    const texture = NOISE_TEXTURE[f.id] ?? 'absorber';
    return {
      texture,
      opacity: sel ? (f.id === 'n_arches' ? 0.96 : 0.94) : 1,
      fill: sel ? `url(#${texture}-${uid}-${f.id})` : act ? 'rgba(255,255,255,0.10)' : 'transparent',
      stroke: sel ? '#CDE23C' : act ? 'rgba(255,255,255,0.9)' : 'none',
      sw: sel || act ? (f.id === 'n_arches' ? 2 : 1.5) : 0,
    };
  };

  /* ---------- Пакеты ---------- */
  type Pkg = { id: string; name: string; active: boolean; pick: () => void };
  let pkgs: Pkg[] = [];
  let noPkgText = '';
  if (isNoise) {
    pkgs = NOISE_PKGS.map((p) => ({ id: p.id, name: p.name, active: p.id === s.noisePkg, pick: () => update({ noisePkg: p.id }) }));
  } else if (isFilm) {
    pkgs = FILM_PKGS.map((p) => ({
      id: p.id, name: p.name, active: p.id === s.filmPkg,
      pick: () => update((prev) => ({ sel: [...prev.sel.filter((k) => !k.startsWith('f_')), ...p.z], filmPkg: p.id, active: null })),
    }));
  } else if (s.tab === 'salon') {
    noPkgText = 'Экраны, глянец, подсветка, магнитола и звук';
  } else {
    noPkgText = 'Нажмите на точку — покажем, как работает';
  }

  const pkgBar = (cls: string) => (
    <div class={cls}>
      {pkgs.length > 0 ? (
        <div class="cfg__pkgs" role="group" aria-label={isNoise ? 'Пакет шумоизоляции' : 'Готовые решения'}>
          {pkgs.map((p) => (
            <button type="button" class="cfg__pkg" aria-pressed={p.active} onClick={p.pick} key={p.id}>{p.name}</button>
          ))}
        </div>
      ) : (
        <span class="cfg__nopkg">{noPkgText}</span>
      )}
      {isFilm && (
        <div class="cfg__finish" role="group" aria-label="Фактура плёнки" data-name="FinishToggle">
          <button type="button" aria-pressed={s.finish === 'gloss'} onClick={() => update({ finish: 'gloss' })}>Глянец</button>
          <button type="button" aria-pressed={s.finish === 'matte'} onClick={() => update({ finish: 'matte' })}>Мат</button>
        </div>
      )}
    </div>
  );

  /* ---------- Список выбранного ---------- */
  const groups = (['kosmos', 'garage'] as DirId[])
    .map((d) => ({
      d,
      name: CFG.dirs[d].name,
      rows: selected.filter((z) => z.dir === d).map((z) => ({
        z, sub: zoneSub(z, s), price: pk && pk.z.includes(z.id) ? 'в пакете' : fmt(zonePrice(z.id, s)),
      })),
    }))
    .filter((g) => g.rows.length > 0);

  const summaryList = (big: boolean) => (
    <div class="cfg__list" data-name="SummaryList">
      {isEmpty && !big && (
        <div class="cfg__empty"><strong>Пока пусто</strong><span>Выберите кузов и отметьте зоны</span></div>
      )}
      {groups.map((g) => (
        <div class={`cfg__group dir-${g.d}`} key={g.d}>
          <div class="cfg__group-head"><span class="cfg__sq" />{g.name} · {g.rows.length}</div>
          <ul role="list">
            {g.rows.map((r) => (
              <li class="cfg__row" key={r.z.id} data-name="SummaryRow">
                <span class="cfg__row-name"><span>{r.z.name}</span><small>{r.sub}</small></span>
                <span class="cfg__row-price">{r.price}</span>
                <button type="button" class="cfg__row-x" aria-label={`Убрать: ${r.z.name}`} onClick={() => toggle(r.z.id)}>×</button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );

  const callButtons = (compact: boolean) =>
    phones.map((p) => (
      <a href={`tel:${p.tel}`} class={'call-btn' + (compact ? '' : ' call-btn--l') + (p.primary ? ' call-btn--primary' : '')} key={p.tel}>
        <span class="call-btn__icon"><Icon name="phone" size={22} /></span>
        <span class="call-btn__text"><span class="call-btn__num">{p.display}</span><span class="call-btn__name">{p.name}</span></span>
      </a>
    ));

  const copyLabel = copied ? 'Ссылка скопирована ✓' : 'Скопировать ссылку на расчёт';
  const itemsText = selected.map((z) => z.name).join(', ');

  /* ---------- Под фото: карточка зоны, плитки деталей или список зон ---------- */
  const middle = () => {
    if (isFilm) {
      return (
        <div class="cfg__film" data-name="FilmDetails">
          <span class="cfg__mid-label">Выберите детали оклейки</span>
          <div class="cfg__tiles" role="group" aria-label="Детали для оклейки">
            {ZONES.filter((z) => z.tab === 'film').map((z) => (
              <button
                type="button" key={z.id}
                class={'cfg__tile' + (on(z.id) ? ' is-on' : '') + (z.id === s.active && !on(z.id) ? ' is-active' : '')}
                aria-pressed={on(z.id)}
                title={`${z.name} — ${z.desc}`}
                aria-label={`${z.name}, ${fmt(zonePrice(z.id, s))}. ${z.desc}`}
                onClick={() => toggle(z.id)}
                data-name="DetailTile"
              >
                <span class="cfg__tile-name">{z.short ?? z.name}</span>
                <span class="cfg__tile-price">{fmt(zonePrice(z.id, s))}</span>
              </button>
            ))}
          </div>
        </div>
      );
    }
    if (isNoise) {
      return (
        <div class="cfg__noise" data-name="NoiseChecklist">
          <div class="cfg__mid-head">
            <span class="cfg__mid-label">Отметьте зоны шумоизоляции</span>
            <span class="cfg__mid-note">Материалы — пакет «{noisePkgName}»</span>
          </div>
          <div class="cfg__checks" role="group" aria-label="Зоны шумоизоляции">
            {ZONES.filter((z) => z.tab === 'noise').map((z) => {
              const mat = noiseMaterial(z.id, s.noisePkg);
              return (
                <button
                  type="button" key={z.id} role="checkbox"
                  class={'cfg__check' + (on(z.id) ? ' is-on' : '') + (z.id === s.active && !on(z.id) ? ' is-active' : '')}
                  aria-checked={on(z.id)}
                  title={`${z.name} — ${z.desc}`}
                  aria-label={`${z.name}: ${mat}, ${fmt(zonePrice(z.id, s))}`}
                  onClick={() => toggle(z.id)}
                  data-name="ZoneCheck"
                >
                  <span class="cfg__box" aria-hidden="true">
                    <svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 6.2 L4.8 9 L10 3" fill="none" stroke="#151A04" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>
                  </span>
                  <span class="cfg__check-text">
                    <span class="cfg__check-name">{z.name}</span>
                    <span class="cfg__check-meta">
                      <span class="cfg__check-mat">{mat}</span>
                      <span class="cfg__check-price">{fmt(zonePrice(z.id, s))}</span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      );
    }
    if (card) {
      const sel = on(card.id);
      return (
        <div class={`cfg__zone dir-${card.dir}` + (sel ? ' is-on' : '')} data-name="ZoneCard/Docked" aria-live="polite">
          {thumb && <img class="cfg__thumb" src={thumb.src} alt={thumb.alt} width={88} height={60} loading="lazy" decoding="async" />}
          <span class="cfg__zone-text">
            <strong>{card.name}</strong>
            <span class="cfg__zone-desc">{card.desc}<span class="cfg__zone-mat"> · {zoneMaterial(card)}</span></span>
            <span class="cfg__zone-price cfg__zone-price--m">{fmt(zonePrice(card.id, s))}</span>
          </span>
          {card.id === 'e_closers' && (
            <span class="cfg__closers">
              <button type="button" aria-pressed={s.closers === 2} onClick={() => update({ closers: 2 })}>2 двери</button>
              <button type="button" aria-pressed={s.closers === 4} onClick={() => update({ closers: 4 })}>4 двери</button>
            </span>
          )}
          <span class="cfg__zone-price cfg__zone-price--d">{fmt(zonePrice(card.id, s))}</span>
          <button type="button" class="cfg__zone-btn" onClick={() => toggle(card.id)}>{sel ? 'Убрать' : 'Добавить'}</button>
        </div>
      );
    }
    return (
      <div class="cfg__hint" data-name="EmptyHint">
        <Icon name="target" size={28} stroke={1.6} />
        <span class="stack">
          <strong>{s.body ? 'Отметьте зоны на машине' : 'Выберите кузов справа и отметьте зоны'}</strong>
          <span>Нажмите на точку — зона попадёт в расчёт</span>
        </span>
      </div>
    );
  };

  return (
    <div class={`cfg dir-${curDir}` + (isPage ? ' cfg--page' : '')} data-name="Configurator">
      {/* ---------- Визуал ---------- */}
      <div class={`cfg__visual is-${s.tab}`} data-name="ConfiguratorVisual">
        <div class="cfg__tabs" role="tablist" aria-label="Направление работ" data-name="Tabs/Direction">
          {TABS.map((t) => {
            const n = selected.filter((z) => z.tab === t.id).length;
            return (
              <button
                type="button" role="tab" key={t.id}
                class={`cfg__tab dir-${t.dir}`}
                aria-selected={t.id === s.tab}
                onClick={() => update({ tab: t.id, active: null })}
              >
                {t.id === 'film' ? <><span class="cfg__long">{t.name}</span><span class="cfg__short">Плёнка</span></> : t.name}
                {n > 0 && <span class="cfg__count">{n}</span>}
              </button>
            );
          })}
        </div>

        <div class="cfg__stage">
          <div class={`cfg__area is-${s.tab}`} ref={areaRef} data-name="Illustration">
            <img
              key={s.tab}
              class="cfg__photo"
              src={photo.src}
              srcset={photo.srcset}
              sizes={isNoise ? '(min-width: 1280px) 712px, (min-width: 768px) 92vw, 334px' : '(min-width: 1280px) 760px, (min-width: 768px) 100vw, 358px'}
              alt={photo.alt}
              style={{ objectFit: photo.fit, objectPosition: photo.position }}
              loading={isPage || touched.current ? 'eager' : 'lazy'}
              decoding="async"
              data-name="CalcPhoto"
            />
            {!isNoise && <span class="cfg__shade" aria-hidden="true" />}

            {s.tab === 'equip' && (
              <svg class={'cfg__overlay' + (on(HEADLIGHT.when) ? ' is-on' : '')} viewBox={HEADLIGHT.viewBox} preserveAspectRatio="none" aria-hidden="true" data-name="Overlay/Headlight">
                <defs>
                  <radialGradient id={`hlg-${uid}`}>
                    <stop offset="0" stop-color={HEADLIGHT.glow.color} stop-opacity="0.95" />
                    <stop offset="0.35" stop-color="#FFF1C2" stop-opacity="0.5" />
                    <stop offset="1" stop-color="#FFF1C2" stop-opacity="0" />
                  </radialGradient>
                  <linearGradient id={`hlb-${uid}`} x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0" stop-color={HEADLIGHT.glow.color} stop-opacity="0.4" />
                    <stop offset="1" stop-color={HEADLIGHT.glow.color} stop-opacity="0" />
                  </linearGradient>
                </defs>
                <path d={HEADLIGHT.beam} fill={`url(#hlb-${uid})`} />
                <ellipse cx={HEADLIGHT.glow.cx} cy={HEADLIGHT.glow.cy} rx={HEADLIGHT.glow.rx} ry={HEADLIGHT.glow.ry} fill={`url(#hlg-${uid})`} />
              </svg>
            )}

            {isFilm && FILM_SHAPES.map((f) => {
              const v = filmShape(f);
              return (
                <svg class="cfg__shape" viewBox={SHAPE_STYLE.viewBox} preserveAspectRatio={SHAPE_STYLE.preserveAspectRatio} style={v.style} aria-hidden="true" key={f.id} data-zone={f.id} data-name="FilmZone">
                  <path d={f.d} fill={v.fill} fill-rule="evenodd" stroke={v.stroke} stroke-width={v.sw} stroke-linejoin="round" stroke-linecap="round" />
                </svg>
              );
            })}

            {isNoise && NOISE_SHAPES.map((f) => {
              const v = noiseShape(f);
              return (
                <svg class="cfg__shape" viewBox={NOISE.viewBox} preserveAspectRatio={NOISE.preserveAspectRatio} style={{ opacity: v.opacity }} aria-hidden="true" key={f.id} data-zone={f.id} data-name="NoiseZone">
                  <defs dangerouslySetInnerHTML={{ __html: NOISE.textures[v.texture].svgPattern.replace('<zoneId>', `${uid}-${f.id}`) }} />
                  <path d={f.d} fill={v.fill} fill-rule="evenodd" stroke={v.stroke} stroke-width={v.sw} stroke-linejoin="round" stroke-linecap="round" />
                </svg>
              );
            })}

            {dotZones.map((z) => {
              const sel = on(z.id);
              return (
                <button
                  type="button" key={z.id}
                  class={`cfg__dot dir-${z.dir}` + (sel ? ' is-on' : '') + (z.id === s.active ? ' is-active' : '')}
                  style={{ left: `${z.x! * 100}%`, top: `${z.y! * 100}%` }}
                  aria-pressed={sel}
                  aria-label={`${z.name}, ${fmt(zonePrice(z.id, s))}`}
                  onClick={() => toggle(z.id)}
                  data-name="HotspotDot"
                />
              );
            })}
            {showLabels && dotZones.map((z) => (
              <span
                key={`${s.tab}-${z.id}`}
                ref={(el) => { labelRefs.current[z.id] = el; }}
                class={`cfg__label dir-${z.dir}` + (on(z.id) ? ' is-on' : '')}
                aria-hidden="true"
              >{isMobile ? (MOBILE_LABELS[z.id] ?? z.name) : (z.label ?? z.name)}</span>
            ))}

            <span class="cfg__caption" ref={captionRef} data-name="PhotoCaption">{photo.caption}</span>
          </div>
        </div>

        <div class="cfg__mid">{middle()}</div>
        {pkgBar('cfg__bottom')}
      </div>

      {/* ---------- Панель ---------- */}
      <div class="cfg__panel" data-name="ConfiguratorPanel">
        <div class="cfg__bodies-wrap">
          <span class={'cfg__label-up' + (s.body ? '' : ' is-attn')}><span class="cfg__num">1 · </span>Тип кузова</span>
          <div class="cfg__bodies" role="group" aria-label="Тип кузова" data-name="BodyTypePicker">
            {BODIES.map((b) => (
              <button type="button" class="cfg__body" aria-pressed={b.id === s.body} onClick={() => update({ body: b.id })} key={b.id}>
                <svg width="38" height="20" viewBox="0 0 38 20" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" aria-hidden="true">
                  <path d={b.d} /><circle cx="10" cy="15" r="2.5" /><circle cx="28" cy="15" r="2.5" />
                </svg>
                {b.name}
              </button>
            ))}
          </div>
        </div>

        {pkgBar('cfg__pkgbar-m')}

        <div class="cfg__summary">
          <div class="cfg__summary-head">
            <span class="cfg__label-up">2 · Выбрано · {count}</span>
            {!isEmpty && <button type="button" class="cfg__reset" onClick={() => update({ sel: [], active: null, filmPkg: null })}>Сбросить</button>}
          </div>
          {summaryList(false)}
          <div class="cfg__total">
            <div class="cfg__total-row">
              <span class={'price cfg__sum' + (isEmpty ? ' is-empty' : '')} aria-live="polite">{totalText}</span>
              <span class="cfg__days">{daysText}</span>
            </div>
            <span class="cfg__note">{carLine} · ориентировочно, точная цена — после осмотра</span>
          </div>
          <div class="cfg__actions">
            <button type="button" class="btn btn--primary" disabled={isEmpty} onClick={(e) => openModal('form', e)}>Связаться с мастером</button>
            <button type="button" class={'btn btn--secondary' + (copied ? ' is-copied' : '')} disabled={isEmpty} onClick={onCopy}>{copyLabel}</button>
          </div>
        </div>
      </div>

      {/* ---------- Мобайл: итог ---------- */}
      <div class="cfg__bar" data-name="SummaryBar">
        {isPage && <span class="light-strip cfg__bar-strip" aria-hidden="true"><span /><span /></span>}
        <span class="stack">
          <span class="cfg__bar-meta">{carLine} · {count} поз.</span>
          <span class={'price cfg__bar-sum' + (isEmpty ? ' is-empty' : '')}>{totalText}</span>
        </span>
        <button type="button" class="btn btn--primary cfg__bar-btn" disabled={isEmpty} onClick={(e) => openModal('sheet', e)} aria-haspopup="dialog">
          Итог<Icon name="up" size={16} stroke={2.2} />
        </button>
      </div>

      {modal !== 'none' && (
        <div class={'cfg-modal' + (modal === 'sheet' || isMobile ? ' is-sheet' : '')}>
          <div class="cfg-modal__overlay" onClick={closeModal} aria-hidden="true" />
          {modal === 'sheet' ? (
            <div class="cfg-modal__box cfg-sheet" role="dialog" aria-modal="true" aria-label="Ваш расчёт" ref={dialogRef} data-name="Sheet/Summary">
              <span class="cfg-modal__grip" aria-hidden="true" />
              <div class="cfg-modal__head">
                <span class="stack"><span class="cfg-modal__title">Ваш расчёт</span><span class="cfg__bar-meta">{carLine} · {count} {positionsWord(count)}</span></span>
                <button type="button" class="cfg-modal__x" aria-label="Свернуть" onClick={closeModal} data-autofocus>×</button>
              </div>
              <div class="cfg-sheet__list">{summaryList(true)}</div>
              <div class="cfg__total">
                <div class="cfg__total-row"><span class="price cfg__sum">{totalText}</span><span class="cfg__days">{daysText}</span></div>
                <span class="cfg__note">Ориентировочно, точная цена — после осмотра</span>
              </div>
              <button type="button" class="btn btn--primary btn--l btn--block" onClick={() => openModal('form')}>Связаться с мастером</button>
              <button type="button" class={'btn btn--secondary btn--block' + (copied ? ' is-copied' : '')} onClick={onCopy}>{copyLabel}</button>
            </div>
          ) : (
            <div class="cfg-modal__box cfg-contact" role="dialog" aria-modal="true" aria-label="Связаться с мастером" ref={dialogRef} data-name="Modal/Contact">
              <span class="light-strip cfg-modal__strip" aria-hidden="true"><span /><span /></span>
              <span class="cfg-modal__grip" aria-hidden="true" />
              <div class="cfg-modal__head">
                <span class="stack cfg-contact__titles">
                  <span class="cfg-modal__title">Связаться с мастером</span>
                  <span class="cfg-contact__sub">Мастер уточнит цену и срок после осмотра</span>
                </span>
                <button type="button" class="cfg-modal__x" aria-label="Закрыть" onClick={isMobile ? () => setModal('sheet') : closeModal} data-autofocus>×</button>
              </div>
              <div class="cfg-contact__calc" data-name="CalcSummary">
                <span class="cfg-contact__calc-head">Ваш расчёт · {carLine} · {count} поз. · {totalText}</span>
                <span class="cfg-contact__calc-items">{itemsText}</span>
              </div>
              {callButtons(isMobile)}
              <button type="button" class={'btn btn--secondary btn--block' + (copied ? ' is-copied' : '')} onClick={onCopy}>{copyLabel}</button>
              <span class="cfg-contact__hours">{hours} — в это время отвечаем сразу</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
