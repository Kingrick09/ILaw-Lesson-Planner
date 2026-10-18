# ILAW customai Planner 📚

Professional standards-aligned curriculum design suite based on the **ILAW (Intentions, Learning Experience, Assessment, Ways Forward)** framework. Built specifically to assist educators in rapidly generating lesson plans, presentation slides, and student flashcards.

---

## 🚀 Key Features
* **AI-Powered Lesson Planning:** Instantly generates complete DepEd-aligned lesson plans using Google Gemini.
* **Multi-Format Export:** 
  * 📄 **PDF Export:** Generates clean, vector-based paginated lesson documents matching official DepEd table layouts.
  * 📝 **Word Document Export:** Exports formatted `.docx` files without stray markdown symbols.
  * 📊 **Slide Decks & Flashcards:** Instantly structures presentation notes and student review grids.
* **Cloud & Database Sync:** Automatically tracks accounts, login credentials, and user data history.
* **Administrator Portal:** Secure management gate to update institutional contacts and configuration settings.

---

## 🛠️ Technology Stack
* **Frontend:** React, Vite, Tailwind CSS, Lucide Icons, jsPDF, docx
* **Backend:** Node.js, Express (`server.ts`), Google Apps Script / Google Sheets
* **AI Engine:** Google Gemini API (`gemini-2.5-flash`)

---

## ⚙️ Environment Variables (.env)
To run or deploy this app locally or in production, ensure your environment variables are configured:
```env
APPSCRIPT_URL="[https://script.google.com/macros/s/.../exec](https://script.google.com/macros/s/.../exec)"
ADMIN_PASSCODE="your_admin_passcode"
MESSENGER_LINK="[https://m.me/yourfacebookpage](https://m.me/yourfacebookpage)"
WHATSAPP_NUMBER="09956270884"
