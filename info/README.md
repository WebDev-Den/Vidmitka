# Проєктна документація Vidmitka

Папка `info` є єдиним місцем для проєктної аналітики, функціональних описів, моделей, планів, критеріїв приймання та майбутніх рішень щодо структури даних.

## Документи

- [concept-redesign-analysis.md](concept-redesign-analysis.md) — аналіз, ризики та поетапний план нової концепції VID-029.
- [concept-redesign-data-model.md](concept-redesign-data-model.md) — модель розкладу v2 і безпечна additive-first міграція.
- [teacher-schedule-json-mapping.md](teacher-schedule-json-mapping.md) — фактична структура й mapping наданого JSON.
- [schedule-v2-operations.md](schedule-v2-operations.md) — маршрути, міграція, створення адміністратора, імпорт, resolver і QA-порядок VID-029.
- [my-schedule-adoption.md](my-schedule-adoption.md) — зіставлення Vite-прототипу `my-schedule` з чинною серверною архітектурою та план публічного workspace VID-031.
- [minimal-admin.md](minimal-admin.md) — VID-033: мінімальна адміністративна оболонка, згрупована навігація й відкладений QA без зміни функцій.
- [calendar-transfers-2026.md](calendar-transfers-2026.md) — VID-034: 12 календарних перенесень 2026 року, чинна модель `makeup_days` і план безпечного production-запису.
- [public-group-context.md](public-group-context.md) — VID-035: загальний розклад без вибору груп і доступне відображення груп біля картки заняття.
- [public-teacher-filter.md](public-teacher-filter.md) — VID-036: серверний фільтр публічного розкладу за одним викладачем або всіма викладачами.
- [imported-recurring-schedule.md](imported-recurring-schedule.md) — VID-038: імпортований JSON як повторюваний розклад до 31.12.2026 без службових позначок у публічній картці.
- [public-schedule-responsive-layout.md](public-schedule-responsive-layout.md) — VID-042/046/049: повноширинний розклад і єдиний компактний header із панеллю дати та викладача.
- [public-schedule-url-state.md](public-schedule-url-state.md) — VID-051: розклад на `/`, cookie викладача, локальна дата без URL-параметрів і відкладені QA-сценарії.
- [pwa-and-push-notifications.md](pwa-and-push-notifications.md) — VID-052/058: PWA, публічна Web Push-підписка одного пристрою, QStash scanner і QA-сценарії.
- [admin-push-operations.md](admin-push-operations.md) — VID-062: захищений журнал QStash scanner-а, безпечний список підписок і manual replay найближчого розкладного push.
- [public-free-rooms.md](public-free-rooms.md) — VID-053: popup активних вільних аудиторій за вибраною датою й номером пари.
- [tasks.md](tasks.md) — журнал запитів, критерії приймання, реалізація й окремі QA-статуси.
- [qa/process.md](qa/process.md) — фінальний пакетний QA окремим агентом лише за запитом або перед релізом.
- [qa/handoff-template.md](qa/handoff-template.md) — доручення незалежному QA-агенту.
- [qa/handoffs/QA-20260902-01.md](qa/handoffs/QA-20260902-01.md) — незалежна перевірка головної сітки VID-026 перед дозволеним релізом VID-028.
- [qa/handoffs/QA-20260902-05.md](qa/handoffs/QA-20260902-05.md) — фінальна незалежна перевірка пакета VID-033–VID-036 перед дозволеним релізом VID-037.
- [qa/reports/QA-20260902-01.md](qa/reports/QA-20260902-01.md) — PASS VID-026: typecheck, 348 тестів, build і browser UI 1440/820/390.
- [qa/reports/RELEASE-20260902-01.md](qa/reports/RELEASE-20260902-01.md) — production deployment VID-028 і повторна verified-прив’язка `web-dev.pp.ua`.
- [qa/handoffs/QA-20260828-04.md](qa/handoffs/QA-20260828-04.md) — передрелізний QA накопичених кольорів, календаря, копіювання й публічних розділів VID-025.
- [qa/reports/QA-20260828-04.md](qa/reports/QA-20260828-04.md) — незалежний PASS уточнень VID-006/011 і VID-019–024: команди, ізольовані міграції, браузерні докази та точний checksum пакета перед VID-025.
- [qa/reports/RELEASE-20260828-03.md](qa/reports/RELEASE-20260828-03.md) — підготовка публікації VID-025, стан Git/Vercel та необхідні міграції 012/013.
- [qa/handoffs/QA-20260828-03.md](qa/handoffs/QA-20260828-03.md) — незалежна перевірка VID-010–VID-017 перед дозволеним релізом VID-018.
- [qa/reports/QA-20260828-03.md](qa/reports/QA-20260828-03.md) — результати передрелізного QA, чотири знайдені дефекти й повторна перевірка виправлень.
- [qa/reports/RELEASE-20260828-02.md](qa/reports/RELEASE-20260828-02.md) — публікація VID-018; користувач прямо дозволив реліз без неперевіреного 200% та без повторного QA, штатні Vercel gates збережено.
- [qa/handoffs/QA-20260828-02.md](qa/handoffs/QA-20260828-02.md) — доручення незалежному QA для локального пакета VID-010–VID-012 без релізу.
- [qa/reports/QA-20260828-02.md](qa/reports/QA-20260828-02.md) — незалежний QA компактних таблиць: результати, дефекти, браузерні вимірювання й повторна перевірка.
- [qa/handoffs/QA-20260828-01.md](qa/handoffs/QA-20260828-01.md) — передрелізне доручення для накопиченого пакета VID-001–VID-008.
- [qa/report-template.md](qa/report-template.md) — шаблон доказового QA-звіту й рішення щодо релізу.
- [qa/reports/QA-20260828-01.md](qa/reports/QA-20260828-01.md) — незалежний QA пакета VID-001–VID-008: остаточний PASS, історія чотирьох виправлених дефектів і межі перевірок.
- [qa/reports/RELEASE-20260828-01.md](qa/reports/RELEASE-20260828-01.md) — журнал дозволеного релізу VID-009: передрелізний стан, міграції, Git і фактичний deployment.
- [qa/reports/RELEASE-20260902-03.md](qa/reports/RELEASE-20260902-03.md) — реліз VID-033–VID-037: незалежний QA PASS, Git, Vercel READY і live smoke.
- [qa/reports/QA-20260902-06.md](qa/reports/QA-20260902-06.md) — docs-only перевірка релізних метаданих VID-037 і доказ уже наявних 12/12 production-дат.
- [qa/reports/QA-20260902-07.md](qa/reports/QA-20260902-07.md) — незалежний PASS VID-038–VID-041: recurring-імпорт, денний public UI, термінологія тижнів, DB і browser QA.
- [qa/reports/RELEASE-20260902-04.md](qa/reports/RELEASE-20260902-04.md) — production deployment VID-038–VID-041, Vercel READY і live smoke без записів у production-БД.
- [qa/reports/QA-20260903-01.md](qa/reports/QA-20260903-01.md) — незалежний PASS VID-042: адаптивна щільність, фактичні вимірювання 1440/820/390, keyboard, auto-submit і pending у системному Edge.
- [qa/handoffs/QA-20260903-02.md](qa/handoffs/QA-20260903-02.md) — передрелізне доручення незалежному QA для пакета VID-042–VID-045.
- [qa/reports/QA-20260903-02.md](qa/reports/QA-20260903-02.md) — остаточний незалежний PASS VID-042–VID-045 після виправлення типізації combobox: typecheck, 77 тестів, production build і browser QA.
- [qa/reports/RELEASE-20260903-01.md](qa/reports/RELEASE-20260903-01.md) — production deployment VID-042–VID-045, Vercel READY і read-only live smoke обох аліасів.
- [qa/handoffs/QA-20260904-01.md](qa/handoffs/QA-20260904-01.md) — передрелізне доручення незалежному QA для повноширинного layout VID-046.
- [qa/reports/QA-20260904-01.md](qa/reports/QA-20260904-01.md) — незалежний PASS VID-046: 1920/1440/820/390 px, overflow, keyboard, console, typecheck, tests і build.
- [qa/reports/RELEASE-20260904-01.md](qa/reports/RELEASE-20260904-01.md) — production deployment VID-046–VID-047, Vercel READY і read-only smoke повноширинного CSS.
- [qa/handoffs/QA-20260904-02.md](qa/handoffs/QA-20260904-02.md) — передрелізне доручення незалежному QA для компактного popup і єдиного header VID-048–VID-050.
- [qa/reports/QA-20260904-02.md](qa/reports/QA-20260904-02.md) — незалежний PASS VID-048–VID-050 після ретесту 44 px touch target: команди й browser QA 1920/1440/820/390.
- [qa/reports/RELEASE-20260904-02.md](qa/reports/RELEASE-20260904-02.md) — production deployment компактного popup і єдиного header, Vercel READY та read-only smoke обох аліасів.
- [qa/handoffs/QA-20260904-03.md](qa/handoffs/QA-20260904-03.md) — незалежне QA-доручення для canonical `/`, cookie викладача, fixed shell і автопозиціонування VID-051.
- [qa/reports/QA-20260904-03.md](qa/reports/QA-20260904-03.md) — незалежний PASS VID-051 після виправлень автопрокрутки й low-height/200%-proxy overflow.
- [qa/handoffs/QA-20260904-04.md](qa/handoffs/QA-20260904-04.md) — передрелізне доручення незалежному QA для canonical `/`, PWA без Web Push і popup вільних аудиторій VID-051–VID-054.
- [qa/reports/QA-20260904-04.md](qa/reports/QA-20260904-04.md) — незалежний PASS VID-051–VID-054 після геометричного ретесту всіх popup-тригерів на 390/820 px.
- [qa/reports/RELEASE-20260904-03.md](qa/reports/RELEASE-20260904-03.md) — production deployment canonical `/`, PWA без Web Push і popup вільних аудиторій, Vercel READY та read-only live smoke.
- [architecture.md](architecture.md) — функціональна архітектура системи керування розкладом.
- [data-model.md](data-model.md) — концептуальна модель даних для подальшого проєктування БД без вибору технології або способу зберігання.
- [database-setup.md](database-setup.md) — підключення Neon Postgres через Vercel, локальні env-файли та перевірка з'єднання.
- [access-control.md](access-control.md) — власна реєстрація, сесії, межі публічної і приватної частин, ролі та схвалення викладачів.
- [administrator-roles.md](administrator-roles.md) — початкова реєстрація за кодом, захищений адміністратор, призначення ролей і спільні викладацькі можливості.
- [authentication-verification.md](authentication-verification.md) — функціональні сценарії власної автентифікації, перевірка складності та підтвердження пароля.
- [ui-spacing-review.md](ui-spacing-review.md) — фактичні браузерні вимірювання відступів, overflow та адаптивного ритму.
- [design-system.md](design-system.md) — обов’язковий візуальний канон, палітра та незмінний початковий логотип.
- [settings-compact-layout.md](settings-compact-layout.md) — VID-010: компактні налаштування, таблиця відпрацювань і сценарії відкладеного QA; без deployment.
- [crud-tables.md](crud-tables.md) — VID-012: інвентаризація й спільний компактний табличний формат форм керування, план фінального QA.
- [navigation-feedback.md](navigation-feedback.md) — VID-013: індикатор переходу меню, loading розділів і сценарії наступного пакетного QA.
- [lesson-directory-search.md](lesson-directory-search.md) — VID-014: пошук і додавання довідників без виходу з форми заняття; наступний пакетний QA.
- [development-plan.md](development-plan.md) — поетапний план розробки з результатами та критеріями приймання.
- [schedule-import.md](schedule-import.md) — формат JSON/CSV, приклади та правила атомарного імпорту розкладу викладача.
- [schedule-weeks.md](schedule-weeks.md) — дата чисельника, автоматичне чергування; VID-016: перемикач перегляду чисельника / знаменника, QA очікується.
- [schedule-calendar-ui.md](schedule-calendar-ui.md) — VID-019: місячний календар, швидкий вибір дня й компактний розклад; фінальний QA очікується.
- [home-period-grid.md](home-period-grid.md) — VID-026: головна як денна горизонтальна сітка за номерами пар із поточним станом; QA очікується.
- [makeup-days.md](makeup-days.md) — календар відпрацювань: адміністрування дат, фактичний розклад і захист журналів; QA PASS, міграція 009 застосована.
- [public-transfers.md](public-transfers.md) — VID-023: публічна вкладка «Перенесення пар», компактний список і фінальні QA-сценарії; QA очікується.
- [lesson-type-colors.md](lesson-type-colors.md) — VID-024: кольори типів занять, спільні позначки та міграція 013; QA очікується, міграцію не застосовано.
- [upcoming-lessons.md](upcoming-lessons.md) — VID-006: три найближчі заняття, перемішування паралельних при оновленні; нова правка QA NOT_RUN. Довідник типів і міграція 010 вже опубліковані.
- [day-timeline.md](day-timeline.md) — жива шкала пар/перерв; уточнення VID-011: нативний input type="color" і довільні HEX-кольори, QA NOT_RUN, потрібна ще не застосована міграція 012.
- [attendance.md](attendance.md) — журнал за датами, імпорт студентів CSV/JSON, підгрупи та правила відвідування.
- [groups-and-lesson-rosters.md](groups-and-lesson-rosters.md) — вибір / створення груп, прив’язка студентів; VID-015: пізніше доповнення списку; VID-020: один студент у кількох предметах, регресійний QA очікується.
- [lesson-copy.md](lesson-copy.md) — VID-021: компактні «Мої заняття», копіювання з редагуванням чернетки й наступний пакетний QA.
- [deployment.md](deployment.md) — поточна Vercel-конфігурація, результат першого deployment і стан автоматизації.
- [agent.md](agent.md) — розширений довідник робочих правил проєкту.

