import type { SupabaseClient } from "@supabase/supabase-js";

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};

declare module "https://esm.sh/@supabase/supabase-js@2.48.0" {
  export * from "@supabase/supabase-js";
  const createClient: SupabaseClient["from"] extends never
    ? never
    : typeof import("@supabase/supabase-js").createClient;
  export { createClient };
}
