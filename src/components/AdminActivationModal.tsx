import React, { useState, useEffect } from "react";
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Search, 
  RefreshCw, 
  ShieldCheck, 
  ShieldAlert,
  Lock, 
  Unlock,
  KeyRound,
  Eye, 
  EyeOff,
  X, 
  ExternalLink, 
  Copy, 
  Check, 
  AlertCircle,
  Image as ImageIcon,
  ZoomIn,
  Sparkles,
  Calendar,
  User as UserIcon,
  Filter,
  MessageSquare,
  Phone,
  Save,
  Link as LinkIcon
} from "lucide-react";
import { PaymentActivationRequest } from "../types";

const MessengerIcon = ({ size = 16, className = "" }: { size?: number; className?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
  >
    <path d="M12 2C6.477 2 2 6.145 2 11.258c0 2.91 1.455 5.518 3.735 7.21V22l3.38-1.856c.928.257 1.916.398 2.885.398 5.523 0 10-4.145 10-9.284C22 6.145 17.523 2 12 2zm1.066 12.484l-2.618-2.793-5.11 2.793 5.62-5.968 2.684 2.793 5.044-2.793-5.62 5.968z" />
  </svg>
);

interface AdminActivationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onActivatedUser?: (email: string, days: number) => void;
}

export default function AdminActivationModal({
  isOpen,
  onClose,
  onActivatedUser
}: AdminActivationModalProps) {
  // Navigation tab state inside admin dashboard
  const [activeTab, setActiveTab] = useState<"requests" | "settings">("requests");

  // Admin authentication state
  const [adminPasscode, setAdminPasscode] = useState<string>(() => {
    return sessionStorage.getItem("ilaw_admin_passcode") || "";
  });
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [passcodeInput, setPasscodeInput] = useState<string>("");
  const [showPasscode, setShowPasscode] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [verifyingAuth, setVerifyingAuth] = useState<boolean>(false);

  // Data state
  const [requests, setRequests] = useState<PaymentActivationRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "approved" | "rejected">("pending");
  const [searchQuery, setSearchQuery] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [copiedRef, setCopiedRef] = useState<string | null>(null);
  const [selectedReceiptImage, setSelectedReceiptImage] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Messenger & App Settings State
  const [messengerLinkInput, setMessengerLinkInput] = useState<string>("");
  const [whatsappInput, setWhatsappInput] = useState<string>("");
  const [loadingSettings, setLoadingSettings] = useState<boolean>(false);
  const [savingSettings, setSavingSettings] = useState<boolean>(false);
  const [settingsSuccessMessage, setSettingsSuccessMessage] = useState<string | null>(null);

  // Validate stored passcode on open
  useEffect(() => {
    if (!isOpen) return;

    setStatusMessage(null);
    setRejectingId(null);
    setAuthError(null);
    setSettingsSuccessMessage(null);

    const stored = sessionStorage.getItem("ilaw_admin_passcode") || "";
    if (stored) {
      verifyStoredPasscode(stored);
    } else {
      setIsAuthenticated(false);
    }
  }, [isOpen]);

  const verifyStoredPasscode = async (passcode: string) => {
    try {
      const res = await fetch("/api/admin/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode })
      });
      const data = await res.json();
      if (data.success) {
        setIsAuthenticated(true);
        setAdminPasscode(passcode);
        fetchRequests(passcode);
        fetchSettings(passcode);
      } else {
        sessionStorage.removeItem("ilaw_admin_passcode");
        setIsAuthenticated(false);
        setAdminPasscode("");
      }
    } catch {
      setIsAuthenticated(false);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcodeInput.trim()) {
      setAuthError("Please enter the administrator passcode.");
      return;
    }

    setVerifyingAuth(true);
    setAuthError(null);

    try {
      const res = await fetch("/api/admin/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode: passcodeInput.trim() })
      });

      const data = await res.json();

      if (data.success) {
        const validCode = passcodeInput.trim();
        sessionStorage.setItem("ilaw_admin_passcode", validCode);
        setAdminPasscode(validCode);
        setIsAuthenticated(true);
        setPasscodeInput("");
        fetchRequests(validCode);
        fetchSettings(validCode);
      } else {
        setAuthError(data.message || "Invalid administrator passcode. Access denied.");
      }
    } catch (err: any) {
      setAuthError("Failed to verify passcode with the server: " + (err.message || "Network error"));
    } finally {
      setVerifyingAuth(false);
    }
  };

  const handleAdminLogout = () => {
    sessionStorage.removeItem("ilaw_admin_passcode");
    setAdminPasscode("");
    setIsAuthenticated(false);
    setRequests([]);
    setStatusMessage(null);
    setSettingsSuccessMessage(null);
  };

  const fetchRequests = async (passcodeToUse?: string) => {
    const code = passcodeToUse || adminPasscode;
    if (!code) return;

    setLoading(true);
    try {
      const res = await fetch("/api/admin/payment-requests", {
        headers: {
          "x-admin-passcode": code
        }
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.requests)) {
        setRequests(data.requests);
      } else if (res.status === 401) {
        handleAdminLogout();
        setAuthError("Session expired or unauthorized passcode. Please re-enter.");
      }
    } catch (err) {
      console.error("Failed to fetch payment requests:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSettings = async (passcodeToUse?: string) => {
    const code = passcodeToUse || adminPasscode;
    if (!code) return;

    setLoadingSettings(true);
    try {
      const res = await fetch("/api/admin/settings", {
        headers: {
          "x-admin-passcode": code
        }
      });
      const data = await res.json();
      if (data.success && data.settings) {
        setMessengerLinkInput(data.settings.messengerLink || "");
        setWhatsappInput(data.settings.whatsappNumber || "");
      }
    } catch (err) {
      console.error("Failed to fetch settings:", err);
    } finally {
      setLoadingSettings(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminPasscode) return;

    setSavingSettings(true);
    setSettingsSuccessMessage(null);

    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-passcode": adminPasscode
        },
        body: JSON.stringify({
          messengerLink: messengerLinkInput,
          whatsappNumber: whatsappInput
        })
      });

      const data = await res.json();
      if (data.success) {
        setSettingsSuccessMessage("Messenger & contact link updated successfully! All teachers will now be directed to this link.");
        if (data.settings) {
          setMessengerLinkInput(data.settings.messengerLink || "");
          setWhatsappInput(data.settings.whatsappNumber || "");
        }
      } else {
        throw new Error(data.message || "Failed to update settings.");
      }
    } catch (err: any) {
      setStatusMessage({
        type: "error",
        text: err.message || "Failed to save settings."
      });
    } finally {
      setSavingSettings(false);
    }
  };

  const getResolvedMessengerUrl = (rawLink: string) => {
    const raw = (rawLink || "").trim();
    if (!raw) return "https://m.me";
    if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
    if (raw.startsWith("m.me/")) return `https://${raw}`;
    return `https://m.me/${raw}`;
  };

  if (!isOpen) return null;

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedRef(id);
    setTimeout(() => setCopiedRef(null), 2500);
  };

  const handleApprove = async (request: PaymentActivationRequest) => {
    setProcessingId(request.id);
    setStatusMessage(null);

    try {
      const res = await fetch("/api/admin/approve-activation", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-admin-passcode": adminPasscode
        },
        body: JSON.stringify({
          requestId: request.id,
          adminPasscode,
          adminRemarks: `Payment verified & confirmed by administrator.`
        })
      });

      const data = await res.json();

      if (data.success) {
        setStatusMessage({
          type: "success",
          text: `Success! ${request.email} has been activated in Google Sheet with +${request.days} days.`
        });
        if (onActivatedUser) {
          onActivatedUser(request.email, request.days);
        }
        await fetchRequests();
      } else {
        throw new Error(data.message || "Failed to approve payment activation.");
      }
    } catch (err: any) {
      console.error("Approval error:", err);
      setStatusMessage({
        type: "error",
        text: err.message || "Could not activate user in Google Sheet. Please check server logs."
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (requestId: string) => {
    setProcessingId(requestId);
    try {
      const res = await fetch("/api/admin/reject-activation", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-admin-passcode": adminPasscode
        },
        body: JSON.stringify({
          requestId,
          reason: rejectReason.trim() || "Payment could not be verified. Please check reference number."
        })
      });

      const data = await res.json();

      if (data.success) {
        setStatusMessage({
          type: "success",
          text: "Payment request has been marked as rejected."
        });
        setRejectingId(null);
        setRejectReason("");
        await fetchRequests();
      } else {
        throw new Error(data.message || "Failed to reject payment request.");
      }
    } catch (err: any) {
      setStatusMessage({
        type: "error",
        text: err.message || "Failed to update request."
      });
    } finally {
      setProcessingId(null);
    }
  };

  const filteredRequests = requests.filter((r) => {
    const matchesFilter = filterStatus === "all" ? true : r.status === filterStatus;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q || 
      r.email.toLowerCase().includes(q) || 
      r.name.toLowerCase().includes(q) || 
      (r.referenceNumber && r.referenceNumber.toLowerCase().includes(q)) ||
      r.planName.toLowerCase().includes(q);
    return matchesFilter && matchesSearch;
  });

  const pendingCount = requests.filter(r => r.status === "pending").length;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
      
      {/* ─────────────────────────────────────────────────────────────
          SCREEN 1: ADMINISTRATOR PASSCODE GATE (IF NOT AUTHENTICATED)
         ───────────────────────────────────────────────────────────── */}
      {!isAuthenticated ? (
        <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-6 animate-fade-in">
          {/* Header */}
          <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-6 relative text-center">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition"
              title="Close"
            >
              <X size={18} />
            </button>
            <div className="h-14 w-14 mx-auto mb-3 rounded-2xl bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center justify-center font-bold shadow-inner">
              <Lock size={28} />
            </div>
            <h2 className="text-xl font-bold font-display text-white">
              Administrator Verification
            </h2>
            <p className="text-slate-300 text-xs mt-1 leading-relaxed">
              Restricted to authorized system administrators. Regular users and teachers cannot view, approve, or activate accounts.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleAdminLogin} className="p-6 space-y-4">
            {authError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2">
                <ShieldAlert size={16} className="text-rose-600 shrink-0 mt-0.5" />
                <div>{authError}</div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <KeyRound size={14} className="text-indigo-600" />
                Master Admin Passcode
              </label>
              <div className="relative">
                <input
                  type={showPasscode ? "text" : "password"}
                  value={passcodeInput}
                  onChange={(e) => {
                    setPasscodeInput(e.target.value);
                    if (authError) setAuthError(null);
                  }}
                  placeholder="Enter administrator passcode..."
                  autoFocus
                  required
                  className="w-full pl-3.5 pr-10 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition shadow-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPasscode(!showPasscode)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  title={showPasscode ? "Hide passcode" : "Show passcode"}
                >
                  {showPasscode ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p className="text-[11px] text-slate-500">
                Authorized passcode configured in server security environment.
              </p>
            </div>

            <button
              type="submit"
              disabled={verifyingAuth || !passcodeInput.trim()}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-bold text-sm rounded-xl shadow-md transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {verifyingAuth ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  <span>Verifying Passcode...</span>
                </>
              ) : (
                <>
                  <Unlock size={16} />
                  <span>Unlock Admin Dashboard</span>
                </>
              )}
            </button>

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={onClose}
                className="text-xs text-slate-500 hover:text-slate-800 font-medium"
              >
                Return to Teacher Dashboard
              </button>
            </div>
          </form>
        </div>
      ) : (

        /* ─────────────────────────────────────────────────────────────
            SCREEN 2: UNLOCKED ADMINISTRATOR VERIFICATION DASHBOARD
           ───────────────────────────────────────────────────────────── */
        <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6 animate-fade-in flex flex-col max-h-[92vh]">
          
          {/* Header */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 text-white p-5 sm:p-6 relative shrink-0">
            <div className="absolute top-4 right-4 flex items-center gap-2">
              <button
                onClick={handleAdminLogout}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/30 transition flex items-center gap-1"
                title="Lock and logout of admin mode"
              >
                <Lock size={12} />
                <span>Lock Admin</span>
              </button>
              <button
                onClick={onClose}
                className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex items-center gap-3 mb-1">
              <div className="h-10 w-10 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center justify-center font-bold shadow-inner">
                <ShieldCheck size={24} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono uppercase tracking-wider bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30 font-bold flex items-center gap-1">
                    <Check size={10} /> Authorized Administrator
                  </span>
                  {pendingCount > 0 && (
                    <span className="text-[10px] font-bold bg-rose-500 text-white px-2 py-0.5 rounded-full animate-pulse">
                      {pendingCount} Pending Review
                    </span>
                  )}
                </div>
                <h2 className="text-xl sm:text-2xl font-bold font-display text-white mt-0.5">
                  Payment Verification &amp; Settings Portal
                </h2>
              </div>
            </div>

            <p className="text-slate-300 text-xs sm:text-sm mt-1 max-w-2xl leading-relaxed">
              Manage teacher subscriptions, verify GCash/Maya receipts, activate access in Google Sheets, and configure the upgrade Messenger link.
            </p>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-3 px-5 sm:px-6 pt-2 bg-slate-900 border-b border-slate-800 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab("requests")}
              className={`pb-2.5 px-3 flex items-center gap-2 border-b-2 text-xs font-bold transition ${
                activeTab === "requests"
                  ? "border-amber-400 text-amber-300"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <Clock size={14} />
              <span>Review Payment Requests</span>
              {pendingCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500 text-white font-bold">
                  {pendingCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab("settings");
                fetchSettings();
              }}
              className={`pb-2.5 px-3 flex items-center gap-2 border-b-2 text-xs font-bold transition ${
                activeTab === "settings"
                  ? "border-blue-400 text-blue-300"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <MessengerIcon size={14} className="fill-current text-blue-400" />
              <span>Change Messenger Link</span>
            </button>
          </div>

          {/* Alert Status Banner */}
          {statusMessage && (
            <div
              className={`p-3 text-xs font-semibold flex items-center justify-between shrink-0 ${
                statusMessage.type === "success"
                  ? "bg-emerald-50 border-b border-emerald-200 text-emerald-800"
                  : "bg-rose-50 border-b border-rose-200 text-rose-800"
              }`}
            >
              <div className="flex items-center gap-2">
                {statusMessage.type === "success" ? (
                  <CheckCircle2 size={16} className="text-emerald-600" />
                ) : (
                  <AlertCircle size={16} className="text-rose-600" />
                )}
                <span>{statusMessage.text}</span>
              </div>
              <button
                type="button"
                onClick={() => setStatusMessage(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              TAB 1: PAYMENT REQUESTS REVIEW & SHEET ACTIVATION
             ══════════════════════════════════════════════════════════════════ */}
          {activeTab === "requests" && (
            <>
              {/* Controls Bar: Filters & Search */}
              <div className="p-3.5 sm:p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
                {/* Filter Tabs */}
                <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 text-xs font-semibold w-full sm:w-auto overflow-x-auto">
                  <button
                    type="button"
                    onClick={() => setFilterStatus("pending")}
                    className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 shrink-0 ${
                      filterStatus === "pending"
                        ? "bg-amber-500 text-white shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <Clock size={13} />
                    <span>Pending Review</span>
                    {pendingCount > 0 && (
                      <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                        filterStatus === "pending" ? "bg-amber-700 text-white" : "bg-amber-100 text-amber-800"
                      }`}>
                        {pendingCount}
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setFilterStatus("approved")}
                    className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 shrink-0 ${
                      filterStatus === "approved"
                        ? "bg-emerald-600 text-white shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <CheckCircle2 size={13} />
                    <span>Approved</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFilterStatus("rejected")}
                    className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 shrink-0 ${
                      filterStatus === "rejected"
                        ? "bg-rose-600 text-white shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <XCircle size={13} />
                    <span>Rejected</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFilterStatus("all")}
                    className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 shrink-0 ${
                      filterStatus === "all"
                        ? "bg-slate-800 text-white shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <Filter size={13} />
                    <span>All ({requests.length})</span>
                  </button>
                </div>

                {/* Search Input & Refresh Button */}
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-64">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search email, name, reference..."
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => fetchRequests()}
                    disabled={loading}
                    className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-300 transition shrink-0"
                    title="Refresh requests"
                  >
                    <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                  </button>
                </div>
              </div>

              {/* List of Requests */}
              <div className="overflow-y-auto p-4 sm:p-5 space-y-4 flex-1 bg-slate-100/60">
                {loading ? (
                  <div className="text-center py-12 text-slate-500 space-y-3">
                    <RefreshCw size={24} className="animate-spin mx-auto text-indigo-600" />
                    <p className="text-xs font-semibold">Loading payment verification records...</p>
                  </div>
                ) : filteredRequests.length === 0 ? (
                  <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 p-8 space-y-2">
                    <ShieldCheck size={36} className="mx-auto text-slate-300" />
                    <h3 className="font-bold text-slate-700 text-sm">No Payment Requests Found</h3>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      {filterStatus === "pending"
                        ? "Great job! There are currently no pending payments awaiting activation."
                        : "No payment submissions match the selected filter."}
                    </p>
                  </div>
                ) : (
                  filteredRequests.map((req) => {
                    const isPending = req.status === "pending";
                    const isApproved = req.status === "approved";
                    const isRejected = req.status === "rejected";
                    const isProcessing = processingId === req.id;
                    const isRejecting = rejectingId === req.id;

                    return (
                      <div
                        key={req.id}
                        className={`bg-white rounded-2xl border-2 transition shadow-sm overflow-hidden ${
                          isPending
                            ? "border-amber-300 hover:border-amber-400"
                            : isApproved
                            ? "border-emerald-200 hover:border-emerald-300"
                            : "border-slate-200"
                        }`}
                      >
                        {/* Card Top Row: Status badge & timestamp */}
                        <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/50">
                          <div className="flex items-center gap-3">
                            <div
                              className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                                isPending
                                  ? "bg-amber-100 text-amber-700 border border-amber-300"
                                  : isApproved
                                  ? "bg-emerald-100 text-emerald-700 border border-emerald-300"
                                  : "bg-rose-100 text-rose-700 border border-rose-300"
                              }`}
                            >
                              {isPending ? (
                                <Clock size={20} className="animate-pulse" />
                              ) : isApproved ? (
                                <CheckCircle2 size={20} />
                              ) : (
                                <XCircle size={20} />
                              )}
                            </div>

                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900 text-sm sm:text-base">
                                  {req.name || "Teacher Account"}
                                </span>
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                    isPending
                                      ? "bg-amber-100 text-amber-800 border border-amber-300"
                                      : isApproved
                                      ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                      : "bg-rose-100 text-rose-800 border border-rose-300"
                                  }`}
                                >
                                  {req.status}
                                </span>
                              </div>
                              <div className="text-xs text-slate-500 font-mono mt-0.5">
                                {req.email}
                              </div>
                            </div>
                          </div>

                          {/* Plan and Date Badge */}
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-900 font-bold flex items-center gap-1">
                              <Sparkles size={13} className="text-indigo-600" />
                              {req.planName} &bull; ₱{req.pricePhp} &bull; +{req.days} Days
                            </span>
                            <span className="text-[11px] text-slate-400 flex items-center gap-1">
                              <Calendar size={12} />
                              {new Date(req.submittedAt).toLocaleString()}
                            </span>
                          </div>
                        </div>

                        {/* Card Body: Reference Number, Receipt Photo & Notes */}
                        <div className="p-4 sm:p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Left Column: Proof Details */}
                          <div className="space-y-3">
                            {/* Reference Number */}
                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                                Payment Reference Number
                              </span>
                              {req.referenceNumber ? (
                                <div className="flex items-center justify-between">
                                  <span className="font-mono text-sm font-bold text-slate-900 select-all">
                                    {req.referenceNumber}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleCopy(req.referenceNumber, req.id)}
                                    className="p-1 text-slate-400 hover:text-slate-700 transition"
                                    title="Copy reference number"
                                  >
                                    {copiedRef === req.id ? (
                                      <Check size={14} className="text-emerald-600" />
                                    ) : (
                                      <Copy size={14} />
                                    )}
                                  </button>
                                </div>
                              ) : (
                                <span className="text-xs text-slate-400 italic">
                                  No reference number entered (receipt photo provided)
                                </span>
                              )}
                            </div>

                            {/* Additional Notes */}
                            {req.notes && (
                              <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-200/60 text-xs">
                                <span className="font-bold text-amber-900 text-[11px] uppercase tracking-wider block mb-1">
                                  Teacher Note / Payment Method:
                                </span>
                                <p className="text-slate-700 whitespace-pre-wrap">{req.notes}</p>
                              </div>
                            )}

                            {/* Admin Remarks (if approved/rejected) */}
                            {req.adminRemarks && (
                              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600">
                                <span className="font-semibold text-slate-800">Admin Remarks:</span> {req.adminRemarks}
                              </div>
                            )}
                          </div>

                          {/* Right Column: Receipt Image Preview */}
                          <div className="space-y-2">
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                              Payment Receipt Photo
                            </span>

                            {req.receiptImage ? (
                              <div 
                                onClick={() => setSelectedReceiptImage(req.receiptImage || null)}
                                className="group relative h-36 bg-slate-900 rounded-xl overflow-hidden border border-slate-300 cursor-pointer shadow-inner flex items-center justify-center"
                              >
                                <img
                                  src={req.receiptImage}
                                  alt="Receipt proof"
                                  className="h-full w-full object-contain group-hover:scale-105 transition duration-300"
                                />
                                <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2 text-white text-xs font-semibold">
                                  <ZoomIn size={16} />
                                  <span>Click to inspect full size</span>
                                </div>
                              </div>
                            ) : (
                              <div className="h-36 bg-slate-50 rounded-xl border border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 text-xs p-4 text-center">
                                <ImageIcon size={24} className="mb-1 text-slate-300" />
                                <span>No picture receipt uploaded</span>
                                <span className="text-[10px] text-slate-400 mt-0.5">Verified via Reference Number</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Card Footer: Action Buttons (Approve / Reject) */}
                        {isPending && (
                          <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                            <div className="text-xs text-slate-600">
                              <span className="font-semibold text-slate-900">Automatic Activation:</span> Confirming will add{" "}
                              <strong className="text-emerald-700 font-bold">+{req.days} Days</strong> directly to Google Sheet.
                            </div>

                            <div className="flex items-center gap-2 w-full sm:w-auto">
                              {/* Reject button */}
                              {isRejecting ? (
                                <div className="flex items-center gap-2 w-full sm:w-auto animate-fade-in">
                                  <input
                                    type="text"
                                    value={rejectReason}
                                    onChange={(e) => setRejectReason(e.target.value)}
                                    placeholder="Reason for rejection..."
                                    className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-800"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleReject(req.id)}
                                    disabled={isProcessing}
                                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg transition"
                                  >
                                    Confirm Reject
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setRejectingId(null);
                                      setRejectReason("");
                                    }}
                                    className="px-2 py-1.5 text-xs text-slate-500 hover:text-slate-800"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setRejectingId(req.id)}
                                  disabled={isProcessing}
                                  className="px-3 py-2 text-xs font-semibold text-rose-700 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition"
                                >
                                  Reject Proof
                                </button>
                              )}

                              {/* Approve Button */}
                              <button
                                type="button"
                                onClick={() => handleApprove(req)}
                                disabled={isProcessing}
                                className="flex-1 sm:flex-none px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md transition flex items-center justify-center gap-2 disabled:opacity-50"
                              >
                                {isProcessing ? (
                                  <>
                                    <RefreshCw size={14} className="animate-spin" />
                                    <span>Activating in Google Sheet...</span>
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle2 size={16} />
                                    <span>Confirm Payment &amp; Activate (+{req.days} Days)</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              TAB 2: CHANGE MESSENGER & CONTACT SETTINGS
             ══════════════════════════════════════════════════════════════════ */}
          {activeTab === "settings" && (
            <div className="overflow-y-auto p-5 sm:p-6 flex-1 bg-slate-50/70 space-y-6">
              
              {/* Settings Header Box */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                    <MessengerIcon size={18} className="fill-current text-[#0084FF]" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">
                      Facebook Messenger Link Configuration
                    </h3>
                    <p className="text-xs text-slate-500">
                      Configure the exact Messenger destination where educators are directed when upgrading their account.
                    </p>
                  </div>
                </div>
              </div>

              {/* Success Notification */}
              {settingsSuccessMessage && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-900 flex items-start gap-2.5 animate-fade-in shadow-sm">
                  <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block font-bold">Settings Saved!</strong>
                    <span>{settingsSuccessMessage}</span>
                  </div>
                </div>
              )}

              {/* Settings Form */}
              <form onSubmit={handleSaveSettings} className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
                
                {/* Field 1: Messenger Link / Page Handle */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <MessengerIcon size={14} className="fill-current text-[#0084FF]" />
                      Facebook Messenger URL or Page Username
                    </span>
                    <span className="text-[11px] font-normal text-slate-400">
                      Hidden from normal teachers
                    </span>
                  </label>

                  <div className="relative">
                    <input
                      type="text"
                      value={messengerLinkInput}
                      onChange={(e) => {
                        setMessengerLinkInput(e.target.value);
                        if (settingsSuccessMessage) setSettingsSuccessMessage(null);
                      }}
                      placeholder="e.g. https://m.me/yourfacebookpage or yourfacebookpage"
                      className="w-full px-4 py-2.5 text-sm bg-white border border-slate-300 rounded-xl text-slate-900 font-mono placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition shadow-sm"
                    />
                  </div>

                  {/* Live Resolved URL Preview & Test Button */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <div>
                      <span className="text-slate-500 block text-[11px] font-semibold">Live Resolved URL:</span>
                      <span className="font-mono text-blue-700 font-semibold break-all">
                        {getResolvedMessengerUrl(messengerLinkInput)}
                      </span>
                    </div>

                    <a
                      href={getResolvedMessengerUrl(messengerLinkInput)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-lg border border-blue-200 transition flex items-center justify-center gap-1.5 shrink-0 self-start sm:self-auto"
                    >
                      <ExternalLink size={13} />
                      <span>Test Link in New Tab</span>
                    </a>
                  </div>

                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Tip: You can paste your complete Facebook Page Messenger URL (e.g., <code>https://m.me/yourpage</code>) or just your Facebook Page username (e.g., <code>ilawmastercurriculum</code>). The system automatically formats it properly.
                  </p>
                </div>

                {/* Field 2: WhatsApp Number */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Phone size={14} className="text-emerald-600" />
                    WhatsApp Number (Optional)
                  </label>

                  <input
                    type="text"
                    value={whatsappInput}
                    onChange={(e) => {
                      setWhatsappInput(e.target.value);
                      if (settingsSuccessMessage) setSettingsSuccessMessage(null);
                    }}
                    placeholder="e.g. 09956270884 or +639956270884"
                    className="w-full px-4 py-2.5 text-sm bg-white border border-slate-300 rounded-xl text-slate-900 font-mono placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition shadow-sm"
                  />
                  <p className="text-[11px] text-slate-500">
                    Additional contact line for teacher inquiries if supporting WhatsApp.
                  </p>
                </div>

                {/* Protection Guarantee Notice */}
                <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl text-xs text-blue-900 space-y-1">
                  <div className="flex items-center gap-2 font-bold text-blue-950">
                    <ShieldCheck size={16} className="text-blue-600 shrink-0" />
                    <span>Privacy &amp; Access Protection</span>
                  </div>
                  <p className="text-blue-800 text-[11px] leading-relaxed">
                    This link is securely stored on the server. In the teacher upgrade dialog, teachers only see the clean <strong>&quot;Open in Messenger&quot;</strong> button. The raw link and configuration are completely hidden and not editable by teachers.
                  </p>
                </div>

                {/* Save Button */}
                <div className="pt-2 flex items-center justify-end">
                  <button
                    type="submit"
                    disabled={savingSettings || loadingSettings}
                    className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md transition flex items-center gap-2 disabled:opacity-50"
                  >
                    {savingSettings ? (
                      <>
                        <RefreshCw size={15} className="animate-spin" />
                        <span>Saving Settings...</span>
                      </>
                    ) : (
                      <>
                        <Save size={15} />
                        <span>Save Messenger &amp; Contact Settings</span>
                      </>
                    )}
                  </button>
                </div>

              </form>

            </div>
          )}

          {/* Footer */}
          <div className="p-4 bg-white border-t border-slate-200 shrink-0 flex items-center justify-between text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span>Logged into Google Sheets Registry via Google Apps Script Proxy.</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 font-semibold text-slate-700 rounded-xl transition"
            >
              Close Portal
            </button>
          </div>
        </div>
      )}

      {/* Full Size Receipt Viewer Modal */}
      {selectedReceiptImage && (
        <div
          className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-fade-in"
          onClick={() => setSelectedReceiptImage(null)}
        >
          <div
            className="relative max-w-2xl max-h-[90vh] bg-white rounded-2xl overflow-hidden shadow-2xl p-2 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-2 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <ImageIcon size={15} /> Payment Receipt Photo
              </span>
              <button
                type="button"
                onClick={() => setSelectedReceiptImage(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>
            <div className="overflow-auto p-2 flex-1 flex items-center justify-center bg-slate-950 rounded-xl">
              <img
                src={selectedReceiptImage}
                alt="Enlarged Receipt"
                className="max-h-[75vh] w-auto object-contain rounded-lg shadow-md"
              />
            </div>
            <div className="p-2 text-center text-xs text-slate-500">
              Verify the amount, transaction date, and reference number in your GCash / Maya merchant record.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
