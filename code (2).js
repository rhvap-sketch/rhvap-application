/**
 * ============================================================
 * R-HVAP MSME Co-Investment — Google Apps Script Backend
 * ============================================================
 * Deploy as Web App:
 *   Execute as: Me
 *   Who has access: Anyone
 *
 * Paste the deployed URL into config.js on the frontend.
 * ============================================================
 */

// ============ CONFIGURATION ============
// 1. Create a Google Sheet and paste its ID here.
//    Sheet ID is the long string between /d/ and /edit in the URL.
const SHEET_ID = 'PASTE_YOUR_GOOGLE_SHEET_ID_HERE';

// 2. Create a Google Drive folder for uploads and paste its ID here.
//    Folder ID is the last part of the folder URL.
const DRIVE_FOLDER_ID = 'PASTE_YOUR_DRIVE_FOLDER_ID_HERE';

// 3. Sheet tab name (default: Sheet1)
const SHEET_NAME = 'Sheet1';

// 4. Email addresses
const NOTIFY_EMAIL = 'rhvap.sp@gmail.com';

// ============ doGet ============
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({
      success: true,
      message: 'R-HVAP application service is running.',
      timestamp: new Date().toISOString(),
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============ doPost ============
function doPost(e) {
  try {
    // Parse JSON payload
    const payload = JSON.parse(e.postData.contents);

    // Honeypot check
    if (payload.website) {
      return jsonResponse({ success: false, message: 'Bot detected.' });
    }

    // Validate required fields
    const required = ['firmName', 'chairName', 'phone', 'email', 'window', 'pan'];
    for (const field of required) {
      if (!payload[field] || !String(payload[field]).trim()) {
        return jsonResponse({ success: false, message: 'Missing required field: ' + field });
      }
    }

    // Generate reference number
    const refNumber = generateReferenceNumber();

    // Create Drive folder
    const parentFolder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
    const safeName = sanitizeFolderName(payload.firmName || 'Applicant');
    const folderName = refNumber + ' - ' + safeName;
    const appFolder = parentFolder.createFolder(folderName);

    // Save files
    if (payload.files) {
      for (const [docId, files] of Object.entries(payload.files)) {
        for (const f of files) {
          try {
            const blob = Utilities.newBlob(
              Utilities.base64Decode(f.data),
              f.type,
              f.name
            );
            appFolder.createFile(blob);
          } catch (fileErr) {
            console.error('File save error for ' + docId + ': ' + fileErr);
          }
        }
      }
    }

    // Append row to Sheet
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
    if (!sheet) throw new Error('Sheet not found: ' + SHEET_NAME);

    // Header row (create if empty)
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        'Timestamp', 'Reference Number', 'Drive Folder Link',
        'Window', 'Notice Date', 'Programme Name',
        'Firm Name', 'Chair Name', 'Position', 'Submission Date',
        'Phone', 'Alt Contact', 'Address',
        'Sub-project Name', 'Start Date', 'End Date',
        'Total Investment (Num)', 'Total Investment (Words)',
        'Org Name', 'Reg Office Date', 'PAN', 'Org Address',
        'Contact Person', 'Email',
        'Legal Status Type', 'Reg Number Body', 'Experience Years',
        'Turnover 2080/081', 'Turnover 2081/082', 'Turnover 2082/083',
        'Market Access', 'Total Manpower', 'Technical Manpower', 'Admin Manpower',
        'Strengths', 'Weaknesses', 'Opportunities', 'Threats',
        'Proposed Activities', 'Expected Results', 'PO Support',
        'Own Source', 'Declaration Name', 'Declaration Position', 'Declaration Date',
        'Activities List', 'Investment Rows JSON', 'Raw JSON'
      ]);
    }

    const investmentJson = JSON.stringify(payload.investmentRows || []);
    const activitiesList = (payload.activities || []).join('; ');

    sheet.appendRow([
      new Date(),
      refNumber,
      appFolder.getUrl(),
      escapeText(payload.window),
      escapeText(payload.noticeDate),
      escapeText(payload.programName),
      escapeText(payload.firmName),
      escapeText(payload.chairName),
      escapeText(payload.position),
      escapeText(payload.submissionDate),
      escapeText(payload.phone),
      escapeText(payload.altContact),
      escapeText(payload.address),
      escapeText(payload.subProjectName),
      escapeText(payload.startDate),
      escapeText(payload.endDate),
      escapeText(payload.totalInvestmentNum),
      escapeText(payload.totalInvestmentWords),
      escapeText(payload.orgName),
      escapeText(payload.regOfficeDate),
      escapeText(payload.pan),
      escapeText(payload.orgAddress),
      escapeText(payload.contactPerson),
      escapeText(payload.email),
      escapeText(payload.legalStatusType),
      escapeText(payload.regNumberBody),
      escapeText(payload.experienceYears),
      escapeText(payload.turnover0801),
      escapeText(payload.turnover0812),
      escapeText(payload.turnover0823),
      escapeText(payload.marketAccess),
      escapeText(payload.totalManpower),
      escapeText(payload.technicalManpower),
      escapeText(payload.adminManpower),
      escapeText(payload.strengths),
      escapeText(payload.weaknesses),
      escapeText(payload.opportunities),
      escapeText(payload.threats),
      escapeText(payload.proposedActivities),
      escapeText(payload.expectedResults),
      escapeText(payload.poSupport),
      escapeText(payload.ownSource),
      escapeText(payload.declName),
      escapeText(payload.declPosition),
      escapeText(payload.declDate),
      escapeText(activitiesList),
      investmentJson,
      JSON.stringify(payload)
    ]);

    // Send confirmation email to applicant
    if (payload.email) {
      try {
        MailApp.sendEmail({
          to: payload.email,
          subject: 'R-HVAP आवेदन पुष्टि / Application Confirmation - ' + refNumber,
          htmlBody: `
            <p>प्रिय ${escapeHtml(payload.firmName)},</p>
            <p>तपाईंको आवेदन सफलतापूर्वक प्राप्त भएको छ।</p>
            <p><strong>सन्दर्भ नम्बर:</strong> ${refNumber}</p>
            <p><strong>विन्डो:</strong> ${escapeHtml(payload.window)}</p>
            <p><strong>पेश गरेको मिति:</strong> ${escapeHtml(payload.submissionDate)}</p>
            <p>धन्यवाद,<br>उच्च मूल्य कृषिवस्तु उत्थानशील कार्यक्रम (R-HVAP)<br>प्रादेशिक कार्यक्रम व्यवस्थापन कार्यालय, डडेलधुरा</p>
            <hr>
            <p>Dear ${escapeHtml(payload.firmName)},</p>
            <p>Your application has been received successfully.</p>
            <p><strong>Reference Number:</strong> ${refNumber}</p>
            <p><strong>Window:</strong> ${escapeHtml(payload.window)}</p>
            <p><strong>Submission Date:</strong> ${escapeHtml(payload.submissionDate)}</p>
            <p>Thank you,<br>High Value Agriculture Commodities Promotion Programme (R-HVAP)<br>Provincial Programme Management Office, Dadeldhura</p>
          `,
        });
      } catch (mailErr) {
        console.error('Applicant email error: ' + mailErr);
      }
    }

    // Notify office
    try {
      MailApp.sendEmail({
        to: NOTIFY_EMAIL,
        subject: 'नयाँ R-HVAP आवेदन / New R-HVAP Application - ' + refNumber,
        htmlBody: `
          <p>नयाँ आवेदन प्राप्त भएको छ।</p>
          <p><strong>सन्दर्भ नम्बर:</strong> ${refNumber}</p>
          <p><strong>फर्म:</strong> ${escapeHtml(payload.firmName)}</p>
          <p><strong>विन्डो:</strong> ${escapeHtml(payload.window)}</p>
          <p><strong>फोन:</strong> ${escapeHtml(payload.phone)}</p>
          <p><strong>इमेल:</strong> ${escapeHtml(payload.email)}</p>
          <p><strong>ड्राइभ फोल्डर:</strong> <a href="${appFolder.getUrl()}">${appFolder.getUrl()}</a></p>
          <p><strong>स्प्रेडसिट:</strong> <a href="https://docs.google.com/spreadsheets/d/${SHEET_ID}">https://docs.google.com/spreadsheets/d/${SHEET_ID}</a></p>
        `,
      });
    } catch (mailErr) {
      console.error('Office email error: ' + mailErr);
    }

    return jsonResponse({
      success: true,
      referenceNumber: refNumber,
      folderUrl: appFolder.getUrl(),
    });

  } catch (err) {
    console.error('doPost error: ' + err);
    return jsonResponse({ success: false, message: err.toString() });
  }
}

// ============ Helpers ============

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function generateReferenceNumber() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return 'RHVAP-2083-' + code;
}

function sanitizeFolderName(name) {
  return String(name).replace(/[\\\/:*?"<>|]/g, '_').substring(0, 60);
}

function escapeText(text) {
  if (text === undefined || text === null) return '';
  let s = String(text);
  // Prevent formula injection
  if (/^[=+\-@]/.test(s)) {
    s = "'" + s;
  }
  return s;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}