#!/usr/bin/env bash
# Dựng BaoCao_TH1.docx từ BaoCao_TH1.md.
# - Render các khối ```mermaid ra diagrams/NN-*.png (Docker minlag/mermaid-cli).
# - Thay khối mermaid bằng ảnh PNG (kèm kích thước vừa khung chữ A4) trong một bản tạm,
#   rồi chuyển .docx bằng pandoc (Docker pandoc/core).
# - Đặt khổ giấy A4 dọc (lề trái 3 cm, các lề khác 2 cm) cho .docx.
# Cần Docker, node, zip/unzip; không cài pandoc/mermaid vào máy.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p diagrams .build
rm -f diagrams/*.mmd
names=(use-case sequence-diem-danh-qr erd-tai-khoan-to-chuc erd-doan-vien-bieu-mau erd-chuong-trinh-diem-danh module-dependency)

# 1. Tách khối mermaid ra diagrams/*.mmd
node - "${names[@]}" <<'JS'
const fs = require("fs");
const names = process.argv.slice(2);
const src = fs.readFileSync("BaoCao_TH1.md", "utf8");
let i = 0;
src.replace(/```mermaid\n([\s\S]*?)```/g, (_, body) => {
  fs.writeFileSync(`diagrams/${String(i + 1).padStart(2, "0")}-${names[i] ?? "diagram"}.mmd`, body);
  i += 1;
});
console.log(`mermaid blocks: ${i}`);
JS

# 2. Render PNG
for f in diagrams/*.mmd; do
  docker run --rm -u "$(id -u):$(id -g)" -v "$PWD:/data" minlag/mermaid-cli:11.12.0 \
    -i "/data/$f" -o "/data/${f%.mmd}.png" -b white -w 1600 -s 2 >/dev/null
done

# 3. Thay khối mermaid bằng ảnh; co ảnh để vừa khung chữ A4 (16 cm x 22 cm)
node - "${names[@]}" <<'JS'
const fs = require("fs");
const names = process.argv.slice(2);
const src = fs.readFileSync("BaoCao_TH1.md", "utf8");
let i = 0;
const out = src.replace(/```mermaid\n[\s\S]*?```/g, () => {
  const file = `diagrams/${String(i + 1).padStart(2, "0")}-${names[i] ?? "diagram"}.png`;
  i += 1;
  const png = fs.readFileSync(file);
  const w = png.readUInt32BE(16), h = png.readUInt32BE(20);
  const size = w / h >= 16 / 22 ? "width=16cm" : `height=22cm`;
  return `![](${file}){${size}}`;
});
// Ảnh chụp màn hình (không có kích thước) cũng co theo bề rộng khung chữ.
const sized = out.replace(/(!\[[^\]]*\]\([^)]+\))(?!\{)/g, "$1{width=16cm}");
fs.writeFileSync(".build/BaoCao_TH1.docx.md", sized);
JS

# Gắn cả repo để báo cáo dùng được ảnh ở thư mục ngoài docs/TH1 nếu cần.
docker run --rm -u "$(id -u):$(id -g)" -v "$(cd ../.. && pwd):/repo" -w /repo/docs/TH1 pandoc/core:3.6 \
  .build/BaoCao_TH1.docx.md -f markdown+lists_without_preceding_blankline -o BaoCao_TH1.docx \
  --resource-path=.:.build --toc --toc-depth=2 -M toc-title="Mục lục"

# 4. Khổ A4 dọc: pandoc không ghi <w:sectPr>, nên chèn vào cuối word/document.xml
(
  cd .build
  unzip -q ../BaoCao_TH1.docx word/document.xml
  node -e '
    const fs = require("fs");
    const p = "word/document.xml";
    const sect = "<w:sectPr><w:pgSz w:w=\"11906\" w:h=\"16838\"/>" +
      "<w:pgMar w:top=\"1134\" w:right=\"1134\" w:bottom=\"1134\" w:left=\"1701\" w:header=\"709\" w:footer=\"709\" w:gutter=\"0\"/></w:sectPr>";
    fs.writeFileSync(p, fs.readFileSync(p, "utf8").replace("</w:body>", sect + "</w:body>"));'
  zip -q ../BaoCao_TH1.docx word/document.xml
)
rm -rf .build
echo "OK: $(pwd)/BaoCao_TH1.docx"
