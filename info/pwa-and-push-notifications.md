# VID-052 — встановлювана PWA без Web Push

## Мета

«Відмітка» встановлюється з браузера як окремий застосунок без Electron-пакета, реєстрації користувача, push-сервісу або додаткових production-секретів.

Остаточним уточненням перед QA користувач попросив прибрати необхідність налаштовувати `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` і `CRON_SECRET`. Оскільки надійний browser Web Push без VAPID неможливий, Web Push вилучено повністю, а PWA-встановлення збережено.

## VID-058 — публічна push-підписка для одного пристрою

Новий запит замінює лише рішення VID-052 про відсутність push: це не відновлення ролей або персональних кабінетів. Шестерня публічного розкладу відкриває налаштування на конкретному пристрої: відвідувач вибирає одного викладача з already-public каталогу, дозволяє browser Web Push і вмикає ранковий огляд та/або нагадування до пари. Підписка належить browser endpoint, а не `app_users`; зміна викладача замінює обраний розклад для цього пристрою.

Відповідно, payload-и можуть містити тільки вже публічні дані обраного розкладу: дату, номер і час пари, аудиторію та групи. Жодних ролей, email, account identity або непублічного журналу не додається. Підписка створюється лише через явну користувацьку дію; відмова/скасування browser permission є штатним станом UI.

Для нагадувань перед парами один QStash schedule викликає захищений scanner щохвилини з 07:00 до 20:59 за часовим поясом `Europe/Chisinau` — доступним у QStash Console поточним еквівалентом київського часу. Це 840 scheduler delivery на добу, тому вміщується у free-ліміт 1 000/добу. Сам scanner обробляє події лише з 07:00 до 20:00 за `Europe/Kyiv` та допускає один grace-minute для затриманої доставки 20:00; решта викликів 20-ї години є успішним no-op без сповіщень. Scanner обробляє два незалежні preference: (1) ранковий огляд у вибраний час цього вікна — фактичний список пар або «Сьогодні занять немає 🙂»; (2) нагадування за вибрані 1–60 хвилин до початку кожної пари. Верхня межа гарантує, що нагадування про першу пару о 08:00 також лишається у вікні scanner-а. Кожне фактичне повідомлення має delivery key, тож повторний cron/HTTP delivery не створює дубль. Вікно також покриває нагадування для чинної 8-ї пари о 19:10.

### Межі реалізації

Візуальна теза: шестерня є тихим компактним керуванням поруч із встановленням PWA; у ній зосереджені вибір одного викладача, два види подій і поточний permission-стан, а сам розклад не перевантажується додатковими блоками. Після основної дії збереження є стримана secondary-кнопка тесту, яка не конкурує з нею візуально. На mobile використовується чинний popup налаштувань перегляду, тому не з’являються вкладені focus trap-и. На desktop та сама форма відкривається окремим доступним popover.

#### UX-корекція 04.09.2026

Візуальна теза: налаштування push — це коротка панель «стан → вибір → одна дія», а не довга форма всередині списку інших налаштувань. Звичайний дозвіл браузера показується компактним рядком під заголовком; попередження утворюють окремий alert лише коли потрібна дія користувача або сервер ще не готовий.

Контент-план: mobile-меню зберігає пошук викладача, дату й PWA на екрані огляду, а пункт «Сповіщення» відкриває окремий екран у тому самому modal popover. Push-екран містить заголовок зі статусом, вибір викладача, два рядки подій з inline часом/кількістю хвилин, feedback над footer і одну повнорозмірну primary-дію. «Надіслати тест» та «Вимкнути» не показуються сірими до успішного save: вони з’являються тільки для збереженої підписки.

Interaction-thesis: back, X і Escape повертають фокус до шестерні; перехід між overview і push не створює вкладеного focus trap. Save лишається єдиною дією, що може запитати permission і створити browser subscription. Помилка persistence читає безпечне server-side пояснення й залишається поруч із повторною дією; SQL, endpoint-и, ключі та інші внутрішні деталі ніколи не виходять у UI.

#### Mobile sheet-корекція 04.09.2026

Візуальна теза: на телефоні налаштування є спокійним майже повноекранним sheet на білій поверхні, а не вузьким desktop-popover поверх активного розкладу. Він залишає тонкий теплий край viewport-а та не конкурує з номером пари, картками занять або toolbar у фоні.

Контент-план: в overview користувач бачить лише три операційні блоки — викладача, іншу дату й застосунок — та один окремий рядок переходу до сповіщень. Push-екран займає доступну висоту, має власний back/X, щільну форму й footer з основною дією. Немає паралельного показу розкладу як нібито доступного контексту.

Interaction-thesis: sheet відкривається тільки зі шестерні, блокує фонові натискання і scroll, а X/Escape повертають фокус до шестерні. Перехід overview → push переводить фокус на back, back повертає його до рядка «Сповіщення»; browser-рух лишається стандартним і вимикається при `prefers-reduced-motion`, без декоративної анімації.

