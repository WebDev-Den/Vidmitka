import { getOptionalAppUser } from "@/lib/auth/session";
import { isApprovedAdministrator } from "@/lib/auth/authorization";
import { exportScheduleSnapshot } from "@/lib/schedule-transfer/repository";
import { MAX_TRANSFER_BYTES, parseSnapshot } from "@/lib/schedule-transfer/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (!isApprovedAdministrator(await getOptionalAppUser())) {
      return new Response(null, { status: 307, headers: {
        Location: "/admin/login", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
      } });
    }
    const snapshot = parseSnapshot(await exportScheduleSnapshot());
    const body = JSON.stringify(snapshot, null, 2);
    if (Buffer.byteLength(body, "utf8") > MAX_TRANSFER_BYTES) {
      return Response.json({ error: "Експорт перевищує ліміт 3 МБ для зворотного імпорту." }, { status: 413, headers: { "Cache-Control": "no-store" } });
    }
    return new Response(body, { headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="vidmitka-schedule-${snapshot.exportedAt.slice(0, 10)}.json"`,
      "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
    } });
  } catch {
    return Response.json({ error: "Не вдалося експортувати розклад. Спробуйте ще раз." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
