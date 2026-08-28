"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { ManagementFeedback, ManagementTable } from "@/components/private/management-table";
import { ManagementSubmit } from "@/components/private/management-submit";
import type { Subject } from "@/lib/subjects/repository";
import type { TeacherStudent } from "@/lib/students/repository";
import type { StudentGroup } from "@/lib/groups/repository";
import { addStudentAction, removeStudentAction } from "./actions";
import { initialStudentActionState } from "./form-state";

export function StudentManager({ subjects, students, groups }: {
  subjects: Subject[]; students: TeacherStudent[]; groups: StudentGroup[];
}) {
  const [state, action, pending] = useActionState(addStudentAction, initialStudentActionState);
  const formId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [groupMode, setGroupMode] = useState(groups.length ? "existing" : "new");
  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success, state.message]);

  return <section className="management-stack" aria-labelledby="student-list-title">
    <div className="management-heading">
      <h2 id="student-list-title">Студенти за предметами</h2><span>{students.length} зв’язків</span>
    </div>
    <p className="management-description">Додайте студента до свого предмета. ПІБ і група зберігаються в спільному каталозі. «Прибрати» видаляє лише зв’язок із предметом.</p>
    {!subjects.length && <p className="notice">Щоб додавати студентів, адміністратор має створити навчальний предмет.</p>}
    <ManagementTable caption="Студенти за предметами" columns={["ПІБ студента", "Група", "Підгрупа", "Предмет", "Дії"]} minWidth={980}>
      <tbody>
        <tr className="management-new-row">
          <td><input form={formId} name="fullName" type="text" maxLength={200} required
            aria-label="ПІБ студента" placeholder="ПІБ студента" disabled={pending} /></td>
          <td><div className="management-cell-stack">
            {/* Keep the controlled selector outside native reset; submit its state once. */}
            <input form={formId} type="hidden" name="groupMode" value={groupMode} />
            <select aria-label="Спосіб вибору групи" value={groupMode}
              onChange={(event) => setGroupMode(event.target.value)} disabled={pending}>
              <option value="existing" disabled={!groups.length}>Наявна група</option>
              <option value="new">Нова група</option>
            </select>
            {groupMode === "existing" ?
              <select form={formId} name="existingGroupName" aria-label="Навчальна група" defaultValue="" required disabled={pending}>
                <option value="" disabled>Оберіть групу</option>
                {groups.map((group) => <option key={group.name} value={group.name}>{group.name}</option>)}
              </select> :
              <input form={formId} name="newGroupName" type="text" aria-label="Назва нової групи" placeholder="Назва нової групи"
                minLength={2} maxLength={100} required disabled={pending} />}
          </div></td>
          <td><input form={formId} name="subgroup" type="text" maxLength={100}
            aria-label="Підгрупа (необов’язково)" placeholder="Необов’язково" disabled={pending} /></td>
          <td><select form={formId} name="subjectId" aria-label="Навчальний предмет" defaultValue="" required disabled={pending || !subjects.length}>
            <option value="" disabled>Оберіть предмет</option>
            {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
          </select></td>
          <td className="management-actions-cell"><form id={formId} ref={formRef} action={action}>
            <button className="button button-primary" disabled={pending || !subjects.length}>{pending ? "Додавання…" : "Додати студента"}</button>
          </form></td>
        </tr>
        <ManagementFeedback state={state} colSpan={5} />
      </tbody>
      <tbody>
        {students.map((student) => <tr key={student.enrollmentId}>
          <th scope="row">{student.fullName}</th>
          <td>{student.groupName}</td><td>{student.subgroup || "—"}</td><td>{student.subjectName}</td>
          <td className="management-actions-cell"><form action={removeStudentAction.bind(null, student.enrollmentId)}>
            <ManagementSubmit className="button button-light"
              aria-label={"Прибрати з предмета: " + student.fullName + ", " + student.subjectName}>Прибрати з предмета</ManagementSubmit>
          </form></td>
        </tr>)}
        {!students.length && <tr><td colSpan={5} className="management-muted">Студентів ще не додано. Оберіть предмет і створіть перший запис.</td></tr>}
      </tbody>
    </ManagementTable>
  </section>;
}
