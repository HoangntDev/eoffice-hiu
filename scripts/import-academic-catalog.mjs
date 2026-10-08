import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";

export const EXPECTED_HEADERS = [
  "Khoa chủ quản",
  "Tên lớp học",
  "Khóa học",
  "Bậc đào tạo",
  "Loại đào tạo",
  "Ngành",
];

const REQUIRED_FIELDS = [
  ["facultyName", "Khoa chủ quản"],
  ["classCode", "Tên lớp học"],
  ["cohortCode", "Khóa học"],
  ["educationLevel", "Bậc đào tạo"],
  ["trainingType", "Loại đào tạo"],
  ["programName", "Ngành"],
];

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  const source = text.replace(/^\uFEFF/, "");

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (quoted) throw new Error("CSV có trường trích dẫn chưa đóng.");
  if (field.length || row.length) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows.filter((values) => values.some((value) => value !== ""));
}

export function analyzeCatalogCsv(csvText) {
  const [headers, ...sourceRows] = parseCsv(csvText);
  const errors = [];
  const normalizedRows = [];

  if (
    !headers
    || headers.length !== EXPECTED_HEADERS.length
    || !EXPECTED_HEADERS.every((header, index) => headers[index] === header)
  ) {
    errors.push({
      lineNumber: 1,
      code: "INVALID_HEADER",
      message: `Header phải đúng thứ tự: ${EXPECTED_HEADERS.join(",")}`,
    });
    return {
      totalRows: sourceRows.length,
      validRows: 0,
      invalidRows: sourceRows.length,
      rows: [],
      errors,
    };
  }

  const indexes = Object.fromEntries(headers.map((header, index) => [header, index]));
  const invalidLines = new Set();

  sourceRows.forEach((sourceRow, index) => {
    const lineNumber = index + 2;
    if (sourceRow.length !== headers.length) {
      invalidLines.add(lineNumber);
      errors.push({
        lineNumber,
        code: "INVALID_COLUMN_COUNT",
        message: `Có ${sourceRow.length} cột; cần ${headers.length} cột.`,
      });
      return;
    }

    const row = {
      lineNumber,
      facultyName: sourceRow[indexes["Khoa chủ quản"]],
      classCode: sourceRow[indexes["Tên lớp học"]],
      cohortCode: sourceRow[indexes["Khóa học"]],
      educationLevel: sourceRow[indexes["Bậc đào tạo"]],
      trainingType: sourceRow[indexes["Loại đào tạo"]],
      programName: sourceRow[indexes.Ngành],
    };

    for (const [field, label] of REQUIRED_FIELDS) {
      if (!row[field].trim()) {
        invalidLines.add(lineNumber);
        errors.push({
          lineNumber,
          code: "MISSING_REQUIRED_VALUE",
          field: label,
          message: `Thiếu giá trị bắt buộc: ${label}.`,
        });
      }
    }
    normalizedRows.push(row);
  });

  const classLines = new Map();
  for (const row of normalizedRows) {
    const lines = classLines.get(row.classCode) ?? [];
    lines.push(row.lineNumber);
    classLines.set(row.classCode, lines);
  }
  for (const [classCode, lineNumbers] of classLines) {
    if (classCode && lineNumbers.length > 1) {
      for (const lineNumber of lineNumbers) invalidLines.add(lineNumber);
      errors.push({
        lineNumber: lineNumbers[0],
        lineNumbers,
        code: "DUPLICATE_CLASS_CODE",
        classCode,
        message: `Mã lớp ${classCode} bị trùng tại các dòng ${lineNumbers.join(", ")}.`,
      });
    }
  }

  return {
    totalRows: sourceRows.length,
    validRows: sourceRows.length - invalidLines.size,
    invalidRows: invalidLines.size,
    rows: normalizedRows.filter((row) => !invalidLines.has(row.lineNumber)),
    errors,
  };
}

export function toCatalogRows(csvText) {
  const analysis = analyzeCatalogCsv(csvText);
  if (analysis.errors.length) {
    throw new Error(analysis.errors.map((error) => `Dòng ${error.lineNumber}: ${error.message}`).join("\n"));
  }
  return analysis.rows;
}

