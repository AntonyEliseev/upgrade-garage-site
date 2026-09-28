# Деплой: GitHub Pages

Сайт статический (Astro собирает HTML в `dist/`), сервер не нужен. Код лежит на GitHub, там же собирается и публикуется через GitHub Actions.

## Схема

```
git push в main или master
      │
      ▼
GitHub Actions  (.github/workflows/deploy.yml)
  1. npm ci                      — зависимости из package-lock.json, Node 22
  2. configure-pages             — узнаёт адрес сайта из настроек Pages
  3. npm run check               — проверка типов
  4. npm run build               — SITE_URL и BASE_PATH из шага 2 → dist/
  5. upload-pages-artifact       — dist/ как артефакт
      │
      ▼
deploy-pages → https://<аккаунт>.github.io/<репозиторий>/   (или свой домен)
```

Публикуется каждый пуш в `main` или `master`; вручную — Actions → Deploy to GitHub Pages → Run workflow. Статус и ссылка на сайт — во вкладке Actions и в Settings → Pages.

## Первый запуск

1. Создайте репозиторий на GitHub (можно приватный — Pages для приватных репозиториев доступны на платных тарифах; на бесплатном репозиторий должен быть публичным).
2. Залейте код:
   ```bash
   git init
   git add .
   git commit -m "Сайт студии"
   git branch -M main
   git remote add origin git@github.com:<аккаунт>/<репозиторий>.git
   git push -u origin main
   ```
3. Settings → Pages → Build and deployment → Source: **GitHub Actions**.
4. Дождитесь зелёной галочки в Actions (2–3 минуты) — сайт откроется по адресу из Settings → Pages.

## Адрес сайта и базовый путь

Workflow сам берёт адрес из настроек Pages, в коде ничего менять не нужно:

| Как настроен Pages | Адрес | `BASE_PATH` |
| --- | --- | --- |
| Обычный репозиторий | `https://<аккаунт>.github.io/<репозиторий>/` | `/<репозиторий>/` |
| Репозиторий `<аккаунт>.github.io` | `https://<аккаунт>.github.io/` | `/` |
| Свой домен | `https://домен.ru/` | `/` |

Все внутренние ссылки в коде идут через `url()` из `src/lib/url.ts` — он добавляет базовый путь. Новые ссылки пишите так же: `href={url('/works')}`.

## Индексация

Пока сайт живёт на `*.github.io`, он закрыт от поисковиков: `<meta name="robots" content="noindex">` на всех страницах и `Disallow: /` в robots.txt. Так временный адрес не попадёт в выдачу и не станет дублем боевого. Как только подключён свой домен, canonical, sitemap и robots.txt переключаются на него автоматически при следующей сборке.

## Свой домен (когда появится)

1. Settings → Pages → Custom domain: `домен.ru`, включить Enforce HTTPS.
2. У регистратора: `A`-записи на `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153` (для `www` — `CNAME` на `<аккаунт>.github.io`).
3. Запустить workflow заново (Run workflow) — сайт пересоберётся с новым адресом и откроется для индексации.
4. Добавить сайт в Яндекс Вебмастер и указать `https://домен.ru/sitemap-index.xml`.

## Что учесть

- **Яндекс Метрика:** ID задаётся в `src/config.ts` (`METRIKA_ID`), после правки — пуш.
- **Адреса без `.html`:** страницы собираются как `calculator.html`, GitHub Pages сам отдаёт их по `/calculator`.
- **404:** GitHub Pages показывает `dist/404.html`.
- **Локальная проверка как на Pages:** `BASE_PATH=/<репозиторий>/ SITE_URL=https://<аккаунт>.github.io npm run build`.
- **Node:** в Actions — 22. Локально собирается и на 18.20.8, но `npm run check` требует Node 20+.
