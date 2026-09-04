# VID-052 — встановлювана PWA без Web Push

## Мета

«Відмітка» встановлюється з браузера як окремий застосунок без Electron-пакета, реєстрації користувача, push-сервісу або додаткових production-секретів.

Остаточним уточненням перед QA користувач попросив прибрати необхідність налаштовувати `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` і `CRON_SECRET`. Оскільки надійний browser Web Push без VAPID неможливий, Web Push вилучено повністю, а PWA-встановлення збережено.

## Реалізований обсяг

- App Router manifest із `start_url=/`, `scope=/`, `standalone`, українською мовою, кольорами бренду та canonical 192/512/maskable icons.
- Мінімальний `/sw.js` лише активує й бере під контроль встановлену PWA. Він не кешує HTML/API, не підписується на push і не показує notification, щоб розклад завжди читав актуальні перенесення з мережі.
- Компактна 44 px кнопка встановлення у header. У Chromium вона використовує `beforeinstallprompt`; на iPhone/iPad показує інструкцію «Поділитися → На початковий екран»; у standalone-режимі зникає.
- Окрема конфігурація Vercel, cron, push endpoints, таблиці підписок і залежність `web-push` не потрібні.

## Потік встановлення

1. Клієнт реєструє `/sw.js`, не просить notification permission і не змінює розклад.
2. Браузер надсилає `beforeinstallprompt`, який зберігається до явного натискання користувача.
3. Після натискання відкривається системний install prompt. Якщо браузер не віддає подію, UI показує коротку платформну інструкцію.
4. Подія `appinstalled` прибирає кнопку й підтверджує встановлення.

## Конфігурація

Додаткових environment variables або міграцій немає. Потрібен лише HTTPS production-домен, який уже забезпечує Vercel. PWA використовує чинне підключення застосунку до бази розкладу без нових секретів.

## Підготовлені QA-сценарії

- content type і поля manifest, наявність та розміри icons;
- JavaScript MIME, no-store, CSP і реєстрація service worker;
- install control, fallback-інструкція, iOS instruction і приховування в standalone;
- відсутність bell, Notification permission, push routes, cron, VAPID/CRON env, push-міграцій і `web-push` у dependency graph;
- 1440/820/390 px, keyboard/focus, console, document-level overflow і регресія розкладу.
