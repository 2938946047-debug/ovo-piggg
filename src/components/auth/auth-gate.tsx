"use client";

import { useState } from "react";
import { ArrowRight, Check, Loader2, Mail } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";

export function AuthGate() {
  const { sendCode, verifyCode } = useAuth();
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const requestCode = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError("请输入有效邮箱");
    setPending(true);
    setError("");
    try {
      await sendCode(email.trim());
      setSent(true);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "验证码发送失败");
    } finally {
      setPending(false);
    }
  };

  const confirmCode = async () => {
    if (token.length !== 6) return setError("请输入六位验证码");
    setPending(true);
    setError("");
    try {
      await verifyCode(email.trim(), token);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "登录失败");
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <header><span className="brand-mark" /><strong>白页</strong></header>
        <div className="auth-copy"><h1>登录你的摄影书</h1><p>使用邮箱验证码登录。你的草稿、发布版本与评论会长期保存在云端。</p></div>
        {!sent ? (
          <form onSubmit={(event) => { event.preventDefault(); void requestCode(); }}>
            <label><span>邮箱</span><div><Mail size={17} /><input autoFocus type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" /></div></label>
            <button disabled={pending}>{pending ? <Loader2 className="spin" size={17} /> : <ArrowRight size={17} />}发送登录验证码</button>
          </form>
        ) : (
          <form onSubmit={(event) => { event.preventDefault(); void confirmCode(); }}>
            <div className="auth-sent"><Check size={15} />验证码已发送至 {email}</div>
            <label><span>六位验证码</span><div><input autoFocus inputMode="numeric" maxLength={6} value={token} onChange={(event) => setToken(event.target.value.replace(/\D/g, ""))} placeholder="000000" /></div></label>
            <button disabled={pending}>{pending ? <Loader2 className="spin" size={17} /> : <ArrowRight size={17} />}登录 / 创建账号</button>
            <button type="button" className="auth-secondary" onClick={() => { setSent(false); setToken(""); setError(""); }}>更换邮箱</button>
          </form>
        )}
        {error && <p className="auth-error">{error}</p>}
        <footer>每个账号只能编辑自己的作品。公开链接始终为只读。</footer>
      </section>
    </main>
  );
}
