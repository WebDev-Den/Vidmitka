import { CircleAlert } from "lucide-react";

import { PageIntro } from "@/components/page-intro";
import { requireAppUser } from "@/lib/auth/session";
import { listClassPeriods } from "@/lib/class-periods/repository";

export default async function NewLessonPage() {
  const user = await requireAppUser();
  const isAdministrator = user.role === "administrator";
  const periods = await listClassPeriods({ activeOnly: true });

  return (
    <section>
      <PageIntro
        eyebrow={isAdministrator ? "АДМІНІСТРУВАННЯ" : "КАБІНЕТ ВИКЛАДАЧА"}
        title="Створити заняття"
        description={
          isAdministrator
            ? "Оберіть викладача й заповніть параметри заняття. Конфлікти буде перевірено перед збереженням."
            : "Заповніть параметри заняття. Перевірка конфліктів буде виконана перед збереженням."
        }
      />

      <div className="notice notice-info">
        <CircleAlert size={19} />
        <p>
          Адміністратор ще не заповнив предмети й аудиторії. Форма вже
          відображає майбутню структуру, але збереження тимчасово недоступне.
        </p>
      </div>

      <form className="lesson-editor">
        {isAdministrator ? (
          <label>
            Викладач
            <select disabled>
              <option>Немає доданих викладачів</option>
            </select>
          </label>
        ) : null}
        <label>
          Навчальний предмет
          <select disabled>
            <option>Немає доступних предметів</option>
          </select>
        </label>
        <label>
          Аудиторія
          <select disabled>
            <option>Немає доступних аудиторій</option>
          </select>
        </label>
        <label>
          День тижня
          <select defaultValue="monday">
            <option value="monday">Понеділок</option>
            <option value="tuesday">Вівторок</option>
            <option value="wednesday">Середа</option>
            <option value="thursday">Четвер</option>
            <option value="friday">П’ятниця</option>
          </select>
        </label>
        <label>
          Номер пари
          <select defaultValue="">
            <option value="" disabled>Оберіть пару</option>
            {periods.map((period) => (
              <option key={period.id} value={period.id}>
                {period.label}
              </option>
            ))}
          </select>
        </label>
        <fieldset>
          <legend>Тип навчального тижня</legend>
          <label><input type="radio" name="weekType" value="numerator" defaultChecked /> Чисельник</label>
          <label><input type="radio" name="weekType" value="denominator" /> Знаменник</label>
          <label><input type="radio" name="weekType" value="both" /> Обидва тижні</label>
        </fieldset>
        <button className="button button-primary" type="button" disabled>
          Створити заняття
        </button>
      </form>
    </section>
  );
}
