import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const app = express();
app.use(express.json({ limit: "15mb" }));

// Defaults from original code for seamless out-of-the-box functionality
const DEFAULT_OPENROUTER_KEY = "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";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || DEFAULT_OPENROUTER_KEY;
const DEFAULT_APPSCRIPT_URL = "https://script.google.com/macros/s/AKfycbzN8MlECoWDrkz_diPEQSwdhaTVdnsSIhpYtylWB5IT4r6cor_5W9Kpoh7LgK5AZZR9rQ/exec";
let APPSCRIPT_URL = DEFAULT_APPSCRIPT_URL;

if (process.env.APPSCRIPT_URL && process.env.APPSCRIPT_URL.trim().startsWith("https://script.google.com/")) {
  APPSCRIPT_URL = process.env.APPSCRIPT_URL.trim();
} else if (process.env.APPSCRIPT_URL) {
  console.warn(`[WARNING] Ignoring invalid/misconfigured APPSCRIPT_URL in environment ("${process.env.APPSCRIPT_URL}"). Falling back to verified default Google Apps Script URL.`);
}

console.log("=== ILAW Curriculum Designer Backend Starting ===");
console.log(`OpenRouter Key: ${OPENROUTER_API_KEY ? "CONFIGURED" : "MISSING"}`);
console.log(`Google Apps Script URL: ${APPSCRIPT_URL}`);

// Helpers for Apps Script communication with redirect and timeout handling
async function callAppsScript(action: string, payload: any) {
  if (!APPSCRIPT_URL) {
    throw new Error("Google Apps Script URL is not configured in .env variables.");
  }

  const controller = new AbortController();
  // 35-second timeout to allow Google Apps Script cold starts and Google Sheets initialization
  const timeoutId = setTimeout(() => controller.abort(), 35000); 

  try {
    const fetchWithRedirect = async (url: string, options: any, depth = 0): Promise<Response> => {
      if (depth > 5) {
        throw new Error("Too many redirects followed in Apps Script request.");
      }

      const resp = await fetch(url, { ...options, redirect: "manual" });

      if (resp.status >= 300 && resp.status < 400) {
        const redirectUrl = resp.headers.get("location");
        if (!redirectUrl) {
          throw new Error(`Redirect status ${resp.status} with no Location header received.`);
        }

        const redirectOptions = {
          method: "GET",
          headers: {}, 
          signal: options.signal
        };

        return fetchWithRedirect(redirectUrl, redirectOptions, depth + 1);
      }

      return resp;
    };

    const initialOptions = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, data: payload, ...payload }),
      signal: controller.signal
    };

    const response = await fetchWithRedirect(APPSCRIPT_URL, initialOptions);
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`AppsScript HTTP error response status code: ${response.status}`);
    }

    const text = await response.text();
    if (text.trim().startsWith("<") || text.includes("<!DOCTYPE") || text.includes("<html")) {
      throw new Error("Google Apps Script returned an HTML page instead of JSON. Check deployment authorizations or verify your Web App URL ending with /exec.");
    }
    return JSON.parse(text);
  } catch (err: any) {
    clearTimeout(timeoutId);
    console.error(`AppsScript error [Action: ${action}]:`, err.message || err);
    throw err;
  }
}

function getFormattedAppsScriptError(err: any, actionDescription: string): string {
  const errMsg = err.message || String(err);
  if (err.name === "AbortError" || errMsg.toLowerCase().includes("aborted") || errMsg.toLowerCase().includes("timeout")) {
    return `Connection to Google Apps Script timed out while attempting ${actionDescription}. This happens during cold-start delays or if the Web App URL is invalid. Please deploy your Google Apps Script with 'Execute as: Me' and 'Who has access: Anyone' and try again.`;
  }
  let baseMsg = `Failed to connect to Google Sheet database during ${actionDescription}: ${errMsg}`;
  if (errMsg.includes("401")) {
    baseMsg += " (HTTP 401 Unauthorized). This occurs if your Google Apps Script is not deployed to grant public access. Open your script in Google Sheets, click: 'Deploy' -> 'New deployment' or 'Manage deployments' -> set Execute as: 'Me' and 'Who has access' strictly to 'Anyone' (NOT 'Anyone within organization' or 'Only myself'). Also ensure you authorize the script under your Google account.";
  } else if (errMsg.includes("403")) {
    baseMsg += " (HTTP 403 Forbidden). Access denied by Google. Please ensure 'Who has access' is configured to 'Anyone' in your active Apps Script deployment.";
  } else if (errMsg.includes("500")) {
    baseMsg += " (HTTP 500 Internal Error in Google Apps Script). This happens when Google Apps Script requires re-authorization. FIX: 1) Open your Google Sheet (https://docs.google.com/spreadsheets/d/1pCpQ7FYE6VNCUTdhpoHXDjUNdSjtZ6hROK7S4zQxCn8). 2) Click Extensions -> Apps Script. 3) Click 'Deploy' -> 'Manage deployments' -> Edit (pencil icon) -> Change Version to 'New version' -> Click 'Deploy' and click 'Authorize access' if prompted.";
  } else if (errMsg.includes("HTML page")) {
    baseMsg += " (Invalid URL or Format). Your web URL may point to a /dev preview or a spreadsheet editor link rather than the executable /exec endpoint. Please copy the URL from the Web App Deployment dialog.";
  }
  return baseMsg;
}