function groupIdsBy(items, keyOf, idOf = (item) => item.id) {
  const result = new Map();
  for (const item of items) {
    const key = keyOf(item);
    const ids = result.get(key) ?? [];
    ids.push(idOf(item));
    result.set(key, ids);
  }
  return result;
}

export function buildImportPlan(rows, existing) {
  const faculties = existing.faculties ?? [];
  const programs = existing.programs ?? [];
  const cohorts = existing.cohorts ?? [];
  const classes = existing.classes ?? [];
  const facultyIdsByName = groupIdsBy(faculties, (item) => item.current_name);
  const facultyById = new Map(faculties.map((item) => [item.id, item]));
  const programById = new Map(programs.map((item) => [item.id, item]));
  const cohortById = new Map(cohorts.map((item) => [item.id, item]));
  const classByCode = new Map(classes.map((item) => [item.current_code, item]));
  const programIdsByPair = groupIdsBy(
    programs,
    (item) => `${facultyById.get(item.current_faculty_id)?.current_name ?? ""}\u0000${item.current_name}`,
  );
  const cohortByCode = new Map(cohorts.map((item) => [item.code, item]));

  const sourceFacultyNames = new Set(rows.map((row) => row.facultyName));
  const sourceProgramPairs = new Set(rows.map((row) => `${row.facultyName}\u0000${row.programName}`));
  const sourceCohortCodes = new Set(rows.map((row) => row.cohortCode));
  const conflicts = [];
  let classInsert = 0;
  let classUpdate = 0;

  for (const row of rows) {
    const facultyIds = facultyIdsByName.get(row.facultyName) ?? [];
    if (facultyIds.length > 1) {
      conflicts.push({
        lineNumber: row.lineNumber,
        classCode: row.classCode,
        code: "AMBIGUOUS_FACULTY",
        message: `Có nhiều Khoa hiện hành cùng tên ${row.facultyName}.`,
      });
      continue;
    }
    const programIds = programIdsByPair.get(`${row.facultyName}\u0000${row.programName}`) ?? [];
    if (programIds.length > 1) {
      conflicts.push({
        lineNumber: row.lineNumber,
        classCode: row.classCode,
        code: "AMBIGUOUS_PROGRAM",
        message: `Có nhiều Ngành hiện hành cùng tên ${row.programName} trong ${row.facultyName}.`,
      });
      continue;
    }

    const currentClass = classByCode.get(row.classCode);
    if (!currentClass) {
      classInsert += 1;
      continue;
    }
    const currentProgram = programById.get(currentClass.current_program_id);
    const currentFaculty = facultyById.get(currentProgram?.current_faculty_id);
    const currentCohort = cohortById.get(currentClass.current_cohort_id);
    const sameRelationship = currentFaculty?.current_name === row.facultyName
      && currentProgram?.current_name === row.programName
      && currentCohort?.code === row.cohortCode;

    if (!sameRelationship) {
      conflicts.push({
        lineNumber: row.lineNumber,
        classCode: row.classCode,
        code: "CLASS_RELATIONSHIP_CONFLICT",
        message: "Lớp đã tồn tại với quan hệ Khoa/Ngành/Khóa khác; cần xử lý thủ công.",
        expected: {
          facultyName: row.facultyName,
          programName: row.programName,
          cohortCode: row.cohortCode,
        },
        actual: {
          facultyName: currentFaculty?.current_name ?? null,
          programName: currentProgram?.current_name ?? null,
          cohortCode: currentCohort?.code ?? null,
        },
      });
    } else if (
      currentClass.education_level !== row.educationLevel
      || currentClass.training_type !== row.trainingType
    ) {
      classUpdate += 1;
    }
  }

  return {
    faculties: {
      insert: [...sourceFacultyNames].filter((name) => !facultyIdsByName.has(name)).length,
      update: 0,
    },
    programs: {
      insert: [...sourceProgramPairs].filter((pair) => !programIdsByPair.has(pair)).length,
      update: 0,
    },
    cohorts: {
      insert: [...sourceCohortCodes].filter((code) => !cohortByCode.has(code)).length,
      update: 0,
    },
    classes: { insert: classInsert, update: classUpdate },
    conflicts,
  };
}

