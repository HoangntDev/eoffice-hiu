import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return NextResponse.next({ request });

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
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
    return redirectResponse;
  }

  if (protectedPath) {
    const userId = typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : null;
    if (claimsError || !userId) return redirect(`/login?next=${encodeURIComponent(pathname)}`);
    const { data: account } = await supabase.from("accounts").select("status").eq("user_id", userId).maybeSingle();
    if (pathname.startsWith("/signup/create-pin")) {
      if (account?.status === "active") return redirect("/onboarding/profile");
      if (account?.status !== "pending_pin") return redirect("/login");
    } else if (account?.status === "pending_pin") {
      return redirect("/signup/create-pin");
    } else if (account?.status !== "active") {
      return redirect("/login");
    }
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
