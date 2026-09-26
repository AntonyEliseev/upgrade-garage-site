import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { url } from '../lib/url';
import { Fragment } from 'preact';
import Icon from './Icon';
import {
  BODIES, CFG, FILM_PKGS, INITIAL, NOISE_PKGS, TABS, ZONES,
  daysWord, dirOfTab, dirOfZone, fmt, fromQuery, positionsWord, toQuery, totals, zoneMaterial, zonePrice, zoneSub,
  type CalcState, type DirId, type TabId, type Zone,
} from '../lib/calc';
import { goal, GOALS } from '../lib/analytics';
import './configurator.css';

// Калькулятор: ничего не отправляет. Выбор хранится в адресе, кнопка копирует ссылку на расчёт.

export interface Photo { src: string; srcset: string }
interface Phone { name: string; tel: string; display: string; primary?: boolean }
interface Props {
  photos: { body: Photo; salon: Photo };
  phones: Phone[];
  hours: string;
  /** page — страница /calculator: состояние синхронизируется с адресом, итог на мобайле — в фиксированной панели */
  mode?: 'embed' | 'page';
  initialTab?: TabId;
  /** Пакет плёнки, выбранный заранее (страница антигравийной плёнки) */
  initialFilmPkg?: string;
}

const MOBILE_Q = '(max-width: 767.98px)';
const W = 760; // ширина фото в макете, от неё считаются отступы карточки
const CARD_W = 240;

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
  const [size, setSize] = useState({ w: W, h: 500 });
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
    try { ok = (document as Document & { execCommand(c: string): boolean }).execCommand('copy'); } catch { ok = false; }
    sel?.removeAllRanges();
    span.remove();
    return ok;
  }
}

function lockScroll(on: boolean, cls: string) {
  document.documentElement.classList.toggle(cls, on);
}

