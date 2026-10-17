import React, { useState } from "react";
import { LogIn, UserPlus, Key, Mail, User, GraduationCap, ShieldAlert, CheckCircle2, Sparkles, AlertTriangle, ArrowRight, ArrowLeft, Lock } from "lucide-react";
import { AuthResponse } from "../types";
import { MessengerIcon } from "./PaymentModal";

interface AuthModalProps {
  onSuccess: (email: string, name: string, daysLeft: number, active: boolean, isFallback?: boolean, errorDetails?: string) => void;
  onRequestPayment?: (email: string, reason?: "expired" | "upgrade") => void;
  onOpenAdminPortal?: () => void;
  pendingAdminCount?: number;
}

export default function AuthModal({ 
  onSuccess, 
  onRequestPayment,
  onOpenAdminPortal,
  pendingAdminCount = 0
}: AuthModalProps) {
  const [activeTab, setActiveTab] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isTrialExpired, setIsTrialExpired] = useState(false);
  const [expiredEmail, setExpiredEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");
    setIsTrialExpired(false);

    const isLogin = activeTab === "login";
    const requestEmail = email.trim().toLowerCase();
    const requestPassword = password.trim();
    const requestName = name.trim();

    if (!requestEmail || !requestPassword || (!isLogin && !requestName)) {
      setErrorMessage("Please complete all required fields.");
      return;
    }

    if (!isLogin && requestPassword.length < 6) {
      setErrorMessage("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      const endpoint = isLogin ? "/api/auth/login" : "/api/auth/register";
      const payload = isLogin
        ? { email: requestEmail, password: requestPassword }
        : { email: requestEmail, password: requestPassword, name: requestName };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      let data: AuthResponse | null = null;
      let responseText = "";
      try {
        responseText = await response.text();
        data = JSON.parse(responseText);
      } catch (parseErr) {
        // Not a JSON response
      }

      if (!response.ok) {
        const errorMsg = data?.message || `Auth Connection Error (Status ${response.status}): ${responseText || response.statusText}`;
        throw new Error(errorMsg);
      }

      if (data && data.success) {
        if (!isLogin) {
          // Registration successful: Redirect to login tab, clear password, and show success message
          setActiveTab("login");
          setPassword("");
          setSuccessMessage("Your account has been registered successfully! Please sign in with your registered email and password below to enter.");
        } else {
          // Safe defaults from payload or sheets
          const loggedName = data.name || requestName || "Teacher User";
          const loggedDays = data.daysLeft !== undefined ? data.daysLeft : 5;
          const loggedActive = data.active !== undefined ? data.active : true;

          onSuccess(requestEmail, loggedName, loggedDays, loggedActive, data.isFallback, data.errorDetails);
        }
      } else {
        const isExp = Boolean(
          data?.expired || 
          data?.isInactive || 
          (data?.message && data.message.toLowerCase().includes("expired")) || 
          (data?.error && data.error.toLowerCase().includes("expired"))
        );

        if (isExp) {
          setIsTrialExpired(true);
          setExpiredEmail(requestEmail);
          setErrorMessage("Your trial account access has expired. Please upgrade to renew your subscription");
        } else {
          setErrorMessage(data?.message || "Authentication attempt failed. Please check your credentials.");
        }
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "Could not connect to authentication gateway. Verify your database connection is active or try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="auth-modal-screen" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      
      {/* ─── POPUP SCREEN FOR EXPIRED TRIAL ACCOUNT ─── */}
      {isTrialExpired && (
        <div id="expired-trial-popup-screen" className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden text-center slide-enter">
            <div className="p-7 bg-gradient-to-br from-rose-700 via-rose-800 to-slate-900 text-white relative">
              <div className="h-16 w-16 mx-auto bg-white/10 rounded-2xl flex items-center justify-center text-amber-300 border border-white/20 mb-3 shadow-inner">
                <AlertTriangle size={36} />
              </div>
              <h3 className="font-display text-xl font-bold tracking-tight text-white">
                Account Status Notice
              </h3>
              <p className="text-rose-100 text-xs mt-1 font-medium font-mono">
                {expiredEmail || email}
              </p>
            </div>

            <div className="p-7 space-y-6">
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl">
                <p className="text-sm font-semibold text-rose-950 leading-relaxed">
                  Your trial account access has expired. Please upgrade to renew your subscription
                </p>
              </div>

              {/* Upgrade button placed directly below the message */}
              <div className="space-y-3">
                {onRequestPayment && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsTrialExpired(false);
                      onRequestPayment(expiredEmail || email, "expired");
                    }}
                    className="w-full py-3.5 px-5 bg-gradient-to-r from-[#006AFF] to-[#00B2FF] hover:from-[#005cd9] hover:to-[#009de0] text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 transition active:scale-[0.98]"
                  >
                    <MessengerIcon size={18} className="fill-white" />
                    <span>Upgrade via Messenger</span>
                    <ArrowRight size={16} />
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setIsTrialExpired(false)}
                  className="w-full py-2.5 px-4 text-xs font-semibold text-slate-500 hover:text-slate-800 transition flex items-center justify-center gap-1.5"
                >
                  <ArrowLeft size={14} />
                  <span>Back to Sign In</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden slide-enter">
        <div className="p-8 pb-6 bg-gradient-to-br from-emerald-800 to-emerald-950 text-white text-center relative">
          <div className="h-16 w-16 mx-auto bg-emerald-500/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-amber-400 border border-emerald-400/20 mb-4 shadow-inner">
            <GraduationCap size={40} />
          </div>
          <h2 className="font-display text-2xl font-bold tracking-tight">ILAW Master Suite</h2>
          <p className="text-emerald-200 text-xs mt-1 font-medium tracking-wide uppercase">
            Standards-Aligned Lesson Designer
          </p>
        </div>

        <div className="p-8">
          <div className="flex bg-slate-100 p-1.5 rounded-xl mb-6">
            <button
              type="button"
              onClick={() => {
                setActiveTab("login");
                setErrorMessage("");
                setSuccessMessage("");
              }}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                activeTab === "login"
                  ? "bg-white text-emerald-800 shadow"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("register");
                setErrorMessage("");
                setSuccessMessage("");
              }}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                activeTab === "register"
                  ? "bg-white text-emerald-800 shadow"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Register
            </button>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            {activeTab === "register" && (
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                  <User size={14} className="text-emerald-700" />
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jane Doe, LPT"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 text-slate-800 rounded-xl text-sm placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white transition"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                <Mail size={14} className="text-emerald-700" />
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="teacher@school.edu"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 text-slate-800 rounded-xl text-sm placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white transition"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                <Key size={14} className="text-emerald-700" />
                Access Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 text-slate-800 rounded-xl text-sm placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white transition"
              />
            </div>

            {errorMessage && (
              <div className="text-xs font-medium bg-red-50 border border-red-200 p-3.5 rounded-xl flex gap-2.5 items-start leading-relaxed shadow-sm">
                <ShieldAlert size={18} className="shrink-0 text-red-500 mt-0.5" />
                <div className="flex-1 space-y-2.5">
                  <p className="text-rose-900 font-semibold">{errorMessage}</p>
                  {(isTrialExpired || errorMessage.toLowerCase().includes("expired") || errorMessage.toLowerCase().includes("upgrade")) && onRequestPayment && (
                    <button
                      type="button"
                      onClick={() => onRequestPayment(expiredEmail || email, "expired")}
                      className="w-full py-2.5 px-4 bg-gradient-to-r from-[#006AFF] to-[#00B2FF] hover:from-[#005cd9] hover:to-[#009de0] text-white font-bold rounded-lg text-xs flex items-center justify-center gap-2 shadow-md transition active:scale-[0.98]"
                    >
                      <MessengerIcon size={15} className="fill-white" />
                      <span>Upgrade via Messenger</span>
                      <ArrowRight size={14} />
                    </button>
                  )}
                </div>
              </div>
            )}

            {successMessage && (
              <div className="text-xs text-emerald-800 font-medium bg-emerald-50 border border-emerald-100 p-3 rounded-xl flex gap-2 items-start leading-relaxed">
                <CheckCircle2 size={16} className="shrink-0 text-emerald-600 animate-pulse" />
                <span>{successMessage}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition shadow-lg shadow-emerald-700/10 active:scale-[0.99] disabled:opacity-50"
            >
              {loading ? (
                <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : activeTab === "login" ? (
                <>
                  <LogIn size={16} />
                  <span>Log In to ILAW</span>
                </>
              ) : (
                <>
                  <UserPlus size={16} />
                  <span>Create Educator Account</span>
                </>
              )}
            </button>

            {onOpenAdminPortal && (
              <div className="pt-3 border-t border-slate-100 flex items-center justify-center">
                <button
                  type="button"
                  onClick={onOpenAdminPortal}
                  className="text-[11px] text-slate-400 hover:text-slate-600 flex items-center gap-1.5 transition font-medium"
                >
                  <Lock size={12} className="text-slate-400" />
                  <span>Administrator Sign-In</span>
                </button>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
