import { afterEach, describe, expect, it } from "vitest";
import { GET } from "./route";

const original = {
  openai: process.env.OPENAI_API_KEY,
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  anon: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  service: process.env.SUPABASE_SERVICE_ROLE_KEY,
};

afterEach(() => {
  process.env.OPENAI_API_KEY = original.openai;
  process.env.NEXT_PUBLIC_SUPABASE_URL = original.url;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = original.anon;
  process.env.SUPABASE_SERVICE_ROLE_KEY = original.service;
});

describe("GET /api/capabilities", () => {
  it("does not expose AI when the real services are not fully configured", async () => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    await expect(GET().then((response) => response.json())).resolves.toEqual({ ai: false, auth: false });
  });

  it("exposes AI only when authentication and OpenAI are both configured", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";

    await expect(GET().then((response) => response.json())).resolves.toEqual({ ai: true, auth: true });
  });
});
