-- Seed form template: Đăng ký Lớp bồi dưỡng nhận thức Đoàn TNCS Hồ Chí Minh
-- Source: Google Apps Script form [YUM] CẢM TÌNH ĐOÀN
-- Questions include: personal info (prefilled from student profile), identity,
-- address (text input; cascade dropdown not yet supported in form viewer),
-- academic info (prefilled), and motivation (free text).
--
-- Skipped automatically on supabase db reset (no accounts yet).
-- Re-run after first user registration to seed into existing DB.

do $$
declare
  v_creator uuid;
  v_tmpl_id uuid := 'f0000000-c45d-0000-0000-000000000001';
  v_ver_id  uuid := 'f0000000-c45d-0000-0000-000000000002';
  v_questions jsonb;
begin
  select user_id into v_creator from public.accounts limit 1;
  if v_creator is null then return; end if;
  if exists (select 1 from public.form_templates where id = v_tmpl_id) then return; end if;

  v_questions := $q$[
    {
      "id": "q-ctd-01", "type": "short_text",
      "label": "Họ và tên", "required": true, "order": 0,
      "prefill_from": "profile.full_name", "base_question": true
    },
    {
      "id": "q-ctd-02", "type": "short_text",
      "label": "Mã số sinh viên", "required": true, "order": 1,
      "prefill_from": "profile.student_code", "base_question": true
    },
    {
      "id": "q-ctd-03", "type": "short_text",
      "label": "Số điện thoại", "required": true, "order": 2,
      "prefill_from": "profile.phone",
      "validation": { "format": "phone" },
      "base_question": true
    },
    {
      "id": "q-ctd-04", "type": "single_choice",
      "label": "Giới tính", "required": true, "order": 3,
      "prefill_from": "profile.gender",
      "options": [
        { "id": "male",   "label": "Nam",  "order": 0 },
        { "id": "female", "label": "Nữ",   "order": 1 },
        { "id": "other",  "label": "Khác", "order": 2 }
      ],
      "base_question": true
    },
    {
      "id": "q-ctd-05", "type": "date",
      "label": "Ngày sinh", "required": true, "order": 4,
      "base_question": true
    },
    {
      "id": "q-ctd-06", "type": "dropdown",
      "label": "Dân tộc", "required": true, "order": 5,
      "options": [
        { "id": "Ba Na",          "label": "Ba Na",          "order": 0  },
        { "id": "Bố Y",           "label": "Bố Y",           "order": 1  },
        { "id": "Brâu",           "label": "Brâu",           "order": 2  },
        { "id": "Bru - Vân Kiều", "label": "Bru - Vân Kiều", "order": 3  },
        { "id": "Cadong",         "label": "Cadong",         "order": 4  },
        { "id": "Cao Lan",        "label": "Cao Lan",        "order": 5  },
        { "id": "Chăm",           "label": "Chăm",           "order": 6  },
        { "id": "Chơ Ro",         "label": "Chơ Ro",         "order": 7  },
        { "id": "Chu Ru",         "label": "Chu Ru",         "order": 8  },
        { "id": "Chứt",           "label": "Chứt",           "order": 9  },
        { "id": "Co",             "label": "Co",             "order": 10 },
        { "id": "Cống",           "label": "Cống",           "order": 11 },
        { "id": "Cơ Ho",          "label": "Cơ Ho",          "order": 12 },
        { "id": "Cờ Lao",         "label": "Cờ Lao",         "order": 13 },
        { "id": "Cơ Tu",          "label": "Cơ Tu",          "order": 14 },
        { "id": "Dao",            "label": "Dao",            "order": 15 },
        { "id": "Ê đê",           "label": "Ê đê",           "order": 16 },
        { "id": "Giáy",           "label": "Giáy",           "order": 17 },
        { "id": "Gỉe Triêng",     "label": "Gỉe Triêng",     "order": 18 },
        { "id": "Hà Nhì",         "label": "Hà Nhì",         "order": 19 },
        { "id": "Hoa",            "label": "Hoa",            "order": 20 },
        { "id": "Hrê",            "label": "Hrê",            "order": 21 },
        { "id": "Jarai",          "label": "Jarai",          "order": 22 },
        { "id": "Jrai",           "label": "Jrai",           "order": 23 },
        { "id": "Kháng",          "label": "Kháng",          "order": 24 },
        { "id": "Không xác định", "label": "Không xác định", "order": 25 },
        { "id": "Khơ Me",         "label": "Khơ Me",         "order": 26 },
        { "id": "Khơ Mú",         "label": "Khơ Mú",         "order": 27 },
        { "id": "Kinh",           "label": "Kinh",           "order": 28 },
        { "id": "La Chí",         "label": "La Chí",         "order": 29 },
        { "id": "La Ha",          "label": "La Ha",          "order": 30 },
        { "id": "La Hủ",          "label": "La Hủ",          "order": 31 },
        { "id": "Lào",            "label": "Lào",            "order": 32 },
        { "id": "Lô Lô",          "label": "Lô Lô",          "order": 33 },
        { "id": "Lự",             "label": "Lự",             "order": 34 },
        { "id": "Mạ",             "label": "Mạ",             "order": 35 },
        { "id": "Mảng",           "label": "Mảng",           "order": 36 },
        { "id": "Mèo",            "label": "Mèo",            "order": 37 },
        { "id": "Mnông",          "label": "Mnông",          "order": 38 },
        { "id": "Mông",           "label": "Mông",           "order": 39 },
        { "id": "Mường",          "label": "Mường",          "order": 40 },
        { "id": "Ngái",           "label": "Ngái",           "order": 41 },
        { "id": "Nùng",           "label": "Nùng",           "order": 42 },
        { "id": "Ơ Đu",           "label": "Ơ Đu",           "order": 43 },
        { "id": "Pà Thẻn",        "label": "Pà Thẻn",        "order": 44 },
        { "id": "Phú Lá",         "label": "Phú Lá",         "order": 45 },
        { "id": "Pu Péo",         "label": "Pu Péo",         "order": 46 },
        { "id": "Ra Glai",        "label": "Ra Glai",        "order": 47 },
        { "id": "Rơ Măm",         "label": "Rơ Măm",         "order": 48 },
        { "id": "S Tiêng",        "label": "S Tiêng",        "order": 49 },
        { "id": "Sán Chay",       "label": "Sán Chay",       "order": 50 },
        { "id": "Sán Chỉ",        "label": "Sán Chỉ",        "order": 51 },
        { "id": "Sán Dìu",        "label": "Sán Dìu",        "order": 52 },
        { "id": "Si La",          "label": "Si La",          "order": 53 },
        { "id": "Tà Ôi",          "label": "Tà Ôi",          "order": 54 },
        { "id": "Tày",            "label": "Tày",            "order": 55 },
        { "id": "Thái",           "label": "Thái",           "order": 56 },
        { "id": "Thổ",            "label": "Thổ",            "order": 57 },
        { "id": "T'Rin",          "label": "T'Rin",          "order": 58 },
        { "id": "Xinh Mun",       "label": "Xinh Mun",       "order": 59 },
        { "id": "Xơ Đăng",        "label": "Xơ Đăng",        "order": 60 }
      ],
      "base_question": true
    },
    {
      "id": "q-ctd-07", "type": "dropdown",
      "label": "Tôn giáo", "required": true, "order": 6,
      "options": [
        { "id": "Bà La Môn",                         "label": "Bà La Môn",                         "order": 0  },
        { "id": "Bahá'í",                            "label": "Bahá'í",                            "order": 1  },
        { "id": "Bửu sơn Kỳ hương",                  "label": "Bửu sơn Kỳ hương",                  "order": 2  },
        { "id": "Cao Đài",                           "label": "Cao Đài",                           "order": 3  },
        { "id": "Công giáo",                         "label": "Công giáo",                         "order": 4  },
        { "id": "Đạo Tứ ấn hiếu nghĩa",             "label": "Đạo Tứ ấn hiếu nghĩa",             "order": 5  },
        { "id": "Hòa Hảo",                           "label": "Hòa Hảo",                           "order": 6  },
        { "id": "Hồi giáo",                          "label": "Hồi giáo",                          "order": 7  },
        { "id": "Không",                             "label": "Không",                             "order": 8  },
        { "id": "Minh Lý Đạo",                       "label": "Minh Lý Đạo",                       "order": 9  },
        { "id": "Minh Sư Đạo",                       "label": "Minh Sư Đạo",                       "order": 10 },
        { "id": "Phật giáo",                         "label": "Phật giáo",                         "order": 11 },
        { "id": "Tin Lành",                          "label": "Tin Lành",                          "order": 12 },
        { "id": "Tịnh độ cư sĩ Phật hội Việt Nam",  "label": "Tịnh độ cư sĩ Phật hội Việt Nam",  "order": 13 }
      ],
      "base_question": true
    },
    {
      "id": "q-ctd-08", "type": "short_text",
      "label": "Số Căn cước công dân", "required": true, "order": 7,
      "validation": { "minLength": 9, "maxLength": 12 },
      "base_question": true
    },
    {
      "id": "q-ctd-09", "type": "date",
      "label": "Ngày cấp Căn cước", "required": true, "order": 8,
      "base_question": true
    },
    {
      "id": "q-ctd-10", "type": "short_text",
      "label": "Nơi cấp Căn cước", "required": true, "order": 9,
      "base_question": true
    },
    {
      "id": "q-ctd-11", "type": "short_text",
      "label": "Quê quán — Tỉnh/thành phố",
      "description": "Nhập tên tỉnh/thành phố quê quán",
      "required": true, "order": 10,
      "base_question": true
    },
    {
      "id": "q-ctd-12", "type": "short_text",
      "label": "Quê quán — Phường/xã/thị trấn",
      "required": true, "order": 11,
      "base_question": true
    },
    {
      "id": "q-ctd-13", "type": "short_text",
      "label": "Thường trú — Tỉnh/thành phố",
      "description": "Nhập tên tỉnh/thành phố hộ khẩu thường trú",
      "required": true, "order": 12,
      "base_question": true
    },
    {
      "id": "q-ctd-14", "type": "short_text",
      "label": "Thường trú — Phường/xã/thị trấn",
      "required": true, "order": 13,
      "base_question": true
    },
    {
      "id": "q-ctd-15", "type": "short_text",
      "label": "Khoa", "required": true, "order": 14,
      "prefill_from": "profile.faculty_name",
      "base_question": true
    },
    {
      "id": "q-ctd-16", "type": "short_text",
      "label": "Ngành học", "required": true, "order": 15,
      "prefill_from": "profile.program_name",
      "base_question": true
    },
    {
      "id": "q-ctd-17", "type": "short_text",
      "label": "Lớp", "required": true, "order": 16,
      "prefill_from": "profile.class_code",
      "base_question": true
    },
    {
      "id": "q-ctd-18", "type": "short_text",
      "label": "Khóa", "required": true, "order": 17,
      "prefill_from": "profile.cohort_code",
      "base_question": true
    },
    {
      "id": "q-ctd-19", "type": "long_text",
      "label": "Nguyện vọng / Lý do tham gia",
      "description": "Trình bày nguyện vọng và lý do muốn tham gia lớp bồi dưỡng nhận thức Đoàn (không bắt buộc)",
      "required": false, "order": 18,
      "base_question": true
    }
  ]$q$::jsonb;

  insert into public.form_templates (id, title, description, audience_rule, status, created_by)
  values (
    v_tmpl_id,
    'Đăng ký Lớp bồi dưỡng nhận thức Đoàn TNCS Hồ Chí Minh',
    'Biểu mẫu đăng ký tham gia lớp cảm tình Đoàn. Thông tin cá nhân và học vụ được tự động điền từ hồ sơ sinh viên.',
    '{"type":"hiu_student"}'::jsonb,
    'published',
    v_creator
  );

  insert into public.form_template_versions (id, template_id, version_number, questions, notes, published_by)
  values (
    v_ver_id,
    v_tmpl_id,
    1,
    v_questions,
    'Import từ Google Forms CẢM TÌNH ĐOÀN — 10/10/2026',
    v_creator
  );
end $$;