export default function Configurator({ photos, phones, hours, mode = 'embed', initialTab, initialFilmPkg }: Props) {
  const isPage = mode === 'page';
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
  const isMobile = useMedia(MOBILE_Q);
  const [photoRef, box] = useSize<HTMLDivElement>();
  const touched = useRef(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

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
    const url = location.pathname + (qs ? `?${qs}` : '') + location.hash;
    if (url !== location.pathname + location.search + location.hash) history.replaceState(null, '', url);
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
  const count = selected.length;
  const isEmpty = count === 0;
  const curDir: DirId = dirOfTab(s.tab);
  const bodyObj = BODIES.find((b) => b.id === s.body);
  const carLine = bodyObj ? bodyObj.name : 'Кузов не выбран';
  const totalText = isEmpty ? '—' : fmt(sum);
  const daysText = isEmpty ? '' : `≈ ${days} ${daysWord(days)}`;

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

  /* ---------- Точки на фото ---------- */
  const tabZones = ZONES.filter((z) => z.tab === s.tab);
  const pos = (z: Zone) => (isMobile ? z.mobile : z.desktop);
  const fillable = s.tab === 'film' || s.tab === 'salon';
  const photo = s.tab === 'salon' ? photos.salon : photos.body;
  const photoAlt = s.tab === 'salon' ? 'Салон: экран, консоль и глянцевые вставки' : 'Кроссовер в три четверти спереди';

  const az = ZONES.find((z) => z.id === s.active && z.tab === s.tab);
  let card: null | { x: number; y: number; right: boolean; lead: string } = null;
  if (az && !isMobile) {
    const k = box.w / W;
    const cx = pos(az).x * box.w, cy = pos(az).y * box.h;
    const right = pos(az).x < 470 / 760;
    let x = right ? cx + 70 * k : cx - 70 * k - CARD_W;
    x = Math.max(8, Math.min(x, box.w - CARD_W - 8));
    const y = Math.max(-4, Math.min(cy - 90 * k, box.h - 190));
    const ey = y + 26, mx = right ? cx + 34 * k : cx - 34 * k, ex = right ? x : x + CARD_W;
    card = { x, y, right, lead: `M${cx} ${cy} L${mx} ${ey} L${ex} ${ey}` };
  }

  /* ---------- Пакеты ---------- */
  type Pkg = { id: string; name: string; active: boolean; pick: () => void };
  let pkgs: Pkg[] = [];
  let noPkgText = '';
  if (s.tab === 'noise') {
    pkgs = NOISE_PKGS.map((p) => ({ id: p.id, name: p.name, active: p.id === s.noisePkg, pick: () => update({ noisePkg: p.id }) }));
  } else if (s.tab === 'film') {
    pkgs = FILM_PKGS.map((p) => ({
      id: p.id, name: p.name, active: p.id === s.filmPkg,
      pick: () => update((prev) => ({ sel: [...prev.sel.filter((k) => !k.startsWith('f_')), ...p.z], filmPkg: p.id, active: null })),
    }));
  } else if (s.tab === 'salon') {
    noPkgText = 'Отметьте элементы салона на фото';
  } else {
    noPkgText = 'Режим «рентген»: узлы оснащения подписаны';
  }

  const pkgBar = (cls: string) => (
    <div class={cls}>
      {pkgs.length > 0 ? (
        <div class="cfg__pkgs" role="group" aria-label={s.tab === 'noise' ? 'Уровень шумоизоляции' : 'Пакет плёнки'}>
          {pkgs.map((p) => (
            <button type="button" class="cfg__pkg" aria-pressed={p.active} onClick={p.pick} key={p.id}>{p.name}</button>
          ))}
        </div>
      ) : (
        <span class="cfg__nopkg">{noPkgText}</span>
      )}
      {s.tab === 'film' && (
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
      rows: selected.filter((z) => dirOfZone(z.id) === d).map((z) => ({
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

  return (
    <div class={`cfg dir-${curDir}` + (isPage ? ' cfg--page' : '')} data-name="Configurator">
      {/* ---------- Визуал ---------- */}
      <div class="cfg__visual" data-name="ConfiguratorVisual">
        <div class="cfg__tabs" role="tablist" aria-label="Направление работ" data-name="Tabs/Direction">
          {TABS.map((t) => {
            const n = selected.filter((z) => z.tab === t.id).length;
            const active = t.id === s.tab;
            return (
              <button
                type="button" role="tab" key={t.id}
                class={`cfg__tab dir-${t.dir}`}
                aria-selected={active}
                onClick={() => update({ tab: t.id, active: null })}
              >
                {t.id === 'film' ? <><span class="cfg__long">{t.name}</span><span class="cfg__short">Плёнка</span></> : t.name}
                {n > 0 && <span class="cfg__count">{n}</span>}
              </button>
            );
          })}
        </div>

        <div class={'cfg__photo' + (s.tab === 'equip' ? ' is-xray' : '')} ref={photoRef} data-name="ModelPhoto">
          <img
            src={photo.src}
            srcset={photo.srcset}
            sizes="(min-width: 1280px) 760px, (min-width: 768px) 100vw, 358px"
            alt={photoAlt}
            width={760}
            height={500}
            loading={isPage ? 'eager' : 'lazy'}
            decoding="async"
          />

          {s.tab === 'equip' && s.sel.includes('e_ambient') && (
            <svg class="cfg__ambient" viewBox="0 0 760 500" preserveAspectRatio="none" aria-hidden="true">
              <path d="M300 162 C 380 137, 470 137, 560 162" stroke-width="3" />
              <path d="M330 242 L 430 234" stroke-width="2.5" />
              <path d="M470 234 L 570 242" stroke-width="2.5" />
            </svg>
          )}

          {card && az && (
            <svg class="cfg__lead" width={box.w} height={box.h} viewBox={`0 0 ${box.w} ${box.h}`} aria-hidden="true">
              <path d={card.lead} class={s.sel.includes(az.id) ? 'is-on' : ''} />
            </svg>
          )}

          {tabZones.map((z) => {
            const on = s.sel.includes(z.id);
            const p = pos(z);
            const style = { left: `${p.x * 100}%`, top: `${p.y * 100}%` };
            return (
              <Fragment key={z.id}>
                {on && fillable && <span class="cfg__glow" style={style} aria-hidden="true" />}
                <button
                  type="button"
                  class={'cfg__dot' + (on ? ' is-on' : '') + (z.id === s.active ? ' is-active' : '')}
                  style={style}
                  aria-pressed={on}
                  aria-label={`${z.name}, ${fmt(zonePrice(z.id, s))}`}
                  onClick={() => toggle(z.id)}
                  data-name="HotspotDot"
                />
                {s.tab === 'equip' && <span class={'cfg__label' + (on ? ' is-on' : '')} style={style} aria-hidden="true">{z.name}</span>}
              </Fragment>
            );
          })}

          {card && az && (
            <div class={'cfg__card' + (s.sel.includes(az.id) ? ' is-on' : '')} style={{ left: `${card.x}px`, top: `${card.y}px` }} data-name="HotspotCard">
              <span class="cfg__card-name">{az.name}</span>
              <span class="cfg__card-desc">{az.desc}</span>
              <span class="cfg__card-mat">Материал: {zoneMaterial(az)}</span>
              {az.id === 'e_closers' && (
                <div class="cfg__closers">
                  <button type="button" aria-pressed={s.closers === 2} onClick={() => update({ closers: 2 })}>2 двери</button>
                  <button type="button" aria-pressed={s.closers === 4} onClick={() => update({ closers: 4 })}>4 двери</button>
                </div>
              )}
              <div class="cfg__card-foot">
                <span class="cfg__card-price">{fmt(zonePrice(az.id, s))}</span>
                <button type="button" class="cfg__card-btn" onClick={() => toggle(az.id)}>{s.sel.includes(az.id) ? 'Убрать' : 'Добавить'}</button>
              </div>
            </div>
          )}

          {isEmpty && !az && (
            <div class="cfg__hint" data-name="EmptyHint">
              <Icon name="target" size={28} stroke={1.6} />
              <span class="stack"><strong>{s.body ? 'Отметьте зоны на машине' : 'Выберите кузов и отметьте зоны'}</strong><span>Нажмите на точку — зона попадёт в расчёт</span></span>
            </div>
          )}
        </div>
        {s.tab === 'equip' && <span class="cfg__caption">Режим «рентген»: узлы оснащения на полупрозрачном кузове</span>}
        {pkgBar('cfg__bottom')}
      </div>

      {/* ---------- Мобайл: зона под фото ---------- */}
      <div class="cfg__strip" aria-live="polite">
        {az ? (
          <div class={'cfg__zone' + (s.sel.includes(az.id) ? ' is-on' : '')} data-name="ZoneStrip">
            <span class="cfg__zone-text">
              <strong>{az.name}</strong>
              <span>{az.desc}</span>
              <span class="cfg__zone-price">{fmt(zonePrice(az.id, s))}</span>
            </span>
            {az.id === 'e_closers' && (
              <span class="cfg__closers cfg__closers--v">
                <button type="button" aria-pressed={s.closers === 2} onClick={() => update({ closers: 2 })}>2 дв.</button>
                <button type="button" aria-pressed={s.closers === 4} onClick={() => update({ closers: 4 })}>4 дв.</button>
              </span>
            )}
            <button type="button" class="cfg__card-btn cfg__zone-btn" onClick={() => toggle(az.id)}>{s.sel.includes(az.id) ? 'Убрать' : 'Добавить'}</button>
          </div>
        ) : (
          <div class="cfg__zone cfg__zone--empty">Нажмите на точку, чтобы добавить зону</div>
        )}
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