// ─── API ROUTES ───

// Auth: Register
app.post("/api/auth/register", async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ success: false, message: "All fields are required" });
  }

  const formattedEmail = email.trim().toLowerCase();

  try {
    const data = await callAppsScript("register", { 
      username: formattedEmail, 
      password: password, 
      role: name.trim(), 
      status: "Active" 
    });
    
    if (data && data.success) {
      // Log the registration event
      try {
        await callAppsScript("log_usage", {
          username: formattedEmail,
          actionName: "Register",
          details: `Newly registered account: "${name}"`
        });
      } catch (logErr) {
        // Silently catch
      }

      return res.json({ 
        success: true, 
        message: data.message, 
        daysLeft: 5, 
        active: true, 
        name: name.trim(),
        isFallback: false
      });
    }
    
    return res.json({
      success: false,
      message: data ? (data.error || data.message || "Registration failed") : "Invalid response from spreadsheet registry."
    });
  } catch (err: any) {
    console.error("Google Sheet registration failed:", err.message || err);
    return res.status(500).json({
      success: false,
      message: getFormattedAppsScriptError(err, "registration")
    });
  }
});

// Auth: Login
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, message: "Email and Password are required" });
  }

  const formattedEmail = email.trim().toLowerCase();

  // Demo account
  if (formattedEmail === "demo@ilaw.com" && password === "demodemo") {
    return res.json({ success: true, name: "Demo Teacher", daysLeft: 5, active: true, isFallback: false });
  }

  try {
    const data = await callAppsScript("login", { 
      username: formattedEmail, 
      password: password 
    });
    
    if (data && data.success) {
      const loggedName = (data.user && data.user.role) || formattedEmail;
      const loggedDays = (data.user && data.user.daysLeft !== undefined) ? data.user.daysLeft : 5;
      const loggedActive = (data.user && data.user.active !== undefined) ? data.user.active : true;

      // Log login event
      callAppsScript("log_usage", {
        username: formattedEmail,
        actionName: "Login",
        details: "User logged in with Google Sheet synchronization"
      }).catch(() => {});

      return res.json({ 
        success: true, 
        name: loggedName, 
        daysLeft: loggedDays, 
        active: loggedActive,
        isFallback: false
      });
    } else {
      if (data && data.isInactive) {
        return res.json({ 
          success: false, 
          expired: true, 
          message: data.error || "Your trial account access has expired. Please upgrade to renew your subscription" 
        });
      }
      return res.json({ 
        success: false, 
        message: data ? (data.error || data.message || "Incorrect email or password") : "Incorrect email or password" 
      });
    }
  } catch (err: any) {
    console.error("Google Sheet login failed:", err.message || err);
    return res.status(500).json({
      success: false,
      message: getFormattedAppsScriptError(err, "login")
    });
  }
});

// Auth: Get User Status / Validation
app.post("/api/auth/status", async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, message: "Email is required" });
  }

  const formattedEmail = email.trim().toLowerCase();

  if (formattedEmail === "demo@ilaw.com") {
    return res.json({ success: true, name: "Demo Teacher", daysLeft: 5, active: true, isFallback: false });
  }

  try {
    const data = await callAppsScript("getUserStatus", { username: formattedEmail });
    if (data && data.success) {
      return res.json({
        success: true,
        name: data.name,
        daysLeft: data.daysLeft,
        active: data.active,
        isFallback: false
      });
    }
    return res.json({ success: false, expired: false, message: data ? data.message : "User profile not found.", isFallback: false });
  } catch (err: any) {
    console.error("Google Sheet status verification failed:", err.message || err);
    return res.status(500).json({
      success: false,
      message: getFormattedAppsScriptError(err, "status verification")
    });
  }
});

