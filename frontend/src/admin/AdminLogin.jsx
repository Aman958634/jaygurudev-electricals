import { useState } from "react";
import { Eye, EyeOff, KeyRound, LockKeyhole } from "lucide-react";
import { adminRequest } from "./adminApi.js";
import logo from "../assets/images/jay-gurudevv-logo.jpg";

export default function AdminLogin({ onLogin, notice }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const result = await adminRequest("", "/admin/login", {
        method: "POST",
        body: JSON.stringify({
          email: form.get("email"),
          password: form.get("password"),
        }),
      });
      onLogin(result);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="admin-login-page">
      <form className="admin-login-card" onSubmit={submit}>
        <img className="admin-login-logo" src={logo} alt="Jay Gurudevv Electricals" />
        <div className="admin-login-mark"><LockKeyhole size={23} /></div>
        <span className="admin-eyebrow">JAY GURUDEVV ELECTRICALS</span>
        <h1>Admin sign in</h1>
        <p>Sign in with your administrator account to manage the website.</p>
        {notice && <div className="admin-alert">{notice}</div>}
        {error && <div className="admin-alert admin-alert--error" role="alert">{error}</div>}
        <label className="admin-field">
          <span>Email address</span>
          <input name="email" type="email" autoComplete="username" required maxLength={190} />
        </label>
        <label className="admin-field">
          <span>Password</span>
          <span className="admin-password-control">
            <input name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required />
            <button type="button" className="admin-password-toggle" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword((visible) => !visible)}>
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </span>
        </label>
        <button className="admin-button admin-button--primary admin-login-submit" type="submit" disabled={busy}>
          <KeyRound size={17} /> {busy ? "Signing in..." : "Sign in"}
        </button>
        <small>Administrator accounts are provisioned locally. Public registration is disabled.</small>
      </form>
    </main>
  );
}