function isLocalSupabaseUrl(value) {
  try {
    const hostname = new URL(value).hostname;
    return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1";
  } catch {
    return false;
  }
}

async function fetchAll(supabase, table, columns) {
  const pageSize = 1000;
  const rows = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase.from(table).select(columns).range(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) return rows;
  }
}

async function main() {
  process.loadEnvFile?.(".env.local");
  const args = process.argv.slice(2);
  const fileArg = args.find((arg) => !arg.startsWith("--"));
  if (!fileArg) {
    throw new Error("Cách dùng: npm run catalog:import -- \"./duong-dan.csv\" [--apply] [--allow-remote]");
  }

  const filePath = resolve(fileArg);
  const fileBytes = await readFile(filePath);
  const contents = fileBytes.toString("utf8");
  const analysis = analyzeCatalogCsv(contents);
  if (analysis.errors.length) {
    console.log(JSON.stringify({
      phase: "csv-validation",
      totalRows: analysis.totalRows,
      validRows: analysis.validRows,
      invalidRows: analysis.invalidRows,
      planned: null,
      conflicts: [],
      errors: analysis.errors,
      applied: false,
    }, null, 2));
    process.exitCode = 1;
    return;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY.");
  if (!args.includes("--allow-remote") && !isLocalSupabaseUrl(url)) {
    throw new Error("REMOTE_DATABASE_BLOCKED: importer chỉ cho phép Supabase local; dùng --allow-remote khi có phê duyệt riêng.");
  }

  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const [faculties, programs, cohorts, classes] = await Promise.all([
    fetchAll(supabase, "faculties", "id,current_name"),
    fetchAll(supabase, "programs", "id,current_name,current_faculty_id"),
    fetchAll(supabase, "cohorts", "id,code"),
    fetchAll(
      supabase,
      "classes",
      "id,current_code,current_program_id,current_cohort_id,education_level,training_type",
    ),
  ]);
  const plan = buildImportPlan(analysis.rows, { faculties, programs, cohorts, classes });
  const fileSha256 = createHash("sha256").update(fileBytes).digest("hex");
  const rpcArgs = {
    p_rows: analysis.rows,
    p_file_name: basename(filePath),
    p_file_sha256: fileSha256,
    p_dry_run: true,
  };
  const { data: serverValidation, error: previewError } = await supabase.rpc(
    "import_academic_catalog_v2",
    rpcArgs,
  );
  if (previewError) throw previewError;

  const conflicts = Array.from(new Map(
    [...plan.conflicts, ...(serverValidation.conflicts ?? [])].map((conflict) => [
      `${conflict.lineNumber ?? ""}:${conflict.classCode ?? ""}:${conflict.code ?? ""}`,
      conflict,
    ]),
  ).values());
  const errors = serverValidation.errors ?? [];
  const preview = {
    phase: "dry-run",
    totalRows: analysis.totalRows,
    validRows: analysis.validRows,
    invalidRows: analysis.invalidRows,
    planned: {
      faculties: plan.faculties,
      programs: plan.programs,
      cohorts: plan.cohorts,
      classes: plan.classes,
    },
    conflicts,
    errors,
    applied: false,
  };
  console.log(JSON.stringify(preview, null, 2));

  if (!args.includes("--apply")) {
    console.log("DRY_RUN_ONLY: thêm --apply sau khi kiểm tra báo cáo xung đột và lỗi.");
    return;
  }
  if (conflicts.length || errors.length) {
    throw new Error("IMPORT_HAS_ERRORS: không ghi dữ liệu.");
  }

  const { data, error } = await supabase.rpc("import_academic_catalog_v2", {
    ...rpcArgs,
    p_dry_run: false,
  });
  if (error) throw error;
  console.log(JSON.stringify({ phase: "apply", ...data }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Import thất bại.");
    process.exitCode = 1;
  });
}
