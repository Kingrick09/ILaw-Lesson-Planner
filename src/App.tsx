/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import AuthModal from "./components/AuthModal";
import SetupGuide from "./components/SetupGuide";
import PaymentModal, { MessengerIcon } from "./components/PaymentModal";
import AdminActivationModal from "./components/AdminActivationModal";
import { User, Curriculum } from "./types";
import {
  WandSparkles,
  Presentation,
  FileDown,
  LogOut,
  Sliders,
  History,
  Settings,
  BookOpen,
  CheckCircle,
  Clock,
  Loader2,
  Trash2,
  PlusCircle,
  CloudLightning,
  RefreshCw,
  FolderOpen,
  AlertTriangle,
  Database,
  CreditCard,
  Sparkles,
  Zap,
  MessageCircle,
  ShieldCheck,
  Bell,
  Lock,
  Printer
} from "lucide-react";
import {
  exportLessonPlanToPdf,
  exportPresentationToPdf,
  exportFlashcardsToPdf,
  printContent
} from "./utils/pdfExport";
import { exportToWord } from "./utils/wordExport";

export default function App() {
  // Authentication & User profile
  const [user, setUser] = useState<User | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [sheetErrorDetails, setSheetErrorDetails] = useState<string | null>(null);
  const [showSetupGuide, setShowSetupGuide] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [isAdminVerified, setIsAdminVerified] = useState<boolean>(() => {
    return !!sessionStorage.getItem("ilaw_admin_passcode");
  });
  const [pendingPaymentsCount, setPendingPaymentsCount] = useState(0);
  const [paymentEmail, setPaymentEmail] = useState("");
  const [paymentReason, setPaymentReason] = useState<"expired" | "upgrade" | "manual">("expired");

  // Form Fields
  const [subject, setSubject] = useState("Science");
  const [grade, setGrade] = useState("Grade 8");
  const [duration, setDuration] = useState("60 Minutes");
  const [competency, setCompetency] = useState(
    "Describe the various structures or organs that help the student understand scientific concepts."
  );
  const [objective, setObjective] = useState(
    "1. Define the core organ functions clearly.\n2. Design a simple map illustrating systemic integration."
  );
  const [context, setContext] = useState(
    "Mixed-ability eighth-grade public school classroom with varied learning speeds and auditory/visual supports."
  );

  // Outputs & History
  const [generatedLesson, setGeneratedLesson] = useState("");
  const [generatedPresentation, setGeneratedPresentation] = useState("");
  const [savedCurriculums, setSavedCurriculums] = useState<Curriculum[]>([]);
  const [activeCurriculumId, setActiveCurriculumId] = useState<string | null>(null);

  // UI state
  const [activeTab, setActiveTab] = useState<"lesson" | "presentation" | "flashcards" | "setup">("lesson");
  const [loadingLesson, setLoadingLesson] = useState(false);
  const [loadingPresentation, setLoadingPresentation] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [showNotification, setShowNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [genTime, setGenTime] = useState<string | null>(null);

  // References for export target selectors
  const lessonSectionRef = useRef<HTMLDivElement>(null);
  const presentationSectionRef = useRef<HTMLDivElement>(null);
  const flashcardsSectionRef = useRef<HTMLDivElement>(null);

  // Run on startup: check session storage, URL payment redirects, and load list
  useEffect(() => {
    const handleInitialSession = async () => {
      // 1. Check for PayMongo return parameters
      const urlParams = new URLSearchParams(window.location.search);
      const paymentStatus = urlParams.get("payment");
      const checkoutId = urlParams.get("checkout_id") || urlParams.get("session_id");
      const emailParam = urlParams.get("email");
      const daysParam = urlParams.get("days");
      const planParam = urlParams.get("plan");

      if (paymentStatus === "success" && emailParam) {
        const daysToAdd = daysParam ? parseInt(daysParam) : 30;
        try {
          const res = await fetch("/api/payment/reactivate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: emailParam,
              days: daysToAdd,
              planName: planParam || "PayMongo Educator Plan",
              checkoutId: checkoutId || "paymongo_success",
            }),
          });
          const data = await res.json();
          if (data.success) {
            triggerToast("success", `PayMongo Payment Confirmed! +${daysToAdd} days added to your subscription.`);
            sessionStorage.setItem("ilaw_session_email", emailParam);
            sessionStorage.setItem("ilaw_session_daysLeft", String(daysToAdd));
            sessionStorage.setItem("ilaw_session_active", "true");
            if (!sessionStorage.getItem("ilaw_session_name")) {
              sessionStorage.setItem("ilaw_session_name", "Teacher");
            }
            setUser({
              email: emailParam,
              name: sessionStorage.getItem("ilaw_session_name") || "Teacher",
              daysLeft: daysToAdd,
              active: true,
            });
            fetchHistory(emailParam);
          }
        } catch (pmErr) {
          console.error("PayMongo post-checkout error:", pmErr);
        }
        window.history.replaceState({}, document.title, window.location.pathname);
      } else if (paymentStatus === "cancelled") {
        triggerToast("error", "PayMongo checkout was cancelled. You can complete your subscription at any time.");
        window.history.replaceState({}, document.title, window.location.pathname);
      }

      // 2. Load stored session if available
      const storedEmail = sessionStorage.getItem("ilaw_session_email");
      const storedName = sessionStorage.getItem("ilaw_session_name");
      const storedDays = sessionStorage.getItem("ilaw_session_daysLeft");
      const storedActive = sessionStorage.getItem("ilaw_session_active");

      if (storedEmail && storedName) {
        const loggedUser: User = {
          email: storedEmail,
          name: storedName,
          daysLeft: storedDays ? parseInt(storedDays) : 5,
          active: storedActive === "true",
        };
        setUser(loggedUser);
        fetchHistory(storedEmail);
      }
      setCheckingAuth(false);
    };

    handleInitialSession();
  }, []);

  const fetchPendingPaymentsCount = async () => {
    const adminPass = sessionStorage.getItem("ilaw_admin_passcode");
    if (!adminPass) {
      setPendingPaymentsCount(0);
      setIsAdminVerified(false);
      return;
    }
    try {
      const res = await fetch("/api/admin/pending-count", {
        headers: { "x-admin-passcode": adminPass }
      });
      const data = await res.json();
      if (data.success && typeof data.pendingCount === "number") {
        setPendingPaymentsCount(data.pendingCount);
        setIsAdminVerified(true);
      } else if (res.status === 401) {
        setIsAdminVerified(false);
        setPendingPaymentsCount(0);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchPendingPaymentsCount();
    const interval = setInterval(fetchPendingPaymentsCount, 8000);
    return () => clearInterval(interval);
  }, []);

  const triggerToast = (type: "success" | "error", message: string) => {
    setShowNotification({ type, message });
    setTimeout(() => {
      setShowNotification(null);
    }, 4000);
  };

  const fetchHistory = async (email: string) => {
    setLoadingHistory(true);
    try {
      const r = await fetch("/api/curriculum/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (r.ok) {
        const d = await r.json();
        if (d.success) {
          setSheetErrorDetails(null);
          if (d.curriculums) {
            setSavedCurriculums(d.curriculums);
          }
        } else {
          setSheetErrorDetails(d.message || "Spreadsheet connection error");
        }
      } else {
        const errText = await r.text();
        setSheetErrorDetails(`Http Server Error: ${errText}`);
      }
    } catch (err: any) {
      console.error("Could not load curriculum history:", err);
      setSheetErrorDetails(err.message || String(err));
    } finally {
      setLoadingHistory(false);
    }
  };

  const loadFromHistory = (item: Curriculum) => {
    setSubject(item.subject);
    setGrade(item.grade);
    setDuration(item.duration);
    setCompetency(item.competency);
    setObjective(item.objective);
    setContext(item.context);
    setGeneratedLesson(item.lessonPlan);
    setGeneratedPresentation(item.presentation);
    setActiveCurriculumId(item.id);
    setActiveTab("lesson");
    triggerToast("success", `Loaded saved lesson: ${item.subject} | ${item.grade}`);
  };

  const createNewWorkspace = () => {
    setSubject("Mathematics");
    setGrade("Grade 10");
    setDuration("60 Minutes");
    setCompetency("");
    setObjective("");
    setContext("");
    setGeneratedLesson("");
    setGeneratedPresentation("");
    setActiveCurriculumId(null);
    triggerToast("success", "Cleared workspace. Start designing your new lesson!");
  };

  const handleAuthSuccess = (email: string, name: string, daysLeft: number, active: boolean, _isFallback?: boolean, errorDetails?: string) => {
    sessionStorage.setItem("ilaw_session_email", email);
    sessionStorage.setItem("ilaw_session_name", name);
    sessionStorage.setItem("ilaw_session_daysLeft", String(daysLeft));
    sessionStorage.setItem("ilaw_session_active", String(active));

    setSheetErrorDetails(errorDetails || null);

    setUser({ email, name, daysLeft, active });
    fetchHistory(email);
    triggerToast("success", `Welcome back, ${name}! Database connection authenticated.`);
  };

  const handleLogout = () => {
    sessionStorage.clear();
    setUser(null);
    setSheetErrorDetails(null);
    // clean states
    setGeneratedLesson("");
    setGeneratedPresentation("");
    setSavedCurriculums([]);
    setActiveCurriculumId(null);
    triggerToast("success", "Session logged out securely.");
  };

  // ─── AI GENERATION PROCESSORS ───

  const generateLesson = async () => {
    if (!user) return;

    // Check trial expiration
    if (user.daysLeft !== undefined && user.daysLeft <= 0) {
      triggerToast("error", "Your 5-day trial has ended. Please subscribe to continue generating lesson plans.");
      setPaymentEmail(user.email);
      setPaymentReason("expired");
      setShowPaymentModal(true);
      return;
    }

    setLoadingLesson(true);
    setGenTime(null);
    setGeneratedLesson("");
    const startTime = performance.now();

    const systemPrompt = `You are an expert DepEd curriculum designer. Generate a complete, highly detailed lesson plan rendered strictly as an HTML table matching the official Department of Education (DepEd) Philippines Lesson Plan template (Escalante National High School format).

OUTPUT RULES:
- Output ONLY valid, clean HTML body content without markdown code fence wrappers (\`\`\`html).
- Wrap the entire lesson plan inside a single, beautifully structured HTML table: \`<table class="deped-lp-table w-full border-collapse border border-slate-700 font-sans text-sm my-4">\`.
- Use \`<tr>\`, \`<th>\`, \`<td>\` elements with clear cell borders (\`border border-slate-600 p-3\`) and shaded section headers (\`bg-slate-200 font-bold text-slate-900 uppercase\`).

EXACT TABLE STRUCTURE TO RENDER:

<table class="deped-lp-table w-full border-collapse border border-slate-700 font-sans text-sm">
  <thead>
    <tr class="bg-slate-200 text-slate-900 font-bold text-center">
      <th colspan="2" class="p-4 text-base uppercase tracking-wide border border-slate-700">
        Republic of the Philippines<br/>
        Department of Education<br/>
        REGION<br/>
        SCHOOLS DIVISION <br/>
        YOUR SCHOOL<br/><br/>
        LESSON PLAN IN ${subject ? subject.toUpperCase() : "ARALING PANLIPUNAN"}
      </th>
    </tr>
  </thead>
  <tbody>
    <tr><td class="w-1/3 font-semibold bg-slate-100 p-2.5 border border-slate-600">Title of Lesson:</td><td class="p-2.5 border border-slate-600">[Specific lesson title]</td></tr>
    <tr><td class="font-semibold bg-slate-100 p-2.5 border border-slate-600">Learning Area:</td><td class="p-2.5 border border-slate-600">${subject}</td></tr>
    <tr><td class="font-semibold bg-slate-100 p-2.5 border border-slate-600">Name of Teacher:</td><td class="p-2.5 border border-slate-600">${user?.name || "Teacher"}</td></tr>
    <tr><td class="font-semibold bg-slate-100 p-2.5 border border-slate-600">Grade level & Section / Time:</td><td class="p-2.5 border border-slate-600">${grade} | [Section & Schedule]</td></tr>
    <tr><td class="font-semibold bg-slate-100 p-2.5 border border-slate-600">No. of Sessions:</td><td class="p-2.5 border border-slate-600">${duration || "1 Session"}</td></tr>
    <tr><td class="font-semibold bg-slate-100 p-2.5 border border-slate-600">References:</td><td class="p-2.5 border border-slate-600">[DepEd Curriculum Guide, textbooks, toolkits]</td></tr>
    <tr><td class="font-semibold bg-slate-100 p-2.5 border border-slate-600">Declaration of AI Use:</td><td class="p-2.5 border border-slate-600">Formulated using AI Assistant (ILAW Master Curriculum Engine) for structured differentiated activities and assessment alignment.</td></tr>

    <!-- INTENTIONS -->
    <tr class="bg-slate-300 font-bold uppercase"><th colspan="2" class="p-2.5 border border-slate-700 text-left text-base">INTENTIONS</th></tr>
    <tr><td class="font-semibold bg-slate-100 p-2.5 border border-slate-600">Learning Competency & Curriculum Standards:</td><td class="p-2.5 border border-slate-600">${competency || "Targeted competency from Revised Curriculum Guide"}</td></tr>
    <tr><td class="font-semibold bg-slate-100 p-2.5 border border-slate-600">Learning Objectives:</td><td class="p-2.5 border border-slate-600">[Unpacked specific, measurable knowledge and skills]</td></tr>
    <tr><td class="font-semibold bg-slate-100 p-2.5 border border-slate-600">Learner Context:</td><td class="p-2.5 border border-slate-600">${context || "Observations on learners' strengths, interests, and potential learning barriers."}</td></tr>

    <!-- LEARNING EXPERIENCE -->
    <tr class="bg-slate-300 font-bold uppercase"><th colspan="2" class="p-2.5 border border-slate-700 text-left text-base">LEARNING EXPERIENCE</th></tr>
    <tr>
      <td class="font-semibold bg-slate-100 p-2.5 border border-slate-600">Pre-Lesson:</td>
      <td class="p-2.5 border border-slate-600">
        <strong>Review / Motivation / Engagement / Presentation of Learning Objectives:</strong><br/>
        • <em>Review Questions:</em> 1., 2., 3.<br/>
        • <em>Motivation & Objectives:</em> Short intro mini-activity leading to discovery.
      </td>
    </tr>
    <tr>
      <td class="font-semibold bg-slate-100 p-2.5 border border-slate-600">Flow (Differentiated Activities):</td>
      <td class="p-2.5 border border-slate-600">
        <strong>Activity (Differentiated Group Tasks):</strong><br/>
        Provide specific titles, materials needed, procedure in bullet list, 2-3 guide questions, and allotted time for Group 1, Group 2, and Group 3.<br/><br/>
        <strong>Analysis Questions:</strong> Discussion & processing questions.<br/><br/>
        <strong>Abstraction / Generalization:</strong> Key questions leading to lesson mastery.<br/><br/>
        <strong>Application:</strong> Real-life practical task.
      </td>
    </tr>
    <tr><td class="font-semibold bg-slate-100 p-2.5 border border-slate-600">Learning Resources:</td><td class="p-2.5 border border-slate-600">[Inclusive learning materials & emergency alternatives]</td></tr>
    <tr><td class="font-semibold bg-slate-100 p-2.5 border border-slate-600">Opportunities for Integration:</td><td class="p-2.5 border border-slate-600">[Cross-curricular links, local context, technology, or N/A]</td></tr>

    <!-- ASSESSMENT -->
    <tr class="bg-slate-300 font-bold uppercase"><th colspan="2" class="p-2.5 border border-slate-700 text-left text-base">ASSESSMENT</th></tr>
    <tr><td class="font-semibold bg-slate-100 p-2.5 border border-slate-600">Formative Assessment:</td><td class="p-2.5 border border-slate-600">[Aligned assessment task, feedback mechanism, accommodations]</td></tr>

    <!-- WAYS FORWARD -->
    <tr class="bg-slate-300 font-bold uppercase"><th colspan="2" class="p-2.5 border border-slate-700 text-left text-base">WAYS FORWARD</th></tr>
    <tr><td class="font-semibold bg-slate-100 p-2.5 border border-slate-600">Extended Learning Opportunities:</td><td class="p-2.5 border border-slate-600">[Reinforcement tasks outside class hours]</td></tr>
    <tr><td class="font-semibold bg-slate-100 p-2.5 border border-slate-600">Reflections:</td><td class="p-2.5 border border-slate-600">[Teacher reflection notes on student engagement and next steps]</td></tr>
  </tbody>
</table>

Fill out every single section completely and thoroughly in HTML!`;

    const userPrompt = `Subject: ${subject}, Grade: ${grade}, Topic: ${objective || "Core concepts"}, Competency: ${competency}, Context: ${context}`;

    try {
      const response = await fetch("/api/ai/lesson", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "nvidia/nemotron-3-super-120b-a12b:free",
          systemPrompt,
          userPrompt,
        }),
      });

      const rData = await response.json();

      if (!response.ok || !rData.success) {
        throw new Error(rData.message || "AI call responded with error. Verify OpenRouter access.");
      }

      const cleanedHtml = rData.content.replace(/```html/g, "").replace(/```/g, "").trim();
      setGeneratedLesson(cleanedHtml);
      setActiveTab("lesson");

      const endTime = performance.now();
      setGenTime(((endTime - startTime) / 1000).toFixed(2));
      triggerToast("success", "Lesson Plan generated successfully!");

      // Auto sync with spreadsheet database right away
      await autoSaveToSpreadsheet(cleanedHtml, generatedPresentation);
    } catch (err: any) {
      triggerToast("error", err.message || "Failed to call OpenRouter AI generator.");
    } finally {
      setLoadingLesson(false);
    }
  };

  const generatePresentation = async () => {
    if (!user) return;

    if (user.daysLeft !== undefined && user.daysLeft <= 0) {
      triggerToast("error", "Your 5-day trial has ended. Please subscribe to continue generating presentations.");
      setPaymentEmail(user.email);
      setPaymentReason("expired");
      setShowPaymentModal(true);
      return;
    }

    if (!generatedLesson) {
      triggerToast("error", "Please generate a lesson plan first.");
      return;
    }
    setLoadingPresentation(true);
    setGeneratedPresentation("");
    setActiveTab("presentation");

    const systemPrompt = "You are an instructional visual designer expert.";
    const presPrompt = `Based on this lesson plan: [${generatedLesson}], generate:
    1. A slide Presentation Deck containing the following: learning competency and learning objective, pre-lesson, activities, guide questions, formative assessment and extended learning opportunities. Wrap each slide in <div class="slide bg-slate-800 text-white p-8 rounded-xl border-4 border-slate-700 min-h-[300px] flex flex-col justify-center mb-8 shadow-md">. Use <h2> for slide titles (color it yellow or amber) and <ul> for content.
    2. each activity must be contained in one slide and add some descriptive unicode symbol or emoji graphics representation to it.
    3. in the Pre-lesson and Formative assessment, instead of presenting the whole content, transform this into either instruction or series of questions.
    4. A set of 5 or more Digital Flashcards with examples. Wrap them in <div class="flashcard-grid grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6"> containing <div class="flashcard bg-amber-50 border-2 border-amber-200 text-slate-800 p-6 rounded-xl hover:shadow-md transition text-center min-h-[160px] flex flex-col justify-center">.
    Return ONLY HTML. Do not include markdown code blocks.`;

    try {
      const response = await fetch("/api/ai/presentation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "nvidia/nemotron-3-super-120b-a12b:free",
          systemPrompt,
          userPrompt: presPrompt,
        }),
      });

      const rData = await response.json();

      if (!response.ok || !rData.success) {
        throw new Error(rData.message || "AI presentation generation response failed");
      }

      const cleanedHtml = rData.content.replace(/```html/g, "").replace(/```/g, "").trim();
      setGeneratedPresentation(cleanedHtml);
      triggerToast("success", "Presentation Slides and Flashcards generated successfully!");

      // Update database item with the newly created presentation slides
      await autoSaveToSpreadsheet(generatedLesson, cleanedHtml);
    } catch (err: any) {
      triggerToast("error", err.message || "Failed to generate Presentation.");
    } finally {
      setLoadingPresentation(false);
    }
  };

  // ─── DIRECT DATABASE EXPORT/SYNC METHODS ───

  const autoSaveToSpreadsheet = async (lesson: string, pres: string) => {
    if (!user) return;

    const id = activeCurriculumId || `curr_${Date.now()}`;
    const itemToSave: Curriculum = {
      id,
      email: user.email,
      subject,
      grade,
      duration,
      competency,
      objective,
      context,
      lessonPlan: lesson,
      presentation: pres,
      createdAt: new Date().toISOString(),
    };

    try {
      const response = await fetch("/api/curriculum/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ curriculum: itemToSave }),
      });
      if (response.ok) {
        const d = await response.json();
        if (d.success) {
          setSheetErrorDetails(null);
          if (!activeCurriculumId) {
            setActiveCurriculumId(id);
          }
          fetchHistory(user.email);
          console.log("Automatically saved successfully.");
        }
      }
    } catch (err: any) {
      console.warn("Could not auto-save, error:", err);
      setSheetErrorDetails(err.message || String(err));
    }
  };

  const manualSave = async () => {
    if (!user) return;
    setLoadingHistory(true);
    const id = activeCurriculumId || `curr_${Date.now()}`;
    const payload: Curriculum = {
      id,
      email: user.email,
      subject,
      grade,
      duration,
      competency,
      objective,
      context,
      lessonPlan: generatedLesson,
      presentation: generatedPresentation,
      createdAt: new Date().toISOString(),
    };

    try {
      const response = await fetch("/api/curriculum/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ curriculum: payload }),
      });
      const d = await response.json();
      if (d.success) {
        setSheetErrorDetails(null);
        triggerToast("success", "Curriculum saved successfully!");
        setActiveCurriculumId(id);
        fetchHistory(user.email);
      } else {
        triggerToast("error", d.message || "Failed to save.");
      }
    } catch (err: any) {
      triggerToast("error", "Failed to connect and save.");
      setSheetErrorDetails(err.message || String(err));
    } finally {
      setLoadingHistory(false);
    }
  };

  const deleteFromHistory = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;
    if (!confirm("Are you sure you want to permanently delete this curriculum from your database?")) return;

    setLoadingHistory(true);
    try {
      const response = await fetch("/api/curriculum/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, email: user.email }),
      });
      const d = await response.json();
      if (d.success) {
        setSheetErrorDetails(null);
        if (activeCurriculumId === id) {
          setActiveCurriculumId(null);
        }
        fetchHistory(user.email);
        triggerToast("success", "Removed curriculum record successfully.");
      } else {
        triggerToast("error", d.message || "Deletion failed.");
      }
    } catch (err: any) {
      triggerToast("error", "Could not delete historical record.");
      setSheetErrorDetails(err.message || String(err));
    } finally {
      setLoadingHistory(false);
    }
  };

  // ─── CLIENT-SIDE EXPORTERS (PDF, Word, PPTX, Print) ───

  const handleExportPDF = async () => {
    let filename = "ILAW-Curriculum.pdf";

    try {
      setExportingPdf(true);

      if (activeTab === "lesson") {
        if (!generatedLesson || generatedLesson.trim() === "") {
          triggerToast("error", "No generated lesson plan content found to export.");
          return;
        }
        filename = `ILAW_Lesson_${subject}_${grade}.pdf`;
        triggerToast("success", "Generating your Lesson Plan PDF...");
        await exportLessonPlanToPdf({
          contentHtml: generatedLesson,
          subject,
          grade,
          teacherName: user?.name || "Teacher",
          duration,
          competency,
          filename,
        });
        triggerToast("success", "Lesson Plan PDF downloaded successfully!");
      } else if (activeTab === "presentation") {
        if (!generatedPresentation || generatedPresentation.trim() === "") {
          triggerToast("error", "No generated presentation slides found to export.");
          return;
        }
        filename = `ILAW_Slides_${subject}_${grade}.pdf`;
        triggerToast("success", "Generating presentation PDF deck...");
        await exportPresentationToPdf({
          contentHtml: generatedPresentation,
          subject,
          grade,
          teacherName: user?.name || "Teacher",
          filename,
        });
        triggerToast("success", "Presentation PDF slides downloaded successfully!");
      } else if (activeTab === "flashcards") {
        if (!generatedPresentation || generatedPresentation.trim() === "") {
          triggerToast("error", "No flashcards found to export.");
          return;
        }
        filename = `ILAW_Flashcards_${subject}_${grade}.pdf`;
        triggerToast("success", "Generating student flashcards PDF...");
        await exportFlashcardsToPdf({
          contentHtml: generatedPresentation,
          subject,
          grade,
          filename,
        });
        triggerToast("success", "Flashcards PDF downloaded successfully!");
      } else {
        triggerToast("error", "Nothing to export on this tab.");
      }
    } catch (err: any) {
      console.error("PDF generation error:", err);
      triggerToast("error", `PDF download failed: ${err.message || "Error"}. You can also use the Print button.`);
    } finally {
      setExportingPdf(false);
    }
  };

  const handlePrint = () => {
    let contentToPrint = "";
    let title = `${subject} (${grade}) - ILAW Curriculum`;

    if (activeTab === "lesson") {
      contentToPrint = generatedLesson;
      title = `DepEd Lesson Plan - ${subject} (${grade})`;
    } else if (activeTab === "presentation") {
      const el = document.querySelector("#presentation-slides-holder");
      contentToPrint = el ? el.innerHTML : generatedPresentation;
      title = `Classroom Presentation - ${subject} (${grade})`;
    } else if (activeTab === "flashcards") {
      const el = document.querySelector("#presentation-flashcards-holder");
      contentToPrint = el ? el.innerHTML : generatedPresentation;
      title = `Review Flashcards - ${subject} (${grade})`;
    }

    if (!contentToPrint || contentToPrint.trim() === "") {
      triggerToast("error", "No active content to print.");
      return;
    }

    printContent(contentToPrint, title);
  };

  const handleExportWord = () => {
    let contentToExport = "";
    let filename = "ILAW-Curriculum.doc";

    if (activeTab === "lesson") {
      if (!generatedLesson || generatedLesson.trim() === "") {
        triggerToast("error", "No generated lesson plan found to export to Word.");
        return;
      }
      contentToExport = generatedLesson;
      filename = `ILAW_Lesson_${subject}_${grade}.doc`;
    } else if (activeTab === "presentation") {
      const el = document.querySelector("#presentation-slides-holder");
      contentToExport = el ? el.innerHTML : generatedPresentation;
      if (!contentToExport || contentToExport.trim() === "") {
        triggerToast("error", "No presentation slides found to export to Word.");
        return;
      }
      filename = `ILAW_Presentation_Slides_${subject}_${grade}.doc`;
    } else if (activeTab === "flashcards") {
      const el = document.querySelector("#presentation-flashcards-holder");
      contentToExport = el ? el.innerHTML : generatedPresentation;
      if (!contentToExport || contentToExport.trim() === "") {
        triggerToast("error", "No flashcards found to export to Word.");
        return;
      }
      filename = `ILAW_Flashcards_${subject}_${grade}.doc`;
    } else {
      triggerToast("error", "No active content to format into Word.");
      return;
    }

    try {
      exportToWord({
        contentHtml: contentToExport,
        subject,
        grade,
        filename,
      });
      triggerToast("success", "Microsoft Word document exported with table formatting.");
    } catch (err: any) {
      console.error("Word export failed:", err);
      triggerToast("error", `Failed to export Word document: ${err.message || "Error"}`);
    }
  };

  const handleExportPPTX = () => {
    // Requires window.PptxGenJS which we imported in index.html
    const PptxGenJS = (window as any).PptxGenJS;
    if (!PptxGenJS) {
      triggerToast("error", "PowerPoint export library is still loading. Please wait.");
      return;
    }

    if (!generatedPresentation) {
      triggerToast("error", "Generate a presentation deck before trying to export.");
      return;
    }

    try {
      const pptx = new PptxGenJS();
      pptx.layout = "LAYOUT_16x9";

      // Parse generated slide elements using DOM parser
      const parser = new DOMParser();
      const doc = parser.parseFromString(generatedPresentation, "text/html");
      const slides = doc.querySelectorAll(".slide");

      if (slides.length === 0) {
        triggerToast("error", "No correctly rendered .slide classes found to pack into PowerPoint.");
        return;
      }

      // 1. Welcome Slide
      const introSlide = pptx.addSlide();
      introSlide.background = { color: "1b5e20" };
      introSlide.addText("ILAW CURRICULUM PRESENTATION", {
        x: 0.5,
        y: 2.0,
        w: "90%",
        h: 1.0,
        fontSize: 36,
        color: "ffa000",
        bold: true,
        align: "center",
      });
      introSlide.addText(`${subject} (${grade}) — Lesson Presentation\nDuration: ${duration}\nCreator: ${user?.name || "Educator"}`, {
        x: 0.5,
        y: 3.2,
        w: "90%",
        h: 1.5,
        fontSize: 18,
        color: "ffffff",
        align: "center",
      });

      // 2. Loop through generated AI Slides
      slides.forEach((slideEl: Element) => {
        const slide = pptx.addSlide();
        slide.background = { color: "263238" }; // Elegant chalkboard theme from standard CSS

        const titleEl = slideEl.querySelector("h2");
        const titleText = titleEl ? titleEl.textContent || "" : "Lesson Material";

        // Add Slide Title
        slide.addText(titleText, {
          x: 0.5,
          y: 0.4,
          w: "90%",
          h: 0.8,
          fontSize: 26,
          color: "ffa000", // Gold yellow
          bold: true,
          border: { type: "solid", color: "546e7a", pt: 1, location: "b" },
        });

        // Add bullets or lists
        const items = slideEl.querySelectorAll("li, p");
        const bodyText: any[] = [];

        items.forEach((item: Element) => {
          const text = item.textContent || "";
          if (text.trim()) {
            bodyText.push({
              text: text.trim(),
              options: {
                bullet: item.tagName === "LI",
                color: "FFFFFF",
                fontSize: 15,
                margin: 4,
              },
            });
          }
        });

        if (bodyText.length > 0) {
          slide.addText(bodyText, {
            x: 0.5,
            y: 1.4,
            w: "90%",
            h: 3.6,
            align: "left",
            valign: "top",
          });
        }
      });

      // 3. Digital Review Flashcards
      const cardElements = doc.querySelectorAll(".flashcard");
      if (cardElements.length > 0) {
        const fSlide = pptx.addSlide();
        fSlide.background = { color: "f8faf8" };
        fSlide.addText("Interactive Review Flashcards", {
          x: 0.5,
          y: 0.3,
          fontSize: 24,
          bold: true,
          color: "1b5e20",
        });

        cardElements.forEach((card: Element, idx: number) => {
          const cardText = card.textContent || "";
          // Grid alignment calculations
          const xPos = idx % 2 === 0 ? 0.6 : 5.8;
          const yPos = idx < 2 ? 1.0 : 3.4;

          fSlide.addText(cardText.trim(), {
            x: xPos,
            y: yPos,
            w: 4.8,
            h: 2.1,
            fill: { color: "fff8e1" },
            line: { color: "ffe082", width: 2 },
            color: "333333",
            fontSize: 14,
            align: "center",
            valign: "middle",
            shape: pptx.ShapeType.rect,
          });
        });
      }

      pptx.writeFile({ fileName: `ILAW_Presentation_${subject}_${grade}.pptx` });
      triggerToast("success", "PowerPoint Slides deck exported and downloaded!");
    } catch (err: any) {
      console.error(err);
      triggerToast("error", "Failed to build slideshow package: " + err.message);
    }
  };

  // Helper parser for flashcards
  const renderInteractiveFlashcards = () => {
    if (!generatedPresentation) return null;

    const parser = new DOMParser();
    const doc = parser.parseFromString(generatedPresentation, "text/html");
    const cards = doc.querySelectorAll(".flashcard");

    if (cards.length === 0) {
      return (
        <div className="text-center py-12 text-slate-400">
          <BookOpen size={48} className="mx-auto mb-3 opacity-40 text-emerald-900" />
          <p className="text-sm font-medium">No custom review cards extracted. Generate a presentation to build cards.</p>
        </div>
      );
    }

    return (
      <div id="presentation-flashcards-holder" className="space-y-6">
        <div className="text-left mb-4">
          <h3 className="font-display text-lg font-bold text-slate-850">Interactive Student Flashcards</h3>
          <p className="text-xs text-slate-500">Formative assessment prompt review triggers</p>
        </div>
        <div ref={flashcardsSectionRef} className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {Array.from(cards).map((card: Element, idx: number) => {
            const cardLines = (card.textContent || "").split("\n").filter(l => l.trim() !== "");
            const title = cardLines[0] || `Flashcard #${idx + 1}`;
            const detailLines = cardLines.slice(1);

            return (
              <div
                key={idx}
                className="bg-amber-50/50 border-2 border-amber-100 hover:border-amber-300 rounded-xl p-6 shadow-sm hover:shadow-md transition text-slate-800 text-left relative overflow-hidden flex flex-col justify-between"
              >
                <div className="absolute top-0 right-0 bg-amber-200 text-amber-900 font-mono text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-bl-lg">
                  Card {idx + 1}
                </div>
                <div>
                  <h4 className="font-display font-black text-amber-900 text-base mb-2.5">{title}</h4>
                  <ul className="list-disc list-inside space-y-1 text-xs text-slate-600 leading-relaxed">
                    {detailLines.map((line, lIdx) => (
                      <li key={lIdx}>{line.replace(/^-\s*/, "")}</li>
                    ))}
                  </ul>
                </div>
                <div className="border-t border-amber-200/50 mt-4 pt-2.5 flex items-center justify-between">
                  <span className="text-[10px] text-amber-800 font-medium font-mono uppercase tracking-widest">Active Review Module</span>
                  <CheckCircle size={14} className="text-amber-600" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderSlidesOnly = () => {
    if (!generatedPresentation) return null;

    const parser = new DOMParser();
    const doc = parser.parseFromString(generatedPresentation, "text/html");
    const slides = doc.querySelectorAll(".slide");

    if (slides.length === 0) {
      return (
        <div className="text-center py-12 text-slate-400">
          <WandSparkles size={48} className="mx-auto mb-3 opacity-40 text-emerald-900" />
          <p className="text-sm font-medium">Please generate the presentation output to view slides hierarchy.</p>
        </div>
      );
    }

    return (
      <div id="presentation-slides-holder" ref={presentationSectionRef} className="space-y-6">
        <div className="text-left mb-2">
          <h3 className="font-display text-lg font-bold text-slate-850">Class Presentation Deck Slides</h3>
          <p className="text-xs text-slate-500">Structured 16:9 lesson components</p>
        </div>
        {Array.from(slides).map((slide: Element, idx: number) => {
          const title = slide.querySelector("h2")?.textContent || `Slide ${idx + 1}`;
          const listItems = slide.querySelectorAll("li");
          const paragraphs = slide.querySelectorAll("p");

          return (
            <div
              key={idx}
              className="deck-slide bg-slate-800 text-white p-7 rounded-2xl shadow-lg border border-slate-700 min-h-[220px] relative overflow-hidden transition hover:-translate-y-0.5 duration-200"
            >
              <div className="absolute top-0 right-0 bg-yellow-500 text-slate-950 font-bold font-mono text-xs px-3.5 py-1.5 rounded-bl-2xl">
                Slide {idx + 1}
              </div>
              <h3 className="text-yellow-400 font-display font-bold text-lg mb-4 border-b border-slate-700 pb-2 flex items-center gap-2">
                📂 {title}
              </h3>
              
              {listItems.length > 0 ? (
                <ul className="list-disc list-inside space-y-2 mt-2 pl-2">
                  {Array.from(listItems).map((li, liIdx) => (
                    <li key={liIdx} className="text-sm text-slate-200 leading-relaxed hover:text-white transition-colors duration-150">
                      {li.textContent}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-sm text-slate-200 whitespace-pre-line leading-relaxed pl-2">
                  {Array.from(paragraphs).map(p => p.textContent).join("\n")}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-emerald-800 mx-auto" />
          <p className="text-sm text-slate-500 font-medium">Connecting to secure ILAW Database...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans flex flex-col relative antialiased">
      
      {/* Dynamic Alert Notification/Toast */}
      {showNotification && (
        <div
          id="toast-alert"
          className={`fixed top-4 right-4 z-50 px-5 py-3.5 rounded-xl shadow-2xl flex items-center gap-3 border transition-all duration-300 transform scale-100 ${
            showNotification.type === "success"
              ? "bg-emerald-900 border-emerald-800 text-emerald-50"
              : "bg-red-950 border-red-900 text-red-100"
          }`}
        >
          <div className="h-6 w-6 rounded-full flex items-center justify-center bg-white/10 shrink-0">
            <CheckCircle size={16} />
          </div>
          <p className="text-xs font-semibold leading-snug">{showNotification.message}</p>
        </div>
      )}

      {/* Auth Gate Overlay */}
      {!user && (
        <AuthModal 
          onSuccess={handleAuthSuccess} 
          onRequestPayment={(email, reason) => {
            setPaymentEmail(email);
            setPaymentReason(reason || "expired");
            setShowPaymentModal(true);
          }}
          onOpenAdminPortal={() => setShowAdminModal(true)}
          pendingAdminCount={pendingPaymentsCount}
        />
      )}

      {/* PayMongo / Messenger Subscription Modal */}
      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => {
          setShowPaymentModal(false);
          fetchPendingPaymentsCount();
        }}
        userEmail={paymentEmail || user?.email || ""}
        userName={user?.name || "Educator"}
        initialReason={paymentReason}
        onPaymentSuccess={(days, message) => {
          triggerToast("success", message);
          sessionStorage.setItem("ilaw_session_daysLeft", String(days));
          sessionStorage.setItem("ilaw_session_active", "true");
          setUser((prev) => 
            prev ? { ...prev, daysLeft: days, active: true } : { email: paymentEmail, name: "Educator", daysLeft: days, active: true }
          );
          if (user?.email || paymentEmail) {
            fetchHistory(user?.email || paymentEmail);
          }
        }}
      />

      {/* Admin Payment Activation & Google Sheet Review Modal */}
      <AdminActivationModal
        isOpen={showAdminModal}
        onClose={() => {
          setShowAdminModal(false);
          setIsAdminVerified(!!sessionStorage.getItem("ilaw_admin_passcode"));
          fetchPendingPaymentsCount();
        }}
        onActivatedUser={(email, days) => {
          fetchPendingPaymentsCount();
          if (user && user.email.toLowerCase() === email.toLowerCase()) {
            setUser({ ...user, daysLeft: days, active: true });
            sessionStorage.setItem("ilaw_session_daysLeft", String(days));
            sessionStorage.setItem("ilaw_session_active", "true");
            fetchHistory(email);
          }
        }}
      />

      {/* Primary Header */}
      <header className="bg-emerald-900 text-white shadow-md border-b border-emerald-950/20 px-4 sm:px-8 py-4 flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0">
        <div className="text-center sm:text-left flex items-center gap-3">
          <div className="bg-white/10 backdrop-blur p-2.5 rounded-xl text-amber-400 border border-white/10 shrink-0">
            <BookOpen size={28} />
          </div>
          <div>
            <h1 className="font-display font-extrabold text-lg sm:text-xl tracking-tight text-white flex items-center gap-2">
              ILAW Master Curriculum Suite
            </h1>
            <p className="text-xs text-emerald-200/90 font-medium italic">
              Professional standards-aligned lesson and visual layout generator
            </p>
          </div>
        </div>

        {user && (
          <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3 shrink-0">
            <div className="bg-white/10 border border-white/10 rounded-xl px-3.5 py-1.5 flex items-center gap-2 text-xs sm:text-sm">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-bold text-slate-100">{user.name}</span>
              {user.daysLeft !== undefined && (
                <button
                  type="button"
                  onClick={() => {
                    setPaymentEmail(user.email);
                    setPaymentReason(user.daysLeft! <= 0 ? "expired" : "upgrade");
                    setShowPaymentModal(true);
                  }}
                  className={`border text-[10px] font-mono leading-none py-1 px-2 rounded-full font-bold ml-1 flex items-center gap-1 transition ${
                    user.daysLeft <= 0
                      ? "bg-rose-500/25 border-rose-400 text-rose-200 hover:bg-rose-500/40"
                      : "bg-amber-400/20 border-amber-400/30 text-amber-300 hover:bg-amber-400/30"
                  }`}
                  title="Click to view subscription options"
                >
                  <Clock size={10} />
                  <span>{user.daysLeft <= 0 ? "0 DAYS LEFT" : `${user.daysLeft} DAYS LEFT`}</span>
                </button>
              )}
            </div>

            {/* Subscribe / Upgrade via Messenger Action */}
            <button
              type="button"
              onClick={() => {
                setPaymentEmail(user.email);
                setPaymentReason(user.daysLeft !== undefined && user.daysLeft <= 0 ? "expired" : "upgrade");
                setShowPaymentModal(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-[#006AFF] to-[#00B2FF] hover:from-[#005cd9] hover:to-[#009de0] text-white transition shadow-sm active:scale-[0.98]"
              title="Upgrade Subscription via Messenger"
            >
              <MessengerIcon size={14} className="fill-white" />
              <span>{user.daysLeft !== undefined && user.daysLeft <= 0 ? "Subscribe" : "Upgrade"}</span>
            </button>

            {/* Admin Payment Activation Review Button (Restricted: ONLY visible if verified as Admin) */}
            {isAdminVerified && (
              <button
                type="button"
                onClick={() => setShowAdminModal(true)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border transition shadow-sm active:scale-[0.98] ${
                  pendingPaymentsCount > 0
                    ? "bg-amber-400 text-slate-950 border-amber-300 ring-2 ring-amber-300/50 hover:bg-amber-300 animate-pulse"
                    : "bg-indigo-900/60 hover:bg-indigo-900 text-indigo-100 border-indigo-400/30"
                }`}
                title="Admin Payment Review & Google Sheet Activation"
              >
                <ShieldCheck size={14} className={pendingPaymentsCount > 0 ? "text-slate-950" : "text-amber-400"} />
                <span>Admin Panel</span>
                {pendingPaymentsCount > 0 && (
                  <span className="px-1.5 py-0.2 bg-rose-600 text-white font-mono text-[10px] font-extrabold rounded-full">
                    {pendingPaymentsCount}
                  </span>
                )}
              </button>
            )}
            
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-xl bg-emerald-950/60 border border-white/10 hover:bg-emerald-950 hover:text-white transition active:scale-[0.98]"
            >
              <LogOut size={14} />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        )}
      </header>

      {/* Trial Expired Alert Banner */}
      {user && user.daysLeft !== undefined && user.daysLeft <= 0 && (
        <div id="trial-expired-banner" className="bg-rose-50/95 border-b border-rose-200 py-3 px-4 sm:px-8 text-xs text-rose-950 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 font-medium shadow-inner animate-fade-in relative z-20">
          <div className="flex items-center gap-2">
            <AlertTriangle className="text-rose-600 shrink-0 h-4.5 w-4.5" />
            <span>
              <strong className="font-bold text-rose-900">5-Day Trial Expired:</strong> Your complimentary access period has concluded. Upgrade via Messenger to continue generating unlimited lesson plans and presentations.
            </span>
          </div>
          <button
            onClick={() => {
              setPaymentEmail(user.email);
              setPaymentReason("expired");
              setShowPaymentModal(true);
            }}
            className="bg-gradient-to-r from-[#006AFF] to-[#00B2FF] hover:from-[#005cd9] hover:to-[#009de0] text-white font-bold text-xs px-4 py-1.5 rounded-lg shadow-sm flex items-center gap-1.5 shrink-0 transition active:scale-[0.98]"
          >
            <MessengerIcon size={13} className="fill-white" />
            <span>Upgrade via Messenger</span>
          </button>
        </div>
      )}

      {/* Google Sheets Sync Alert banner */}
      {sheetErrorDetails && (
        <div id="connection-error-notice" className="bg-amber-50/95 border-b border-amber-200/80 py-3.5 px-4 sm:px-8 text-xs text-amber-950 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 font-medium transition-all shadow-inner animate-fade-in relative z-20">
          <div className="flex items-start md:items-center gap-2.5">
            <AlertTriangle className="text-amber-600 shrink-0 h-4.5 w-4.5 mt-0.5 md:mt-0" />
            <span>
              <strong className="text-amber-900 font-extrabold font-mono font-bold">Google Spreadsheet Connection Alert:</strong> Connection generated an unauthorized response or was not configured. Click <button onClick={() => setShowSetupGuide(true)} className="text-emerald-800 font-extrabold underline hover:text-emerald-950">Setup Sheets Sync</button> to verify your environments.
            </span>
          </div>
          <div className="font-mono bg-amber-100/90 border border-amber-200 rounded-xl py-1 px-3 text-[10px] sm:text-[11px] text-amber-900/90 break-all max-w-full md:max-w-md">
            <strong className="font-bold">Sync warning:</strong> {sheetErrorDetails}
          </div>
        </div>
      )}

      {/* Main Container workspace */}
      <main className="flex-1 w-full max-w-[1500px] mx-auto p-3 sm:p-6 grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-6 overflow-y-auto">
        
        {/* Left Column (Inputs Board & Saved Database list) */}
        <section className="space-y-6 flex flex-col h-full">
          
          {/* Quick Clear Workspace Actions */}
          <div className="flex gap-2 justify-between items-center bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
            <h3 className="font-display font-medium text-xs text-slate-400 uppercase tracking-wider">Lesson Blueprint Workspace</h3>
            <button
              onClick={createNewWorkspace}
              className="flex items-center gap-1 px-3 py-1.5 text-xs text-emerald-700 hover:text-white border border-emerald-200 hover:bg-emerald-700 bg-emerald-50 rounded-lg transition font-bold"
            >
              <PlusCircle size={13} />
              <span>New Lesson</span>
            </button>
          </div>

          {/* Core Settings Card */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-sm border border-slate-200/80 space-y-4">
            <h3 className="font-display font-bold text-sm text-emerald-900 border-b border-slate-100 pb-2.5 flex items-center gap-2">
              <Sliders size={16} className="text-emerald-700" />
              1. Setup Input Parameters
            </h3>

            <div className="grid grid-cols-2 gap-3.5">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Subject Matter</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-slate-800 rounded-lg text-xs font-semibold focus:outline-none focus:border-emerald-600 transition"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Grade Level</label>
                <input
                  type="text"
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-slate-800 rounded-lg text-xs font-semibold focus:outline-none focus:border-emerald-600 transition"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Time Duration</label>
              <input
                type="text"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 text-slate-800 rounded-lg text-xs font-semibold focus:outline-none focus:border-emerald-600 transition"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Learning Competency</label>
              <textarea
                rows={3}
                value={competency}
                onChange={(e) => setCompetency(e.target.value)}
                placeholder="Paste curriculum standard code/text here..."
                className="w-full p-3 bg-slate-50 border border-slate-200 text-slate-800 rounded-lg text-xs focus:outline-none focus:border-emerald-600 transition leading-normal font-sans"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Specific Objectives / Target Topic</label>
              <textarea
                rows={3}
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                placeholder="Measurable student outcomes..."
                className="w-full p-3 bg-slate-50 border border-slate-200 text-slate-800 rounded-lg text-xs focus:outline-none focus:border-emerald-600 transition leading-normal font-sans"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Learner Profile / Classroom Context</label>
              <textarea
                rows={3}
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder="e.g. general mixed background, specific language support elements..."
                className="w-full p-3 bg-slate-50 border border-slate-200 text-slate-800 rounded-lg text-xs focus:outline-none focus:border-emerald-600 transition leading-normal font-sans"
              />
            </div>

            {/* Launch Actions */}
            <div className="space-y-2 pt-2">
              <button
                onClick={generateLesson}
                disabled={loadingLesson || loadingPresentation}
                className="w-full py-3 rounded-xl font-bold text-sm bg-emerald-800 hover:bg-emerald-900 border border-emerald-950 text-white flex items-center justify-center gap-2 transition disabled:opacity-50 select-none shadow hover:shadow-md"
              >
                {loadingLesson ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Analyzing Curriculum...</span>
                  </>
                ) : (
                  <>
                    <WandSparkles size={16} />
                    <span>1. Generate Lesson Plan</span>
                  </>
                )}
              </button>

              {generatedLesson && (
                <button
                  onClick={generatePresentation}
                  disabled={loadingLesson || loadingPresentation}
                  className="w-full py-3 rounded-xl font-bold text-sm bg-white hover:bg-emerald-50 text-emerald-850 border border-emerald-200 flex items-center justify-center gap-2 transition disabled:opacity-50 select-none shadow-sm"
                >
                  {loadingPresentation ? (
                    <>
                      <Loader2 size={16} className="animate-spin text-emerald-800" />
                      <span>Drafting Visual Deck...</span>
                    </>
                  ) : (
                    <>
                      <Presentation size={16} className="text-emerald-800" />
                      <span>2. Generate Slides & assessment</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {genTime && (
              <p className="text-[10px] font-mono text-center text-slate-400">
                Processed in <span className="text-emerald-700 font-bold">{genTime}s</span> using dual-models parameters.
              </p>
            )}
          </div>

          {/* Historical Saved Curriculums */}
          <div className="flex-1 bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 flex flex-col min-h-[300px]">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-3.5 shrink-0">
              <h3 className="font-display font-bold text-sm text-emerald-900 flex items-center gap-2">
                <History size={16} className="text-emerald-700" />
                Curriculum Library
              </h3>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => user && fetchHistory(user.email)}
                  disabled={loadingHistory}
                  className="p-1.5 hover:bg-slate-50 active:bg-slate-100 border border-slate-200 rounded-lg text-slate-500 transition hover:text-emerald-800"
                  title="Refresh connection"
                >
                  <RefreshCw size={12} className={loadingHistory ? "animate-spin" : ""} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2.5 max-h-[380px] pr-1">
              {loadingHistory ? (
                <div className="flex items-center justify-center h-full py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-emerald-800" />
                </div>
              ) : savedCurriculums.length === 0 ? (
                <div className="text-center py-10 text-slate-400 space-y-2">
                  <CloudLightning size={32} className="mx-auto mb-1.5 opacity-30 text-emerald-800" />
                  <p className="text-xs font-semibold">No saved documents linked.</p>
                  <p className="text-[10px] text-slate-400 max-w-[200px] mx-auto leading-relaxed">
                    Create and generate a curriculum lesson plan above. Your entries sync instantly!
                  </p>
                </div>
              ) : (
                savedCurriculums.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => loadFromHistory(item)}
                    className={`p-3 border-2 rounded-xl text-left cursor-pointer transition relative group overflow-hidden ${
                      activeCurriculumId === item.id
                        ? "bg-emerald-50/50 border-emerald-400 shadow-sm"
                        : "bg-slate-50 hover:bg-slate-100 border-slate-200/80 hover:border-slate-300"
                    }`}
                  >
                    <div className="absolute top-2.5 right-2.5 opacity-100 sm:opacity-0 group-hover:opacity-100 transition duration-150">
                      <button
                        onClick={(e) => deleteFromHistory(item.id, e)}
                        className="p-1 rounded bg-white hover:bg-red-50 text-slate-400 hover:text-red-600 border border-slate-200 shadow-sm transition"
                        title="Delete from database"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>

                    <div className="pr-6 space-y-1">
                      <h4 className="font-display font-bold text-xs text-slate-850 truncate">
                        {item.subject} <span className="font-medium text-[10px] text-slate-400">({item.grade})</span>
                      </h4>
                      <p className="text-[10px] text-slate-500 line-clamp-1 italic font-sans">
                        Objective: {item.objective || "No specific objectives listed."}
                      </p>
                      <div className="flex items-center justify-between text-[8px] font-mono font-bold tracking-wider text-slate-400 uppercase pt-1">
                        <span className="text-emerald-700">Saved Record</span>
                        <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {generatedLesson && (
              <div className="mt-4 pt-3.5 border-t border-slate-100 shrink-0">
                <button
                  onClick={manualSave}
                  className="w-full py-2.5 rounded-xl font-bold text-xs bg-emerald-950 hover:bg-emerald-900 border border-emerald-950 text-white flex items-center justify-center gap-2 transition select-none shadow hover:shadow-md"
                >
                  <FolderOpen size={14} className="text-amber-400" />
                  <span>Save to library</span>
                </button>
              </div>
            )}
          </div>

        </section>

        {/* Right Column (View Tab Panel) */}
        <section className="flex flex-col h-full space-y-4">
          
          {/* Main Visual Tabs Nav Bar & Export Actions */}
          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-sm gap-4 shrink-0">
            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => setActiveTab("lesson")}
                className={`px-4 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all ${
                  activeTab === "lesson"
                    ? "bg-white text-emerald-800 shadow"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Lesson Plan
              </button>
              
              {generatedPresentation && (
                <>
                  <button
                    onClick={() => setActiveTab("presentation")}
                    className={`px-4 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all ${
                      activeTab === "presentation"
                        ? "bg-white text-emerald-800 shadow shadow-emerald-700/5"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    Presentation Deck
                  </button>

                  <button
                    onClick={() => setActiveTab("flashcards")}
                    className={`px-4 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all ${
                      activeTab === "flashcards"
                        ? "bg-white text-emerald-800 shadow shadow-emerald-700/5"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    Student Flashcards
                  </button>
                </>
              )}
            </div>

            {/* Quick Export Downloads Actions */}
            {(generatedLesson || generatedPresentation) && activeTab !== "setup" && (
              <div className="flex items-center gap-1.5 justify-end">
                <button
                  onClick={handleExportPDF}
                  disabled={exportingPdf}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-700 hover:text-emerald-800 border border-slate-200 rounded-lg hover:bg-slate-50 bg-white font-bold transition shadow-sm disabled:opacity-60"
                  title="Download as standalone PDF document"
                >
                  {exportingPdf ? (
                    <Loader2 size={14} className="text-rose-600 animate-spin" />
                  ) : (
                    <FileDown size={14} className="text-rose-600" />
                  )}
                  <span>{exportingPdf ? "Exporting..." : "PDF"}</span>
                </button>

                <button
                  onClick={handlePrint}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-700 hover:text-emerald-800 border border-slate-200 rounded-lg hover:bg-slate-50 bg-white font-bold transition shadow-sm"
                  title="Print or Save via Browser (Ctrl+P)"
                >
                  <Printer size={14} className="text-slate-600" />
                  <span>Print</span>
                </button>

                <button
                  onClick={handleExportWord}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs text-slate-700 hover:text-emerald-800 border border-slate-200 rounded-lg hover:bg-slate-50 bg-white font-bold transition shadow-sm"
                  title="Export styled document to Microsoft Word"
                >
                  <FileDown size={14} className="text-blue-600" />
                  <span>Word</span>
                </button>

                {generatedPresentation && (
                  <button
                    onClick={handleExportPPTX}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs text-slate-700 hover:text-emerald-800 border border-slate-200 rounded-lg hover:bg-slate-50 bg-white font-bold transition shadow-sm"
                    title="Export PowerPoint deck (.pptx)"
                  >
                    <FileDown size={14} className="text-amber-500" />
                    <span>PPTX Slides</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Core Content Viewer Panel */}
          <div className="flex-1 bg-white border border-slate-200/80 rounded-2xl shadow-sm p-4 sm:p-8 min-h-[500px] relative overflow-y-auto">
            
            {/* Loading Cover Overlay */}
            {(loadingLesson || loadingPresentation) && (
              <div id="loader" className="absolute inset-0 bg-white/70 backdrop-blur-sm z-10 flex flex-col items-center justify-center space-y-3.5">
                <Loader2 className="h-10 w-10 animate-spin text-emerald-800" />
                <p className="font-display font-bold text-sm text-emerald-900">
                  {loadingLesson ? "Double-AI standard structures modeling in progress..." : "Drafting visual slide layouts..."}
                </p>
                <span className="text-xs text-slate-400 font-medium">Please wait. Processing standard-aligned inputs...</span>
              </div>
            )}

            {/* TAB VIEW: Lesson Plan */}
            {activeTab === "lesson" && (
              <div id="lessonSection" className="slide-enter">
                {generatedLesson ? (
                  <div className="space-y-6">
                    {/* Visual Header */}
                    <div className="bg-emerald-950 text-white rounded-xl p-6 shadow border border-emerald-900 flex justify-between items-center flex-wrap gap-4">
                      <div>
                        <span className="text-[10px] text-amber-400 font-mono font-bold uppercase tracking-widest leading-none">Draft Curriculum Standards</span>
                        <h2 className="font-display text-2xl font-black mt-1 text-white">{subject} — {grade} Topic Plan</h2>
                        <p className="text-xs text-emerald-100 flex items-center gap-1.5 mt-1 font-medium italic">
                          <Clock size={12} /> Unit Time Duration Limit: {duration}
                        </p>
                      </div>
                      <div className="bg-emerald-800 border border-emerald-700 px-3.5 py-1.5 rounded-lg text-[10px] font-mono tracking-widest uppercase font-bold text-amber-300">
                        ILAW Formative Ready
                      </div>
                    </div>

                    {/* Styled Markdown Parser Body */}
                    <div
                      id="lesson-section-content"
                      ref={lessonSectionRef}
                      className="markdown-body text-slate-800 text-left text-sm leading-relaxed space-y-4"
                      dangerouslySetInnerHTML={{ __html: generatedLesson }}
                    />
                  </div>
                ) : (
                  <div className="text-center py-24 text-slate-400 space-y-4 max-w-md mx-auto">
                    <div className="h-20 w-20 mx-auto bg-slate-150 border-2 border-dashed border-slate-300 rounded-full flex items-center justify-center text-slate-400">
                      <WandSparkles size={36} />
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-display font-bold text-sm text-slate-800">No lesson plan generated yet</h4>
                      <p className="text-xs text-slate-400 leading-relaxed px-4">
                        Populate your grade level, competency objectives, and learner context, then launch the artificial intelligence composer!
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB VIEW: Presentation Deck */}
            {activeTab === "presentation" && (
              <div id="presentationSection" className="slide-enter">
                {renderSlidesOnly()}
              </div>
            )}

            {/* TAB VIEW: Digital Flashcards */}
            {activeTab === "flashcards" && (
              <div id="flashcardsSection" className="slide-enter">
                {renderInteractiveFlashcards()}
              </div>
            )}



          </div>

        </section>

      </main>

      {/* Discreet Footer with Administrator Entry Point */}
      <footer className="py-4 px-6 border-t border-slate-200 text-center text-xs text-slate-500 bg-white/60 backdrop-blur flex flex-col sm:flex-row items-center justify-between gap-2 shrink-0">
        <div>
          ILAW Master Curriculum Suite &bull; DepEd Standards Aligned
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowAdminModal(true)}
            className="text-[11px] text-slate-400 hover:text-slate-700 flex items-center gap-1 transition font-medium"
            title="Administrator Sign-In"
          >
            <Lock size={11} />
            <span>Administrator Access</span>
          </button>
        </div>
      </footer>

      {/* Google Sheets Apps Script Setup Guide Modal Overlay */}
      <SetupGuide isOpen={showSetupGuide} onClose={() => setShowSetupGuide(false)} />

    </div>
  );
}
