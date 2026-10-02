import type { NextRequest } from "next/server";
import { handleConfirmation } from "@/app/auth/confirm-handler";

export async function GET(request: NextRequest) {
  return handleConfirmation(request);
}
