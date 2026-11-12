import "server-only";

import { cache } from "react";
import { createUserSupabase } from "@/lib/supabase/server";

export const paymentEnabled = cache(async (): Promise<boolean> => {
  const supabase = await createUserSupabase();
  const { data, error } = await supabase.rpc("feature_flag_enabled", { p_key: "PAYMENT_ENABLED" });
  return !error && data === true;
});
