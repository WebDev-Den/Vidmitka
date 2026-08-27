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
- Authentication: власні облікові записи та сесії в Neon; зовнішня auth-інтеграція не використовується.
- Database integration: Neon (`vidmitka-db`), підключено для Production, Preview і Development.

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

Оновлення від 27.08.2026: репозиторій уже містить гілку `main` і попередні production-релізи. Push у `main` запускає нативний deployment Vercel; окремого GitHub Actions або GitLab pipeline наразі немає.

Кореневий `vercel.json` встановлює обов’язковий gate кожної Vercel-збірки:

1. Нативне встановлення залежностей Vercel: pnpm визначається за `pnpm-lock.yaml`, у CI використовується frozen lockfile;
2. `pnpm test`;
3. `pnpm build`, включно з перевіркою TypeScript у Next.js.

Якщо тести або збірка завершаться помилкою, новий deployment не стане production-версією. Домен залишиться на попередньому успішному deployment. Додатковий Vercel token у Git не потрібний: публікацією керує вже підключена Git-інтеграція.

Мережеві integration-тести не запускаються проти робочих таблиць під час Vercel build. Перед релізом їх виконують через `info/testing/attendance-runner.mjs` (окремо без параметрів і з `--groups`) у тимчасових схемах та ролях без права змінювати робочі дані. Звичайний `pnpm test` пропускає ці два тести без спеціального ізольованого середовища. Повністю автоматизовані integration/E2E gates потребують окремої тестової БД і CI workflow; поточний build gate їх не замінює.

## Реліз журналу, груп і списків занять

- Нові можливості: журнал відвідування, CSV/JSON-імпорт студентів, вибір або створення групи, індивідуальний список студентів заняття, дата чисельника та фірмові фавіконки.
- Міграції `006_attendance.sql` і `007_student_groups_and_lesson_rosters.sql` застосовано до підключеної БД до публікації коду. Наявні студенти, розклад і облікові записи збережені.
- Перед push перевіряються unit-тести, TypeScript, production build, актуальність фавіконок і два ізольовані integration-сценарії.
- Після push потрібно перевірити статус `Ready`, відповідність deployment новому commit SHA, прив’язку `web-dev.pp.ua` і відсутність нових runtime-помилок. Сам факт push не підтверджує завершення публікації.

## Локальні службові файли

- `.vercel/project.json` містить локальне прив'язування до Vercel-проєкту й не комітиться.
- `.vercel/.env.production.local` створюється Vercel CLI й не комітиться.
- `.vercelignore` виключає локальні build artifacts, залежності, QA artifacts і env-файли з upload.
- Токени та інші secrets заборонено додавати до репозиторію або документації.
