"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient, isSupabaseEnabled } from "@/lib/supabase-browser";

interface AuthContextValue {
  configured: boolean;
  loading: boolean;
  session: Session | null;
  user: User | null;
  displayName: string;
  sendCode: (email: string) => Promise<void>;
  verifyCode: (email: string, token: string) => Promise<void>;
  signOut: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const configured = isSupabaseEnabled();
  const [loading, setLoading] = useState(configured);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    const client = getSupabaseBrowserClient();
    if (!client) {
      setLoading(false);
      return;
    }
    let mounted = true;
    void client.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });
    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const sendCode = useCallback(async (email: string) => {
    const client = getSupabaseBrowserClient();
    if (!client) throw new Error("登录服务尚未配置");
    const displayName = email.split("@")[0] || "创作者";
    const { error } = await client.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true, data: { display_name: displayName } },
    });
    if (error) throw new Error(error.message);
  }, []);

  const verifyCode = useCallback(async (email: string, token: string) => {
    const client = getSupabaseBrowserClient();
    if (!client) throw new Error("登录服务尚未配置");
    const { error } = await client.auth.verifyOtp({ email, token, type: "email" });
    if (error) throw new Error("验证码无效或已过期");
  }, []);

  const signOut = useCallback(async () => {
    const client = getSupabaseBrowserClient();
    if (client) await client.auth.signOut();
  }, []);

  const getAccessToken = useCallback(async () => {
    const client = getSupabaseBrowserClient();
    if (!client) return null;
    const { data } = await client.auth.getSession();
    return data.session?.access_token ?? null;
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const user = session?.user ?? null;
    const displayName = String(user?.user_metadata?.display_name || user?.email?.split("@")[0] || "创作者");
    return { configured, loading, session, user, displayName, sendCode, verifyCode, signOut, getAccessToken };
  }, [configured, getAccessToken, loading, sendCode, session, signOut, verifyCode]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
