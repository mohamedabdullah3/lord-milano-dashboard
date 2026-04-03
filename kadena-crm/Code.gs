// ============================================================
// KADENA BEAUTY CENTER — CRM SYSTEM
// Google Apps Script — CRM Spreadsheet
// ============================================================

// ------------------------------------------------------------
// CONFIG
// ------------------------------------------------------------

const CONFIG = {
  PLATFORMS_SPREADSHEET_ID: 'REPLACE_ME',
  CRM_SPREADSHEET_ID:       'REPLACE_ME',
  REPORT_EMAIL:             'REPLACE_ME',
  SOURCE_TABS:              ['Meta', 'Snapchat', 'TikTok'],
  CRM_SHEET:                'CRM',
  CONFIG_SHEET:             'Config',
  LOGS_SHEET:               'Logs',
  DASHBOARD_SHEET:          'Dashboard'
};

// ------------------------------------------------------------
// HELPER FUNCTIONS
// ------------------------------------------------------------

/**
 * Returns the sheet named `name` inside spreadsheet `ss`.
 * Creates it if it does not exist. Never overwrites an existing sheet.
 *
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 * @param {string} name
 * @returns {GoogleAppsScript.Spreadsheet.Sheet}
 */
function getOrCreateSheet(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  return sheet;
}

/**
 * Appends a log row to the Logs tab of the CRM spreadsheet.
 * New entries are inserted at the TOP (row 2), preserving newest-first order.
 * Row format: timestamp | functionName | message | status
 *
 * @param {string} functionName  Name of the calling function.
 * @param {string} message       Human-readable description of the event.
 * @param {string} status        "OK" or "ERROR".
 */
function logToSheet(functionName, message, status) {
  try {
    var ss    = SpreadsheetApp.openById(CONFIG.CRM_SPREADSHEET_ID);
    var sheet = getOrCreateSheet(ss, CONFIG.LOGS_SHEET);

    // Ensure a header row exists on the very first call.
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(['Timestamp', 'Function', 'Message', 'Status']);
    }

    var timestamp = new Date();
    // Insert after the header so newest entry is always row 2.
    sheet.insertRowAfter(1);
    sheet.getRange(2, 1, 1, 4).setValues([[timestamp, functionName, message, status]]);
  } catch (e) {
    // Fail silently — logging must never break the main flow.
    Logger.log('logToSheet error: ' + e.message);
  }
}

/**
 * Extracts the doctor identifier from a campaign name.
 * Campaign names follow the pattern: doctor_service_...
 * Returns the first segment (index 0), trimmed and lowercased.
 * Returns "unknown" if the name is empty or contains no underscore.
 *
 * @param {string} campaignName
 * @returns {string}
 */
function extractDoctor(campaignName) {
  if (!campaignName || typeof campaignName !== 'string') return 'unknown';
  var parts = campaignName.split('_');
  var doctor = parts[0] ? parts[0].trim().toLowerCase() : '';
  return doctor || 'unknown';
}

/**
 * Extracts the service identifier from a campaign name.
 * Campaign names follow the pattern: doctor_service_...
 * Returns the second segment (index 1), trimmed (original case preserved).
 * Returns "unknown" if the segment is missing or blank.
 *
 * @param {string} campaignName
 * @returns {string}
 */
function extractService(campaignName) {
  if (!campaignName || typeof campaignName !== 'string') return 'unknown';
  var parts = campaignName.split('_');
  var service = parts[1] ? parts[1].trim() : '';
  return service || 'unknown';
}

/**
 * Generates the next unique Lead ID for today.
 * Format: YYYYMMDD-NNN  (e.g. 20260403-001)
 * Reads all values in column A of the CRM sheet, counts how many
 * already match today's date prefix, then increments by 1.
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} crmSheet
 * @returns {string}
 */
function generateLeadId(crmSheet) {
  var today  = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd');
  var prefix = today + '-';

  var lastRow = crmSheet.getLastRow();
  var count   = 0;

  if (lastRow > 1) {
    // Column A, starting from row 2 (skip header).
    var ids = crmSheet.getRange(2, 1, lastRow - 1, 1).getValues();
    ids.forEach(function(row) {
      var id = String(row[0]);
      if (id.indexOf(prefix) === 0) {
        count++;
      }
    });
  }

  var sequence = String(count + 1).padStart(3, '0');
  return prefix + sequence;
}

