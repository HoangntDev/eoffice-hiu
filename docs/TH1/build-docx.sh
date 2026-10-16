#!/usr/bin/env bash
# Dựng BaoCao_TH1.docx từ BaoCao_TH1.md.
# - Render các khối ```mermaid ra diagrams/NN-*.png (Docker minlag/mermaid-cli).
# - Thay khối mermaid bằng ảnh PNG trong một bản tạm rồi chuyển .docx bằng pandoc (Docker pandoc/core).
# Chỉ cần Docker; không cài pandoc/mermaid vào máy.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p diagrams .build
names=(use-case sequence-diem-danh-qr erd module-dependency)
node - "${names[@]}" <<'JS'
const fs = require("fs");
const names = process.argv.slice(2);
const src = fs.readFileSync("BaoCao_TH1.md", "utf8");
let i = 0;
const out = src.replace(/```mermaid\n([\s\S]*?)```/g, (_, body) => {
  const name = `${String(i + 1).padStart(2, "0")}-${names[i] ?? "diagram"}`;
  fs.writeFileSync(`diagrams/${name}.mmd`, body);
  i += 1;
  return `![](diagrams/${name}.png)`;
});
fs.writeFileSync(".build/BaoCao_TH1.docx.md", out);
console.log(`mermaid blocks: ${i}`);
JS
for f in diagrams/*.mmd; do
  docker run --rm -u "$(id -u):$(id -g)" -v "$PWD:/data" minlag/mermaid-cli:11.4.2 \
    -i "/data/$f" -o "/data/${f%.mmd}.png" -b white -w 1600 -s 2 >/dev/null
done
docker run --rm -u "$(id -u):$(id -g)" -v "$PWD:/data" -w /data pandoc/core:3.6 \
  .build/BaoCao_TH1.docx.md -o BaoCao_TH1.docx --resource-path=.:.build --toc --toc-depth=2
rm -rf .build
echo "OK: $(pwd)/BaoCao_TH1.docx"