## Правило розміщення

Нові допоміжні документи про предметну область, вимоги, тестові сценарії, дизайн, архітектуру, дані та випуск продукту потрібно додавати до `info` і включати до цього покажчика.

Кореневий `AGENTS.md` є технічним винятком: його розташування потрібне для поширення інструкцій на весь репозиторій. Проєктна документація в ньому не зберігається.

## Стан реалізації

Поточна публічна адреса — [vidmitka.vercel.app](https://vidmitka.vercel.app/). 28.08.2026 за запитом VID-008 домен `web-dev.pp.ua` відв’язано без нового deployment; DNS і реєстрацію домену не змінювали. Деталі й підтвердження операції — [deployment.md](deployment.md).

VID-029 локально переводить робочий застосунок на нову концепцію: публічний розклад за групою, єдина прихована адмін-панель, довідники v2, базовий розклад, винятки й датований JSON-імпорт. Старі студентські та викладацькі маршрути й модулі вилучені з коду; старі SQL-таблиці поки збережені лише для безпечного rollback і не використовуються новими маршрутами. Цей пакет ще має статус `NOT_RUN`, не застосовував міграцію 014 і не опублікований; актуальні деталі — у [schedule-v2-operations.md](schedule-v2-operations.md). Нижче збережено історичні відомості попередніх релізів.

28.08.2026 пакет VID-001–VID-008 пройшов незалежний QA; чотири знайдені дефекти виправлені й повторно перевірені. Міграції 009 → 010 → 011 застосовані без очищення даних. Код `efcc141` завантажено в `main`; автоматичний production deployment Vercel має статус READY. Календар відпрацювань, типи, п’ять найближчих занять, жива шкала та доступне мобільне меню опубліковані. Фактичні релізні результати — у [журналі релізу](qa/reports/RELEASE-20260828-01.md).

Постійний дозвіл на реалізацію поставлених задач і вибір TDD-меж записаний у `AGENTS.md`; повторного процедурного погодження не потрібно. Наступні зміни також перевіряються одним незалежним пакетом за запитом або перед дозволеним релізом.

За запитом VID-018 незалежний QA перевірив пакет VID-010–VID-017, чотири дефекти виправлені й повторно підтверджені; докази — [QA-20260828-03](qa/reports/QA-20260828-03.md). 28.08.2026 користувач прямо попросив лише Git і деплой, без перевірки: одноразово дозволено реліз із неперевіреним справжнім масштабом 200%, без нового QA. Історичний BLOCKED збережено чесно; чинні Vercel gates не змінено. Код `a178039` опублікований у main і Vercel production **READY** на [vidmitka.vercel.app](https://vidmitka.vercel.app/); [релізний журнал](qa/reports/RELEASE-20260828-02.md). Наступний абзац зберігає історію попереднього прогону.

Локальний пакет VID-010–VID-012 реалізовано без push / deployment. За [QA-20260828-02](qa/reports/QA-20260828-02.md), VID-011/012 — PASS; помилку mobile overflow виправлено й закрито. VID-010 — BLOCKED лише на перевірці справжнього масштабу 200% через обмеження browser-control; інші погоджені виконані перевірки пройшли. Тести, production build, ізольовані DB-сценарії та 30 комбінацій сторінка × viewport мають фактичні докази у звіті. Заборона деплою зберігається.
