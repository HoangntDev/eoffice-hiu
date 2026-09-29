import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/dal";
import { apiError,HttpError,readJson } from "@/lib/http";
const schema=z.object({code:z.string().trim().min(2).max(50),label:z.string().trim().min(3).max(300),isRequired:z.boolean(),displayOrder:z.number().int(),roleGrantId:z.uuid()}).strict();
export async function GET(){try{const{supabase}=await requireUser();const{data,error}=await supabase.from("membership_review_checklist_items").select("id,code,label,is_required,display_order").eq("is_active",true).order("display_order");if(error)throw new Error("CHECKLIST_READ_FAILED");return NextResponse.json({items:data??[]});}catch(error){return apiError(error);}}
export async function POST(request:Request){try{const input=schema.parse(await readJson(request));const{supabase}=await requireUser();const{data,error}=await supabase.rpc("save_membership_checklist_definition",{p_code:input.code,p_label:input.label,p_is_required:input.isRequired,p_display_order:input.displayOrder,p_role_grant_id:input.roleGrantId});if(error)throw new HttpError(403,"CHECKLIST_SAVE_FAILED","Chỉ Văn phòng/Đoàn Trường được cấu hình checklist.");return NextResponse.json({id:data,message:"Đã lưu mục checklist."});}catch(error){return apiError(error);}}