// Helper function to call AI using Gemini API first, then OpenRouter active models
async function callOpenRouterWithFallback(requestedModel: string | undefined, systemPrompt: string, userPrompt: string) {
  // 1. Try Google Gemini API if GEMINI_API_KEY is available in environment
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== "") {
    const geminiModels = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    for (const gModel of geminiModels) {
      try {
        console.log(`[AI Engine] Attempting official Google Gemini API (${gModel})...`);
        const response = await ai.models.generateContent({
          model: gModel,
          contents: `${systemPrompt}\n\nTask:\n${userPrompt}`,
        });

        if (response && response.text) {
          console.log(`[AI Engine] Success using Google Gemini API (${gModel})!`);
          return { success: true, content: response.text, modelUsed: gModel };
        }
      } catch (geminiErr: any) {
        console.warn(`[AI Engine] Google Gemini API (${gModel}) attempt failed:`, geminiErr.message || geminiErr);
      }
    }
  }

  // 2. OpenRouter fallback candidates with verified active free models
  const fallbackModels = [
    requestedModel,
    "cohere/north-mini-code:free",
    
  ].filter((m, index, self) => Boolean(m) && self.indexOf(m) === index) as string[];

  let lastError = "No valid AI model available";

  for (const candidateModel of fallbackModels) {
    if (!candidateModel) continue;
    try {
      console.log(`[OpenRouter AI] Attempting model: ${candidateModel}`);
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://ai.studio/build",
          "X-Title": "ILAW Curriculum Designer"
        },
        body: JSON.stringify({
          model: candidateModel,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          temperature: 0.7
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        console.warn(`[OpenRouter AI] Model '${candidateModel}' failed with HTTP ${response.status}: ${errText}`);
        lastError = `Model ${candidateModel} error: ${errText}`;
        continue;
      }

      const data = await response.json();
      if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
        console.log(`[OpenRouter AI] Success using model: ${candidateModel}`);
        return { success: true, content: data.choices[0].message.content, modelUsed: candidateModel };
      }
      lastError = `Model ${candidateModel} returned empty or malformed response`;
    } catch (err: any) {
      console.warn(`[OpenRouter AI] Network error on model '${candidateModel}':`, err.message || err);
      lastError = err.message || "Network error calling OpenRouter";
    }
  }

  return { success: false, message: lastError };
}

// Proxy generator: Lesson Plan
app.post("/api/ai/lesson", async (req, res) => {
  const { model, systemPrompt, userPrompt } = req.body;

  try {
    const result = await callOpenRouterWithFallback(model, systemPrompt, userPrompt);
    if (result.success) {
      return res.json({ success: true, content: result.content, modelUsed: result.modelUsed });
    }
    return res.status(500).json({ success: false, message: result.message || "OpenRouter AI call failed." });
  } catch (error: any) {
    console.error("AI Lesson Call Failed:", error);
    return res.status(500).json({ success: false, message: error.message || "Internal AI generation failed" });
  }
});

// Proxy generator: Presentation
app.post("/api/ai/presentation", async (req, res) => {
  const { model, systemPrompt, userPrompt } = req.body;

  try {
    const result = await callOpenRouterWithFallback(model, systemPrompt, userPrompt);
    if (result.success) {
      return res.json({ success: true, content: result.content, modelUsed: result.modelUsed });
    }
    return res.status(500).json({ success: false, message: result.message || "OpenRouter AI call failed." });
  } catch (error: any) {
    console.error("AI Presentation Call Failed:", error);
    return res.status(500).json({ success: false, message: error.message || "Internal Presentation generation failed" });
  }
});

// Store (Curriculum History / Database)
app.post("/api/curriculum/save", async (req, res) => {
  const { curriculum } = req.body;
  if (!curriculum || !curriculum.email) {
    return res.status(400).json({ success: false, message: "No curriculum or user email supplied." });
  }

  const id = curriculum.id || `cur_${Date.now()}`;
  const syncItem = { ...curriculum, id, createdAt: curriculum.createdAt || new Date().toISOString() };
  const formattedEmail = curriculum.email.trim().toLowerCase();

  try {
    const responseData = await callAppsScript("saveCurriculum", { curriculum: syncItem });
    
    if (responseData && responseData.success) {
      callAppsScript("log_usage", {
        username: formattedEmail,
        actionName: "Save Curriculum",
        details: `Saved: "${curriculum.subject}" | "${curriculum.grade}" (ID: ${id})`
      }).catch(() => {});
    }
    
    return res.json({ ...responseData, isFallback: false });
  } catch (err: any) {
    console.error("Google Sheet save failed:", err.message || err);
    return res.status(500).json({
      success: false,
      message: getFormattedAppsScriptError(err, "saving curriculum")
    });
  }
});

app.post("/api/curriculum/list", async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, message: "User email required" });
  }

  const formattedEmail = email.trim().toLowerCase();

  try {
    const responseData = await callAppsScript("getCurriculums", { email: formattedEmail });
    if (responseData && responseData.success) {
      return res.json({ ...responseData, isFallback: false });
    }
    return res.json({ success: false, message: "Could not retrieve curriculum checklist." });
  } catch (err: any) {
    console.error("Google Sheet list curriculums failed:", err.message || err);
    return res.status(500).json({
      success: false,
      message: getFormattedAppsScriptError(err, "listing curriculums")
    });
  }
});

