import { Writable } from "node:stream";
import { createInterface } from "node:readline/promises";
import { createClient } from "@supabase/supabase-js";

process.loadEnvFile?.(".env.local");

const SCHOOL_UNION_ID = "00000000-0000-4000-8000-000000000001";
const userIndex = process.argv.indexOf("--user-id");
const userId = userIndex >= 0 ? process.argv[userIndex + 1] : null;

function refuse(message) {
  console.error(`BOOTSTRAP_REFUSED: ${message}`);
  process.exitCode = 1;
}

function secretReader() {
  if (!process.stdin.isTTY) {
    const lines = createInterface({ input: process.stdin, terminal: false });
    const answers = (async () => {
      const values = [];
      for await (const line of lines) values.push(line);
      return values;
    })();
    let index = 0;
    return { ask: async () => (await answers)[index++] ?? "", close: () => lines.close() };
  }
  const output = new Writable({
    write(chunk, _encoding, callback) {
      if (!output.muted) process.stdout.write(chunk);
      callback();
    },
  });
  output.muted = false;
  const lines = createInterface({ input: process.stdin, output, terminal: true });
  return {
    async ask(prompt) {
      output.muted = false;
      const answer = lines.question(prompt);
      output.muted = true;
      const value = await answer;
      output.muted = false;
      process.stdout.write("\n");
      return value;
    },
    close: () => lines.close(),
  };
}

if (!userId || !process.argv.includes("--confirm")) {
  refuse("cách dùng: npm run admin:bootstrap -- --user-id <UUID> --confirm");
} else {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    refuse("thiếu biến môi trường Supabase server-side.");
  } else {
    const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: existing, error: lookupError } = await client
      .from("accounts")
      .select("user_id, status")
      .eq("account_type", "organization")
      .eq("organization_id", SCHOOL_UNION_ID)
      .maybeSingle();
    const { count: pinCount, error: pinLookupError } = existing
      ? await client.from("organization_pins").select("account_user_id", { count: "exact", head: true }).eq("account_user_id", existing.user_id)
      : { count: 0, error: null };
    if (lookupError) {
      refuse(`không kiểm tra được trạng thái khởi tạo: ${lookupError.message}`);
    } else if (pinLookupError) {
      refuse(`không kiểm tra được PIN tổ chức: ${pinLookupError.message}`);
    } else if ((pinCount ?? 0) > 0) {
      refuse("tài khoản tổ chức Đoàn Trường đã được khởi tạo.");
    } else {
      const reader = secretReader();
      try {
        const pin = await reader.ask("PIN tổ chức mới (6 số): ");
        const confirmation = await reader.ask("Nhập lại PIN tổ chức: ");
        if (!/^\d{6}$/.test(pin)) {
          refuse("PIN tổ chức phải đúng 6 chữ số.");
        } else if (pin !== confirmation) {
          refuse("PIN nhập lại không khớp.");
        } else {
          const { data: accountUserId, error: bootstrapError } = await client.rpc("bootstrap_school_admin", {
            p_user_id: userId,
            p_reason: "Bootstrap tài khoản tổ chức Đoàn Trường ban đầu",
          });
          if (bootstrapError) {
            refuse(bootstrapError.message);
          } else {
            const { error: pinError } = await client.rpc("set_organization_pin", {
              p_account_user_id: accountUserId,
              p_pin: pin,
            });
            if (pinError) refuse(pinError.message);
            else console.log(`BOOTSTRAP_OK account_user_id=${accountUserId}`);
          }
        }
      } finally {
        reader.close();
      }
    }
  }
}
