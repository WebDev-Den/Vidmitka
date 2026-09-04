# VID-063 — REST API v1

Статус: реалізація локальна, QA очікується. Production-доступ до API ще не налаштовано.

## Покриття

Base URL після релізу: `https://vidmitka.vercel.app/api/v1`.
OpenAPI 3.1: `GET /api/v1/openapi.json` (публічна специфікація без даних і секретів; імпортується у Postman/Swagger Editor).

| Ресурс | Методи |
| --- | --- |
| `/groups`, `/teachers`, `/disciplines`, `/rooms`, `/lesson-types` | GET список, POST створення |
| Ті самі ресурси `/{id}` | GET один, PUT усі редаговані поля, PATCH `{isActive}`, DELETE |
| Ті самі ресурси `/batch` | PUT `{changes:[{id,...поля}]}`, атомарно до 25 записів |
| `/periods`, `/periods/{id}` | GET/POST і GET/PUT/PATCH/DELETE; ID — числовий рядок |
| `/periods/batch` | PUT `{changes:[{id,number,startTime,endTime,color}]}`, до 99 записів |
| `/entries`, `/entries/{id}` | GET/POST і GET/PUT/PATCH/DELETE базового повторюваного розкладу |
| `/exceptions`, `/exceptions/{id}` | GET/POST і GET/PUT/DELETE переносів, скасувань і разових занять |
| `/calendar-overrides` | GET активних календарних перенесень |
| `/calendar-overrides/YYYY-MM-DD` | GET, PUT з version, DELETE з query `version` |
| `/week-settings` | GET, PUT базової дати, типу тижня та меж семестру |
| `/schedule?date=YYYY-MM-DD` | GET фактичного денного розкладу з урахуванням винятків |
| `/imports/preview`, `/imports/commit` | POST чинного teacher-schedule JSON формату |

API охоплює дані розкладу. Секрети, адміністраторські акаунти, старий журнал відвідувань і Push-пристрої не є ресурсами цього API. Навчальні тижні є єдиним об’єктом налаштувань: його змінюють PUT, а не видаляють. Видалення використаних довідників/пар або базового заняття з винятками відхиляється; спочатку змініть зв’язки або деактивуйте запис.

## Налаштування доступу

Дві server-only змінні середовища:

- `SCHEDULE_API_KEY`: випадковий ключ із 32–512 символів `A–Z a–z 0–9 _ -`. Рекомендовано 32 випадкових байти, закодованих base64url.
- `SCHEDULE_API_ADMIN_ID`: текстовий ID існуючого `app_users` з `role=administrator`, `approval_status=approved` (1–128 символів: літери, цифри, `_`, `-`; UUID також підходить). Записи створюються від імені цього адміністратора.

Ключ використовується в заголовку `Authorization: Bearer …`. Він не приймається в URL, JSON або cookie й не повинен потрапляти у frontend bundle. Це server-to-server інтеграція; довільний browser CORS не вмикається. Без конфігурації API повертає `503 API_NOT_CONFIGURED`; неправильний ключ — `401`; відкликані права адміністратора — `403`. Зміна ключа в env із новим deployment відкликає попередній ключ. Ротація signing/VAPID ключів Push для цього не потрібна.

## Формат та помилки

JSON із camelCase. Запити зі змінами: `Content-Type: application/json`. Максимум 64 KiB для звичайного запиту і 4 MiB для імпорту. Невідомі поля відхиляються. Масиви IDs не очищаються мовчки від невірних UUID; календарні дати перевіряються на існування.

Успіх: `{ "data": ..., "requestId": "uuid" }`. Список: `data = {items,total,limit,offset}`. Створення повертає `201`, `data.id` і заголовок `Location`. Оновлення та видалення повертають `200`, `data.success` і повідомлення. ID ресурсів — UUID, крім `periods` (рядок із числом) та календаря (дата).

Помилка: `{ "error": { "code": "INVALID_FIELDS", "message": "...", "details": {"fields":["name"]} }, "requestId": "uuid" }`. `details` є не для всіх помилок. SQL і ключі не виходять у відповідь.

| HTTP | Значення |
| --- | --- |
| 400 | Невірний JSON, query, ID або пропущена version для видалення дати |
| 401 / 403 | Неправильний ключ / адміністратор не має доступу |
| 404 / 405 | Запис чи маршрут відсутній / метод не підтримується |
| 409 | Конфлікт БД, пов’язані записи або непідтверджені попередження імпорту |
| 413 / 415 | Завеликий body / неправильний Content-Type |
| 422 | Невірні поля чи відмова чинного бізнес-правила, зокрема конфлікт розкладу або застаріла calendar version |
| 500 / 503 | Внутрішня помилка / API не налаштовано |

PUT передає весь набір редагованих полів; пропущені необов’язкові поля очищаються, зв’язки roomIds без значення стають порожніми. PUT не змінює `isActive`; для цього використовуйте PATCH лише з `{ "isActive": false }`. Звичайний PATCH довільних полів не підтримується. Статус винятку передається в його PUT. Повторна активація заняття перевіряє актуальні довідники й конфлікти, так само як створення.