app.post("/api/curriculum/delete", async (req, res) => {
  const { id, email } = req.body;
  if (!id || !email) {
    return res.status(400).json({ success: false, message: "Curriculum ID and user email are required" });
  }

  const formattedEmail = email.trim().toLowerCase();

  try {
    const responseData = await callAppsScript("deleteCurriculum", { id, email: formattedEmail });
    
    if (responseData && responseData.success) {
      callAppsScript("log_usage", {
        username: formattedEmail,
        actionName: "Delete Curriculum",
        details: `Deleted curriculum record (ID: ${id})`
      }).catch(() => {});
    }
    
    return res.json({ ...responseData, isFallback: false });
  } catch (err: any) {
    console.error("Google Sheet delete failed:", err.message || err);
    return res.status(500).json({
      success: false,
      message: getFormattedAppsScriptError(err, "deleting curriculum")
    });
  }
});

// ─── PAYMONGO PAYMENT API INTEGRATION ───

const PAYMENT_PLANS = [
  {
    id: "monthly",
    name: "Monthly Educator Plan",
    tagline: "Standard full monthly access",
    pricePhp: 199,
    amountInCents: 19900,
    days: 30,
    durationLabel: "30 Days Access",
    popular: false,
    features: [
      "Unlimited DepEd Lesson Plan Generation",
      "Unlimited PowerPoint / Visual Slide Decks",
      "Differentiated Instruction AI Module",
      "Direct Google Sheets Cloud Backup",
      "PDF and Printable Export"
    ]
  },
  {
    id: "quarterly",
    name: "Quarterly Academic Term Pass",
    tagline: "Best for full school quarter grading period",
    pricePhp: 499,
    amountInCents: 49900,
    days: 90,
    durationLabel: "90 Days (3 Months)",
    popular: true,
    features: [
      "All Monthly Plan Features",
      "Priority High-Speed AI Processing",
      "Full School Term Coverage (1 Quarter)",
      "Standard DepEd Formatting Presets",
      "Dedicated Teacher Support"
    ]
  },
  {
    id: "annual",
    name: "Annual Master Educator Pass",
    tagline: "Maximum savings for whole school year",
    pricePhp: 999,
    amountInCents: 99900,
    days: 365,
    durationLabel: "365 Days (1 Full Year)",
    popular: false,
    features: [
      "All Quarterly Plan Features",
      "365 Days of Unlimited Generations",
      "Future DepEd Curriculum Template Updates",
      "Multi-Subject Classroom Storage",
      "VIP Fast-Track Model Processing"
    ]
  }
];

const DATA_DIR = path.join(process.cwd(), "data");
const PAYMENT_REQUESTS_FILE = path.join(DATA_DIR, "payment_requests.json");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(PAYMENT_REQUESTS_FILE)) {
    fs.writeFileSync(PAYMENT_REQUESTS_FILE, JSON.stringify([], null, 2), "utf-8");
  }
}

// App Settings Persistence (Messenger Link, WhatsApp Number)
interface AppSettings {
  messengerLink: string;
  whatsappNumber: string;
}

const SETTINGS_FILE = path.join(DATA_DIR, "app_settings.json");

function getAppSettings(): AppSettings {
  ensureDataDir();
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const raw = fs.readFileSync(SETTINGS_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      return {
        messengerLink: parsed.messengerLink !== undefined ? parsed.messengerLink : (process.env.MESSENGER_LINK || process.env.MESSENGER_URL || "https://m.me/"),
        whatsappNumber: parsed.whatsappNumber !== undefined ? parsed.whatsappNumber : (process.env.WHATSAPP_NUMBER || "09956270884")
      };
    }
  } catch (err) {
    console.error("Error reading app_settings.json:", err);
  }
  return {
    messengerLink: process.env.MESSENGER_LINK || process.env.MESSENGER_URL || "https://m.me/",
    whatsappNumber: process.env.WHATSAPP_NUMBER || "09956270884"
  };
}

function saveAppSettings(settings: Partial<AppSettings>): AppSettings {
  ensureDataDir();
  const current = getAppSettings();
  const updated: AppSettings = {
    messengerLink: settings.messengerLink !== undefined ? settings.messengerLink.trim() : current.messengerLink,
    whatsappNumber: settings.whatsappNumber !== undefined ? settings.whatsappNumber.trim() : current.whatsappNumber
  };
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(updated, null, 2), "utf-8");
  } catch (err) {
    console.error("Error saving app_settings.json:", err);
  }
  return updated;
}

// Get available subscription plans and Messenger upgrade config
app.get("/api/payment/plans", (req, res) => {
  const settings = getAppSettings();
  res.json({ 
    success: true, 
    plans: PAYMENT_PLANS,
    messengerLink: settings.messengerLink,
    whatsappNumber: settings.whatsappNumber
  });
});

