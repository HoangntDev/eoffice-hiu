import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { loginPathFor } from "@/lib/auth/next-path";
import { optionalPublicSupabaseEnv } from "@/lib/env";
import { logEvent, requestIdFrom } from "@/lib/log";
import { clientIp } from "@/lib/request-meta";
import { instrumentedFetch } from "@/lib/supabase/instrumented-fetch";

function withRequestId(response: NextResponse, requestId: string) {
  response.headers.set("x-request-id", requestId);
  return response;
}

export async function proxy(request: NextRequest) {
  // Mã tham chiếu yêu cầu: chuyển tiếp cho route handler/trang qua header x-request-id để mọi dòng log
  // của cùng một yêu cầu có chung requestId; trả lại cho trình duyệt ở header phản hồi.
  const requestId = requestIdFrom(request);
  request.headers.set("x-request-id", requestId);
  request.headers.set("x-request-path", request.nextUrl.pathname);

  const env = optionalPublicSupabaseEnv();
  if (!env) return withRequestId(NextResponse.next({ request }), requestId);

  let response = NextResponse.next({ request });
  const supabase = createServerClient(env.url, env.publishableKey, {
    global: { fetch: instrumentedFetch("proxy") },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        for (const cookie of cookiesToSet) request.cookies.set(cookie.name, cookie.value);
        response = NextResponse.next({ request });
        for (const cookie of cookiesToSet) response.cookies.set(cookie.name, cookie.value, cookie.options);
      },
    },
  });
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const pathname = request.nextUrl.pathname;
  const protectedPath = [
    "/onboarding",
    "/account",
    "/account/security",
    "/account/recover-pin",
    "/signup/create-pin",
    "/union-membership",
    "/organization",
    "/office",
    "/forms/templates",
    "/forms/new",
    "/programs",
    "/attend",
  ].some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
    || /^\/forms\/[^/]+(\/edit|\/responses)(\/|$)/.test(pathname);

  function redirect(path: string) {
    const redirectResponse = NextResponse.redirect(new URL(path, request.url));
    for (const cookie of response.cookies.getAll()) redirectResponse.cookies.set(cookie);
    redirectResponse.headers.set("Cache-Control", "private, no-store, max-age=0");
    return withRequestId(redirectResponse, requestId);
  }

  function denied(reason: string, extra: Record<string, unknown> = {}) {
    logEvent("warn", "auth.access_denied", { source: "proxy", requestId, path: pathname, reason, ip: clientIp(request.headers), ...extra });
  }

  if (protectedPath) {
    const userId = typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : null;
    if (claimsError || !userId) {
      denied("NO_SESSION");
      return redirect(loginPathFor(pathname, request.nextUrl.search));
    }
    const { data: account } = await supabase.from("accounts").select("status, student_code").eq("user_id", userId).maybeSingle();
    const denyAccount = () => denied("ACCOUNT_NOT_ACTIVE", { userId, studentCode: account?.student_code, accountStatus: account?.status ?? null });
    if (pathname.startsWith("/signup/create-pin")) {
      if (account?.status === "active") return redirect("/onboarding/profile");
      if (account?.status !== "pending_pin") {
        denyAccount();
        return redirect("/login");
      }
    } else if (account?.status === "pending_pin") {
      return redirect("/signup/create-pin");
    } else if (account?.status !== "active") {
      denyAccount();
      return redirect("/login");
    }
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
  }
  return withRequestId(response, requestId);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
