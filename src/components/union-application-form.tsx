"use client";

import { useEffect, useMemo, useState } from "react";
import { applicationStatusLabel } from "@/modules/union-membership/labels";

type Option = { id: string; category: string; code: string; label: string; parent_code?: string | null };
type Existing = {
  application?: { status?: string; decision_reason?: string };
  identity?: Record<string, string>;
  membership?: Record<string, string>;
  qualifications?: Record<string, string>;
};

const qualificationFields = [
  ["educationLevelId",    "education_level_id",  "education_level",  "Trình độ văn hóa"],
  ["specializationId",    "specialization_id",   "specialization",   "Trình độ chuyên môn"],
  ["politicalTheoryId",   "political_theory_id", "political_theory", "Trình độ lý luận chính trị"],
  ["itLevelId",           "it_level_id",         "it_level",         "Trình độ tin học"],
  ["foreignLanguageId",   "foreign_language_id", "foreign_language", "Trình độ ngoại ngữ"],
  ["occupationId",        "occupation_id",       "occupation",       "Nghề nghiệp hiện nay"],
] as const;

const qualificationCategories = qualificationFields.map(([,, cat]) => cat);

export function UnionApplicationForm() {
  const [options, setOptions] = useState<Option[]>([]);
  const [existing, setExisting] = useState<Existing>({});
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [hometownProvinceCode, setHometownProvinceCode] = useState("");
  const [permanentProvinceCode, setPermanentProvinceCode] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const [a, c] = await Promise.all([
          fetch("/api/union-membership?cycle=2026-2027"),
          fetch("/api/catalog"),
        ]);
        const ad = await a.json(), cd = await c.json();
        if (!a.ok || !c.ok) throw new Error(ad.message ?? cd.message ?? "Không thể tải hồ sơ.");
        setExisting(ad);
        setOptions(cd.referenceOptions ?? []);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Không thể tải hồ sơ.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const missingQualCategories = useMemo(
    () => qualificationCategories.filter((cat) => !options.some((o) => o.category === cat)),
    [options],
  );
  const editable = !existing.application?.status || ["draft", "needs_changes"].includes(existing.application.status);
  const v = (group: "identity" | "membership" | "qualifications", key: string) => existing[group]?.[key] ?? "";

  function opts(category: string) {
    return options.filter((o) => o.category === category);
  }

  async function submit(form: HTMLFormElement, shouldSubmit: boolean) {
    setPending(true); setMessage(""); setError("");
    const raw = Object.fromEntries(new FormData(form));
    const body = {
      cycleKey: "2026-2027",
      submit: shouldSubmit,
      identity: {
        dateOfBirth: raw.dateOfBirth,
        ethnicity: raw.ethnicity,
        religion: raw.religion,
        citizenId: raw.citizenId,
        citizenIssuedOn: raw.citizenIssuedOn,
        citizenIssuedBy: raw.citizenIssuedBy,
        hometownProvinceCode: raw.hometownProvinceCode ?? "",
        hometownProvinceName: raw.hometownProvinceName,
        hometownWardCode: "",
        hometownWardName: raw.hometownWardName,
        permanentProvinceCode: raw.permanentProvinceCode ?? "",
        permanentProvinceName: raw.permanentProvinceName,
        permanentWardCode: "",
        permanentWardName: raw.permanentWardName,
      },
      membership: {
        joinedUnionOn: raw.joinedUnionOn,
        joinedUnionAt: raw.joinedUnionAt,
        admissionResolutionNumber: raw.admissionResolutionNumber,
        unionCardNumber: raw.unionCardNumber,
        joinedPartyOn: raw.joinedPartyOn,
      },
      qualifications: Object.fromEntries(qualificationFields.map(([field]) => [field, raw[field]])),
    };
    try {
      const response = await fetch("/api/union-membership", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "Không thể lưu hồ sơ.");
      setMessage(result.message);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể lưu hồ sơ.");
    } finally {
      setPending(false);
    }
  }

  if (loading) return <p className="notice">Đang tải hồ sơ Đoàn viên…</p>;

  return (
    <div className="panel">
      {existing.application?.status && (
        <p>Trạng thái: <span className="status">{applicationStatusLabel(existing.application.status)}</span></p>
      )}
      {existing.application?.decision_reason && (
        <p className="notice warning">Yêu cầu xử lý: {existing.application.decision_reason}</p>
      )}
      {missingQualCategories.length > 0 && (
        <p className="notice warning">
          Chưa có dữ liệu cho {missingQualCategories.length} danh mục trình độ. Người vận hành phải nạp trước khi có thể nộp.
        </p>
      )}
      {error && <p className="notice error" role="alert">{error}</p>}

      <form onSubmit={(e) => { e.preventDefault(); void submit(e.currentTarget, false); }}>

        {/* ── 1. Căn cước ── */}
        <fieldset disabled={!editable}>
          <legend>1. Hồ sơ căn cước</legend>
          <div className="form-grid">
            <label>Ngày sinh *
              <input name="dateOfBirth" type="date" required defaultValue={v("identity", "date_of_birth")} />
            </label>

            <label>Dân tộc *
              <select name="ethnicity" required defaultValue={v("identity", "ethnicity")}>
                <option value="">Chọn dân tộc</option>
                {opts("ethnicity").map((o) => <option key={o.id} value={o.label}>{o.label}</option>)}
              </select>
            </label>

            <label>Tôn giáo *
              <select name="religion" required defaultValue={v("identity", "religion")}>
                <option value="">Chọn tôn giáo</option>
                {opts("religion").map((o) => <option key={o.id} value={o.label}>{o.label}</option>)}
              </select>
            </label>

            <label>Số Căn cước *
              <input name="citizenId" inputMode="numeric" pattern="[0-9]{9,12}" required defaultValue={v("identity", "citizen_id")} />
            </label>

            <label>Ngày cấp *
              <input name="citizenIssuedOn" type="date" required defaultValue={v("identity", "citizen_issued_on")} />
            </label>

            <label>Nơi cấp *
              <input name="citizenIssuedBy" required defaultValue={v("identity", "citizen_issued_by")} />
            </label>

            <ProvinceSelect
              label="Tỉnh/thành quê quán *"
              nameCode="hometownProvinceCode"
              nameName="hometownProvinceName"
              defaultCode={v("identity", "hometown_province_code")}
              defaultName={v("identity", "hometown_province_name")}
              provinces={opts("province")}
              onProvinceChange={setHometownProvinceCode}
            />

            <WardSelect
              label="Phường/xã quê quán *"
              nameName="hometownWardName"
              defaultName={v("identity", "hometown_ward_name")}
              provinceCode={hometownProvinceCode || v("identity", "hometown_province_code")}
              wards={opts("ward")}
            />

            <ProvinceSelect
              label="Tỉnh/thành thường trú *"
              nameCode="permanentProvinceCode"
              nameName="permanentProvinceName"
              defaultCode={v("identity", "permanent_province_code")}
              defaultName={v("identity", "permanent_province_name")}
              provinces={opts("province")}
              onProvinceChange={setPermanentProvinceCode}
            />

            <WardSelect
              label="Phường/xã thường trú *"
              nameName="permanentWardName"
              defaultName={v("identity", "permanent_ward_name")}
              provinceCode={permanentProvinceCode || v("identity", "permanent_province_code")}
              wards={opts("ward")}
            />
          </div>
        </fieldset>

        {/* ── 2. Thông tin Đoàn viên ── */}
        <fieldset disabled={!editable}>
          <legend>2. Thông tin Đoàn viên</legend>
          <div className="form-grid">
            <label>Ngày vào Đoàn *
              <input name="joinedUnionOn" type="date" required defaultValue={v("membership", "joined_union_on")} />
            </label>
            <label>Nơi vào Đoàn *
              <input name="joinedUnionAt" required defaultValue={v("membership", "joined_union_at")} />
            </label>
            <label>Số nghị quyết chuẩn y
              <input name="admissionResolutionNumber" defaultValue={v("membership", "admission_resolution_number")} />
            </label>
            <label>Số thẻ Đoàn viên
              <input name="unionCardNumber" defaultValue={v("membership", "union_card_number")} />
            </label>
            <label>Ngày vào Đảng
              <input name="joinedPartyOn" type="date" defaultValue={v("membership", "joined_party_on")} />
            </label>
          </div>
        </fieldset>

        {/* ── 3. Trình độ ── */}
        <fieldset disabled={!editable}>
          <legend>3. Trình độ và chuyên môn</legend>
          <div className="form-grid">
            {qualificationFields.map(([field, stored, category, label]) => (
              <label key={field}>{label} *
                <select name={field} required defaultValue={v("qualifications", stored)}>
                  <option value="">Chọn từ danh mục chính thức</option>
                  {opts(category).map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="inline">
          <button className="secondary" disabled={pending || !editable || missingQualCategories.length > 0}>
            Lưu bản nháp
          </button>
          <button
            className="primary"
            type="button"
            disabled={pending || !editable || missingQualCategories.length > 0}
            onClick={(e) => { if (e.currentTarget.form) void submit(e.currentTarget.form, true); }}
          >
            Nộp hồ sơ
          </button>
        </div>
      </form>

      {message && <p className="notice" aria-live="polite">{message}</p>}
    </div>
  );
}

/* ── Province selector ── */
function ProvinceSelect({
  label, nameCode, nameName, defaultCode, defaultName, provinces, onProvinceChange,
}: {
  label: string;
  nameCode: string;
  nameName: string;
  defaultCode: string;
  defaultName: string;
  provinces: Option[];
  onProvinceChange?: (code: string) => void;
}) {
  const initial = provinces.find((p) => p.code === defaultCode || p.label === defaultName);
  const [selected, setSelected] = useState<Option | undefined>(initial);

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const found = provinces.find((p) => p.code === e.target.value);
    setSelected(found);
    onProvinceChange?.(found?.code ?? "");
  }

  return (
    <label>{label}
      <input type="hidden" name={nameCode} value={selected?.code ?? ""} />
      <input type="hidden" name={nameName} value={selected?.label ?? ""} />
      <select required value={selected?.code ?? ""} onChange={handleChange}>
        <option value="">Chọn tỉnh/thành phố</option>
        {provinces.map((p) => <option key={p.id} value={p.code}>{p.label}</option>)}
      </select>
    </label>
  );
}

/* ── Ward selector: filters by province code via parent_code ── */
function WardSelect({
  label, nameName, defaultName, provinceCode, wards,
}: {
  label: string;
  nameName: string;
  defaultName: string;
  provinceCode: string;
  wards: Option[];
}) {
  const filtered = wards.filter((w) => w.parent_code === provinceCode);
  const initial = filtered.find((w) => w.label === defaultName);
  const [selected, setSelected] = useState<Option | undefined>(initial);
  const [prevProvinceCode, setPrevProvinceCode] = useState(provinceCode);

  // Reset the ward when the province changes (adjust state during render, no effect).
  if (prevProvinceCode !== provinceCode) {
    setPrevProvinceCode(provinceCode);
    setSelected(initial);
  }

  return (
    <label>{label}
      <input type="hidden" name={nameName} value={selected?.label ?? ""} />
      <select
        required
        value={selected?.code ?? ""}
        disabled={!provinceCode}
        onChange={(e) => setSelected(filtered.find((w) => w.code === e.target.value))}
      >
        <option value="">{provinceCode ? "Chọn phường/xã/thị trấn" : "Chọn tỉnh/thành trước"}</option>
        {filtered.map((w) => <option key={w.id} value={w.code}>{w.label}</option>)}
      </select>
    </label>
  );
}