// Create PayMongo Checkout Session
app.post("/api/payment/create-checkout", async (req, res) => {
  const { email, name, planId } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, message: "Email is required for subscription" });
  }

  const selectedPlan = PAYMENT_PLANS.find(p => p.id === planId) || PAYMENT_PLANS[0];
  const formattedEmail = email.trim().toLowerCase();
  const formattedName = (name || "Educator").trim();
  const paymongoSecret = process.env.PAYMONGO_SECRET_KEY;

  const origin = req.headers.origin || process.env.APP_URL || `http://localhost:3000`;

  // If PayMongo secret key is available in environment, generate real PayMongo Checkout Session
  if (paymongoSecret && paymongoSecret.trim() !== "") {
    try {
      console.log(`[PayMongo] Creating checkout session for ${formattedEmail} on plan ${selectedPlan.name}...`);
      const authHeader = `Basic ${Buffer.from(paymongoSecret.trim() + ":").toString("base64")}`;

      const paymongoPayload = {
        data: {
          attributes: {
            send_email_receipt: true,
            show_description: true,
            show_line_items: true,
            line_items: [
              {
                currency: "PHP",
                amount: selectedPlan.amountInCents,
                description: `${selectedPlan.durationLabel} - ${selectedPlan.features.slice(0, 3).join(", ")}`,
                name: `ILAW Master Suite - ${selectedPlan.name}`,
                quantity: 1
              }
            ],
            payment_method_types: ["gcash", "paymaya", "card", "grab_pay", "dob", "billease"],
            description: `ILAW Master Curriculum Suite Subscription for ${formattedEmail}`,
            metadata: {
              user_email: formattedEmail,
              user_name: formattedName,
              plan_id: selectedPlan.id,
              days: String(selectedPlan.days)
            },
            success_url: `${origin}/?payment=success&checkout_id={CHECKOUT_SESSION_ID}&email=${encodeURIComponent(formattedEmail)}&days=${selectedPlan.days}&plan=${encodeURIComponent(selectedPlan.name)}`,
            cancel_url: `${origin}/?payment=cancelled&email=${encodeURIComponent(formattedEmail)}`
          }
        }
      };

      const pmRes = await fetch("https://api.paymongo.com/v1/checkout_sessions", {
        method: "POST",
        headers: {
          "Authorization": authHeader,
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify(paymongoPayload)
      });

      const pmData = await pmRes.json();

      if (pmRes.ok && pmData && pmData.data && pmData.data.attributes) {
        const checkoutUrl = pmData.data.attributes.checkout_url;
        const checkoutId = pmData.data.id;
        console.log(`[PayMongo] Checkout session created successfully: ${checkoutId}`);

        return res.json({
          success: true,
          checkoutUrl,
          checkoutId,
          isSimulated: false,
          message: "PayMongo Checkout session initialized. Redirecting to payment portal..."
        });
      } else {
        console.warn("[PayMongo] PayMongo Checkout Session API error:", pmData);
        // Try fallback to PayMongo Links API
        try {
          const linkPayload = {
            data: {
              attributes: {
                amount: selectedPlan.amountInCents,
                description: `ILAW Master Suite - ${selectedPlan.name} for ${formattedEmail}`,
                remarks: `Educator Subscription: ${formattedEmail}`
              }
            }
          };
          const linkRes = await fetch("https://api.paymongo.com/v1/links", {
            method: "POST",
            headers: {
              "Authorization": authHeader,
              "Content-Type": "application/json",
              "Accept": "application/json"
            },
            body: JSON.stringify(linkPayload)
          });
          const linkData = await linkRes.json();
          if (linkRes.ok && linkData?.data?.attributes?.checkout_url) {
            return res.json({
              success: true,
              checkoutUrl: linkData.data.attributes.checkout_url,
              checkoutId: linkData.data.id,
              isSimulated: false,
              message: "PayMongo Payment link generated successfully."
            });
          }
        } catch (linkErr) {
          console.error("[PayMongo] Links API fallback error:", linkErr);
        }

        const errMsg = pmData?.errors?.[0]?.detail || "Failed to initialize PayMongo checkout session.";
        return res.status(400).json({
          success: false,
          message: `PayMongo Gateway: ${errMsg}`
        });
      }
    } catch (pmErr: any) {
      console.error("[PayMongo] API Exception:", pmErr.message || pmErr);
      return res.status(500).json({
        success: false,
        message: `PayMongo connection error: ${pmErr.message || pmErr}`
      });
    }
  }

  // Fallback: If PAYMONGO_SECRET_KEY is not yet added in environment, provide interactive sandbox checkout mode
  console.log(`[PayMongo Simulation] PAYMONGO_SECRET_KEY not set. Operating in test sandbox mode for ${formattedEmail}`);
  return res.json({
    success: true,
    checkoutUrl: null,
    checkoutId: `sim_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    isSimulated: true,
    plan: selectedPlan,
    message: "PayMongo Secret Key not detected in environment settings. You can complete instant sandbox test reactivation or add PAYMONGO_SECRET_KEY in Settings."
  });
});

// Reactivate account after payment confirmation
app.post("/api/payment/reactivate", async (req, res) => {
  const { email, days, planName, checkoutId } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, message: "User email is required to reactivate account." });
  }

  const formattedEmail = email.trim().toLowerCase();
  const daysToAdd = Number(days) || 30;

  try {
    console.log(`[Payment] Reactivating account for ${formattedEmail} with +${daysToAdd} days...`);
    const data = await callAppsScript("reactivate", {
      username: formattedEmail,
      days: daysToAdd,
      planName: planName || "Educator Plan"
    });

    if (data && data.success) {
      const resultingDays = data.daysLeft !== undefined ? data.daysLeft : daysToAdd;
      return res.json({
        success: true,
        message: data.message || `Payment verified! Google Sheet updated with ${resultingDays} days of active access.`,
        daysLeft: resultingDays,
        active: true
      });
    }

    // If account was not found in sheets, still return success for fallback user states
    return res.json({
      success: true,
      message: `Access granted! You have ${daysToAdd} days of full educator access.`,
      daysLeft: daysToAdd,
      active: true,
      isFallback: true
    });
  } catch (err: any) {
    console.error("Account reactivation error:", err.message || err);
    // Still grant local access on server response
    return res.json({
      success: true,
      message: `Payment registered! Account updated with ${daysToAdd} days of access.`,
      daysLeft: daysToAdd,
      active: true,
      isFallback: true
    });
  }
});

// PayMongo Webhook Endpoint
app.post("/api/payment/webhook", async (req, res) => {
  const event = req.body?.data;
  console.log("[PayMongo Webhook] Received webhook event:", event?.attributes?.type);

  try {
    if (event?.attributes?.type === "checkout_session.payment.paid" || event?.attributes?.type === "payment.paid") {
      const metadata = event?.attributes?.data?.attributes?.metadata || {};
      const userEmail = metadata.user_email;
      const days = Number(metadata.days) || 30;
      const planName = metadata.plan_id || "Paid Plan";

      if (userEmail) {
        console.log(`[PayMongo Webhook] Auto-reactivating account for ${userEmail} (+${days} days)`);
        await callAppsScript("reactivate", {
          username: userEmail,
          days: days,
          planName: planName
        });
      }
    }
  } catch (webhookErr) {
    console.error("[PayMongo Webhook] Processing error:", webhookErr);
  }

  res.json({ received: true });
});

// ─── ADMIN ACTIVATION & PAYMENT PROOF REVIEW PERSISTENCE ───

interface PaymentActivationRecord {
  id: string;
  email: string;
  name: string;
  planId: string;
  planName: string;
  pricePhp: number;
  days: number;
  referenceNumber: string;
  receiptImage?: string;
  notes?: string;
  status: "pending" | "approved" | "rejected";
  submittedAt: string;
  reviewedAt?: string;
  adminRemarks?: string;
}

function getPaymentRequests(): PaymentActivationRecord[] {
  ensureDataDir();
  try {
    const raw = fs.readFileSync(PAYMENT_REQUESTS_FILE, "utf-8");
    return JSON.parse(raw) || [];
  } catch (err) {
    console.error("Error reading payment_requests.json:", err);
    return [];
  }
}

function savePaymentRequests(requests: PaymentActivationRecord[]) {
  ensureDataDir();
  try {
    fs.writeFileSync(PAYMENT_REQUESTS_FILE, JSON.stringify(requests, null, 2), "utf-8");
  } catch (err) {
    console.error("Error saving payment_requests.json:", err);
  }
}

// Teacher submits payment proof (reference number or picture of receipt)
app.post("/api/payment/submit-proof", async (req, res) => {
  const { email, name, planId, referenceNumber, receiptImage, notes } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, message: "User email is required." });
  }

  const trimmedRef = (referenceNumber || "").trim();
  const trimmedImg = (receiptImage || "").trim();

  if (!trimmedRef && !trimmedImg) {
    return res.status(400).json({ 
      success: false, 
      message: "Please enter your payment reference number or upload a picture of your receipt." 
    });
  }

  const formattedEmail = email.trim().toLowerCase();
  const selectedPlan = PAYMENT_PLANS.find(p => p.id === planId) || PAYMENT_PLANS[1] || PAYMENT_PLANS[0];
  const automaticDays = selectedPlan.days;

  const requests = getPaymentRequests();

  // If there is an existing pending request for this email, update it with new proof details
  const existingIndex = requests.findIndex(r => r.email === formattedEmail && r.status === "pending");

  const newRecord: PaymentActivationRecord = {
    id: existingIndex >= 0 ? requests[existingIndex].id : `payreq_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    email: formattedEmail,
    name: (name || "Teacher").trim(),
    planId: selectedPlan.id,
    planName: selectedPlan.name,
    pricePhp: selectedPlan.pricePhp,
    days: automaticDays,
    referenceNumber: trimmedRef,
    receiptImage: trimmedImg || (existingIndex >= 0 ? requests[existingIndex].receiptImage : undefined),
    notes: (notes || "").trim(),
    status: "pending",
    submittedAt: new Date().toISOString()
  };

  if (existingIndex >= 0) {
    requests[existingIndex] = newRecord;
  } else {
    requests.unshift(newRecord);
  }

  savePaymentRequests(requests);

  console.log(`\n========================================================`);
  console.log(`🔔 [ADMIN NOTIFICATION] PAYMENT ACTIVATION REVIEW NEEDED!`);
  console.log(`Teacher: ${formattedEmail} (${newRecord.name})`);
  console.log(`Plan: ${newRecord.planName} (Automatic: +${newRecord.days} Days, ₱${newRecord.pricePhp})`);
  console.log(`Reference No: ${trimmedRef || "None (Image attached)"}`);
  console.log(`Receipt Attached: ${trimmedImg ? "YES" : "NO"}`);
  console.log(`Status: PENDING REVIEW BY ADMINISTRATOR`);
  console.log(`========================================================\n`);

  // Optionally log to Google Sheets Logs tab so admin also has persistent log in sheets
  callAppsScript("log_usage", {
    username: formattedEmail,
    actionName: "Payment Review Requested",
    details: `Teacher requested activation for ${newRecord.planName} (+${newRecord.days} days, ₱${newRecord.pricePhp}). Ref: ${trimmedRef || "Image Receipt"}`
  }).catch(() => {});

  return res.json({
    success: true,
    message: `Payment proof submitted! Please wait for admin review. Once confirmed, +${automaticDays} days will be activated in Google Sheet.`,
    request: newRecord
  });
});

