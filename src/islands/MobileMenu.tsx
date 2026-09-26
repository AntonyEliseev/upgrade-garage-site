import { useEffect, useRef, useState } from 'preact/hooks';
import { url } from '../lib/url';
import Icon from './Icon';

// Меню на мобайле и планшете: на весь экран, аккордеон направлений, прокрутка страницы блокируется.

interface Item { name: string; url: string }
interface Phone { name: string; tel: string; display: string; primary?: boolean }
interface Props {
  kosmos: Item[];
  garage: Item[];
  phones: Phone[];
  telegram: { kosmos: string; garage: string };
  whatsapp: string;
  footnote: string;
  logo: string;
}

const GROUPS = [
  { id: 'kosmos', name: 'КОСМОС', tag: 'WRAP', sub: 'Оклейка и защита' },
  { id: 'garage', name: 'АПГРЕЙД', tag: 'GARAGE', sub: 'Шумоизоляция, автозвук и дооснащение' },
] as const;

export default function MobileMenu(props: Props) {
  const [open, setOpen] = useState(false);
  const [group, setGroup] = useState<string | null>('kosmos');
  const burger = useRef<HTMLButtonElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const html = document.documentElement;
    html.classList.toggle('menu-open', open);
    if (!open) return;
    closeBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); burger.current?.focus(); }
      if (e.key === 'Tab' && panel.current) {
        const f = panel.current.querySelectorAll<HTMLElement>('a[href], button');
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    const onResize = () => { if (window.innerWidth >= 1280) setOpen(false); };
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
      html.classList.remove('menu-open');
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <>
      <button ref={burger} type="button" class="btn btn--icon" aria-label="Меню" aria-expanded={open} aria-controls="mobile-menu" onClick={() => setOpen(true)}>
        <Icon name="burger" />
      </button>
      <div ref={panel} id="mobile-menu" class="mmenu" role="dialog" aria-modal="true" aria-label="Меню" hidden={!open} data-name="Menu/Mobile">
        <div class="mmenu__top">
          <a href={url('/')} aria-label="На главную" class="mmenu__logo" onClick={close}>
            <img src={props.logo} alt="Космос Wrap · Апгрейд Garage" width={157} height={44} />
          </a>
          <button ref={closeBtn} type="button" class="btn btn--icon" aria-label="Закрыть меню" onClick={close}>
            <Icon name="close" stroke={2} />
          </button>
        </div>
        <div class="mmenu__body">
          <nav class="mmenu__nav" aria-label="Разделы сайта">
            {GROUPS.map((g) => {
              const isOpen = group === g.id;
              const items = g.id === 'kosmos' ? props.kosmos : props.garage;
              return (
                <div class={`mmenu__group dir-${g.id}`} key={g.id}>
                  <button type="button" class="mmenu__gbtn" aria-expanded={isOpen} aria-controls={`mm-${g.id}`} onClick={() => setGroup(isOpen ? null : g.id)}>
                    <span class="mmenu__gtext">
                      <span class="mmenu__gname">{g.name} <span class="dir-card__badge">{g.tag}</span></span>
                      <span class="mmenu__gsub">{g.sub}</span>
                    </span>
                    <span class="mmenu__sign" aria-hidden="true">{isOpen ? '−' : '+'}</span>
                  </button>
                  <ul role="list" id={`mm-${g.id}`} class="mmenu__items" hidden={!isOpen}>
                    {items.map((it) => (
                      <li><a href={it.url} class="mmenu__item" onClick={close}>{it.name}</a></li>
                    ))}
                  </ul>
                </div>
              );
            })}
            <a href={url('/calculator')} class="mmenu__row" onClick={close}>Калькулятор<span aria-hidden="true">→</span></a>
            <a href={url('/works')} class="mmenu__row" onClick={close}>Работы<span aria-hidden="true">→</span></a>
            <a href={url('/#contacts')} class="mmenu__row" onClick={close}>Контакты<span aria-hidden="true">→</span></a>
          </nav>
          <div class="mmenu__contacts">
            {props.phones.map((p) => (
              <a href={`tel:${p.tel}`} class={'call-btn call-btn--m' + (p.primary ? ' call-btn--primary' : '')}>
                <span class="call-btn__icon"><Icon name="phone" /></span>
                <span class="call-btn__text"><span class="call-btn__num">{p.display}</span><span class="call-btn__name">{p.name}</span></span>
              </a>
            ))}
            <div class="msg-grid">
              <a class="msg-btn msg-btn--kosmos" href={props.telegram.kosmos} target="_blank" rel="noopener">@{props.telegram.kosmos.split('/').pop()}</a>
              <a class="msg-btn msg-btn--garage" href={props.telegram.garage} target="_blank" rel="noopener">@{props.telegram.garage.split('/').pop()}</a>
              <a class="msg-btn" href={props.whatsapp} target="_blank" rel="noopener">WhatsApp</a>
            </div>
            <span class="mmenu__foot">{props.footnote}</span>
          </div>
        </div>
      </div>
    </>
  );
}