#### VID-060 — iPhone 15 Pro Max: щільний sheet

Візуальна теза: в PWA sheet займає рівно стільки висоти, скільки потрібно поточному екрану; біла поверхня не перетворюється на порожню сторінку, а форма сповіщень не розтягує короткі повідомлення.

Контент-план: overview містить тільки доступні керування — без порожнього блоку встановленого застосунку; push-екран показує iOS-інструкцію лише до встановлення на початковий екран, після чого місце належить вибору викладача й подій.

Interaction-thesis: ні click, ні фокус, ні блокування фону не змінюються. Висота overview анімаційно не прикрашається, а overflow лишається локальним push-екрану; `prefers-reduced-motion` не отримує нового руху.

Послідовність взаємодії: відвідувач відкриває шестерню → обирає конкретного викладача → налаштовує події → натискає явну кнопку збереження. Лише ця кнопка може запитати browser permission, створити subscription і надіслати її на сервер. Після збереження доступна «Надіслати тест»: вона не запитує дозвіл, не зберігає незбережені зміни й надсилає один нейтральний payload лише на поточний browser endpoint. Відповідь provider-а `410` відкликає server-side запис і перед наступним save примусово створює нову browser-підписку, а не реактивує застарілий endpoint. Зміна звичайного фільтра розкладу не змінює push-підписку. Після явного збереження вибраний викладач синхронізується з чинним cookie фільтра розкладу. Вимкнення відкликає server-side налаштування й browser subscription. На iPhone/iPad UI пояснює вимогу встановити PWA на початковий екран.

Серверну межу утворює `lib/public-push/`: чисті правила перевіряють Kyiv-час, параметри подій та deterministic delivery key; repository відповідає за endpoint hash, active teacher, атомарне створення/lease/finalize delivery та один test-send на підписку за 60 секунд; scanner групує активні підписки за викладачем і повторно використовує чинний resolver публічного розкладу; sender є єдиним адаптером VAPID/web-push. Вхід QStash перевіряє підпис current/next signing key над raw body та URL. Публічний API не повертає endpoint, ключі або приватні VAPID-дані.

TDD-межі, обрані в межах постійного дозволу користувача: (1) чисті правила часу, payload-ів і delivery key; (2) repository validation/upsert/revoke/ідемпотентне claim; (3) scanner із mock sender; (4) route із QStash signature; (5) browser lifecycle permission → service worker → subscription → save/delete; (6) test-send: exact active subscription → нейтральний payload → cooldown/gone/error. Тести додаються до пакета, але запуск належить фінальному незалежному QA.

## Реалізований обсяг VID-058

- App Router manifest і встановлення PWA збережені: `start_url=/`, `scope=/`, `standalone`, українська локалізація, canonical icons і компактна 44 px кнопка встановлення.
- `/sw.js` як і раніше не кешує HTML або API, але тепер безпечно обробляє `push` і `notificationclick`: показує лише server-signed public payload, використовує canonical icons та відкриває тільки `/` того самого origin. Server transport-topic є 32-символьним URL-safe Base64 hash payload tag-а, тоді як сам тег залишається в payload для згортання notification UI.
- На desktop є окрема 44 px шестерня біля PWA-control. На mobile чинна шестерня відкриває майже повноекранний modal sheet з overview (викладач, дата, PWA), а пункт «Сповіщення» переходить до окремого компактного екрана в ньому — без вкладеного popup, активного фону або спільного 420 px скролу. Форма зберігає один публічний вибір викладача на browser endpoint, два види подій і явне вимкнення.
- `GET` / `POST` / `PUT` / `DELETE` `/api/public/push` віддають лише public VAPID key, безпечний стан готовності push-сховища та стан/збереження налаштувань цього endpoint. `POST action=test` вимагає точного збігу чинної server-side підписки, надсилає лише сталий test payload і не пише schedule delivery ledger. Немає login, cookie-ідентичності, endpoint у відповіді чи секретів у браузері. API перевіряє same-origin, малий JSON body, конкретного active teacher та HTTPS endpoint від підтримуваного browser push provider. Для відсутньої/неповної schema API повертає стабільний safe code `PUSH_STORAGE_NOT_READY`, а журналює тільки action і DB code без даних підписки.
- Міграція `015_public_push_notifications.sql` додає один запис налаштувань на endpoint та окремий idempotent delivery ledger; `016_public_push_test_cooldown.sql` додає server-side timestamp для атомарного обмеження тесту до одного разу на 60 секунд; `017_public_push_admin_operations.sql` додає окремі журнали QStash scanner runs і manual replay. Endpoint зберігається на сервері разом із browser crypto keys; унікальність і пошук використовують лише SHA-256 hash. Admin UI не повертає endpoint або ключі.
- Node-only `POST /api/internal/push/scan` читає raw QStash body, перевіряє current/next signature key **і** canonical `PUSH_SCANNER_URL`, не приймає дату, викладача або endpoint з body, а повторно використовує актуальний public schedule resolver. Неактивні викладачі відсікаються на SQL join до resolver-а.
- Scanner працює за Europe/Kyiv і запускається за розкладом лише у 07:00–20:00. Він приймає затриманий до 20:01 виклик виключно як one-minute grace для події рівно о 20:00, але не дає обрати 20:01 і ніколи не надсилає раніше. Читання розкладу лишається один раз на викладача, а browser endpoint-и обробляються обмеженою паралельністю (до 8 підписок), тому повільний пристрій не блокує весь scanner. Transient provider/network failure повторюється один раз у межах того самого delivery lease; delivery claim і стабільний notification tag зупиняють дубль як для QStash retry, так і на рівні notification UI; 404/410 деактивує застарілу підписку.
- UX-корекція після фактичного `503`: UI не створює зайву local subscription, коли server storage ще не готове; показує коротке пояснення поруч із primary-дією, не показує disabled test до успішного save та зберігає feedback над mobile footer.