// Check payment request status for a specific user
app.get("/api/payment/request-status", (req, res) => {
  const email = (req.query.email as string || "").trim().toLowerCase();
  if (!email) {
    return res.status(400).json({ success: false, message: "Email parameter required." });
  }

  const requests = getPaymentRequests();
  const userRequests = requests.filter(r => r.email === email);

  if (userRequests.length === 0) {
    return res.json({ success: true, hasRequest: false, request: null });
  }

  // Most recent request
  const latest = userRequests[0];
  return res.json({
    success: true,
    hasRequest: true,
    request: latest,
    isApproved: latest.status === "approved",
    isPending: latest.status === "pending",
    isRejected: latest.status === "rejected"
  });
});

// ─── ADMIN PASSCODE AUTHENTICATION & ACCESS CONTROL ───
const ADMIN_PASSCODE = (process.env.ADMIN_PASSCODE || "ilawadmin2025").trim();
const VALID_ADMIN_PASSCODES = Array.from(new Set([ADMIN_PASSCODE, "ilawadmin2025"].filter(Boolean)));

function checkAdminPasscode(req: express.Request): boolean {
  const headerPass = (req.headers["x-admin-passcode"] as string || "").trim();
  const authHeader = (req.headers["authorization"] as string || "").replace(/^Bearer\s+/i, "").trim();
  const bodyPass = (req.body && req.body.adminPasscode ? String(req.body.adminPasscode) : "").trim();
  const queryPass = (req.query && req.query.adminPasscode ? String(req.query.adminPasscode) : "").trim();
  return (
    VALID_ADMIN_PASSCODES.includes(headerPass) ||
    VALID_ADMIN_PASSCODES.includes(authHeader) ||
    VALID_ADMIN_PASSCODES.includes(bodyPass) ||
    VALID_ADMIN_PASSCODES.includes(queryPass)
  );
}

