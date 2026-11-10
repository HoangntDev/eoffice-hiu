# So sánh v1.0.0 và v1.1.0

Các lệnh chạy ngày 10/11/2026 trên tag đã phát hành:

```text
git log --first-parent --oneline v1.0.0..v1.1.0
git diff --stat v1.0.0 v1.1.0
```

Kết quả tóm tắt: 22 merge commit trên first-parent; 340 file thay đổi, 16.106 dòng
thêm và 316 dòng xóa. Phạm vi này gồm toàn bộ TH2, TH3 và CR-01 đã vào `main` giữa
hai tag, không chỉ riêng code tài khoản tổ chức. Output đầy đủ nằm trong
`first-parent.log` và `diff-stat.log`; thay đổi dependency nằm trong
`package-json.diff`.
