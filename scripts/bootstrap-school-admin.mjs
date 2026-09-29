import { createClient } from "@supabase/supabase-js";

process.loadEnvFile?.(".env.local");
const userIndex=process.argv.indexOf("--user-id");const userId=userIndex>=0?process.argv[userIndex+1]:null;
if(!userId||!process.argv.includes("--confirm")){console.error("Cách dùng: npm run admin:bootstrap -- --user-id <UUID> --confirm");process.exitCode=1;}
else{const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key){console.error("Thiếu biến môi trường Supabase server-side.");process.exitCode=1;}else{const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});const{data,error}=await client.rpc("bootstrap_school_admin",{p_user_id:userId,p_reason:"Bootstrap người quản lý Đoàn Trường ban đầu"});if(error){console.error(error.message);process.exitCode=1;}else console.log(`BOOTSTRAP_OK role_grant_id=${data}`);}}
