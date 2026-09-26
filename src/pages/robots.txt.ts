import type { APIRoute } from 'astro';
import { url } from '../lib/url';

// Временный адрес *.github.io закрыт от индексации; на своём домене — обычные правила.
export const GET: APIRoute = ({ site }) => {
  const body = site!.hostname.endsWith('github.io')
    ? ['User-agent: *', 'Disallow: /', '']
    : [
        'User-agent: *',
        'Allow: /',
        '',
        'User-agent: Yandex',
        'Allow: /',
        // Состояние калькулятора в адресе — не отдельные страницы
        'Clean-param: body&z&pkg&np&fin&cl&tab /calculator',
        'Clean-param: s&b /works',
        '',
        `Sitemap: ${new URL(url('/sitemap-index.xml'), site).href}`,
        '',
      ];
  return new Response(body.join('\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
