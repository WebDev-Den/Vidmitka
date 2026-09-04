# VID-062 — операційний контроль Push

## Модуль та interface

`lib/public-push/admin-operations.ts` — server-only module з двома public
операціями: читання safe dashboard та ручна доставка найближчого запланованого
повідомлення для одного subscription ID. Його interface приймає лише UUID і
adapter-и repository/resolver/sender; endpoint, crypto keys, VAPID settings та
довільний payload лишаються implementation detail.

Це дає depth: page і Server Action знають лише про safe rows і результат, а
вибір майбутньої події, побудова тексту, окремий manual tag, delivery log,
повтор transient provider error та cleanup 404/410 зосереджені в одному module.
Scanner продовжує працювати через свій існуючий ідемпотентний ledger.

## Ручна доставка

1. Module повторно читає активну підписку за ID та актуальний публічний розклад.
2. Він вибирає найближчу подію: digest у заданий час або reminder перед
   нескасованим заняттям. Для сьогоднішньої події бере лише майбутній час; для
   reminder-only підписки шукає до семи календарних днів уперед.
3. Користувачеві надсилаються такі самі title/body/url, які створить cron.
   `tag` ручної доставки окремий, тому browser не замінює ним scheduled notice.
4. Окремий manual ledger фіксує pending → sent/failed/invalid і не торкається
   `public_push_deliveries`; при 404/410 підписка деактивується так само, як у
   scanner.

## Дані та журнали

Міграція `017_public_push_admin_operations.sql` додає два append-oriented
журнали: `public_push_scan_runs` для кожного автентичного QStash scanner run та
`public_push_manual_deliveries` для явного Play. В admin UI відображаються лише
time, safe counters/status, викладач і notification kind. Endpoint, browser
keys, VAPID material і payload не показуються.

## TDD seams

- `sendNextScheduledPush(subscriptionId, now, dependencies)` — selection,
  manual tag, log lifecycle, send/retry/gone behavior через injected adapter-и.
- `sendAdminPushAction` — admin session, FormData UUID validation, safe result
  і `revalidatePath`.

Тести не прив'язані до SQL-template internals або browser endpoint. Вони
спостерігають лише interface module та action result.

## UI

Робоча сторінка `/admin/push` — три компактні табличні sections: cron runs,
active subscriptions із Play та manual deliveries. Вона не є dashboard mosaic:
один статусний рядок, короткі headings і локальний horizontal scroll tables.
Canonical теплий фон, білі surfaces, thin borders і primary teal зберігаються.
