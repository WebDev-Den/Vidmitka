# Vercel deployment

## Поточний стан

- Production URL: `https://web-dev.pp.ua/`
- Vercel project: `vidmitka`
- Vercel scope: `webdevdens-projects`
- Git repository: `https://github.com/WebDev-Den/Vidmitka.git`
- Production branch: `main`
- Custom domain verification: підтверджено
- DNS provider: Cloudflare
- DNS route: `web-dev.pp.ua` → `76.76.21.21`

Перший production deployment виконано 27 серпня 2026 року. Домен було без простою перенесено з попереднього Vercel-проєкту `my-schedule` до `vidmitka` після перевірки нового deployment на окремій адресі.

## Перевірки першого deployment

- TypeScript typecheck: успішно.
- Локальний production build: успішно.
- Віддалений Vercel build: успішно.
- Deployment status: `Ready`.
- Public HTTP response: `200 OK`.
- Vercel cache: працює.
- Desktop browser smoke check: успішно.
- Mobile browser smoke check: успішно.
- Browser console: 0 errors, 0 warnings.
- Runtime error logs після deployment: відсутні.

## Автоматичні deployment

Vercel-проєкт підключено до GitHub-репозиторію, а production branch встановлено як `main`. Нативне створення deployment із Git увімкнене.

На момент першого deployment віддалений Git-репозиторій ще не має гілок і комітів, а локальна `main` не має першого коміту. Тому автоматичний deployment із Git почне працювати лише після першого контрольованого commit і push.

Для суворого правила «production лише після успішного CI» потрібно окремо:

1. створити перший commit і push у `main`;
2. додати CI-перевірки typecheck, тестів і production build;
3. додати deployment job, який залежить від успішних перевірок;
4. зберігати Vercel credentials лише в захищених secrets репозиторію;
5. вимкнути паралельне нативне створення production deployment, якщо deployment повністю контролюватиме CI workflow.

До появи автоматизованих тестів обов'язковими gates залишаються typecheck і production build.

## Локальні службові файли

- `.vercel/project.json` містить локальне прив'язування до Vercel-проєкту й не комітиться.
- `.vercel/.env.production.local` створюється Vercel CLI й не комітиться.
- `.vercelignore` виключає локальні build artifacts, залежності, QA artifacts і env-файли з upload.
- Токени та інші secrets заборонено додавати до репозиторію або документації.
