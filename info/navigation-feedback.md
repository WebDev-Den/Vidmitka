# VID-013 — зворотний зв'язок навігації

## План і межі

1. Використати `useLinkStatus` у дочірньому компоненті `Link`: справжній pending до оновлення історії, без власних таймерів, router event listeners або дублювання стану URL.
2. Замінювати іконку натиснутого пункту спінером 19 px у незмінному слоті 24 px. Не приховувати слот у collapsed sidebar. Назву посилання залишити доступною, а pending оголошувати через status.
3. Додати `dashboard/loading.tsx`: компактний серверний fallback зі спінером і текстом «Завантаження розділу…» на час streaming вмісту. Стан Link і fallback покривають різні фази переходу; не тримати штучний глобальний pending.
4. Палітра й логотип незмінні; обертання вимикається при `prefers-reduced-motion`. Зберегти Next Link, prefetch і штатне відкривання в новій вкладці; не закривати drawer раніше чинного pathname effect.

Прочитано локальну документацію Next16.3.3: `use-link-status.md` та `loading.md`; skill `vercel:nextjs` і `vercel:react-best-practices` визначають штатну межу loading / Link та похідний pending без нового глобального стану. Auth у private/admin layouts не змінюється; route fallback не обходить перевірки доступу.

## Межі пакетного QA

Публічна поведінкова межа — реальний Link / App Router, не mocked click із вручну встановленим pending. У production-browser уповільнити тестові RSC-відповіді, перевірити індикатор до переходу й fallback до готовності вмісту, потім завершення та швидке перемикання на інший маршрут. Перевірити кешований / поточний URL, Ctrl/Cmd-click, середню кнопку, Enter, back/forward, помилку маршруту й редирект авторизації без завислого індикатора.

UI-перевірку додати до наступного `ui-spacing-review`: 1440 / 820 / 390, collapsed/expanded/drawer, стабільні розміри рядка й слота, доступні назви / status, focus, reduced motion, console, відсутність document overflow. Рольові довідники й правила не змінені; використати тільки ізольовані QA-акаунти. Не обходити попередній policy guard перевірки масштабу.

Статус: **реалізовано; QA очікується**, `NOT_RUN`. Додано `components/private/navigation-link-content.tsx`, `app/(private)/dashboard/loading.tsx`; оновлено shell і вузькі стилі іконки / status / reduced motion. Доступна назва Link лишається стабільною через aria-label. Статичне читання diff виконано, але browser-вимірювань чи red → green циклу немає. Тести / build / браузер виконуються окремим QA-агентом лише на наступний запит перевірки або перед дозволеним релізом. Новий loading boundary і зміни shell потребують регресії навігації, попередні PASS не поширюються автоматично. Push і deployment не виконувалися.
