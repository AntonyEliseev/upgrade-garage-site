import extrasJson from '@data/service-pages.json';
import { services, caseBySlug, type Service } from './data';
import { seoByUrl, type SeoBlock, type SeoPage } from './seo';
import type { TabId } from './calc';

interface Stat { v: string; l: string; lm?: string }
interface Problem { t: string; d: string; s: string }
interface Package { name: string; sub: string; price: string; items: string[]; featured?: boolean; calc: string }
interface Extras {
  h1Mark?: string;
  hero: { img: string; alt: string };
  stats: Stat[];
  priceFrom?: number;
  problems?: Problem[];
  included?: { lead: string; items: string[] };
  packages?: Package[];
  calc: { tab: TabId; pkg?: string };
  cases: string[];
  worksTitle: string;
  faqTitle: string;
}

const extras = extrasJson as unknown as Record<string, Extras>;

export interface ServicePageData extends Extras {
  service: Service;
  seo: SeoPage;
  includedBlock: { lead: string; items: string[] } | { lead: string; text: string } | null;
  details: SeoBlock[];
  caseItems: NonNullable<ReturnType<typeof caseBySlug>>[];
}

export function buildServicePages(): ServicePageData[] {
  return services.map((service) => {
    const seo = seoByUrl(service.url);
    const ex = extras[service.slug];
    if (!seo) throw new Error(`Нет SEO-текста для ${service.url} в docs/seo-texts.md`);
    if (!ex) throw new Error(`Нет данных для ${service.slug} в data/service-pages.json`);

    const incl = seo.blocks.find((b) => b.title === 'Что входит');
    let includedBlock: ServicePageData['includedBlock'] = null;
    if (ex.included) includedBlock = ex.included;
    else if (incl?.items.length) includedBlock = { lead: incl.text, items: incl.items };
    else if (incl) includedBlock = { lead: '', text: incl.text };

    // Остальные блоки SEO-текста — в «Цены и детали». «Пакеты» уже показаны карточками.
    const details = seo.blocks.filter((b) => {
      if (b === incl && !ex.included) return false;
      if (b.title === 'Пакеты' && ex.packages) return false;
      return true;
    });

    return {
      ...ex,
      service,
      seo,
      includedBlock,
      details,
      caseItems: ex.cases.map(caseBySlug).filter((c): c is NonNullable<typeof c> => !!c),
    };
  });
}

/** H1 с маркером под словом из h1Mark */
export function markH1(h1: string, mark?: string) {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  if (!mark || !h1.includes(mark)) return esc(h1);
  const i = h1.indexOf(mark);
  return `${esc(h1.slice(0, i))}<span class="mark">${esc(mark)}</span>${esc(h1.slice(i + mark.length))}`;
}
