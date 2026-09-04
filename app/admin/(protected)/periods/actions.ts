"use server";

import { revalidatePath } from "next/cache";

import { requireAdminPanelUser } from "@/lib/auth/session";
import {
  createClassPeriod,
  setClassPeriodActive,
  updateClassPeriod,
  updateClassPeriods,
  type ClassPeriodBatchInput,
} from "@/lib/class-periods/repository";

import type { PeriodActionState } from "./form-state";
const state = (result: {success:boolean;message:string}): PeriodActionState => ({...result,submittedAt:Date.now()});

function refresh() { for (const path of ["/", "/schedule", "/admin/periods", "/admin/schedule", "/admin/import"]) revalidatePath(path); }

function parseBatchChanges(formData: FormData): ClassPeriodBatchInput[] | null {
  const raw = formData.get("changes");
  if (typeof raw !== "string") return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return null;
    return value.map((item) => {
      if (!item || typeof item !== "object") return { id: "", number: "", startTime: "", endTime: "", color: "" };
      const record = item as Record<string, unknown>;
      return {
        id: typeof record.id === "string" ? record.id : "",
        number: typeof record.number === "string" ? record.number : "",
        startTime: typeof record.startTime === "string" ? record.startTime : "",
        endTime: typeof record.endTime === "string" ? record.endTime : "",
        color: typeof record.color === "string" ? record.color : "",
      };
    });
  } catch {
    return null;
  }
}

export async function createClassPeriodAction(_previous: PeriodActionState, formData: FormData): Promise<PeriodActionState> {
  await requireAdminPanelUser();
  const result=await createClassPeriod({number:formData.get("number"),startTime:formData.get("startTime"),endTime:formData.get("endTime"),color:formData.get("color")});
  if(result.success) refresh(); return state(result);
}
export async function updateClassPeriodAction(id:string,_previous:PeriodActionState,formData:FormData):Promise<PeriodActionState>{
  await requireAdminPanelUser(); const intent=formData.get("intent");
  const result=intent==="activate"||intent==="deactivate"?await setClassPeriodActive(id,intent==="activate"):
    await updateClassPeriod(id,{number:formData.get("number"),startTime:formData.get("startTime"),endTime:formData.get("endTime"),color:formData.get("color")});
  if(result.success) refresh(); return state(result);
}

export async function updateClassPeriodsAction(_previous: PeriodActionState, formData: FormData): Promise<PeriodActionState> {
  await requireAdminPanelUser();
  const changes = parseBatchChanges(formData);
  const result = changes ? await updateClassPeriods(changes) : { success: false, message: "Перелік змін некоректний." };
  if (result.success) refresh();
  return state(result);
}
