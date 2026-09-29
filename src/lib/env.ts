function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`MISSING_ENV:${name}`);
  }
  return value;
}

export function publicSupabaseEnv() {
  return {
    url: required("NEXT_PUBLIC_SUPABASE_URL"),
    publishableKey: required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
  };
}

export function serverSupabaseEnv() {
  return {
    ...publicSupabaseEnv(),
    serviceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
  };
}

export function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:3000";
}

export function rateLimitPepper() {
  return required("AUTH_RATE_LIMIT_PEPPER");
}
