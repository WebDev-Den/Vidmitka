"use server";

import { revalidatePath } from "next/cache";

import { requireAdminPanelUser } from "@/lib/auth/session";
import { createClassPeriod, setClassPeriodActive, updateClassPeriod } from "@/lib/class-periods/repository";

import type { PeriodActionState } from "./form-state";
const state = (result: {success:boolean;message:string}): PeriodActionState => ({...result,submittedAt:Date.now()});

function refresh() { for (const path of ["/", "/schedule", "/admin/periods", "/admin/schedule", "/admin/import"]) revalidatePath(path); }
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
