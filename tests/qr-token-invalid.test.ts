// Issue #61: token QR sai định dạng phải trả 422 QR_INVALID, không phải 500, và không gọi xuống database.
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/dal", () => ({
  requireUser: async () => ({ user: { id: "1b984dc1-8896-45b8-90a3-40a135ae07c5" }, supabase: { rpc } }),
}));

import { POST as checkIn } from "@/app/api/attendance/check-in/route";
import { attendanceRpcError } from "@/modules/program-attendance/errors";

const SESSION = "8cd2a9d5-f523-40d7-89ee-1dc8b071e6d6";
const SIG = "0123456789abcdef0123456789abcdef";

function post(token: string) {
  return checkIn(new Request("http://localhost/api/attendance/check-in", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sessionId: SESSION, token }),
  }));
}

afterEach(() => {
  rpc.mockReset();
  vi.restoreAllMocks();
});

describe("token QR sai định dạng (#61)", () => {
  it.each([
    ["phần đầu 36 số 0, không phải UUID", `${"0".repeat(36)}.1.1700000000000.${SIG}`],
    ["phần đầu toàn dấu gạch", `${"-".repeat(36)}.1.1700000000000.${SIG}`],
    ["không đúng cấu trúc 4 phần", "abc"],
  ])("%s → 422 QR_INVALID, không gọi RPC", async (_label, token) => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    rpc.mockResolvedValue({ data: null, error: { message: `invalid input syntax for type uuid: "${token.split(".")[0]}"` } });
    const response = await post(token);
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ error: "QR_INVALID" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("token đúng định dạng vẫn được chuyển cho database kiểm chữ ký", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    rpc.mockResolvedValue({ data: { record_id: "r1", session_label: "Lượt sáng", supplementary: false }, error: null });
    const response = await post(`${SESSION}.1.1700000000000.${SIG}`);
    expect(response.status).toBe(201);
    expect(rpc).toHaveBeenCalledOnce();
  });

  it("phòng thủ: database báo 22P02 (sai cú pháp UUID) thì ánh xạ thành 422 QR_INVALID", () => {
    const error = attendanceRpcError('invalid input syntax for type uuid: "000000000000000000000000000000000000"');
    expect(error.status).toBe(422);
    expect(error.code).toBe("QR_INVALID");
  });
});
