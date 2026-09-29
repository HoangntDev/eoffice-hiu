import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export function apiError(error: unknown) {
  if (error instanceof HttpError) {
    return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", message: "Dữ liệu chưa hợp lệ.", fields: error.flatten().fieldErrors },
      { status: 422 },
    );
  }
  if (error instanceof Error && error.message.startsWith("MISSING_ENV:")) {
    return NextResponse.json(
      { error: "SERVICE_NOT_CONFIGURED", message: "Dịch vụ chưa được cấu hình biến môi trường." },
      { status: 503 },
    );
  }
  return NextResponse.json(
    { error: "INTERNAL_ERROR", message: "Không thể xử lý yêu cầu. Vui lòng thử lại." },
    { status: 500 },
  );
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, "INVALID_JSON", "Nội dung yêu cầu không phải JSON hợp lệ.");
  }
}
