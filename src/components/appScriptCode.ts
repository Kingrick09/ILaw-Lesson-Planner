// =====================================================================================
// ⚠️ CRITICAL WARNING: DO NOT COPY THE FIRST 16 LINES OR THE LAST LINE OF THIS FILE! ⚠️
// 
// If you copy-pasted this entire file into Google Apps Script, it will fail with:
// "Syntax error: SyntaxError: Unexpected token 'export' line: 1 file: Code.gs"
//
// HOW TO GET THE CORRECT CODE:
// 1. RECOMMENDED: Open the "Setup Guide" inside the running application and click 
//    the "COPY CODE" button. It will copy ONLY the correct Google Apps Script code.
// 2. MANUAL COPY: Copy ONLY the code starting from the "/**" comment on line 17 
//    all the way down to the closing curly brace "}" of the last function.
//    Do NOT copy the "export const appScriptCode = `..." or the final "`;" at the bottom.
// =====================================================================================

export const appScriptCode = `/**
 * ILAW Master Curriculum Suite - Backend Apps Script
 * Acts as a lightweight proxy database routing users & logs into standard Google Sheet arrays.
 * 
 * Instructions:
 * 1. Open Google Sheets (https://sheets.new)
 * 2. Click Extensions -> Apps Script
 * 3. Replace all existing text with this complete code
 * 4. Click the Save icon (Floppy disk)
 * 5. Click "Deploy" -> "New deployment"
 * 6. Select "Web app" (Gear icon next to Select Access)
 * 7. Set 'Execute as': "Me (your email)"
 * 8. IMPORTANT: Set 'Who has access': "Anyone" (allows server proxy logins)
 * 9. Click Deploy, Authorize access, and COPY the generated Web App URL!
 */

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return ContentService.createTextOutput(JSON.stringify({ 
        success: false, 
        message: "No payload provided in POST request." 
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var requestData = JSON.parse(e.postData.contents);
    var action = requestData.action;
    var data = requestData.data || requestData;
    var result = { success: false, message: "Unknown endpoint action requested: " + action };
    
    // Auto-bootstrap schemas on first run
    initSheets();

    if (action === "register") {
      result = handleRegister(data);
    } else if (action === "login") {
      result = handleLogin(data);
    } else if (action === "getUserStatus" || action === "checkStatus") {
      result = handleGetUserStatus(data);
    } else if (action === "reactivate") {
      result = handleReactivate(data);
    } else if (action === "log_usage" || action === "logUsage") {
      result = handleLogUsage(data);
    } else if (action === "saveCurriculum") {
      result = handleSaveCurriculum(data);
    } else if (action === "getCurriculums" || action === "listCurriculums") {
      result = handleGetCurriculums(data);
    } else if (action === "deleteCurriculum") {
      result = handleDeleteCurriculum(data);
    }

    return ContentService.createTextOutput(JSON.stringify(result))
                         .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ 
      success: false, 
      error: error.toString(),
      message: "Apps Script exception: " + error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: "online",
    service: "MATATAG AI Apps Script Database Gateway",
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}

function getSpreadsheet() {
  var ss = null;
  try {
    ss = SpreadsheetApp.getActiveSpreadsheet();
  } catch (e) {
    Logger.log("getActiveSpreadsheet error: " + e.toString());
  }

  if (!ss) {
    var SPREADSHEET_ID = "1pCpQ7FYE6VNCUTdhpoHXDjUNdSjtZ6hROK7S4zQxCn8";
    if (SPREADSHEET_ID && SPREADSHEET_ID.trim() !== "") {
      try {
        ss = SpreadsheetApp.openById(SPREADSHEET_ID);
      } catch (e) {
        Logger.log("openById error: " + e.toString());
      }
    }
  }

  if (!ss) {
    throw new Error("Unable to access spreadsheet. Please open Google Sheet, go to Extensions -> Apps Script, and re-deploy.");
  }

  return ss;
}

function initSheets() {
  var ss = getSpreadsheet();
  
  if (!ss.getSheetByName("Users")) {
    var sheet = ss.insertSheet("Users");
    sheet.appendRow(["Username", "Password", "Role", "Status", "DaysLeft", "CreatedAt"]);
  }
  if (!ss.getSheetByName("Logs")) {
    var sheet = ss.insertSheet("Logs");
    sheet.appendRow(["Timestamp", "Username", "Action", "Details"]);
  }
  if (!ss.getSheetByName("Curriculums")) {
    var sheet = ss.insertSheet("Curriculums");
    sheet.appendRow(["ID", "Email", "Subject", "Grade", "Term", "Data", "CreatedAt"]);
  }
}

function handleRegister(data) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName("Users");
  if (!sheet) {
    sheet = ss.insertSheet("Users");
    sheet.appendRow(["Username", "Password", "Role", "Status", "DaysLeft", "CreatedAt", "ExpiresAt"]);
  }
  var rows = sheet.getDataRange().getValues();
  
  var username = (data.username || (data.data && data.data.username) || data.email || "").toString().toLowerCase().trim();
  if (!username) {
    return { success: false, message: "Email username is required for registration." };
  }

  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0].toString().toLowerCase().trim() === username) {
      return { success: false, message: "Username account already registered." };
    }
  }
  
  var now = new Date();
  var trialDays = 5;
  var expiresAt = new Date(now.getTime() + (trialDays * 24 * 60 * 60 * 1000));
  
  sheet.appendRow([
    username,
    data.password || (data.data && data.data.password) || "",
    data.role || (data.data && data.data.role) || "Educator",
    data.status || (data.data && data.data.status) || "Active",
    trialDays, // default 5 trial days
    now.toISOString(),
    expiresAt.toISOString()
  ]);
  
  return { success: true, message: "Registered beautifully inside spreadsheet database!" };
}

function calculateUserDays(row, rowIndex, sheet) {
  var status = row[3] ? row[3].toString() : "Active";
  var storedDays = Number(row[4]);
  if (isNaN(storedDays)) storedDays = 5;
  var createdAtVal = row[5];
  var expiresAtVal = row.length >= 7 ? row[6] : null;
  
  var now = new Date();
  var daysLeft = 0;
  
  if (expiresAtVal) {
    var expDate = new Date(expiresAtVal.toString());
    if (!isNaN(expDate.getTime())) {
      var diffMs = expDate.getTime() - now.getTime();
      daysLeft = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    }
  }
  
  if (!expiresAtVal || isNaN(daysLeft)) {
    var startDate = createdAtVal ? new Date(createdAtVal.toString()) : now;
    if (isNaN(startDate.getTime())) startDate = now;
    var elapsedMs = now.getTime() - startDate.getTime();
    var elapsedDays = Math.floor(elapsedMs / (1000 * 60 * 60 * 24));
    daysLeft = Math.max(0, storedDays - elapsedDays);
  }
  
  if (daysLeft <= 0) {
    status = "Expired";
    if (sheet) {
      sheet.getRange(rowIndex, 4).setValue("Expired");
      sheet.getRange(rowIndex, 5).setValue(0);
    }
  } else {
    if (sheet) {
      if (status !== "Suspended") {
        sheet.getRange(rowIndex, 4).setValue("Active");
      }
      sheet.getRange(rowIndex, 5).setValue(daysLeft);
    }
  }
  
  return {
    status: status,
    daysLeft: daysLeft
  };
}

function handleLogin(data) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName("Users");
  if (!sheet) {
    sheet = ss.insertSheet("Users");
    sheet.appendRow(["Username", "Password", "Role", "Status", "DaysLeft", "CreatedAt", "ExpiresAt"]);
  }
  var rows = sheet.getDataRange().getValues();
  
  var username = (data.username || (data.data && data.data.username) || data.email || "").toString().toLowerCase().trim();
  var password = (data.password !== undefined ? data.password : (data.data && data.data.password !== undefined ? data.data.password : "")).toString();
  
  if (!username || !password) {
    return { success: false, message: "Email and password are required." };
  }

  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0].toString().toLowerCase().trim() === username) {
      if (rows[i][1].toString() === password) {
        var calc = calculateUserDays(rows[i], i + 1, sheet);
        
        if (calc.daysLeft <= 0 || calc.status !== "Active") {
          return { success: false, isInactive: true, error: "Your trial account access has expired. Please upgrade to renew your subscription" };
        }
        
        return { 
          success: true, 
          user: { 
            role: rows[i][2].toString(), 
            active: true, 
            daysLeft: calc.daysLeft 
          } 
        };
      }
    }
  }
  return { success: false, message: "Invalid email or password credentials." };
}

function handleGetUserStatus(data) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName("Users");
  if (!sheet) {
    sheet = ss.insertSheet("Users");
    sheet.appendRow(["Username", "Password", "Role", "Status", "DaysLeft", "CreatedAt", "ExpiresAt"]);
  }
  var rows = sheet.getDataRange().getValues();

  var username = (data.username || (data.data && data.data.username) || data.email || "").toString().toLowerCase().trim();
  if (!username) {
    return { success: false, message: "Username is required." };
  }

  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0].toString().toLowerCase().trim() === username) {
      var calc = calculateUserDays(rows[i], i + 1, sheet);
      
      return {
        success: true,
        name: rows[i][2].toString(),
        daysLeft: calc.daysLeft,
        active: calc.status === "Active" && calc.daysLeft > 0
      };
    }
  }
  return { success: false, message: "Educator account records not found." };
}

function handleReactivate(data) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName("Users");
  if (!sheet) {
    sheet = ss.insertSheet("Users");
    sheet.appendRow(["Username", "Password", "Role", "Status", "DaysLeft", "CreatedAt", "ExpiresAt"]);
  }
  
  // Ensure header has ExpiresAt column
  var headers = sheet.getRange(1, 1, 1, Math.max(7, sheet.getLastColumn())).getValues()[0];
  if (!headers[6] || headers[6].toString().trim() === "") {
    sheet.getRange(1, 7).setValue("ExpiresAt");
  }

  var rows = sheet.getDataRange().getValues();
  var username = data.username.toLowerCase().trim();
  var daysToAdd = Number(data.days) || 30;
  var now = new Date();
  
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0].toString().toLowerCase().trim() === username) {
      var currentDays = Number(rows[i][4]);
      if (isNaN(currentDays) || currentDays < 0) currentDays = 0;
      
      // If user still had active days, add to them; otherwise start fresh with daysToAdd
      var updatedTotalDays = currentDays > 0 ? (currentDays + daysToAdd) : daysToAdd;
      var expiresAt = new Date(now.getTime() + (updatedTotalDays * 24 * 60 * 60 * 1000));
      
      // Update Column 4 (Status) -> "Active"
      sheet.getRange(i + 1, 4).setValue("Active");
      // Update Column 5 (DaysLeft) -> updatedTotalDays
      sheet.getRange(i + 1, 5).setValue(updatedTotalDays);
      // Update Column 6 (LastRenewedAt / CreatedAt) -> now.toISOString()
      sheet.getRange(i + 1, 6).setValue(now.toISOString());
      // Update Column 7 (ExpiresAt) -> expiresAt.toISOString()
      sheet.getRange(i + 1, 7).setValue(expiresAt.toISOString());
      
      // Log payment reactivation in Logs tab
      var logSheet = ss.getSheetByName("Logs");
      if (logSheet) {
        logSheet.appendRow([
          now.toISOString(),
          username,
          "Payment / Subscription Upgrade Confirmed",
          "Google Sheet updated to Active. Added +" + daysToAdd + " days (Total: " + updatedTotalDays + " days). Plan: " + (data.planName || "Educator Plan")
        ]);
      }
      
      return { 
        success: true, 
        message: "Google Sheet successfully updated with " + updatedTotalDays + " active days!",
        daysLeft: updatedTotalDays,
        active: true
      };
    }
  }
  
  // If user row wasn't found in Users sheet, append a new active user row
  var expiresAt = new Date(now.getTime() + (daysToAdd * 24 * 60 * 60 * 1000));
  sheet.appendRow([
    username,
    "paid_user",
    "Educator",
    "Active",
    daysToAdd,
    now.toISOString(),
    expiresAt.toISOString()
  ]);
  
  var logSheet = ss.getSheetByName("Logs");
  if (logSheet) {
    logSheet.appendRow([
      now.toISOString(),
      username,
      "New Paid User Created",
      "Created row in Users sheet with " + daysToAdd + " days. Plan: " + (data.planName || "Educator Plan")
    ]);
  }
  
  return { 
    success: true, 
    message: "Google Sheet user created and updated with " + daysToAdd + " active days!",
    daysLeft: daysToAdd,
    active: true
  };
}

function handleLogUsage(data) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName("Logs");
  if (!sheet) {
    sheet = ss.insertSheet("Logs");
    sheet.appendRow(["Timestamp", "Username", "Action", "Details"]);
  }
  sheet.appendRow([
    new Date().toISOString(),
    data.username,
    data.actionName,
    data.details
  ]);
  return { success: true };
}

function handleSaveCurriculum(data) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName("Curriculums");
  if (!sheet) {
    sheet = ss.insertSheet("Curriculums");
    sheet.appendRow(["ID", "Email", "Subject", "Grade", "Term", "Data", "CreatedAt"]);
  }
  
  var curriculum = data.curriculum;
  var id = curriculum.id;
  var email = curriculum.email.toLowerCase().trim();
  var subject = curriculum.subject || "";
  var grade = curriculum.grade || "";
  var term = curriculum.term || "";
  var curriculumStr = JSON.stringify(curriculum);
  var createdAt = curriculum.createdAt || new Date().toISOString();
  
  var rows = sheet.getDataRange().getValues();
  var foundIndex = -1;
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0].toString() === id) {
      foundIndex = i + 1; // 1-based index for sheet row
      break;
    }
  }
  
  if (foundIndex !== -1) {
    // Update existing row
    sheet.getRange(foundIndex, 1, 1, 7).setValues([[id, email, subject, grade, term, curriculumStr, createdAt]]);
  } else {
    // Append new row
    sheet.appendRow([id, email, subject, grade, term, curriculumStr, createdAt]);
  }
  
  return { success: true, message: "Curriculum saved successfully!" };
}

function handleGetCurriculums(data) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName("Curriculums");
  if (!sheet) {
    return { success: true, curriculums: [] };
  }
  
  var rows = sheet.getDataRange().getValues();
  var email = data.email.toLowerCase().trim();
  var list = [];
  
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][1].toString().toLowerCase().trim() === email) {
      try {
        var currObj = JSON.parse(rows[i][5].toString());
        list.push(currObj);
      } catch (e) {
        // Fallback if JSON parse fails
        list.push({
          id: rows[i][0].toString(),
          email: rows[i][1].toString(),
          subject: rows[i][2].toString(),
          grade: rows[i][3].toString(),
          term: rows[i][4].toString(),
          createdAt: rows[i][6].toString()
        });
      }
    }
  }
  
  return { success: true, curriculums: list };
}

function handleDeleteCurriculum(data) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName("Curriculums");
  if (!sheet) {
    return { success: false, message: "Curriculum database sheet not found." };
  }
  
  var id = data.id;
  var email = data.email.toLowerCase().trim();
  var rows = sheet.getDataRange().getValues();
  
  for (var i = rows.length - 1; i >= 1; i--) {
    if (rows[i][0].toString() === id && rows[i][1].toString().toLowerCase().trim() === email) {
      sheet.deleteRow(i + 1);
      return { success: true, message: "Curriculum deleted successfully!" };
    }
  }
  
  return { success: false, message: "Curriculum not found or unauthorized delete attempt." };
}`;
