// Разбор docs/seo-texts.md: у каждой услуги — лид, блоки («Что входит», «Материалы», «Цена»…), FAQ и ключевые запросы.
import raw from '../../docs/seo-texts.md?raw';

export interface SeoBlock {
  title: string;
  /** Текст сразу после заголовка блока, HTML */
  text: string;
  /** Пункты списка под блоком, HTML */
  items: string[];
}
export interface SeoPage {
  url: string;
  title: string;
  description: string;
  h1: string;
  lead: string;
  blocks: SeoBlock[];
  faq: { q: string; a: string }[];
  keywords: string[];
}

// Редакторские пометки, которые не должны попасть на сайт
const EDITORIAL = [/\s*Старые названия из макета \*\*заменяем\*\*\./g];

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inline = (s: string) =>
  esc(s.trim())
    .replace(/\\\[/g, '[').replace(/\\\]/g, ']')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>');
export const stripTags = (s: string) => s.replace(/<[^>]+>/g, '');

function parseSection(body: string): SeoPage | null {
  const field = (name: string) => body.match(new RegExp(`^\\| ${name} \\| (.+?) \\|$`, 'm'))?.[1].trim() ?? '';
  const url = field('URL');
  if (!url) return null;

  let text = body.slice(body.lastIndexOf('|') + 1);
  for (const re of EDITORIAL) text = text.replace(re, '');
  const paras = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

  const page: SeoPage = { url, title: field('Title'), description: field('Description'), h1: field('H1'), lead: '', blocks: [], faq: [], keywords: [] };
  let current: SeoBlock | null = null;
  let inFaq = false;

  for (const p of paras) {
    if (p === '**FAQ**') { inFaq = true; current = null; continue; }
    const kw = p.match(/^\*\*Ключевые запросы:\*\*\s*(.+)$/s);
    if (kw) { page.keywords = kw[1].split('·').map((k) => k.trim()); inFaq = false; continue; }

    if (p.startsWith('- ')) {
      const items = p.split(/\n(?=- )/).map((li) => li.replace(/^- /, '').replace(/\n\s*/g, ' '));
      if (inFaq) {
        for (const li of items) {
          const m = li.match(/^\*(.+?)\*\s*(.+)$/s);
          if (m) page.faq.push({ q: m[1].trim(), a: inline(m[2]) });
        }
      } else if (current) {
        current.items.push(...items.map(inline));
      }
      continue;
    }

    const head = p.match(/^\*\*(.+?)[.:]\*\*\s*(.*)$/s);
    if (head) {
      inFaq = false;
      const [, title, rest] = head;
      if (title === 'Лид') { page.lead = inline(rest.replace(/\n/g, ' ')); current = null; continue; }
      current = { title, text: inline(rest.replace(/\n/g, ' ')), items: [] };
      page.blocks.push(current);
      continue;
    }
    // Абзац без заголовка — продолжение текущего блока
    if (current) current.text += (current.text ? ' ' : '') + inline(p.replace(/\n/g, ' '));
  }
  return page;
}

export const seoPages: SeoPage[] = raw
  .split(/\n(?=## )/)
  .map(parseSection)
  .filter((p): p is SeoPage => p !== null);

export const seoByUrl = (url: string) => seoPages.find((p) => p.url === url);
