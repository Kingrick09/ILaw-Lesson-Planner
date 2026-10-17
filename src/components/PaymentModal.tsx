import React, { useState, useEffect, useRef } from "react";
import { 
  Check, 
  ShieldCheck, 
  Sparkles, 
  X, 
  ExternalLink, 
  AlertCircle,
  Copy,
  Clock,
  CheckCircle2,
  Upload,
  Image as ImageIcon,
  Trash2,
  RefreshCw,
  ArrowRight,
  FileCheck2,
  Lock
} from "lucide-react";
import { PaymentPlan, PaymentActivationRequest } from "../types";

// Authentic Facebook Messenger Icon SVG
export function MessengerIcon({ className = "w-5 h-5", size }: { className?: string; size?: number }) {
  return (
    <svg 
      viewBox="0 0 24 24" 
      fill="currentColor"
      className={className}
      style={size ? { width: size, height: size } : undefined}
    >
      <path d="M12 2C6.477 2 2 6.145 2 11.258c0 2.91 1.455 5.518 3.735 7.195V22l3.414-1.874c.905.251 1.862.388 2.851.388 5.523 0 10-4.145 10-9.256C22 6.145 17.523 2 12 2zm1.066 12.435l-2.613-2.787-5.097 2.787 5.607-5.952 2.68 2.787 5.03-2.787-5.607 5.952z" />
    </svg>
  );
}

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail: string;
  userName?: string;
  onPaymentSuccess: (days: number, message: string) => void;
  initialReason?: "expired" | "upgrade" | "manual";
}

const DEFAULT_PLANS: PaymentPlan[] = [
  {
    id: "monthly",
    name: "Monthly Educator Plan",
    tagline: "30 Days Full Access",
    pricePhp: 199,
    amountInCents: 19900,
    days: 30,
    durationLabel: "30 Days (1 Month)",
    popular: false,
    features: [
      "Unlimited DepEd Lesson Plan Generation",
      "PowerPoint / Visual Slide Decks",
      "Direct Google Sheets Cloud Backup",
      "PDF and Printable Formatting",
      "Priority Customer Care"
    ]
  },
  {
    id: "quarterly",
    name: "Quarterly Academic Term Pass",
    tagline: "90 Days (Full School Term)",
    pricePhp: 499,
    amountInCents: 49900,
    days: 90,
    durationLabel: "90 Days (3 Months)",
    popular: true,
    features: [
      "All Monthly Features Included",
      "Full DepEd Quarter / Term Coverage",
      "Priority AI Generation Queue",
      "Direct Google Sheets Cloud Backup",
      "Fast-track Messenger Activation"
    ]
  },
  {
    id: "annual",
    name: "Annual All-Access Pass",
    tagline: "365 Days (Full School Year)",
    pricePhp: 999,
    amountInCents: 99900,
    days: 365,
    durationLabel: "365 Days (1 Full Year)",
    popular: false,
    features: [
      "Full Academic Year Access",
      "All Future Curriculum Updates",
      "VIP Generation Speed & Processing",
      "Direct Google Sheets Cloud Backup",
      "Dedicated Messenger Support"
    ]
  }
];