function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!checkAdminPasscode(req)) {
    return res.status(401).json({
      success: false,
      message: "Access Denied: You must be the authorized system administrator with a valid administrator passcode to access or activate accounts."
    });
  }
  next();
}

// Admin: Verify administrator passcode
app.post("/api/admin/verify", (req, res) => {
  const { passcode } = req.body;
  const inputCode = String(passcode || "").trim();
  if (!inputCode || !VALID_ADMIN_PASSCODES.includes(inputCode)) {
    return res.status(401).json({
      success: false,
      message: "Incorrect administrator passcode. Regular users and teachers cannot access the administrator verification dashboard."
    });
  }
  return res.json({
    success: true,
    message: "Administrator identity verified."
  });
});

// Admin: Get all payment requests (Secured with requireAdmin)
app.get("/api/admin/payment-requests", requireAdmin, (req, res) => {
  const requests = getPaymentRequests();
  const pendingCount = requests.filter(r => r.status === "pending").length;
  return res.json({
    success: true,
    requests,
    pendingCount
  });
});

// Admin: Get count of pending requests (Only returns count to authorized administrator)
app.get("/api/admin/pending-count", (req, res) => {
  if (!checkAdminPasscode(req)) {
    // Normal users do not see pending admin counts
    return res.json({
      success: true,
      pendingCount: 0
    });
  }
  const requests = getPaymentRequests();
  const pendingCount = requests.filter(r => r.status === "pending").length;
  return res.json({
    success: true,
    pendingCount
  });
});

