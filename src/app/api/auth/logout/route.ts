import { NextResponse } from "next/server";
import { apiError } from "@/lib/http";
import { createUserSupabase } from "@/lib/supabase/server";

export async function POST() {
  try {
    const supabase = await createUserSupabase();
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    const response = NextResponse.json({ message: "Đã đăng xuất.", next: "/login" });
    response.headers.set("Cache-Control", "no-store, max-age=0");
    response.headers.set("Clear-Site-Data", '"cache"');
    return response;
  } catch (error) {
    return apiError(error);
  }
}
