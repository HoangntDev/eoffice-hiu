import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";

const EXPECTED_HEADERS = ["STT", "Khoa", "Ngành", "Lớp", "Khóa", "Số hiệu", "Thứ tự khoa"];

export function parseCsv(text) {
  const rows = []; let row = []; let field = ""; let quoted = false;
  const source = text.replace(/^\uFEFF/, "");
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') { field += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { row.push(field); field = ""; }
    else if (char === "\n") { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; }
    else field += char;
  }
  if (quoted) throw new Error("CSV có trường trích dẫn chưa đóng.");
  if (field.length || row.length) { row.push(field.replace(/\r$/, "")); rows.push(row); }
  return rows.filter((values) => values.some((value) => value !== ""));
}

export function toCatalogRows(csvText) {
  const [headers, ...values] = parseCsv(csvText);
  if (!headers || headers.length !== EXPECTED_HEADERS.length || !EXPECTED_HEADERS.every((header, index) => headers[index] === header)) {
    throw new Error(`Header phải đúng: ${EXPECTED_HEADERS.join(",")}`);
  }
  const rows = values.map((row, rowIndex) => {
    if (row.length !== headers.length) throw new Error(`Dòng ${rowIndex + 2} có ${row.length} cột; cần ${headers.length}.`);
    return Object.fromEntries(headers.map((header, index) => [header, row[index]]));
  });
  const duplicateClasses = rows.filter((row, index) => rows.findIndex((candidate) => candidate["Lớp"] === row["Lớp"]) !== index);
  if (duplicateClasses.length) throw new Error(`CSV có Lớp trùng: ${[...new Set(duplicateClasses.map((row) => row["Lớp"]))].join(", ")}`);
  return rows;
}

async function main() {
  process.loadEnvFile?.(".env.local");
  const fileArg = process.argv.slice(2).find((arg) => !arg.startsWith("--"));
  if (!fileArg) throw new Error("Cách dùng: npm run catalog:import -- ./duong-dan.csv [--apply]");
  const filePath = resolve(fileArg); const contents = await readFile(filePath, "utf8"); const rows = toCatalogRows(contents);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY.");
  const supabase = createClient(url, key, {auth:{persistSession:false,autoRefreshToken:false}});
  const args = {p_rows:rows,p_file_name:basename(filePath),p_file_sha256:createHash("sha256").update(contents).digest("hex"),p_dry_run:true};
  const {data:preview,error:previewError}=await supabase.rpc("import_academic_catalog",args);if(previewError)throw previewError;
  console.log(JSON.stringify(preview,null,2));
  if(!process.argv.includes("--apply")){console.log("DRY_RUN_ONLY: thêm --apply sau khi kiểm tra báo cáo xung đột.");return;}
  if(preview.conflicts?.length)throw new Error("IMPORT_HAS_CONFLICTS: không ghi dữ liệu.");
  const {data,error}=await supabase.rpc("import_academic_catalog",{...args,p_dry_run:false});if(error)throw error;console.log(JSON.stringify(data,null,2));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main().catch((error)=>{console.error(error instanceof Error?error.message:"Import thất bại.");process.exitCode=1;});
