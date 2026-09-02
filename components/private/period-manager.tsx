"use client";

import { useActionState, useEffect, useId, useRef } from "react";

import { ColorField } from "@/components/color-field";
import { ManagementFeedback, ManagementStatus, ManagementTable } from "@/components/private/management-table";
import { createClassPeriodAction, updateClassPeriodAction } from "@/app/admin/(protected)/periods/actions";
import { initialPeriodActionState } from "@/app/admin/(protected)/periods/form-state";
import type { ClassPeriod } from "@/lib/class-periods/repository";

function Fields({formId,period,pending}:{formId:string;period?:ClassPeriod;pending:boolean}){const suffix=period?` ${period.number} пари`:" нової пари";return <>
  <td className="management-number-cell"><input form={formId} name="number" type="number" min="1" max="99" defaultValue={period?.number} aria-label={`Номер${suffix}`} required disabled={pending}/></td>
  <td><input form={formId} name="startTime" type="time" defaultValue={period?.startTime} aria-label={`Початок${suffix}`} required disabled={pending}/></td>
  <td><input form={formId} name="endTime" type="time" defaultValue={period?.endTime} aria-label={`Завершення${suffix}`} required disabled={pending}/></td>
  <td><ColorField form={formId} color={period?.color} label={`Колір${suffix}`} hideLabel disabled={pending}/></td></>}

function CreateRow(){const formId=useId();const [state,action,pending]=useActionState(createClassPeriodAction,initialPeriodActionState);const ref=useRef<HTMLFormElement>(null);
  useEffect(()=>{if(state.success)ref.current?.reset()},[state.success,state.submittedAt]);return <tbody><tr className="management-new-row"><Fields formId={formId} pending={pending}/><td>Нова пара</td><td><form id={formId} ref={ref} action={action}><button className="button button-primary" disabled={pending}>{pending?"Додавання…":"Додати пару"}</button></form></td></tr><ManagementFeedback state={state} colSpan={6}/></tbody>}
function Row({period}:{period:ClassPeriod}){const formId=useId();const [state,action,pending]=useActionState(updateClassPeriodAction.bind(null,period.id),initialPeriodActionState);return <tbody><tr><Fields formId={formId} period={period} pending={pending}/><td><ManagementStatus active={period.isActive} feminine/></td><td><form id={formId} action={action} className="management-actions"><button className="button button-light" name="intent" value="save" disabled={pending}>Зберегти</button><button className="button button-light" name="intent" value={period.isActive?"deactivate":"activate"} disabled={pending}>{period.isActive?"Деактивувати":"Активувати"}</button></form></td></tr><ManagementFeedback state={state} colSpan={6}/></tbody>}
export function PeriodManager({periods}:{periods:ClassPeriod[]}){return <div className="management-stack"><p className="management-description">{periods.filter((item)=>item.isActive).length} активних пар.</p><ManagementTable caption="Навчальні пари" columns={["№ пари","Початок","Завершення","Колір","Стан","Дії"]} minWidth={870}><CreateRow/>{periods.map((period)=><Row key={period.id} period={period}/>)}</ManagementTable></div>}
