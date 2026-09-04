import { openApiDocument } from "@/lib/rest-api/openapi";

export function GET() {
  return Response.json(openApiDocument, { headers: { "Cache-Control": "no-store" } });
}