export default function PaymentModal({
  isOpen,
  onClose,
  userEmail,
  userName,
  onPaymentSuccess,
  initialReason = "expired",
}: PaymentModalProps) {
  const [plans, setPlans] = useState<PaymentPlan[]>(DEFAULT_PLANS);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("quarterly");
  const [messengerLink, setMessengerLink] = useState<string>("");
  const [customNote, setCustomNote] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [referenceCode, setReferenceCode] = useState("");
  const [receiptImage, setReceiptImage] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successInfo, setSuccessInfo] = useState<string | null>(null);
  const [activeRequest, setActiveRequest] = useState<PaymentActivationRequest | null>(null);
  const [isEditingProof, setIsEditingProof] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch available plans and Messenger configuration from backend
  useEffect(() => {
    fetch("/api/payment/plans")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          if (data.plans && Array.isArray(data.plans) && data.plans.length > 0) {
            setPlans(data.plans);
          }
          if (data.messengerLink) {
            setMessengerLink(data.messengerLink);
          }
        }
      })
      .catch((err) => console.error("Could not fetch payment plans:", err));
  }, []);

  // Check if user has an existing payment activation request
  const fetchUserRequestStatus = async (showLoadingSpinner = false) => {
    if (!userEmail) return;
    if (showLoadingSpinner) setCheckingStatus(true);

    try {
      const res = await fetch(`/api/payment/request-status?email=${encodeURIComponent(userEmail)}`);
      const data = await res.json();

      if (data.success && data.hasRequest && data.request) {
        setActiveRequest(data.request);
        if (data.request.planId) {
          setSelectedPlanId(data.request.planId);
        }
        if (data.request.referenceNumber) {
          setReferenceCode(data.request.referenceNumber);
        }
        if (data.request.receiptImage) {
          setReceiptImage(data.request.receiptImage);
        }

        // If approved by admin, inform user they can proceed
        if (data.isApproved) {
          setSuccessInfo(`Payment verified by administrator! Your account has been activated for +${data.request.days} days in Google Sheet.`);
        }
      }
    } catch (err) {
      console.error("Status check failed:", err);
    } finally {
      if (showLoadingSpinner) setCheckingStatus(false);
    }
  };

  useEffect(() => {
    if (isOpen && userEmail) {
      fetchUserRequestStatus();

      // Poll periodically if there is a pending request
      pollIntervalRef.current = setInterval(() => {
        fetchUserRequestStatus(false);
      }, 6000);
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [isOpen, userEmail]);

  if (!isOpen) return null;

  const currentPlan = plans.find((p) => p.id === selectedPlanId) || plans[1] || DEFAULT_PLANS[1];
  const teacherName = userName || "Teacher";
  const teacherEmail = userEmail || "educator@deped.gov.ph";
  const todayFormatted = new Date().toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  // Construct structured Messenger message content based on the selected plan
  const generateOrderMessage = () => {
    let msg = `Kumusta! I would like to upgrade my MATATAG / ILAW AI Lesson Planner account.\n\n`;
    msg += `📋 SELECTED PLAN:\n`;
    msg += `• Plan: ${currentPlan.name}\n`;
    msg += `• Duration: ${currentPlan.durationLabel} (+${currentPlan.days} days)\n`;
    msg += `• Price: ₱${currentPlan.pricePhp}.00\n\n`;
    msg += `👤 TEACHER ACCOUNT DETAILS:\n`;
    msg += `• Account Email: ${teacherEmail}\n`;
    msg += `• Educator Name: ${teacherName}\n`;
    msg += `• Request Date: ${todayFormatted}\n`;
    if (customNote.trim()) {
      msg += `• Notes/Preferred Payment: ${customNote.trim()}\n`;
    }
    msg += `\nPlease send the payment instructions (GCash, Maya, or Bank Transfer) so I can complete the upgrade. Maraming salamat!`;
    return msg;
  };

  const messageText = generateOrderMessage();

  // Normalize Messenger link to valid URL (hidden from display, used solely for button action)
  const getResolvedMessengerUrl = () => {
    const raw = (messengerLink || "").trim();
    if (!raw) {
      return "https://m.me";
    }
    if (raw.startsWith("http://") || raw.startsWith("https://")) {
      return raw;
    }
    if (raw.startsWith("m.me/")) {
      return `https://${raw}`;
    }
    return `https://m.me/${raw}`;
  };

  const resolvedMessengerUrl = getResolvedMessengerUrl();

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(messageText);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      console.error("Failed to copy message:", err);
    }
  };

  const handleOpenMessengerClick = async () => {
    try {
      await navigator.clipboard.writeText(messageText);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // Ignore copy error
    }
    setSuccessInfo("Opening Messenger! Your upgrade request details have been copied to your clipboard. Simply paste them in the chat!");
  };

  // Receipt image file selector
  const handleReceiptFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage("Receipt photo must be smaller than 5MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setReceiptImage(reader.result as string);
      setErrorMessage("");
    };
    reader.readAsDataURL(file);
  };

  // Submit payment proof for administrator review
  const handleSubmitProof = async () => {
    if (!userEmail) {
      setErrorMessage("Please ensure your account email is registered before submitting.");
      return;
    }

    const trimmedRef = referenceCode.trim();
    const trimmedImg = receiptImage.trim();

    if (!trimmedRef && !trimmedImg) {
      setErrorMessage("Please enter your payment reference number or upload a picture of your receipt.");
      return;
    }

    setSubmitting(true);
    setErrorMessage("");

    try {
      const res = await fetch("/api/payment/submit-proof", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: userEmail,
          name: teacherName,
          planId: currentPlan.id,
          referenceNumber: trimmedRef,
          receiptImage: trimmedImg,
          notes: customNote.trim()
        }),
      });

      const data = await res.json();

      if (data.success && data.request) {
        setActiveRequest(data.request);
        setIsEditingProof(false);
        setSuccessInfo("Payment proof successfully submitted! The administrator will review your payment and activate your account in the Google Sheet with automatic days.");
      } else {
        throw new Error(data.message || "Could not submit payment proof.");
      }
    } catch (err: any) {
      console.error("Proof submission error:", err);
      setErrorMessage(err.message || "Failed to submit payment proof. Please check your network connection.");
    } finally {
      setSubmitting(false);
    }
  };

  // When admin has approved, teacher clicks Proceed
  const handleProceedAfterApproval = () => {
    if (activeRequest && activeRequest.status === "approved") {
      onPaymentSuccess(
        activeRequest.days,
        `Account activated! +${activeRequest.days} days registered in Google Sheet.`
      );
      onClose();
    }
  };

  const isPending = activeRequest?.status === "pending";
  const isApproved = activeRequest?.status === "approved";
  const isRejected = activeRequest?.status === "rejected";

  return (
    <div
      id="payment-modal-overlay"
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto"
    >
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6 animate-fade-in relative flex flex-col max-h-[94vh]">
        
        {/* Header with Facebook Messenger Theme */}
        <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-blue-950 text-white p-5 sm:p-6 relative shrink-0">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-blue-100 hover:text-white transition"
            title="Close"
          >
            <X size={18} />
          </button>

          <div className="flex items-center gap-3 mb-2">
            <div className="h-11 w-11 rounded-2xl bg-gradient-to-tr from-[#006AFF] to-[#00B2FF] flex items-center justify-center text-white shadow-lg shadow-blue-500/25 shrink-0">
              <MessengerIcon size={24} className="fill-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="inline-flex items-center gap-1.5 bg-[#0084FF]/20 text-[#60b6ff] font-mono text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border border-[#0084FF]/40">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#0084FF] animate-ping" />
                  Messenger Direct Upgrade
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold font-display text-white tracking-tight">
                {initialReason === "expired"
                  ? "5-Day Free Trial Ended"
                  : "Upgrade Educator Subscription"}
              </h2>
            </div>
          </div>

          <p className="text-blue-100/90 text-xs sm:text-sm mt-1 max-w-xl leading-relaxed">
            Select your plan, send your payment on Messenger, and submit your reference number or receipt photo. Once payment is confirmed, the administrator will activate your account in the Google Sheet.
          </p>

          {/* Supported Methods Badge */}
          <div className="mt-4 pt-3 border-t border-blue-800/60 flex flex-wrap items-center gap-2 text-[11px] text-blue-200">
            <span className="font-semibold text-white flex items-center gap-1">
              <ShieldCheck size={14} className="text-blue-300" /> Payment via Messenger:
            </span>
            <span className="bg-white/15 px-2.5 py-0.5 rounded font-bold text-white border border-white/10">GCash</span>
            <span className="bg-white/15 px-2.5 py-0.5 rounded font-bold text-white border border-white/10">Maya</span>
            <span className="bg-white/15 px-2.5 py-0.5 rounded font-bold text-white border border-white/10">Bank Transfer</span>
            <span className="bg-white/15 px-2.5 py-0.5 rounded font-bold text-white border border-white/10">Admin Google Sheet Activation</span>
          </div>
        </div>

        {/* Content Area */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50/50">
          
          {/* User Account Details Bar */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs shadow-sm">
            <div>
              <span className="text-slate-500 font-medium">Subscribing Teacher Account:</span>{" "}
              <strong className="text-slate-900 font-mono font-bold">{teacherEmail}</strong>
            </div>
            <div className="text-blue-700 font-semibold flex items-center gap-1.5">
              <Sparkles size={14} className="text-blue-600" /> Google Sheet Sync Included
            </div>
          </div>

          {/* Step 1: Plans Grid */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                Step 1: Choose Subscription Plan
              </label>
              <span className="text-[11px] text-slate-500">Days calculated automatically</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {plans.map((plan) => {
                const isSelected = selectedPlanId === plan.id;
                return (
                  <div
                    key={plan.id}
                    onClick={() => {
                      if (!isPending || isEditingProof) {
                        setSelectedPlanId(plan.id);
                      }
                    }}
                    className={`relative rounded-xl p-4 cursor-pointer transition border-2 flex flex-col justify-between ${
                      isSelected
                        ? "border-blue-600 bg-blue-50/60 shadow-md ring-2 ring-blue-500/20 scale-[1.01]"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80 shadow-sm"
                    } ${isPending && !isEditingProof ? "opacity-90" : ""}`}
                  >
                    {plan.popular && (
                      <span className="absolute -top-2.5 right-3 bg-amber-500 text-slate-950 font-extrabold text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full shadow-sm">
                        Recommended
                      </span>
                    )}

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-bold text-slate-900 text-sm">{plan.name}</span>
                        <div
                          className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                            isSelected
                              ? "border-blue-600 bg-blue-600 text-white"
                              : "border-slate-300"
                          }`}
                        >
                          {isSelected && <Check size={10} strokeWidth={3} />}
                        </div>
                      </div>

                      <div className="flex items-baseline gap-1 my-2">
                        <span className="text-2xl font-extrabold text-slate-900">₱{plan.pricePhp}</span>
                        <span className="text-xs text-slate-500 font-medium">/ {plan.durationLabel}</span>
                      </div>

                      <div className="inline-block bg-blue-100 text-blue-900 font-bold text-[10px] px-2 py-0.5 rounded-md mb-2">
                        +{plan.days} Days Automatic Access
                      </div>

                      <p className="text-[11px] text-slate-500 mb-3">{plan.tagline}</p>
                    </div>

                    <ul className="space-y-1.5 pt-3 border-t border-slate-100 text-[11px] text-slate-600">
                      {plan.features.slice(0, 3).map((feat, idx) => (
                        <li key={idx} className="flex items-center gap-1.5">
                          <Check size={12} className="text-blue-600 shrink-0" />
                          <span className="line-clamp-1">{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Step 2: Messenger Message Preview */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <MessengerIcon size={14} className="text-[#0084FF]" />
                Step 2: Message Details for Messenger Chat
              </label>
              <button
                type="button"
                onClick={handleCopyMessage}
                className="text-xs font-semibold text-blue-700 hover:text-blue-800 flex items-center gap-1 transition"
              >
                {copied ? (
                  <>
                    <Check size={13} className="text-blue-600" />
                    <span>Copied to Clipboard!</span>
                  </>
                ) : (
                  <>
                    <Copy size={13} />
                    <span>Copy Message</span>
                  </>
                )}
              </button>
            </div>

            {/* Messenger Chat Bubble Card */}
            <div className="bg-slate-100 p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-inner relative">
              <div className="bg-white rounded-lg p-3 sm:p-4 shadow-sm border border-slate-200/80 text-xs font-mono text-slate-800 space-y-2 relative">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 text-[11px] font-sans text-slate-500">
                  <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#0084FF]" />
                    Official Messenger Upgrade Support
                  </span>
                  <span>{todayFormatted}</span>
                </div>

                <div className="whitespace-pre-line leading-relaxed text-slate-800 font-sans text-[12px]">
                  {messageText}
                </div>
              </div>
            </div>

            {/* Optional note input */}
            <div className="pt-1">
              <input
                type="text"
                value={customNote}
                onChange={(e) => setCustomNote(e.target.value)}
                placeholder="Optional: Add payment note (e.g. 'Paid via GCash 0917xxxxxxx', 'Sent receipt')"
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 transition"
              />
            </div>
          </div>

          {/* Feedback & Notifications */}
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2 animate-fade-in">
              <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
              <div>
                <strong>Notice:</strong> {errorMessage}
              </div>
            </div>
          )}

          {successInfo && (
            <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-950 space-y-1 animate-fade-in">
              <div className="flex items-center gap-2 font-bold text-blue-900">
                <CheckCircle2 size={16} className="text-blue-600 shrink-0" />
                <span>{successInfo}</span>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════════
              STEP 3: CONFIRM ACCOUNT ACTIVATION & ADMIN PAYMENT REVIEW
             ══════════════════════════════════════════════════════════════════════ */}
          <div className="p-4 sm:p-5 bg-white border-2 border-blue-300 rounded-2xl shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
                  3
                </div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                  Step 3: Confirm Account Activation
                </h3>
              </div>

              {/* Automatic days badge */}
              <span className="text-[11px] font-bold bg-emerald-100 text-emerald-900 px-3 py-1 rounded-full border border-emerald-300 flex items-center gap-1">
                <Sparkles size={12} className="text-emerald-600" />
                Automatic: +{currentPlan.days} Days
              </span>
            </div>

            {/* Condition 1: User has an APPROVED request */}
            {isApproved && !isEditingProof ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center space-y-3 animate-fade-in">
                <div className="h-12 w-12 mx-auto rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <CheckCircle2 size={28} />
                </div>
                <div>
                  <h4 className="font-bold text-emerald-950 text-base">
                    Payment Confirmed &amp; Account Activated!
                  </h4>
                  <p className="text-xs text-emerald-800 mt-1">
                    The administrator has confirmed your payment and activated your account in the Google Sheet for <strong>+{activeRequest?.days || currentPlan.days} days</strong>.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleProceedAfterApproval}
                  className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-md transition flex items-center justify-center gap-2"
                >
                  <span>Proceed to AI Lesson Planner</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            ) : isPending && !isEditingProof ? (
              /* Condition 2: User is PENDING ADMIN REVIEW */
              <div className="bg-amber-50/80 border border-amber-300 rounded-xl p-4 space-y-3 animate-fade-in">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 border border-amber-300">
                    <Clock size={22} className="animate-pulse" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full">
                        Awaiting Admin Review
                      </span>
                      <span className="text-xs text-slate-500 font-mono">
                        Plan: {activeRequest?.planName}
                      </span>
                    </div>
                    <h4 className="font-bold text-slate-900 text-sm mt-1">
                      Payment Proof Submitted — Activation Required Before Proceeding
                    </h4>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      Your payment proof has been submitted. The administrator is currently reviewing if your payment was completed. 
                      Once verified, the administrator will activate your user in the Google Sheet with <strong>+{activeRequest?.days} days</strong> automatically.
                    </p>
                  </div>
                </div>

                {/* Proof Summary Card */}
                <div className="bg-white rounded-lg p-3 border border-amber-200 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Reference Number:</span>
                    <strong className="font-mono text-slate-900">
                      {activeRequest?.referenceNumber || "None (Receipt image provided)"}
                    </strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Plan Duration:</span>
                    <span className="font-bold text-blue-700">
                      +{activeRequest?.days} Days (Automatic on Approval)
                    </span>
                  </div>
                  {activeRequest?.receiptImage && (
                    <div className="pt-2 border-t border-slate-100 flex items-center gap-3">
                      <span className="text-slate-500 shrink-0">Attached Receipt:</span>
                      <img
                        src={activeRequest.receiptImage}
                        alt="Receipt proof thumbnail"
                        className="h-12 w-12 object-cover rounded-md border border-slate-200"
                      />
                    </div>
                  )}
                </div>

                {/* Polling & Action Buttons */}
                <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => fetchUserRequestStatus(true)}
                    disabled={checkingStatus}
                    className="w-full sm:flex-1 py-2.5 px-4 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg shadow-sm flex items-center justify-center gap-2 transition disabled:opacity-50"
                  >
                    <RefreshCw size={14} className={checkingStatus ? "animate-spin" : ""} />
                    <span>{checkingStatus ? "Checking with Google Sheet..." : "Check If Admin Activated Account"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsEditingProof(true)}
                    className="w-full sm:w-auto py-2.5 px-3 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg border border-slate-200 transition"
                  >
                    Update Proof / Re-upload
                  </button>
                </div>

                <div className="text-[11px] text-amber-800 text-center flex items-center justify-center gap-1">
                  <Lock size={12} />
                  <span>Access remains locked until administrator confirms payment in Google Sheet.</span>
                </div>
              </div>
            ) : (
              /* Condition 3: Input Form for Reference Number and Receipt Picture */
              <div className="space-y-4 animate-fade-in">
                {isRejected && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900">
                    <strong>Previous Submission Notice:</strong> {activeRequest?.adminRemarks || "Payment could not be verified. Please enter the correct reference number or upload a clear picture of your receipt."}
                  </div>
                )}

                <p className="text-xs text-slate-600 leading-relaxed">
                  Enter your payment <strong>reference number</strong> (from GCash, Maya, or Bank) or upload a <strong>picture of your receipt</strong>. 
                  The administrator will review your payment and activate your account in the Google Sheet. You must be activated before you can proceed.
                </p>

                {/* Input 1: Reference Number */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">
                    Payment Reference Number (GCash / Maya / Bank Ref #):
                  </label>
                  <input
                    type="text"
                    value={referenceCode}
                    onChange={(e) => setReferenceCode(e.target.value)}
                    placeholder="e.g. GCash Ref No. 9023 8471 2019"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white transition"
                  />
                </div>

                {/* Input 2: Picture of Receipt File Upload */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block flex items-center justify-between">
                    <span>Picture of Receipt (Screenshot or Photo):</span>
                    {receiptImage && (
                      <button
                        type="button"
                        onClick={() => setReceiptImage("")}
                        className="text-[11px] text-rose-600 hover:text-rose-700 flex items-center gap-1 font-normal"
                      >
                        <Trash2 size={12} /> Remove Picture
                      </button>
                    )}
                  </label>

                  {!receiptImage ? (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-xl p-4 text-center cursor-pointer bg-slate-50 hover:bg-blue-50/50 transition group"
                    >
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleReceiptFileChange}
                        accept="image/png, image/jpeg, image/webp"
                        className="hidden"
                      />
                      <div className="flex flex-col items-center gap-1.5">
                        <div className="h-9 w-9 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center group-hover:scale-110 transition">
                          <Upload size={18} />
                        </div>
                        <span className="text-xs font-bold text-slate-700 group-hover:text-blue-700">
                          Click to upload receipt photo / screenshot
                        </span>
                        <span className="text-[11px] text-slate-400">
                          PNG, JPG, or WEBP (Max 5MB)
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                      <img
                        src={receiptImage}
                        alt="Receipt preview"
                        className="h-16 w-16 object-cover rounded-lg border border-slate-300 shadow-sm"
                      />
                      <div className="flex-1 text-xs">
                        <span className="font-bold text-slate-800 flex items-center gap-1 text-emerald-700">
                          <CheckCircle2 size={14} /> Receipt Picture Attached
                        </span>
                        <p className="text-slate-500 text-[11px] mt-0.5">
                          The administrator will inspect this receipt to verify your transaction.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Automatic Plan Duration Notice */}
                <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileCheck2 size={16} className="text-blue-600 shrink-0" />
                    <div>
                      <span className="font-bold text-blue-950">Automatic Duration:</span>{" "}
                      <span className="text-blue-800">+{currentPlan.days} Days for {currentPlan.name}</span>
                    </div>
                  </div>
                  <strong className="text-slate-900 font-bold">₱{currentPlan.pricePhp}.00</strong>
                </div>

                {/* Submit Proof Button */}
                <button
                  type="button"
                  onClick={handleSubmitProof}
                  disabled={submitting}
                  className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md flex items-center justify-center gap-2 transition disabled:opacity-50 active:scale-[0.99]"
                >
                  {submitting ? (
                    <>
                      <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Sending to Administrator for Review...</span>
                    </>
                  ) : (
                    <>
                      <Check size={16} />
                      <span>Submit Payment Proof for Admin Activation</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 bg-white border-t border-slate-200 shrink-0 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-600 text-center sm:text-left">
            <span className="font-bold text-slate-900">Selected: {currentPlan.name} (₱{currentPlan.pricePhp}.00)</span> &bull; {currentPlan.days} Days Automatic Access
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <a
              href={resolvedMessengerUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleOpenMessengerClick}
              className="w-full sm:w-auto flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#006AFF] to-[#00B2FF] hover:from-[#005cd9] hover:to-[#009de0] text-white font-bold text-xs sm:text-sm shadow-md shadow-blue-500/20 transition active:scale-[0.98]"
            >
              <MessengerIcon size={18} className="fill-white" />
              <span>Open in Messenger (₱{currentPlan.pricePhp})</span>
              <ExternalLink size={15} />
            </a>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-xl text-slate-600 hover:bg-slate-100 transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
