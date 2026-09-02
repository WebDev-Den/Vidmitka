# Модель даних для розкладу v2

## Принцип переходу

Нова модель додається поруч із чинною. Старі `students`, `teacher_subjects`, `subject_students`, `lesson_students`, `attendance_sessions`, `attendance_entries` і `lessons` не видаляються в першій міграції. Після переключення коду та резервної перевірки їхнє фізичне видалення оформлюється окремою migration-задачею.

## Довідники

### `academic_groups`

- випадковий публічний `id`;
- `code`, `code_normalized` з унікальністю без регістру;
- необов’язкові `faculty`, `course`, `study_form`;
- `is_active`, `created_at`, `updated_at`.

### `disciplines`

- `id`, повна `name`, нормалізована назва;
- необов’язкові `short_name`, `internal_code`;
- `is_active`, timestamps;
- унікальні нормалізована назва й непорожній внутрішній код.

### `schedule_lesson_types`

- `id`, `name`, нормалізована назва, `short_name`;
- HEX-колір із чинними правилами `#RRGGBB`;
- `is_active`, timestamps.

На етапі переходу значення можна перенести з чинної `lesson_types`, але новий репозиторій не залежить від старої таблиці занять.

### `schedule_rooms`

- `id`, `name`, нормалізована назва;
- необов’язкові `building`, `description`, `room_type`;
- `delivery_mode`: `physical`, `remote`, `unspecified`;
- `is_active`, timestamps.

Заняття без фізичної аудиторії може не мати зв’язку з кімнатою; дистанційність задається явно, а не фіктивною кімнатою.

### `teachers`

- `id`, обов’язкове `display_name`, нормалізоване ім’я;
- необов’язкові `last_name`, `first_name`, `middle_name`, `short_name`, `department`;
- `is_active`, timestamps.

Викладач не є користувачем і не має права входу. Для скорочених імен JSON заповнюється `display_name`; повні складові не вигадуються.

## Базовий розклад

### `schedule_entries`

- `id`, `discipline_id`, `lesson_type_id`, `class_period_id`;
- `day_of_week` 1–7;
- внутрішній `week_pattern`: `numerator`, `denominator`, `both`; у UI це «перший», «другий», «щотижня»;
- `valid_from`, `valid_until`;
- `note`, `is_active`;
- `source_kind`, `source_id` для idempotency;
- `created_by_user_id`, `updated_by_user_id`, timestamps.

Зв’язки багато-до-багатьох:

- `schedule_entry_groups(entry_id, group_id)`;
- `schedule_entry_teachers(entry_id, teacher_id)`;
- `schedule_entry_rooms(entry_id, room_id)`.

Щонайменше одна група є обов’язковою. Список викладачів може містити більше одного запису. Відсутність кімнати дозволена лише для дистанційного або явно невизначеного формату.

## Винятки

### `schedule_exceptions`

- `id`, необов’язковий `base_entry_id`;
- `kind`: `move`, `reschedule`, `room_change`, `teacher_change`, `discipline_change`, `type_change`, `cancel`, `one_time`;
- `original_date`, необов’язкова `new_date`;
- override-поля пари, часу, дисципліни й типу;
- `reason`, `status`, `source_kind`, `source_id`;
- author / timestamps.

Override-зв’язки для викладачів, аудиторій і груп зберігаються в окремих junction-таблицях. Порожній override означає «успадкувати базове значення», а не «очистити»; для явного очищення потрібна окрема ознака режиму.

`one_time` не потребує `base_entry_id` і містить повний набір даних справжнього разового заняття. За уточненням VID-038 наданий датований JSON описує повторюваний семестровий розклад і імпортується до `schedule_entries`: `date` є початком дії, а завершенням — 31 грудня відповідного року.

## Календар

Чинна `schedule_week_settings` розширюється полями початку / завершення семестру. Внутрішні значення `numerator` / `denominator` зберігаються для безпечної сумісності, а UI використовує назви «перший» / «другий» тиждень. Один модуль виконує всі перетворення.

Глобальні перенесення навчальних днів можуть лишатися в `makeup_days`, але вони не замінюють точкові `schedule_exceptions`.

## Імпорт і аудит

### `schedule_import_runs`

- `id`, hash файлу, назва, розмір, статус;
- кількості total / created / updated / skipped / error;
- автор, timestamps.

### `schedule_import_items`

- `run_id`, `row_number`, стабільний `source_id`;
- статус і повідомлення;
- необов’язкове посилання на створений entry / exception;
- sanitized snapshot вхідного рядка для діагностики без службових даних адміністратора.

Унікальний ключ `(source_kind, source_id)` на записах і винятках забезпечує повторний імпорт без дублікатів.

## Індекси

- активні групи за `code_normalized`;
- дисципліни, викладачі, кімнати й типи за нормалізованою назвою;
- базові записи за `day_of_week`, `week_pattern`, `valid_from`, `valid_until`, `class_period_id`;
- junction-таблиці у двох напрямках;
- винятки за `original_date`, `new_date`, `base_entry_id`, `status`;
- import items за `source_id` і `run_id`;
- унікальні source keys для idempotency.

## Видалення й залежності

Довідник, який уже використовується, за замовчуванням деактивується. Фізичне видалення дозволяється лише без залежностей. Історичні записи й import audit не видаляються каскадно разом із довідником.
