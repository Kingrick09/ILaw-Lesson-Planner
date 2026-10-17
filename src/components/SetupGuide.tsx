import React, { useState } from "react";
import { Copy, Check, ExternalLink, X, FileText, Settings, ShieldAlert, Award } from "lucide-react";
import { appScriptCode } from "./appScriptCode";

interface SetupGuideProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SetupGuide({ isOpen, onClose }: SetupGuideProps) {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"tutorial" | "code">("tutorial");

  if (!isOpen) return null;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(appScriptCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-emerald-950/80 p-4 backdrop-blur-sm animate-fade-in">
      <div className="relative flex h-full max-h-[640px] w-full max-w-2xl flex-col rounded-3xl border border-emerald-500/20 bg-white shadow-2xl transition-all overflow-hidden">
        
        {/* Banner header decor */}
        <div className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-950 p-6 text-white shrink-0 relative">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 active:bg-white/30 rounded-full transition text-emerald-100"
          >
            <X size={16} />
          </button>
          <div className="flex items-center gap-3">
            <div className="p-2 w-10 h-10 bg-emerald-700/50 rounded-xl flex items-center justify-center border border-emerald-400/30">
              <Settings className="text-emerald-300 animate-spin-slow" size={20} />
            </div>
            <div>
              <h2 className="text-lg font-display font-black tracking-tight select-none">Google Sheets DB Connection</h2>
              <p className="text-xs text-emerald-200/90 font-medium">Configure continuous multi-master record syncing in 2 minutes</p>
            </div>
          </div>
        </div>

        {/* Tab Buttons bar */}
        <div className="flex items-center bg-slate-100 p-1.5 border-b border-slate-200/70 shrink-0 font-display text-xs font-bold font-mono">
          <button
            onClick={() => setActiveTab("tutorial")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl transition ${
              activeTab === "tutorial" 
              ? "bg-white text-emerald-950 shadow-sm border border-slate-200/50" 
              : "text-slate-500 hover:text-emerald-900 hover:bg-slate-200/50"
            }`}
          >
            <Settings size={13} />
            <span>1. STEP-BY-STEP TUTORIAL</span>
          </button>
          
          <button
            onClick={() => setActiveTab("code")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl transition ${
              activeTab === "code" 
              ? "bg-white text-emerald-950 shadow-sm border border-slate-200/50" 
              : "text-slate-500 hover:text-emerald-900 hover:bg-slate-200/50"
            }`}
          >
            <FileText size={13} />
            <span>2. COPY APPS SCRIPT CODE</span>
          </button>
        </div>

        {/* Modal content body viewport */}
        <div className="flex-1 overflow-y-auto p-6 text-slate-700">
          {activeTab === "tutorial" ? (
            <div className="space-y-4 text-[13px] leading-relaxed">
              <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-4 flex gap-3 text-emerald-950 font-medium">
                <Award className="text-emerald-700 shrink-0 mt-0.5" size={17} />
                <span>
                  <strong>Zero-Config Offline Support:</strong> Your workspaces save to local persistent JSON backups while this is empty. Set this up to enable persistent cloud access for all devices or team shares!
                </span>
              </div>

              <h3 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-1.5 font-display select-none">
                <span className="w-5 h-5 bg-emerald-100 text-emerald-950 rounded-full flex items-center justify-center text-[10px] font-mono font-bold">1</span>
                Open Target Google Sheet
              </h3>
              <p className="pl-6 text-slate-500">
                Open your target sheet <a href="https://docs.google.com/spreadsheets/d/1pCpQ7FYE6VNCUTdhpoHXDjUNdSjtZ6hROK7S4zQxCn8/edit?gid=0#gid=0" target="_blank" rel="noopener noreferrer" className="text-emerald-700 font-bold underline hover:text-emerald-800 inline-flex items-center gap-0.5">Click here to open Google Sheet <ExternalLink size={10} /></a>. Inside the Google Sheet menu, click <strong className="text-slate-800">Extensions &rarr; Apps Script</strong>.
              </p>

              <h3 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-1.5 font-display select-none">
                <span className="w-5 h-5 bg-emerald-100 text-emerald-950 rounded-full flex items-center justify-center text-[10px] font-mono font-bold">2</span>
                Insert Code
              </h3>
              <p className="pl-6 text-slate-500">
                Switch to the <strong className="text-slate-800">"Copy Apps Script Code"</strong> tab above, click Copy, delete everything inside the Google Apps Script text editor, and paste the code block. Save changes (floppy icon).
              </p>

              <h3 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-1.5 font-display select-none">
                <span className="w-5 h-5 bg-emerald-100 text-emerald-950 rounded-full flex items-center justify-center text-[10px] font-mono font-bold">3</span>
                Deploy Web Service (Critical Settings)
              </h3>
              <ul className="pl-12 list-decimal space-y-1.5 text-slate-500">
                <li>Click <strong className="text-slate-800">Deploy &rarr; New deployment</strong>.</li>
                <li>Tap the gear icon next to "Select type" and pick <strong className="text-slate-800">Web app</strong>.</li>
                <li>Write <code className="text-slate-900 font-bold">Proxy DB Service</code> as description.</li>
                <li>Ensure <strong>"Execute as"</strong> is set to <strong className="text-emerald-800">"Me (your email)"</strong>.</li>
                <li>Ensure <strong>"Who has access"</strong> is selected as <strong className="text-emerald-800 font-bold underline">"Anyone"</strong> (NOT "Anyone within organization" or "Only myself"). This allows host servers to proxy records.</li>
              </ul>

              {/* Troubleshooting 401 Error Box */}
              <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-4 mt-3 space-y-2 text-amber-950">
                <div className="flex items-center gap-2 font-bold text-amber-900">
                  <ShieldAlert size={16} className="text-amber-700 shrink-0" />
                  <span>Fixing HTTP 401 Unauthorized Errors</span>
                </div>
                <p className="text-xs text-amber-900/80 pl-6 leading-relaxed">
                  If you receive an <strong className="text-amber-900">HTTP 401</strong> error status code, it means Google is blocking the server request due to authentication settings:
                </p>
                <ul className="pl-10 space-y-1.5 list-disc text-xs text-amber-900/80 leading-normal">
                  <li>
                    <strong>Using a Workspace/Corporate Account?</strong> Google Workspace administrators frequently block deploying Apps Scripts with access to "Anyone" outside the company. To bypass this, we highly recommend deploying the script using a standard <strong>personal @gmail.com account</strong>.
                  </li>
                  <li>
                    <strong>Verify 'Who has access' configuration:</strong> When deploying, check that "Who has access" is set strictly to <strong className="text-amber-950 font-semibold text-xs">"Anyone"</strong>, rather than "Anyone within your company network".
                  </li>
                  <li>
                    <strong>Check the URL format:</strong> Make sure you copied the Web App URL from the deployment confirmation window ending with <code className="bg-amber-100 px-1 py-0.2 rounded font-mono font-bold border border-amber-200 text-amber-900">/exec</code>, and NOT the draft URL ending with <code className="bg-amber-100 px-1 font-mono">/dev</code> or the script editor's tool page.
                  </li>
                </ul>
              </div>

              <h3 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-1.5 font-display select-none">
                <span className="w-5 h-5 bg-emerald-100 text-emerald-950 rounded-full flex items-center justify-center text-[10px] font-mono font-bold">4</span>
                Save Environment Secret
              </h3>
              <p className="pl-6 text-slate-400">
                Deploy, authenticate, and copy your generated <strong className="text-slate-800">Web app URL Web macro Link</strong>. Add this into your <code className="bg-slate-100 font-mono text-[11px] text-slate-800 px-1 py-0.5 border border-slate-200 rounded">.env</code> keys with key: <code className="bg-emerald-50 text-emerald-900 font-bold font-mono text-[11px] px-1 py-0.5 rounded border border-emerald-100">APPSCRIPT_URL=https://script.google.com/macros/...</code>!
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-between items-center shrink-0">
                <span className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider">Spreadsheet Adapter Macro Engine</span>
                <button
                  onClick={copyToClipboard}
                  className="px-3 py-1.5 bg-emerald-900 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow select-none"
                >
                  {copied ? (
                    <>
                      <Check size={13} className="text-emerald-200" />
                      <span>COPIED CODE!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={13} />
                      <span>COPY CODE</span>
                    </>
                  )}
                </button>
              </div>

              <div className="relative">
                <pre className="p-4 bg-slate-900 text-emerald-300 font-mono text-[11px] rounded-2xl overflow-x-auto max-h-[310px] border border-slate-800 select-all shadow-inner leading-normal">
                  {appScriptCode}
                </pre>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-[11px] text-amber-900 flex gap-2">
                <ShieldAlert className="text-amber-700 shrink-0 mt-0.5" size={14} />
                <span>
                  <strong>Avoid Common Mistakes:</strong> Always deploy as a new Web App with access permissions given to <strong>Anyone</strong>. Re-deploying requires hitting "New deployment" to successfully publish changes.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer controls */}
        <div className="bg-slate-50 p-4 border-t border-slate-150 flex justify-end gap-3 shrink-0">
          <button 
            onClick={onClose}
            className="px-5 py-2 hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-bold font-mono transition border border-slate-200/50"
          >
            DISMISS
          </button>
        </div>

      </div>
    </div>
  );
}
