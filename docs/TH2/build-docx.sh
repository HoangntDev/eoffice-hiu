#!/usr/bin/env bash
# Dựng BaoCao_TH2.docx từ BaoCao_TH2.md (cùng cách với docs/TH1/build-docx.sh).
# - Ảnh chưa ghi kích thước được co theo bề rộng khung chữ A4 (16 cm) trong một bản tạm,
#   rồi chuyển .docx bằng pandoc (Docker pandoc/core).
# - Đặt khổ giấy A4 dọc (lề trái 3 cm, các lề khác 2 cm) cho .docx.
# Báo cáo TH2 không có khối mermaid, nên không cần bước render sơ đồ.
# Cần Docker, node, zip/unzip; không cài pandoc vào máy.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p .build

# 1. Co ảnh chụp màn hình (không có kích thước) theo bề rộng khung chữ.
node - <<'JS'
const fs = require("fs");
const src = fs.readFileSync("BaoCao_TH2.md", "utf8");
const sized = src.replace(/(!\[[^\]]*\]\([^)]+\))(?!\{)/g, "$1{width=16cm}");
fs.writeFileSync(".build/BaoCao_TH2.docx.md", sized);
JS

# 2. Chuyển .docx. Gắn cả repo để báo cáo dùng được ảnh ở thư mục ngoài docs/TH2 nếu cần.
docker run --rm -u "$(id -u):$(id -g)" -v "$(cd ../.. && pwd):/repo" -w /repo/docs/TH2 pandoc/core:3.6 \
  .build/BaoCao_TH2.docx.md -f markdown+lists_without_preceding_blankline -o BaoCao_TH2.docx \
  --resource-path=.:.build --toc --toc-depth=2 -M toc-title="Mục lục"

# 3. Khổ A4 dọc: pandoc không ghi <w:sectPr>, nên chèn vào cuối word/document.xml
(
  cd .build
  unzip -q ../BaoCao_TH2.docx word/document.xml
  node -e '
    const fs = require("fs");
    const p = "word/document.xml";
    const sect = "<w:sectPr><w:pgSz w:w=\"11906\" w:h=\"16838\"/>" +
      "<w:pgMar w:top=\"1134\" w:right=\"1134\" w:bottom=\"1134\" w:left=\"1701\" w:header=\"709\" w:footer=\"709\" w:gutter=\"0\"/></w:sectPr>";
    fs.writeFileSync(p, fs.readFileSync(p, "utf8").replace("</w:body>", sect + "</w:body>"));'
  zip -q ../BaoCao_TH2.docx word/document.xml
)
rm -rf .build
echo "OK: $(pwd)/BaoCao_TH2.docx"
