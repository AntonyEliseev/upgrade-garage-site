// Базовый путь сайта: «/» на своём домене, «/<репозиторий>/» на GitHub Pages без домена.
// import.meta.env.BASE_URL доступен и при сборке, и в островках.
const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

/** Внутренняя ссылка от корня сайта с учётом базового пути: url('/works') → '/repo/works' */
export function url(path: string) {
  if (!path.startsWith('/') || path.startsWith('//')) return path;
  if (!BASE) return path;
  return path === '/' ? `${BASE}/` : path.startsWith('/#') ? `${BASE}/${path.slice(1)}` : BASE + path;
}

/** Путь страницы без базового префикса: для сравнения с '/calculator' */
export function stripBase(pathname: string) {
  return BASE && pathname.startsWith(BASE) ? pathname.slice(BASE.length) || '/' : pathname;
}