/**
 * Maps a source-tab header name to its 0-based column index.
 * These indices reflect the fixed layout of the platform export sheets
 * (Meta, Snapchat, TikTok).
 *
 * Header → 0-based index:
 *   created_time  → 1
 *   ad_name       → 3
 *   adset_name    → 5
 *   campaign_name → 7
 *   form_name     → 9
 *   platform      → 11
 *   phone         → 12
 *   form_answer   → 13
 *   email         → 14
 *   full_name     → 15
 *
 * @param {string} header
 * @returns {number} 0-based column index, or -1 if the header is unknown.
 */
function getColumnIndex(header) {
  var map = {
    'created_time':  1,
    'ad_name':       3,
    'adset_name':    5,
    'campaign_name': 7,
    'form_name':     9,
    'platform':      11,
    'phone':         12,
    'form_answer':   13,
    'email':         14,
    'full_name':     15
  };
  var index = map[header];
  return (index !== undefined) ? index : -1;
}

// ------------------------------------------------------------
// SETUP FUNCTIONS
// ------------------------------------------------------------

/**
 * Creates the "Kadena - Platforms" spreadsheet with three tabs:
 * Meta, Snapchat, TikTok — each with identical headers A:P.
 *
 * Run this ONCE to bootstrap the platforms spreadsheet.
 * Copy the logged Spreadsheet ID into CONFIG.PLATFORMS_SPREADSHEET_ID.
 *
 * @returns {string} The new spreadsheet's ID.
 */
function createPlatformsSpreadsheet() {
  // -----------------------------------------------------------
  // 1. Create the spreadsheet
  // -----------------------------------------------------------
  var ss = SpreadsheetApp.create('Kadena - Platforms');

  // -----------------------------------------------------------
  // 2. Define the header row (A–P, 16 columns)
  //    Odd-numbered data columns have empty interleaved columns.
  // -----------------------------------------------------------
  var headers = [
    'Row_Number',                          // A  col 1
    'created_time',                        // B  col 2
    '',                                    // C  col 3  (empty)
    'ad_name',                             // D  col 4
    '',                                    // E  col 5  (empty)
    'adset_name',                          // F  col 6
    '',                                    // G  col 7  (empty)
    'campaign_name',                       // H  col 8
    '',                                    // I  col 9  (empty)
    'form_name',                           // J  col 10
    '',                                    // K  col 11 (empty)
    'platform',                            // L  col 12
    'رقم_الجوال',                          // M  col 13
    'ما_هو_الإجراء_المطلوب؟',             // N  col 14
    'email',                               // O  col 15
    'full_name'                            // P  col 16
  ];

  // Header styling
  var HEADER_BG    = '#4285f4';
  var HEADER_FG    = '#ffffff';

  // -----------------------------------------------------------
  // 3. Create the three platform tabs and style them
  // -----------------------------------------------------------
  var tabNames = ['Meta', 'Snapchat', 'TikTok'];

  tabNames.forEach(function(tabName) {
    var sheet = ss.insertSheet(tabName);

    // Write headers
    var headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setValues([headers]);

    // Style: blue background, white bold text
    headerRange
      .setBackground(HEADER_BG)
      .setFontColor(HEADER_FG)
      .setFontWeight('bold');

    // Freeze row 1
    sheet.setFrozenRows(1);
  });

  // -----------------------------------------------------------
  // 4. Remove the default "Sheet1" if it still exists
  // -----------------------------------------------------------
  var defaultSheet = ss.getSheetByName('Sheet1');
  if (defaultSheet) {
    ss.deleteSheet(defaultSheet);
  }

  // -----------------------------------------------------------
  // 5. Log and return the new spreadsheet ID
  // -----------------------------------------------------------
  var id  = ss.getId();
  var url = ss.getUrl();

  Logger.log('=== Platforms Spreadsheet Created ===');
  Logger.log('ID  : ' + id);
  Logger.log('URL : ' + url);
  Logger.log('Copy the ID above into CONFIG.PLATFORMS_SPREADSHEET_ID');

  return id;
}

/**
 * Sets up the CRM spreadsheet (CONFIG.CRM_SPREADSHEET_ID) by creating
 * and formatting all required tabs: CRM, Config, Logs, Dashboard.
 *
 * Safe to re-run — existing tabs with data are never overwritten.
 * Only creates a tab's structure when the tab is brand-new (lastRow === 0).
 */
