import { useEffect, useRef, useState } from 'preact/hooks';
import { url } from '../lib/url';

// Мега-меню «Услуги»: клик и наведение (задержка 150 мс), закрытие по Esc, клику вне и уходу курсора.

interface Item { name: string; url: string }
interface Props {
  kosmos: Item[];
  garage: Item[];
  phone: { display: string; tel: string };
  active?: boolean;
}

const HOVER_DELAY = 150;

export default function ServicesMenu({ kosmos, garage, phone, active }: Props) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const timer = useRef<number>();

  const schedule = (next: boolean) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(next), HOVER_DELAY);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); btn.current?.focus(); }
    };
    const onDown = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [open]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const hoverable = () => window.matchMedia('(hover: hover)').matches;

  const col = (dir: 'kosmos' | 'garage', items: Item[]) => (
    <div class={`mega__col dir-${dir}`} data-name={dir === 'kosmos' ? 'MegaMenu/Kosmos' : 'MegaMenu/Garage'}>
      <div class="mega__head">
        <span class="mega__brand">
          {dir === 'kosmos' ? 'КОСМОС' : 'АПГРЕЙД'} <span class="dir-card__badge">{dir === 'kosmos' ? 'WRAP' : 'GARAGE'}</span>
        </span>
        <span class="mega__sub">{dir === 'kosmos' ? 'Оклейка и защита' : 'Шумоизоляция, автозвук и дооснащение'}</span>
      </div>
      <ul role="list" class="mega__list">
        {items.map((it) => (
          <li><a href={it.url} class="mega__link">{it.name}<span aria-hidden="true">→</span></a></li>
        ))}
      </ul>
    </div>
  );

  return (
    <div
      ref={root}
      class="mega"
      onMouseEnter={() => hoverable() && schedule(true)}
      onMouseLeave={() => hoverable() && schedule(false)}
    >
      <button
        ref={btn}
        type="button"
        class={'nav__link nav__btn' + (open || active ? ' is-active' : '')}
        aria-expanded={open}
        aria-controls="services-menu"
        onClick={() => { window.clearTimeout(timer.current); setOpen(!open); }}
      >
        Услуги
        <svg class="nav__chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      <div id="services-menu" class="mega__panel" hidden={!open} data-name="MegaMenu/Services">
        <div class="container mega__grid">
          {col('kosmos', kosmos)}
          {col('garage', garage)}
          <a href={url('/calculator')} class="mega__calc" data-name="MegaMenu/CalcCard">
            <span class="light-strip mega__calc-strip" aria-hidden="true"><span></span><span></span></span>
            <span class="mega__calc-title">Не знаете, что нужно?</span>
            <span class="mega__calc-text">Отметьте зоны на машине — калькулятор покажет цену по обоим направлениям.</span>
            <span class="btn btn--primary btn--block mega__calc-btn">Открыть калькулятор</span>
            <span class="mega__calc-note">или позвоните: {phone.display}</span>
          </a>
        </div>
      </div>
    </div>
  );
}