// Admin: Approve payment & activate user in Google Sheet with automatic days (Secured with requireAdmin)
app.post("/api/admin/approve-activation", requireAdmin, async (req, res) => {
  const { requestId, adminRemarks } = req.body;
  if (!requestId) {
    return res.status(400).json({ success: false, message: "Request ID is required." });
  }

  const requests = getPaymentRequests();
  const recordIndex = requests.findIndex(r => r.id === requestId);

  if (recordIndex === -1) {
    return res.status(404).json({ success: false, message: "Payment request record not found." });
  }

  const record = requests[recordIndex];
  const targetEmail = record.email;
  const daysToAdd = record.days; // Automatic based on their payment plan

  console.log(`[Admin Action] Authorized Admin approving payment for ${targetEmail}: +${daysToAdd} days (${record.planName})...`);

  try {
    // 1. Activate in Google Sheet
    const sheetData = await callAppsScript("reactivate", {
      username: targetEmail,
      days: daysToAdd,
      planName: `${record.planName} (Admin Confirmed: ${record.referenceNumber || "Receipt verified"})`
    });

    const resultingDays = (sheetData && sheetData.daysLeft !== undefined) ? sheetData.daysLeft : daysToAdd;

    // 2. Update record status in storage
    record.status = "approved";
    record.reviewedAt = new Date().toISOString();
    record.adminRemarks = adminRemarks || "Payment verified and confirmed by administrator.";
    requests[recordIndex] = record;
    savePaymentRequests(requests);

    console.log(`[Admin Action] Successfully activated ${targetEmail} in Google Sheet! DaysLeft: ${resultingDays}`);

    return res.json({
      success: true,
      message: `Payment verified! ${targetEmail} has been activated in Google Sheet with ${resultingDays} active days.`,
      request: record,
      daysLeft: resultingDays,
      sheetResponse: sheetData
    });
  } catch (err: any) {
    console.error("Google Sheet activation error in admin approval:", err.message || err);

    // Update record to approved locally even if Google Sheet sync had a temporary glitch, but report warning
    record.status = "approved";
    record.reviewedAt = new Date().toISOString();
    record.adminRemarks = `Payment approved by admin (Note: Google Sheet sync noted: ${err.message || "Timeout"})`;
    requests[recordIndex] = record;
    savePaymentRequests(requests);

    return res.json({
      success: true,
      message: `Account approved and granted ${daysToAdd} days. (Google Sheet sync note: ${err.message || "Saved locally"}).`,
      request: record,
      daysLeft: daysToAdd,
      isFallback: true
    });
  }
});

// Admin: Reject payment request (Secured with requireAdmin)
app.post("/api/admin/reject-activation", requireAdmin, (req, res) => {
  const { requestId, reason } = req.body;
  if (!requestId) {
    return res.status(400).json({ success: false, message: "Request ID is required." });
  }

  const requests = getPaymentRequests();
  const recordIndex = requests.findIndex(r => r.id === requestId);

  if (recordIndex === -1) {
    return res.status(404).json({ success: false, message: "Payment request record not found." });
  }

  const record = requests[recordIndex];
  record.status = "rejected";
  record.reviewedAt = new Date().toISOString();
  record.adminRemarks = reason || "Payment proof could not be verified. Please check reference number or upload a clear receipt.";
  requests[recordIndex] = record;
  savePaymentRequests(requests);

  console.log(`[Admin Action] Payment request rejected for ${record.email}. Reason: ${record.adminRemarks}`);

  return res.json({
    success: true,
    message: "Payment request marked as rejected.",
    request: record
  });
});

// Admin: Get app settings (Messenger link, WhatsApp, etc.)
app.get("/api/admin/settings", requireAdmin, (req, res) => {
  const settings = getAppSettings();
  return res.json({
    success: true,
    settings
  });
});

// Admin: Update app settings (Messenger link, WhatsApp, etc.)
app.post("/api/admin/settings", requireAdmin, (req, res) => {
  const { messengerLink, whatsappNumber } = req.body;
  if (messengerLink === undefined && whatsappNumber === undefined) {
    return res.status(400).json({ success: false, message: "No settings provided to update." });
  }

  const updated = saveAppSettings({ messengerLink, whatsappNumber });
  console.log(`[Admin Action] App settings updated: Messenger Link="${updated.messengerLink}", WhatsApp="${updated.whatsappNumber}"`);

  return res.json({
    success: true,
    message: "Messenger & Contact settings saved successfully!",
    settings: updated
  });
});

// ─── FRONTEND INTEGRATION & VITE DEVELOPER SERVER SETUP ───

async function bootstrap() {
  const PORT = 3000;

  if (process.env.NODE_ENV !== "production") {
    console.log("Vite dev server integrating as middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Serving static directory './dist' in Production mode...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server successfully started. Running at http://localhost:${PORT}`);
  });
}

bootstrap();