## Потік встановлення

1. Клієнт реєструє `/sw.js`, не просить notification permission і не змінює розклад.
2. Браузер надсилає `beforeinstallprompt`, який зберігається до явного натискання користувача.
3. Після натискання відкривається системний install prompt. Якщо браузер не віддає подію, UI показує коротку платформну інструкцію.
4. Подія `appinstalled` прибирає кнопку й підтверджує встановлення.

## Production-конфігурація після дозволеного релізу

Після уточнення VID-061 адмінський UI QStash цілком вилучено. Поточний код не читає `QSTASH_URL` або `QSTASH_TOKEN`; не видаляйте їх автоматично, якщо ними керує ваш зовнішній процес. `QSTASH_CURRENT_SIGNING_KEY` і `QSTASH_NEXT_SIGNING_KEY` лишаються потрібними scanner-у для перевірки вхідних QStash requests. VAPID-пару згенеровано одноразово і її значення не зберігаються в репозиторії або документації.

| Змінна | Значення / призначення |
| --- | --- |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Публічна частина один раз згенерованої VAPID-пари; route віддає її browser-у лише коли повна VAPID-конфігурація наявна. |
| `VAPID_PRIVATE_KEY` | Приватна частина тієї самої пари; лише server-side, secret. |
| `VAPID_SUBJECT` | `mailto:admin@web-devops.uno` — надане користувачем значення. |
| `QSTASH_CURRENT_SIGNING_KEY` | Already-added QStash signing key для перевірки входу. |
| `QSTASH_NEXT_SIGNING_KEY` | Already-added QStash signing key для безпечної ротації. |
| `PUSH_SCANNER_URL` | Точна canonical production URL: `https://vidmitka.vercel.app/api/internal/push/scan`. Вона має повністю збігатися з target QStash schedule. |

Після production deployment, окремого QA PASS та застосування міграцій 015, 016 і 017 адміністратор створює або оновлює безпосередньо у QStash Console/API один POST schedule до `PUSH_SCANNER_URL` з JSON body `{"version":1}`:

| Кількість | Cron / часовий пояс |
| --- | --- |
| 1 | `CRON_TZ=Europe/Chisinau * 7-20 * * *` |

Це рівно `14 × 60 = 840` scheduler delivery за добу. Виклики після 20:01 не створюють notification, але дають змогу одним cron покрити дозволений користувацький час 20:00; preview не отримує production-секрети.

## Підготовлені QA-сценарії

- content type і поля manifest, canonical icons, JavaScript MIME/no-store/CSP service worker, install control та iOS fallback;
- desktop/mobile шестерня, mobile overview → push → back, keyboard/Escape/focus return, 1440/820/390 px, document-level overflow, reduced motion та console;
- denied/default/granted browser permission, ready/not-ready server storage, status/save/delete lifecycle, зміна викладача лише після явного save, test hidden до збереженої підписки, test success і відсутність endpoint/keys у UI/API responses;
- same-origin/body/provider validation, inactive teacher, exact-subscription test capability, атомарний 60-second cooldown/429, raw QStash signature + canonical URL, VAPID-missing state, 404/410 cleanup;
- Kyiv/DST, межі 07:00 та 20:00, відсутність пар, скасоване/перенесене заняття, N=1/60, один хвилинний grace та idempotent concurrent/retry delivery;
- admin push dashboard: safe subscription/list/log fields, keyboard Play/pending/result, non-admin/invalid UUID/VAPID-missing/no-upcoming/gone/transient error, separate manual ledger і відсутність впливу на cron idempotency;
- ізольоване застосування міграцій 015/016/017, typecheck, tests, production build і browser flow перед будь-яким production push або schedule.