Списки: `limit=1..200` (типово 100), `offset=0..1000000`, необов’язкові `q`, `active=true|false`. Для entries/exceptions додатково `teacherId`, `groupId`; `/schedule` також приймає ці два фільтри. Сортування списку стабільне за ID/датою. Сторінки можуть змінитися при паралельних змінах, тому це offset-пагінація, а не snapshot export. Поточні admin list services читають повний набір перед пагінацією — для значно більших наборів наступним кроком буде SQL-пагінація.

## Приклади PowerShell

Приклади припускають, що `$env:VIDMITKA_API_KEY` уже встановлений у вашому локальному середовищі. Це змінна клієнта, її назва не має збігатися із server `SCHEDULE_API_KEY`.

```powershell
$apiBase = 'https://vidmitka.vercel.app/api/v1'
$apiHeaders = @{ Authorization = "Bearer $env:VIDMITKA_API_KEY" }

# Список викладачів
Invoke-RestMethod "$apiBase/teachers?limit=100" -Headers $apiHeaders

# Створити групу й отримати її ID
$created = Invoke-RestMethod "$apiBase/groups" -Method Post -Headers $apiHeaders `
  -ContentType 'application/json; charset=utf-8' -Body '{"name":"API-26-1"}'
$groupId = $created.data.id

# Змінити назву
Invoke-RestMethod "$apiBase/groups/$groupId" -Method Put -Headers $apiHeaders `
  -ContentType 'application/json; charset=utf-8' -Body '{"name":"API-26-2"}'

# Деактивувати
Invoke-RestMethod "$apiBase/groups/$groupId" -Method Patch -Headers $apiHeaders `
  -ContentType 'application/json' -Body '{"isActive":false}'

# Видалити незадіяний запис
Invoke-RestMethod "$apiBase/groups/$groupId" -Method Delete -Headers $apiHeaders
```

Приклад curl (ключ у змінній shell, не в самому файлі прикладу):

```sh
curl 'https://vidmitka.vercel.app/api/v1/schedule?date=2026-09-07' \
  -H "Authorization: Bearer $VIDMITKA_API_KEY"
```

Тіло `POST /entries` (UUID замініть ID, отриманими через довідники):

```json
{
  "disciplineId": "11111111-1111-4111-8111-111111111111",
  "lessonTypeId": "22222222-2222-4222-8222-222222222222",
  "periodId": "1",
  "dayOfWeek": 1,
  "weekPattern": "both",
  "validFrom": "2026-09-01",
  "validUntil": "2026-12-31",
  "groupIds": ["33333333-3333-4333-8333-333333333333"],
  "teacherIds": ["44444444-4444-4444-8444-444444444444"],
  "roomIds": [],
  "note": "Створено через API"
}
```

Скасування конкретного заняття: `POST /exceptions` із `{ "kind":"cancel", "baseEntryId":"ID базового заняття", "originalDate":"2026-09-07", "reason":"Причина" }`. Базовий запис зберігає решту тижнів. Для видалення всієї серії використовуйте `DELETE /entries/{id}` після видалення залежних винятків.

Календар: `PUT /calendar-overrides/2026-09-12` із `{ "dayOfWeek":1, "weekType":"numerator", "version":0 }` створює підміну. Наступна зміна використовує version із GET, видалення — `DELETE /calendar-overrides/2026-09-12?version=1`. Після кожної зміни перечитуйте актуальну version.

Імпорт: надсилайте `{ "records": [ ...чинний teacher-schedule JSON... ] }` у `/imports/preview`. Після перегляду надішліть той самий records до `/imports/commit`. Попередження вимагають явного `confirmWarnings:true`. Сервер повторно звіряє БД при commit; невірні записи не застосовуються частково. Повтор ідентичного імпорту пропускає вже наявні заняття.

## Межі модулів та QA

- `contracts.ts` — спільні runtime/OpenAPI поля; `http.ts` — bounded JSON, строгі типи та query.
- `auth.ts` — Bearer + актуальні права server-configured адміністратора.
- `collections.ts`, `import.ts` — адаптація JSON до чинних доменних операцій; `handler.ts` — HTTP-статуси, авторизація та інвалідація.
- Існуючі create services тепер повертають optional `id` без зміни контрактів форм; додано FK-захищене видалення пари. Нова схема БД не потрібна.
- `lib/rest-api/http.test.ts`: auth-before-mutation, відсутність витоку ключа, Location/no-store, safe FK error, bounded JSON, дати та mass assignment.
- `info/testing/rest-api.integration.test.ts`: лише окрема schema через існуючий harness; реальні CRUD, callbacks, конфлікти, FK, календарна version, навчальні тижні, preview/commit і повторний імпорт. Прапорець `RUN_REST_API_DB_INTEGRATION=1`; без нього suite явно пропущений.
- Перед релізом незалежний QA запускає tsc/tests/build і isolated API integration, звіряє OpenAPI з реальними HTTP-запитами. Візуальна перевірка не потрібна: UI не змінювався. Реальні розклади під час QA не редагуються.
