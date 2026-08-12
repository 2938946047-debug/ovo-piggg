import { NextResponse } from "next/server";
import { z } from "zod";
import { sanitizeSvg } from "@/lib/sanitize-svg";
import { accessErrorResponse, requireIdentity } from "@/lib/server/request-auth";

const schema = z.object({ source: z.string().min(10).max(1_000_000), name: z.string().max(200).optional() });

export async function POST(request: Request) {
  try {
    await requireIdentity(request);
    const input = schema.parse(await request.json());
    const safe = sanitizeSvg(input.source);
    const dataUrl = `data:image/svg+xml;base64,${Buffer.from(safe, "utf8").toString("base64")}`;
    return NextResponse.json({ ok: true, name: input.name ?? "decoration.svg", dataUrl });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "SVG 无法处理" }, { status: 400 });
    return accessErrorResponse(error);
  }
}
