import { Fragment } from 'preact';
import { url } from '../lib/url';
import { useEffect, useMemo, useState } from 'preact/hooks';
import './portfolio.css';

// Портфолио: фильтры по услуге и марке, «Показать ещё». Фильтр хранится в адресе: /works?s=film&b=bmw

type Dir = 'kosmos' | 'garage';
export interface CaseItem {
  slug: string;
  name: string;
  brand: string;
  d: Dir;
  s: string[];
  tags: string[];
  photo: string;
  img?: { src: string; srcset: string };
  /** Сколько всего фото в кейсе */
  count: number;
  /** Миниатюры 2–4-го фото */
  thumbs: string[];
}
interface Filter { id: string; name: string; d?: Dir; sep?: boolean }
interface Props {
  cases: CaseItem[];
  services: Filter[];
  brands: Filter[];
  telegram: string;
  initialService?: string;
}

const FIRST = 9;

/** Бейдж «N фото» в правом верхнем углу обложки */
export function PhotoCount({ n }: { n: number }) {
  return (
    <span class="case-card__count">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="6" width="18" height="14" rx="2" /><circle cx="12" cy="13" r="3.5" /><path d="M8 6l2-2h4l2 2" /></svg>
      {n} фото
    </span>
  );
}

/** Три миниатюры под обложкой и плашка «+N», если фото больше четырёх */
export function Thumbs({ thumbs, count }: { thumbs: string[]; count: number }) {
  return (
    <span class="case-card__thumbs" aria-hidden="true" data-name="CaseCard/Thumbs">
      {thumbs.map((t) => <span class="case-card__thumb" key={t}><img src={t} alt="" loading="lazy" decoding="async" width={76} height={56} /></span>)}
      {count > 4 && <span class="case-card__thumb case-card__more">+{count - 4}</span>}
    </span>
  );
}
const STEP = 6;

export default function PortfolioFilter({ cases, services, brands, telegram, initialService = 'all' }: Props) {
  const [sv, setSv] = useState(initialService);
  const [bd, setBd] = useState('all');
  const [limit, setLimit] = useState(FIRST);

  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const s = q.get('s'), b = q.get('b');
    if (s && services.some((f) => f.id === s)) setSv(s);
    if (b && brands.some((f) => f.id === b)) setBd(b);
  }, []);

  useEffect(() => {
    const q = new URLSearchParams();
    if (sv !== 'all') q.set('s', sv);
    if (bd !== 'all') q.set('b', bd);
    const url = location.pathname + (q.toString() ? `?${q}` : '');
    if (url !== location.pathname + location.search) history.replaceState(null, '', url);
  }, [sv, bd]);

  const found = useMemo(
    () => cases.filter((c) => (sv === 'all' || c.s.includes(sv)) && (bd === 'all' || c.brand === bd)),
    [cases, sv, bd],
  );
  const shown = found.slice(0, limit);
  const rest = found.length - shown.length;

  const pick = (fn: (v: string) => void, v: string) => { fn(v); setLimit(FIRST); };

  const chip = (f: Filter, on: boolean, onClick: () => void) => (
    <button type="button" class={'chip' + (f.d ? ` dir-${f.d}` : '')} aria-pressed={on} onClick={onClick} key={f.id}>{f.name}</button>
  );

  return (
    <div class="pf">
      <div class="pf__filters" data-name="Filters">
        <div class="pf__row" role="group" aria-label="Фильтр по услуге">
          <span class="pf__label">Услуга</span>
          <div class="pf__chips">
            {services.map((f) => (
              <Fragment key={f.id}>
                {f.sep && <span class="chip-sep" aria-hidden="true" />}
                {chip(f, f.id === sv, () => pick(setSv, f.id))}
              </Fragment>
            ))}
          </div>
        </div>
        <div class="pf__row" role="group" aria-label="Фильтр по марке">
          <span class="pf__label">Марка</span>
          <div class="pf__chips">{brands.map((f) => chip(f, f.id === bd, () => pick(setBd, f.id)))}</div>
          <span class="pf__count" aria-live="polite">Найдено: {found.length}</span>
        </div>
      </div>

      <ul role="list" class="pf__grid" data-name="CaseGrid">
        {shown.map((c) => (
          <li key={c.slug}>
            <a href={url(`/works/${c.slug}`)} class={`case-card dir-${c.d}`} data-name="CaseCard">
              <span class={'case-card__media pf__media' + (c.img ? '' : ' case-card__media--stripe')}>
                {c.img && (
                  <img
                    src={c.img.src}
                    srcset={c.img.srcset}
                    sizes="(min-width: 1280px) 410px, (min-width: 768px) 50vw, 100vw"
                    alt={c.name}
                    loading="lazy"
                    decoding="async"
                    width={410}
                    height={280}
                  />
                )}
                <span class="case-card__line" aria-hidden="true" />
                {c.img && <PhotoCount n={c.count} />}
                {!c.img && <span class="case-card__caption">Фото: {c.photo}</span>}
                <span class="case-card__cta" aria-hidden="true">Смотреть кейс →</span>
              </span>
              {c.thumbs.length > 0 && <Thumbs thumbs={c.thumbs} count={c.count} />}
              <h2 class="case-card__title">{c.name}</h2>
              <span class="tags">{c.tags.map((t) => <span class="tag" key={t}>{t}</span>)}</span>
            </a>
          </li>
        ))}
        {found.length === 0 && (
          <li class="pf__empty">
            <strong>Таких работ пока нет на сайте</strong>
            <span>Напишите нам — покажем похожие в Telegram</span>
            <button type="button" class="btn btn--secondary btn--s" onClick={() => { setSv('all'); setBd('all'); }}>Сбросить фильтры</button>
          </li>
        )}
      </ul>

      <div class="pf__more">
        {rest > 0 ? (
          <button type="button" class="btn btn--secondary btn--l" onClick={() => setLimit(limit + STEP)}>Показать ещё {Math.min(rest, STEP)}</button>
        ) : found.length > 0 ? (
          <div class="pf__end">
            <strong>Это все работы на сайте</strong>
            <a href={telegram} target="_blank" rel="noopener">Ещё больше — в Telegram →</a>
          </div>
        ) : null}
      </div>
    </div>
  );
}
