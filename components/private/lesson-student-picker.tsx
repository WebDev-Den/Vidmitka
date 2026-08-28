"use client";

import { useState } from "react";
import type { GroupStudent, StudentGroup } from "@/lib/groups/repository";
import { ManagementTable } from "./management-table";

export function LessonStudentPicker({ groups, students, disabled, optional = false, existingStudentIds = [] }: {
  groups: StudentGroup[];
  students: GroupStudent[];
  disabled: boolean;
  optional?: boolean;
  existingStudentIds?: string[];
}) {
  const [groupNames, setGroupNames] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const existing = new Set(existingStudentIds);
  const visibleStudents = students.filter((student) => groupNames.includes(student.groupName));
  const selected = visibleStudents.filter((student) => selectedIds.includes(student.id) && !existing.has(student.id));

  function toggleGroup(name: string, checked: boolean) {
    setGroupNames((current) => checked ? [...current, name] : current.filter((group) => group !== name));
    if (!checked) {
      const removed = new Set(students.filter((student) => student.groupName === name).map((student) => student.id));
      setSelectedIds((current) => current.filter((id) => !removed.has(id)));
    }
  }

  return <>
    <fieldset className="lesson-group-picker" disabled={disabled}>
      <legend>Групи заняття{optional ? " (необов’язково)" : ""}</legend>
      <p>{optional ? "Групи й студентів можна вибрати зараз або додати пізніше через «Мої заняття»." : "Оберіть групи, з яких додаватимете студентів."}</p>
      {!groups.length && <p>Груп ще немає. Додайте студента з новою групою у розділі «Мої студенти»{optional ? " — це можна зробити після створення заняття" : ""}.</p>}
      {!!groups.length && <ManagementTable caption="Вибір груп заняття" columns={["Група", "Студентів"]} minWidth={300}>
        <tbody>{groups.map((group) => <tr key={group.name}>
          <th scope="row"><label className="management-check">
            <input type="checkbox" name="groupNames" value={group.name} checked={groupNames.includes(group.name)}
              onChange={(event) => toggleGroup(group.name, event.target.checked)} />{group.name}
          </label></th><td>{group.studentCount}</td>
        </tr>)}</tbody>
      </ManagementTable>}
    </fieldset>
    <fieldset className="lesson-student-picker" disabled={disabled}>
      <legend>Студенти цього заняття{optional ? " (необов’язково)" : ""}</legend>
      <p>Вибрано для додавання: {selected.length}. {optional
        ? "Без вибору заняття збережеться з порожнім списком. Вибір групи сам по собі не додає її студентів."
        : "Наявні учасники залишаються. Вибрані студенти додаються лише до окремого списку цього заняття й предмета викладача."}</p>
      {groupNames.length === 0 && <p>{optional ? "Щоб додати студентів зараз, спочатку виберіть групу вище." : "Спочатку виберіть групу вище."}</p>}
      {groupNames.length > 0 && <ManagementTable caption="Вибір студентів заняття" columns={["ПІБ студента", "Група"]} minWidth={440}>
        {groupNames.map((name) => <tbody key={name}>
          <tr className="management-group-row"><th colSpan={2} scope="rowgroup">
            <div className="management-heading"><span>{name}</span>
              <button type="button" className="button button-light" onClick={() => setSelectedIds((current) => [...new Set([
                ...current, ...visibleStudents.filter((student) => student.groupName === name && !existing.has(student.id)).map((student) => student.id),
              ])])}>Вибрати всіх із {name}</button>
            </div>
          </th></tr>
          {!visibleStudents.some((student) => student.groupName === name) && <tr><td colSpan={2}>У цій групі немає активних студентів.</td></tr>}
          {visibleStudents.filter((student) => student.groupName === name).map((student) => <tr key={student.id}>
            <th scope="row"><label className="management-check">
              <input type="checkbox" name="studentIds" value={student.id}
                disabled={existing.has(student.id)} checked={existing.has(student.id) || selectedIds.includes(student.id)}
                onChange={(event) => setSelectedIds((current) => event.target.checked ? [...current, student.id] : current.filter((id) => id !== student.id))} />
              {student.fullName}{existing.has(student.id) ? " · уже в занятті" : ""}
            </label></th><td>{name}</td>
          </tr>)}
        </tbody>)}
      </ManagementTable>}
      {selected.length > 0 && <button className="button button-light" type="button" onClick={() => setSelectedIds([])}>Зняти вибір студентів</button>}
    </fieldset>
  </>;
}
