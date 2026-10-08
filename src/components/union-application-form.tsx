"use client";

import { useEffect, useMemo, useState } from "react";

type Option = {id:string;category:string;label:string};
type Existing = {application?:{status?:string;decision_reason?:string};identity?:Record<string,string>;membership?:Record<string,string>;qualifications?:Record<string,string>};
const categories = ["education_level","specialization","political_theory","it_level","foreign_language","occupation"] as const;
const qualificationFields = [
  ["educationLevelId","education_level_id","education_level","Trình độ văn hóa"],
  ["specializationId","specialization_id","specialization","Chuyên môn"],
  ["politicalTheoryId","political_theory_id","political_theory","Lý luận chính trị"],
  ["itLevelId","it_level_id","it_level","Tin học"],
  ["foreignLanguageId","foreign_language_id","foreign_language","Ngoại ngữ"],
  ["occupationId","occupation_id","occupation","Nghề nghiệp hiện nay"],
] as const;

export function UnionApplicationForm() {
  const [options,setOptions] = useState<Option[]>([]); const [existing,setExisting] = useState<Existing>({});
  const [loading,setLoading] = useState(true); const [pending,setPending] = useState(false);
  const [message,setMessage] = useState(""); const [error,setError] = useState("");
  useEffect(() => { void (async () => { try {
    const [a,c] = await Promise.all([fetch("/api/union-membership?cycle=2026-2027"),fetch("/api/catalog")]);
    const ad=await a.json(), cd=await c.json(); if(!a.ok||!c.ok) throw new Error(ad.message??cd.message??"Không thể tải hồ sơ.");
    setExisting(ad); setOptions(cd.referenceOptions??[]);
  } catch(reason){setError(reason instanceof Error?reason.message:"Không thể tải hồ sơ.");} finally{setLoading(false);} })(); },[]);
  const missingCategories = useMemo(() => categories.filter((category) => !options.some((option) => option.category === category)),[options]);
  const editable = !existing.application?.status || ["draft","needs_changes"].includes(existing.application.status);
  const v = (group:"identity"|"membership"|"qualifications", key:string) => existing[group]?.[key] ?? "";

  async function submit(form:HTMLFormElement, shouldSubmit:boolean) {
    setPending(true); setMessage(""); setError(""); const raw=Object.fromEntries(new FormData(form));
    const body={cycleKey:"2026-2027",submit:shouldSubmit,identity:{
      dateOfBirth:raw.dateOfBirth,ethnicity:raw.ethnicity,religion:raw.religion,citizenId:raw.citizenId,citizenIssuedOn:raw.citizenIssuedOn,citizenIssuedBy:raw.citizenIssuedBy,
      hometownProvinceCode:"",hometownProvinceName:raw.hometownProvinceName,hometownWardCode:"",hometownWardName:raw.hometownWardName,
      permanentProvinceCode:"",permanentProvinceName:raw.permanentProvinceName,permanentWardCode:"",permanentWardName:raw.permanentWardName,
    },membership:{joinedUnionOn:raw.joinedUnionOn,joinedUnionAt:raw.joinedUnionAt,admissionResolutionNumber:raw.admissionResolutionNumber,unionCardNumber:raw.unionCardNumber,joinedPartyOn:raw.joinedPartyOn},qualifications:Object.fromEntries(qualificationFields.map(([field])=>[field,raw[field]]))};
    try{const response=await fetch("/api/union-membership",{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify(body)});const result=await response.json();if(!response.ok)throw new Error(result.message??"Không thể lưu hồ sơ.");setMessage(result.message);}
    catch(reason){setError(reason instanceof Error?reason.message:"Không thể lưu hồ sơ.");}finally{setPending(false);}
  }
  if(loading)return <p className="notice">Đang tải hồ sơ Đoàn viên…</p>;
  return <div className="panel">
    {existing.application?.status&&<p>Trạng thái: <span className="status">{existing.application.status}</span></p>}
    {existing.application?.decision_reason&&<p className="notice warning">Yêu cầu xử lý: {existing.application.decision_reason}</p>}
    {missingCategories.length>0&&<p className="notice warning">Chưa có nguồn chính thức cho {missingCategories.length} danh mục trình độ/chuyên môn. Người vận hành phải nạp danh mục trước khi có thể nộp; hệ thống không tự bịa lựa chọn.</p>}
    {error&&<p className="notice error" role="alert">{error}</p>}
    <form onSubmit={(event)=>{event.preventDefault();void submit(event.currentTarget,false);}}>
      <fieldset disabled={!editable}><legend>1. Hồ sơ căn cước</legend><div className="form-grid">
        <label>Ngày sinh *<input name="dateOfBirth" type="date" required defaultValue={v("identity","date_of_birth")}/></label><label>Dân tộc *<input name="ethnicity" required defaultValue={v("identity","ethnicity")}/></label>
        <label>Tôn giáo *<input name="religion" required defaultValue={v("identity","religion")}/></label><label>Số Căn cước *<input name="citizenId" inputMode="numeric" pattern="[0-9]{9,12}" required defaultValue={v("identity","citizen_id")}/></label>
        <label>Ngày cấp *<input name="citizenIssuedOn" type="date" required defaultValue={v("identity","citizen_issued_on")}/></label><label>Nơi cấp *<input name="citizenIssuedBy" required defaultValue={v("identity","citizen_issued_by")}/></label>
        <label>Tỉnh/thành quê quán *<input name="hometownProvinceName" required defaultValue={v("identity","hometown_province_name")}/></label><label>Phường/xã quê quán *<input name="hometownWardName" required defaultValue={v("identity","hometown_ward_name")}/></label>
        <label>Tỉnh/thành thường trú *<input name="permanentProvinceName" required defaultValue={v("identity","permanent_province_name")}/></label><label>Phường/xã thường trú *<input name="permanentWardName" required defaultValue={v("identity","permanent_ward_name")}/></label>
      </div></fieldset>
      <fieldset disabled={!editable}><legend>2. Thông tin Đoàn viên</legend><div className="form-grid">
        <label>Ngày vào Đoàn *<input name="joinedUnionOn" type="date" required defaultValue={v("membership","joined_union_on")}/></label><label>Nơi vào Đoàn *<input name="joinedUnionAt" required defaultValue={v("membership","joined_union_at")}/></label>
        <label>Số nghị quyết chuẩn y<input name="admissionResolutionNumber" defaultValue={v("membership","admission_resolution_number")}/></label><label>Số thẻ Đoàn viên<input name="unionCardNumber" defaultValue={v("membership","union_card_number")}/></label>
        <label>Ngày vào Đảng<input name="joinedPartyOn" type="date" defaultValue={v("membership","joined_party_on")}/></label>
      </div></fieldset>
      <fieldset disabled={!editable}><legend>3. Trình độ và chuyên môn</legend><div className="form-grid">
        {qualificationFields.map(([field,stored,category,label])=><label key={field}>{label} *<select name={field} required defaultValue={v("qualifications",stored)}><option value="">Chọn từ danh mục chính thức</option>{options.filter((option)=>option.category===category).map((option)=><option key={option.id} value={option.id}>{option.label}</option>)}</select></label>)}
      </div></fieldset>
      <div className="inline"><button className="secondary" disabled={pending||!editable||missingCategories.length>0}>Lưu bản nháp</button><button className="primary" type="button" disabled={pending||!editable||missingCategories.length>0} onClick={(event)=>{if(event.currentTarget.form)void submit(event.currentTarget.form,true);}}>Nộp hồ sơ</button></div>
    </form>
    {message&&<p className="notice" aria-live="polite">{message}</p>}
  </div>;
}
