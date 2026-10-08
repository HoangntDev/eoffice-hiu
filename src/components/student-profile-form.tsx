"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  getClassOptions,
  getCohortOptions,
  getFacultyOptions,
  getProgramOptions,
  type AcademicCatalogRow,
} from "@/modules/organization-catalog/cascade";

export function StudentProfileForm() {
  const [catalog, setCatalog] = useState<AcademicCatalogRow[]>([]);
  const [profile, setProfile] = useState<Record<string, string>>({});
  const [account, setAccount] = useState<{student_code?:string}|null>(null);
  const [email, setEmail] = useState<{email?:string;verified_at?:string|null}|null>(null);
  const [facultyId, setFacultyId] = useState("");
  const [programId, setProgramId] = useState("");
  const [cohortId, setCohortId] = useState("");
  const [classId, setClassId] = useState("");
  const [loading, setLoading] = useState(true); const [pending, setPending] = useState(false);
  const [message, setMessage] = useState(""); const [error, setError] = useState("");

  useEffect(() => { void (async () => {
    try {
      const [catalogResponse, profileResponse] = await Promise.all([fetch("/api/catalog"), fetch("/api/student-profile")]);
      if (catalogResponse.status === 401 || profileResponse.status === 401) throw new Error("Vui lòng đăng nhập bằng MSSV.");
      const catalogData = await catalogResponse.json(); const profileData = await profileResponse.json();
      if (!catalogResponse.ok || !profileResponse.ok) throw new Error(catalogData.message ?? profileData.message ?? "Không thể tải dữ liệu.");
      setCatalog(catalogData.catalog); setProfile(profileData.profile ?? {}); setAccount(profileData.account); setEmail(profileData.email);
      const current = catalogData.catalog.find((row:AcademicCatalogRow) => row.class_id === profileData.profile?.class_id);
      if (current) {
        setFacultyId(current.faculty_id);
        setProgramId(current.program_id);
        setCohortId(current.cohort_id);
        setClassId(current.class_id);
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể tải dữ liệu."); }
    finally { setLoading(false); }
  })(); }, []);

  const faculties = useMemo(() => getFacultyOptions(catalog), [catalog]);
  const programs = useMemo(() => getProgramOptions(catalog, facultyId), [catalog, facultyId]);
  const cohorts = useMemo(
    () => getCohortOptions(catalog, facultyId, programId),
    [catalog, facultyId, programId],
  );
  const classes = useMemo(
    () => getClassOptions(catalog, facultyId, programId, cohortId),
    [catalog, facultyId, programId, cohortId],
  );

  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError(""); setMessage("");
    const raw = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const response = await fetch("/api/student-profile", {method:"PUT", headers:{"content-type":"application/json"}, body:JSON.stringify(raw)});
      const result = await response.json(); if (!response.ok) throw new Error(result.message ?? "Không thể lưu hồ sơ."); setMessage(result.message);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể lưu hồ sơ."); }
    finally { setPending(false); }
  }

  if (loading) return <p className="notice">Đang tải hồ sơ và danh mục…</p>;
  return <div className="panel">
    {error && <p className="notice error" role="alert">{error}</p>}
    <div className="form-grid" style={{marginBottom:20}}><label>MSSV<input value={account?.student_code ?? ""} readOnly /></label><label>Gmail đã xác minh<input value={email?.email ?? ""} readOnly /></label></div>
    {!email?.verified_at && <p className="notice warning">Gmail chưa được ghi nhận xác minh. Hãy dùng liên kết trong email trước khi hoàn tất hồ sơ.</p>}
    {catalog.length === 0 && <p className="notice warning">Chưa có danh mục Lớp. Vui lòng báo Đoàn Khoa/Đoàn Trường bổ sung; sinh viên không tự tạo lớp chính thức.</p>}
    <form className="form-grid" onSubmit={submit}>
      <label className="full">Họ và tên<input name="fullName" required defaultValue={profile.full_name ?? ""} /></label>
      <label>Giới tính<select name="gender" required defaultValue={profile.gender ?? ""}><option value="">Chọn giới tính</option><option value="female">Nữ</option><option value="male">Nam</option><option value="other">Khác</option></select></label>
      <label>Số điện thoại<input name="phone" required inputMode="tel" defaultValue={profile.phone ?? ""} /></label>
      <label>Khoa<select value={facultyId} onChange={(event) => {setFacultyId(event.target.value);setProgramId("");setCohortId("");setClassId("");}} required><option value="">Chọn Khoa</option>{faculties.map((row) => <option key={row.faculty_id} value={row.faculty_id}>{row.faculty_name}</option>)}</select></label>
      <label>Ngành<select value={programId} onChange={(event) => {setProgramId(event.target.value);setCohortId("");setClassId("");}} required disabled={!facultyId}><option value="">Chọn Ngành</option>{programs.map((row) => <option key={row.program_id} value={row.program_id}>{row.program_name}</option>)}</select></label>
      <label>Khóa<select value={cohortId} onChange={(event) => {setCohortId(event.target.value);setClassId("");}} required disabled={!programId}><option value="">Chọn Khóa</option>{cohorts.map((row) => <option key={row.cohort_id} value={row.cohort_id}>{row.cohort_name}</option>)}</select></label>
      <label>Lớp<select name="classId" required value={classId} onChange={(event) => setClassId(event.target.value)} disabled={!cohortId}><option value="">Chọn Lớp</option>{classes.map((row) => <option key={row.class_id} value={row.class_id}>{row.class_code} — {row.class_name}</option>)}</select></label>
      <div className="full"><button className="primary" disabled={pending || catalog.length === 0 || !email?.verified_at}>{pending ? "Đang lưu…" : "Lưu hồ sơ cơ bản"}</button></div>
    </form>
    {message && <p className="notice" aria-live="polite">{message}</p>}
  </div>;
}
