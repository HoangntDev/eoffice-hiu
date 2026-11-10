#!/usr/bin/env bash
# Dựng BaoCao_TH4.docx theo cùng quy trình và phong cách của báo cáo TH3.
# Dùng Docker pandoc/core; không cài pandoc hay công cụ PDF lên máy.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p .build

# Co ảnh theo bề rộng khung chữ A4 và giữ Markdown gốc không đổi.
node - <<'JS'
const fs = require("fs");
const src = fs.readFileSync("BaoCao_TH4.md", "utf8");
const sized = src.replace(/(!\[[^\]]*\]\([^)]+\))(?!\{)/g, "$1{width=16cm}");
fs.writeFileSync(".build/BaoCao_TH4.docx.md", sized);
JS

docker run --rm -u "$(id -u):$(id -g)" -v "$(cd ../.. && pwd):/repo" \
  -w /repo/docs/TH4 pandoc/core:3.6 \
  .build/BaoCao_TH4.docx.md -f markdown+lists_without_preceding_blankline \
  -o BaoCao_TH4.docx --resource-path=.:.build --toc --toc-depth=2 \
  -M toc-title="Mục lục" --reference-doc=../TH3/BaoCao_TH3.docx

# Đặt khổ A4 dọc và yêu cầu Word cập nhật trường mục lục khi mở file.
(
  cd .build
  unzip -q ../BaoCao_TH4.docx word/document.xml word/settings.xml
  node -e '
    const fs = require("fs");
    const p = "word/document.xml";
    const sect = "<w:sectPr><w:pgSz w:w=\"11906\" w:h=\"16838\"/>" +
      "<w:pgMar w:top=\"1134\" w:right=\"1134\" w:bottom=\"1134\" w:left=\"1701\" w:header=\"709\" w:footer=\"709\" w:gutter=\"0\"/></w:sectPr>";
    fs.writeFileSync(p, fs.readFileSync(p, "utf8").replace("</w:body>", sect + "</w:body>"));'
  node -e '
    const fs = require("fs");
    const p = "word/settings.xml";
    const s = fs.readFileSync(p, "utf8");
    if (!s.includes("w:updateFields")) fs.writeFileSync(p, s.replace(/<w:settings([^>]*)>/, "<w:settings$1><w:updateFields w:val=\"true\"/>"));'
  zip -q ../BaoCao_TH4.docx word/document.xml word/settings.xml
)

rm -rf .build
echo "OK: $(pwd)/BaoCao_TH4.docx"