function setupCRM() {
  var ss = SpreadsheetApp.openById(CONFIG.CRM_SPREADSHEET_ID);

  // -----------------------------------------------------------
  // 1. CRM tab
  // -----------------------------------------------------------
  var crmSheet = getOrCreateSheet(ss, CONFIG.CRM_SHEET);

  if (crmSheet.getLastRow() === 0) {
    var crmHeaders = [
      'Lead_ID',            // A
      'created_time',       // B
      'full_name',          // C
      'phone',              // D
      'email',              // E
      'platform',           // F
      'campaign_name',      // G
      'doctor_name',        // H
      'service_name',       // I
      'form_answer',        // J
      'lead_status',        // K
      'first_contact_time', // L
      'response_time_hours',// M
      'no_booking_reason',  // N
      'no_show_reason',     // O
      'sales_agent',        // P
      'notes',              // Q
      'synced_to_doctor'    // R
    ];

    // Write header row
    var crmHeaderRange = crmSheet.getRange(1, 1, 1, crmHeaders.length);
    crmHeaderRange.setValues([crmHeaders]);

    // Style: dark blue background, white bold text
    crmHeaderRange
      .setBackground('#1a73e8')
      .setFontColor('#ffffff')
      .setFontWeight('bold');

    // Freeze row 1
    crmSheet.setFrozenRows(1);

    // M2: auto-calculate response time in hours from created_time (B) and
    // first_contact_time (L). Formula covers the full column via ARRAYFORMULA.
    crmSheet.getRange('M2').setFormula(
      '=IF(L2="","",ROUND((L2-B2)*24,1))'
    );

    // -----------------------------------------------------------
    // Data-validation dropdowns
    // -----------------------------------------------------------

    // Column K — lead_status (entire column, excluding header)
    var leadStatusRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(
        ['جديد', 'تم الاتصال', 'تم الحجز', 'لم يتم الحجز', 'حضر', 'لم يحضر', 'اتحول لعميل'],
        true
      )
      .setAllowInvalid(false)
      .build();
    crmSheet.getRange(2, 11, crmSheet.getMaxRows() - 1, 1)
      .setDataValidation(leadStatusRule);

    // Column N — no_booking_reason (entire column, excluding header)
    var noBookingRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(
        ['السعر', 'عدم الاهتمام', 'لم يرد', 'أجّل', 'أخرى'],
        true
      )
      .setAllowInvalid(false)
      .build();
    crmSheet.getRange(2, 14, crmSheet.getMaxRows() - 1, 1)
      .setDataValidation(noBookingRule);

    // Column O — no_show_reason (entire column, excluding header)
    var noShowRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(
        ['نسي', 'ظرف طارئ', 'لم يرد', 'أخرى'],
        true
      )
      .setAllowInvalid(false)
      .build();
    crmSheet.getRange(2, 15, crmSheet.getMaxRows() - 1, 1)
      .setDataValidation(noShowRule);
  }

  // -----------------------------------------------------------
  // 2. Config tab
  // -----------------------------------------------------------
  var configSheet = getOrCreateSheet(ss, CONFIG.CONFIG_SHEET);

  if (configSheet.getLastRow() === 0) {
    var configHeaders = ['doctor_name', 'spreadsheet_url', 'active'];

    var configHeaderRange = configSheet.getRange(1, 1, 1, configHeaders.length);
    configHeaderRange.setValues([configHeaders]);

    configHeaderRange
      .setBackground('#34a853')
      .setFontColor('#ffffff')
      .setFontWeight('bold');

    configSheet.setFrozenRows(1);

    // Sample data row so the sheet isn't blank
    configSheet.getRange(2, 1, 1, 3).setValues([
      ['DrAhmed', 'https://docs.google.com/...', 'Yes']
    ]);
  }

  // -----------------------------------------------------------
  // 3. Logs tab
  // -----------------------------------------------------------
  var logsSheet = getOrCreateSheet(ss, CONFIG.LOGS_SHEET);

  if (logsSheet.getLastRow() === 0) {
    var logsHeaders = ['timestamp', 'function_name', 'message', 'status'];

    var logsHeaderRange = logsSheet.getRange(1, 1, 1, logsHeaders.length);
    logsHeaderRange.setValues([logsHeaders]);

    logsHeaderRange
      .setBackground('#ea4335')
      .setFontColor('#ffffff')
      .setFontWeight('bold');

    logsSheet.setFrozenRows(1);
  }

  // -----------------------------------------------------------
  // 4. Dashboard tab — empty placeholder for now
  // -----------------------------------------------------------
  getOrCreateSheet(ss, CONFIG.DASHBOARD_SHEET);

  // -----------------------------------------------------------
  // 5. Log completion
  // -----------------------------------------------------------
  logToSheet('setupCRM', 'CRM setup complete', 'OK');
  Logger.log('setupCRM: CRM setup complete');
}
