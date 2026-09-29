import { NextResponse } from "next/server";
import { apiError } from "@/lib/http";
import { createUserSupabase } from "@/lib/supabase/server";

export async function POST() {
  try {
    const supabase = await createUserSupabase();
    await supabase.auth.signOut();
    return NextResponse.json({ message: "Đã đăng xuất." });
  } catch (error) {
    return apiError(error);
  }
}
