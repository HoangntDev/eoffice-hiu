import { z } from "zod";
import { apiError, HttpError } from "@/lib/http";
import { createAdminSupabase } from "@/lib/supabase/server";

// Ảnh đại diện của bài đã lên cổng E-Office, đọc công khai. Bản nháp chưa xuất bản trả 404.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = z.uuid().parse((await params).id);
    const admin = createAdminSupabase();
    const { data: post } = await admin.from("program_publications")
      .select("cover_path, cover_content_type").eq("program_id", id).not("eoffice_published_at", "is", null).maybeSingle();
    if (!post?.cover_path) throw new HttpError(404, "NOT_FOUND", "Không tìm thấy ảnh.");
    const { data: file, error } = await admin.storage.from("program-publication-covers").download(post.cover_path);
    if (error || !file) throw new HttpError(404, "NOT_FOUND", "Không tìm thấy ảnh.");
    return new Response(file, {
      headers: {
        "content-type": post.cover_content_type as string,
        "cache-control": "public, max-age=300",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) return apiError(new HttpError(404, "NOT_FOUND", "Không tìm thấy ảnh."));
    return apiError(error);
  }
}
