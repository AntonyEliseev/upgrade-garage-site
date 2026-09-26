import { contacts, phones } from './data';
import { url } from './url';
import { SITE_NAME } from '../config';

// schema.org: AutoRepair (подтип LocalBusiness) — адрес, часы и телефоны из data/contacts.json.
export function localBusiness(site: URL) {
  const [street] = contacts.address.replace('Москва, ', '').split(', бокс');
  return {
    '@context': 'https://schema.org',
    '@type': 'AutoRepair',
    '@id': new URL(url('/#business'), site).href,
    name: SITE_NAME,
    alternateName: ['Космос Wrap', 'Апгрейд Garage'],
    url: new URL(url('/'), site).href,
    logo: new URL(url('/logo/logo-light-bg.svg'), site).href,
    image: new URL(url('/logo/logo-light-bg.svg'), site).href,
    telephone: phones.map((p) => p.tel),
    address: {
      '@type': 'PostalAddress',
      streetAddress: contacts.address.replace('Москва, ', ''),
      addressLocality: 'Москва',
      addressCountry: 'RU',
    },
    hasMap: contacts.yandexMaps,
    // «Вт–Сб 11:00–20:00, пн и вс — выходной»
    openingHoursSpecification: [{
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      opens: '11:00',
      closes: '20:00',
    }],
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: contacts.rating.value,
      reviewCount: contacts.rating.reviews,
      bestRating: 5,
    },
    foundingDate: String(contacts.stats.since),
    sameAs: [contacts.telegram.kosmos, contacts.telegram.garage, contacts.yandexMaps],
    areaServed: 'Москва',
    priceRange: '₽₽',
    description: `Две студии в одном боксе на ${street}: оклейка и защитная плёнка (Космос Wrap), шумоизоляция, автозвук и дооснащение (Апгрейд Garage).`,
  };
}

export function faqPage(items: { q: string; a: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((it) => ({
      '@type': 'Question',
      name: it.q,
      acceptedAnswer: { '@type': 'Answer', text: it.a.replace(/<[^>]+>/g, '') },
    })),
  };
}

export function breadcrumbs(site: URL, items: { name: string; href: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: new URL(url(it.href), site).href,
    })),
  };
}

export function serviceSchema(site: URL, s: { name: string; description: string; url: string }, priceFrom?: number) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: s.name,
    description: s.description,
    url: new URL(url(s.url), site).href,
    areaServed: 'Москва',
    provider: { '@id': new URL(url('/#business'), site).href },
    ...(priceFrom
      ? { offers: { '@type': 'Offer', priceCurrency: 'RUB', price: priceFrom, priceSpecification: { '@type': 'PriceSpecification', minPrice: priceFrom, priceCurrency: 'RUB' } } }
      : {}),
  };
}
