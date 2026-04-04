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
  DASHBOARD_SHEET:          'Dashboard',
  DOCTORS_SHEET:            'Doctors',       // admin roster tab inside CRM SS

  // CRM column positions (1-based) — update here if layout ever changes
  COL: {
    LEAD_ID:            1,   // A
    CREATED_TIME:       2,   // B
    FULL_NAME:          3,   // C
    PHONE:              4,   // D
    EMAIL:              5,   // E
    PLATFORM:           6,   // F
    CAMPAIGN_NAME:      7,   // G
    DOCTOR_NAME:        8,   // H
    SERVICE_NAME:       9,   // I
    FORM_ANSWER:        10,  // J
    CONTACT_STATUS:     11,  // K  ← was lead_status
    BOOKING_STATUS:     12,  // L  ← new
    ATTENDANCE_STATUS:  13,  // M  ← new
    FIRST_CONTACT_TIME: 14,  // N  (was L)
    RESPONSE_TIME_HRS:  15,  // O  (was M)
    NO_BOOKING_REASON:  16,  // P  (was N)
    NO_SHOW_REASON:     17,  // Q  (was O)
    SALES_AGENT:        18,  // R  (was P)
    NOTES:              19,  // S  (was Q)
    SYNCED_TO_DOCTOR:   20   // T  (was R)
  },

  // Dropdown values for each status column
  CONTACT_STATUS_VALUES:    ['جديد', 'تم التواصل', 'لم يتم التواصل'],
  BOOKING_STATUS_VALUES:    ['لم يتم الرد', 'استفسار', 'تم الحجز'],
  ATTENDANCE_STATUS_VALUES: ['حضر', 'لم يحضر', 'إعادة جدولة']
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
      'Lead_ID',             // A  col 1
      'created_time',        // B  col 2
      'full_name',           // C  col 3
      'phone',               // D  col 4
      'email',               // E  col 5
      'platform',            // F  col 6
      'campaign_name',       // G  col 7
      'doctor_name',         // H  col 8
      'service_name',        // I  col 9
      'form_answer',         // J  col 10
      'contact_status',      // K  col 11  ← NEW (was lead_status)
      'booking_status',      // L  col 12  ← NEW
      'attendance_status',   // M  col 13  ← NEW
      'first_contact_time',  // N  col 14  (was L)
      'response_time_hours', // O  col 15  (was M)
      'no_booking_reason',   // P  col 16  (was N)
      'no_show_reason',      // Q  col 17  (was O)
      'sales_agent',         // R  col 18  (was P)
      'notes',               // S  col 19  (was Q)
      'synced_to_doctor'     // T  col 20  (was R)
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

    // O2: response time in hours — now references N (first_contact_time), not L
    crmSheet.getRange('O2').setFormula(
      '=IF(N2="","",ROUND((N2-B2)*24,1))'
    );

    // -----------------------------------------------------------
    // Data-validation dropdowns
    // -----------------------------------------------------------
    var maxRows = crmSheet.getMaxRows() - 1;

    // Column K — contact_status
    crmSheet.getRange(2, CONFIG.COL.CONTACT_STATUS, maxRows, 1)
      .setDataValidation(
        SpreadsheetApp.newDataValidation()
          .requireValueInList(CONFIG.CONTACT_STATUS_VALUES, true)
          .setAllowInvalid(false).build()
      );

    // Column L — booking_status
    crmSheet.getRange(2, CONFIG.COL.BOOKING_STATUS, maxRows, 1)
      .setDataValidation(
        SpreadsheetApp.newDataValidation()
          .requireValueInList(CONFIG.BOOKING_STATUS_VALUES, true)
          .setAllowInvalid(false).build()
      );

    // Column M — attendance_status
    crmSheet.getRange(2, CONFIG.COL.ATTENDANCE_STATUS, maxRows, 1)
      .setDataValidation(
        SpreadsheetApp.newDataValidation()
          .requireValueInList(CONFIG.ATTENDANCE_STATUS_VALUES, true)
          .setAllowInvalid(false).build()
      );

    // Column P — no_booking_reason (was N)
    crmSheet.getRange(2, CONFIG.COL.NO_BOOKING_REASON, maxRows, 1)
      .setDataValidation(
        SpreadsheetApp.newDataValidation()
          .requireValueInList(['السعر', 'عدم الاهتمام', 'لم يرد', 'أجّل', 'أخرى'], true)
          .setAllowInvalid(false).build()
      );

    // Column Q — no_show_reason (was O)
    crmSheet.getRange(2, CONFIG.COL.NO_SHOW_REASON, maxRows, 1)
      .setDataValidation(
        SpreadsheetApp.newDataValidation()
          .requireValueInList(['نسي', 'ظرف طارئ', 'لم يرد', 'أخرى'], true)
          .setAllowInvalid(false).build()
      );
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

// ------------------------------------------------------------
// SYNC FUNCTIONS
// ------------------------------------------------------------

/**
 * Reads all platform tabs (Meta, Snapchat, TikTok) from the Platforms
 * spreadsheet and writes net-new leads into the CRM sheet in one batch.
 *
 * Deduplication key: phone number (CRM column D).
 * A row is skipped when:
 *   - column M (index 12, phone) is blank/whitespace, OR
 *   - the phone already exists in the CRM.
 *
 * All new rows are collected first, then written in a single setValues()
 * call — never appendRow() inside a loop.
 */
function syncAllLeads() {
  try {
    var platformSS = SpreadsheetApp.openById(CONFIG.PLATFORMS_SPREADSHEET_ID);
    var crmSS      = SpreadsheetApp.openById(CONFIG.CRM_SPREADSHEET_ID);
    var crmSheet   = crmSS.getSheetByName(CONFIG.CRM_SHEET);

    // ----------------------------------------------------------
    // 1. Load all existing phones from CRM column D into a Set
    // ----------------------------------------------------------
    var existingPhones = new Set();
    var crmLastRow = crmSheet.getLastRow();

    if (crmLastRow > 1) {
      var phonesData = crmSheet.getRange(2, 4, crmLastRow - 1, 1).getValues();
      phonesData.forEach(function(row) {
        var p = String(row[0]).trim();
        if (p) existingPhones.add(p);
      });
    }

    // ----------------------------------------------------------
    // 2. Iterate source tabs and collect new lead rows
    // ----------------------------------------------------------
    var allNewRows  = [];   // rows destined for the CRM sheet
    var tabSummary  = {};   // { tabName: count } for logging

    CONFIG.SOURCE_TABS.forEach(function(tabName) {
      var tabNewCount = 0;

      try {
        var srcSheet = platformSS.getSheetByName(tabName);
        if (!srcSheet) {
          Logger.log('syncAllLeads: tab not found — ' + tabName);
          tabSummary[tabName] = 0;
          return; // next tab
        }

        var srcLastRow = srcSheet.getLastRow();
        if (srcLastRow < 2) {
          tabSummary[tabName] = 0;
          return; // no data rows
        }

        // Read entire data range in one call (skip header row 1)
        var data = srcSheet.getRange(2, 1, srcLastRow - 1, 16).getValues();

        data.forEach(function(row) {
          // Column M = index 12 (0-based) → phone
          var phone = String(row[12]).trim();
          if (!phone) return;              // skip: no phone
          if (existingPhones.has(phone)) return; // skip: duplicate

          // Extract fields using getColumnIndex() 0-based mapping
          var createdTime   = row[getColumnIndex('created_time')];   // index 1
          var campaignName  = String(row[getColumnIndex('campaign_name')] || '').trim(); // index 7
          var platform      = String(row[getColumnIndex('platform')]  || '').trim(); // index 11
          var formAnswer    = row[getColumnIndex('form_answer')];     // index 13
          var email         = row[getColumnIndex('email')];           // index 14
          var fullName      = row[getColumnIndex('full_name')];       // index 15

          // Use tab name as platform fallback when column L is empty
          if (!platform) platform = tabName;

          var doctorName  = extractDoctor(campaignName);
          var serviceName = extractService(campaignName);

          // Generate a unique Lead ID using the CRM sheet's current state
          // plus any rows already collected in this run.
          var leadId = generateLeadId(crmSheet);

          // Build the 20-column CRM row
          // [A]Lead_ID [B]created_time [C]full_name [D]phone [E]email
          // [F]platform [G]campaign_name [H]doctor_name [I]service_name
          // [J]form_answer [K]contact_status [L]booking_status
          // [M]attendance_status [N]first_contact_time [O]response_time_hours
          // [P]no_booking_reason [Q]no_show_reason [R]sales_agent
          // [S]notes [T]synced_to_doctor
          var newRow = [
            leadId,        // A — Lead_ID
            createdTime,   // B — created_time
            fullName,      // C — full_name
            phone,         // D — phone
            email,         // E — email
            platform,      // F — platform
            campaignName,  // G — campaign_name
            doctorName,    // H — doctor_name
            serviceName,   // I — service_name
            formAnswer,    // J — form_answer
            'جديد',        // K — contact_status   (default: new)
            '',            // L — booking_status
            '',            // M — attendance_status
            '',            // N — first_contact_time
            '',            // O — response_time_hours (formula-driven)
            '',            // P — no_booking_reason
            '',            // Q — no_show_reason
            '',            // R — sales_agent
            '',            // S — notes
            'No'           // T — synced_to_doctor
          ];

          allNewRows.push(newRow);
          existingPhones.add(phone); // prevent cross-tab duplicates in this run
          tabNewCount++;
        });

      } catch (tabErr) {
        logToSheet('syncAllLeads', 'Error processing tab ' + tabName + ': ' + tabErr.message, 'ERROR');
      }

      tabSummary[tabName] = tabNewCount;
    });

    // ----------------------------------------------------------
    // 3. Write all new rows in a single batch
    // ----------------------------------------------------------
    if (allNewRows.length > 0) {
      var writeStartRow = crmSheet.getLastRow() + 1;
      crmSheet
        .getRange(writeStartRow, 1, allNewRows.length, 20)
        .setValues(allNewRows);
    }

    SpreadsheetApp.flush();

    // ----------------------------------------------------------
    // 4. Log results
    // ----------------------------------------------------------
    var totalAdded = allNewRows.length;
    var summary = CONFIG.SOURCE_TABS.map(function(t) {
      return t + ': ' + (tabSummary[t] || 0);
    }).join(' | ');

    var msg = 'Total added: ' + totalAdded + ' (' + summary + ')';
    logToSheet('syncAllLeads', msg, 'OK');
    Logger.log('syncAllLeads: ' + msg);

  } catch (e) {
    logToSheet('syncAllLeads', e.message, 'ERROR');
    Logger.log('syncAllLeads ERROR: ' + e.message);
  }
}

/**
 * Reads active doctor entries from the Config tab and pushes their
 * unsynced CRM leads to the individual doctor spreadsheets.
 *
 * Each doctor spreadsheet receives a "Leads" sheet.
 * Deduplication: a lead is skipped if its Lead_ID already exists in
 * the doctor sheet's column A.
 *
 * After a successful push the CRM column R (synced_to_doctor) is
 * updated to "Yes" in batch for all affected rows.
 */
function distributeToDoctor() {
  var crmSS      = SpreadsheetApp.openById(CONFIG.CRM_SPREADSHEET_ID);
  var crmSheet   = crmSS.getSheetByName(CONFIG.CRM_SHEET);
  var configSheet = crmSS.getSheetByName(CONFIG.CONFIG_SHEET);

  // ----------------------------------------------------------
  // 1. Read Config tab — collect active doctor rows
  // ----------------------------------------------------------
  var configLastRow = configSheet.getLastRow();
  if (configLastRow < 2) {
    logToSheet('distributeToDoctor', 'No doctor rows in Config tab', 'OK');
    return;
  }

  var configData = configSheet.getRange(2, 1, configLastRow - 1, 3).getValues();
  var activeDoctors = configData.filter(function(row) {
    return String(row[2]).trim().toLowerCase() === 'yes';
  });

  if (activeDoctors.length === 0) {
    logToSheet('distributeToDoctor', 'No active doctors found in Config', 'OK');
    return;
  }

  // ----------------------------------------------------------
  // 2. Read ALL CRM data once
  // ----------------------------------------------------------
  var crmLastRow = crmSheet.getLastRow();
  if (crmLastRow < 2) {
    logToSheet('distributeToDoctor', 'CRM sheet has no data rows', 'OK');
    return;
  }

  // Rows are 1-indexed in the sheet; store alongside their sheet row number
  // so we can update column R later without re-scanning.
  var crmData = crmSheet.getRange(2, 1, crmLastRow - 1, 20).getValues();
  // crmData[i] corresponds to sheet row (i + 2)

  // ----------------------------------------------------------
  // 3. Process each active doctor
  // ----------------------------------------------------------
  activeDoctors.forEach(function(configRow) {
    var doctorRaw = String(configRow[0]).trim();
    var docUrl    = String(configRow[1]).trim();
    var doctorKey = doctorRaw.toLowerCase(); // for case-insensitive comparison

    try {
      // Open the doctor's spreadsheet
      var docSS    = SpreadsheetApp.openByUrl(docUrl);
      var docSheet = getOrCreateSheet(docSS, 'Leads');

      // --------------------------------------------------------
      // 3a. Create headers if this is a fresh Leads sheet
      // --------------------------------------------------------
      var isNewSheet = docSheet.getLastRow() === 0;
      if (isNewSheet) {
        var docHeaders = [
          'Lead_ID', 'full_name', 'phone', 'platform', 'service',
          'contact_status', 'booking_status', 'attendance_status',
          'form_answer', 'notes'
        ];
        var docHeaderRange = docSheet.getRange(1, 1, 1, docHeaders.length);
        docHeaderRange.setValues([docHeaders]);
        docHeaderRange
          .setBackground('#673ab7')
          .setFontColor('#ffffff')
          .setFontWeight('bold');
        docSheet.setFrozenRows(1);
      }

      // --------------------------------------------------------
      // 3b. Load existing Lead_IDs from doctor sheet column A
      // --------------------------------------------------------
      var existingLeadIds = new Set();
      var docLastRow = docSheet.getLastRow();

      if (docLastRow > 1) {
        var docIds = docSheet.getRange(2, 1, docLastRow - 1, 1).getValues();
        docIds.forEach(function(r) {
          var id = String(r[0]).trim();
          if (id) existingLeadIds.add(id);
        });
      }

      // --------------------------------------------------------
      // 3c. Find matching, unsynced CRM rows for this doctor
      // --------------------------------------------------------
      var rowsForDoctor  = [];  // 8-col rows to append to doctor sheet
      var crmRowsToMark  = [];  // sheet row numbers to flip column R → "Yes"

      crmData.forEach(function(crmRow, i) {
        var crmDoctorKey = String(crmRow[7]).trim().toLowerCase(); // col H (index 7)
        var syncedFlag   = String(crmRow[19]).trim();              // col T (index 19)
        var leadId       = String(crmRow[0]).trim();               // col A (index 0)

        if (crmDoctorKey !== doctorKey) return;
        if (syncedFlag === 'Yes') return;
        if (existingLeadIds.has(leadId)) return; // already in doctor sheet

        // Build the 10-column doctor row
        // A:Lead_ID B:full_name C:phone D:platform E:service
        // F:contact_status G:booking_status H:attendance_status
        // I:form_answer J:notes
        rowsForDoctor.push([
          crmRow[0],   // Lead_ID
          crmRow[2],   // full_name
          crmRow[3],   // phone
          crmRow[5],   // platform
          crmRow[8],   // service_name
          crmRow[10],  // contact_status
          crmRow[11],  // booking_status
          crmRow[12],  // attendance_status
          crmRow[9],   // form_answer
          crmRow[18]   // notes (col S, index 18)
        ]);

        crmRowsToMark.push(i + 2); // sheet row = array index + 2 (1-header + 1-base)
        existingLeadIds.add(leadId); // prevent duplicates within this batch
      });

      // --------------------------------------------------------
      // 3d. Write new rows to doctor sheet in one batch
      // --------------------------------------------------------
      if (rowsForDoctor.length > 0) {
        var writeStart = docSheet.getLastRow() + 1;
        docSheet
          .getRange(writeStart, 1, rowsForDoctor.length, 10)
          .setValues(rowsForDoctor);
      }

      // --------------------------------------------------------
      // 3e. Mark synced rows in CRM column T = "Yes" in batch
      // --------------------------------------------------------
      crmRowsToMark.forEach(function(sheetRow) {
        crmSheet.getRange(sheetRow, CONFIG.COL.SYNCED_TO_DOCTOR).setValue('Yes'); // col T = 20
      });

      var msg = 'Sent ' + rowsForDoctor.length + ' lead(s) to ' + doctorRaw;
      logToSheet('distributeToDoctor', msg, 'OK');
      Logger.log('distributeToDoctor: ' + msg);

    } catch (docErr) {
      logToSheet(
        'distributeToDoctor',
        'Error for doctor ' + doctorRaw + ': ' + docErr.message,
        'ERROR'
      );
      Logger.log('distributeToDoctor ERROR (' + doctorRaw + '): ' + docErr.message);
    }
  });

  // ----------------------------------------------------------
  // 4. Flush all pending writes at once
  // ----------------------------------------------------------
  SpreadsheetApp.flush();
  logToSheet('distributeToDoctor', 'Distribution complete', 'OK');
}

// ------------------------------------------------------------
// STATUS SYNC & REPORTING FUNCTIONS
// ------------------------------------------------------------

/**
 * Reads lead_status updates from every active doctor's "Leads" sheet
 * and writes any changes back to CRM column K (lead_status).
 *
 * Flow:
 *   1. Load CRM data into a Map<Lead_ID → {rowIndex, currentStatus}>
 *   2. For each active doctor, read their Leads sheet columns A & F
 *   3. Collect CRM cells that need updating
 *   4. Write all updates in one batch per affected row then flush
 */
function syncStatusFromDoctors() {
  var crmSS       = SpreadsheetApp.openById(CONFIG.CRM_SPREADSHEET_ID);
  var crmSheet    = crmSS.getSheetByName(CONFIG.CRM_SHEET);
  var configSheet = crmSS.getSheetByName(CONFIG.CONFIG_SHEET);

  // ----------------------------------------------------------
  // 1. Read Config tab — active doctors only
  // ----------------------------------------------------------
  var configLastRow = configSheet.getLastRow();
  if (configLastRow < 2) {
    logToSheet('syncStatusFromDoctors', 'No doctor rows in Config tab', 'OK');
    return;
  }

  var configData    = configSheet.getRange(2, 1, configLastRow - 1, 3).getValues();
  var activeDoctors = configData.filter(function(row) {
    return String(row[2]).trim().toLowerCase() === 'yes';
  });

  if (activeDoctors.length === 0) {
    logToSheet('syncStatusFromDoctors', 'No active doctors found', 'OK');
    return;
  }

  // ----------------------------------------------------------
  // 2. Read ALL CRM data once — build Lead_ID → row map
  //    Map value: { sheetRow: number, status: string }
  // ----------------------------------------------------------
  var crmLastRow = crmSheet.getLastRow();
  if (crmLastRow < 2) {
    logToSheet('syncStatusFromDoctors', 'CRM sheet has no data rows', 'OK');
    return;
  }

  var crmData   = crmSheet.getRange(2, 1, crmLastRow - 1, 13).getValues();
  // columns read: A(0)=Lead_ID … M(12)=attendance_status
  var leadIdMap = new Map(); // Lead_ID → { sheetRow, contactStatus, bookingStatus, attendanceStatus }

  crmData.forEach(function(row, i) {
    var leadId = String(row[0]).trim();
    if (leadId) {
      leadIdMap.set(leadId, {
        sheetRow:         i + 2,
        contactStatus:    String(row[10]).trim(), // col K index 10
        bookingStatus:    String(row[11]).trim(), // col L index 11
        attendanceStatus: String(row[12]).trim()  // col M index 12
      });
    }
  });

  // ----------------------------------------------------------
  // 3. Accumulate all status updates across all doctors
  //    updates = [ { sheetRow, newStatus }, … ]
  // ----------------------------------------------------------
  var updates = []; // { sheetRow: number, newStatus: string }

  activeDoctors.forEach(function(configRow) {
    var doctorRaw = String(configRow[0]).trim();
    var docUrl    = String(configRow[1]).trim();

    try {
      var docSS    = SpreadsheetApp.openByUrl(docUrl);
      var docSheet = docSS.getSheetByName('Leads');

      if (!docSheet) {
        logToSheet('syncStatusFromDoctors', 'Leads sheet missing for ' + doctorRaw, 'OK');
        return;
      }

      var docLastRow = docSheet.getLastRow();
      if (docLastRow < 2) return; // no data yet

      // Read cols A(Lead_ID), F(contact_status), G(booking_status), H(attendance_status)
      var docData      = docSheet.getRange(2, 1, docLastRow - 1, 8).getValues();
      var updatedCount = 0;

      docData.forEach(function(docRow) {
        var leadId            = String(docRow[0]).trim(); // col A
        var docContactStatus  = String(docRow[5]).trim(); // col F
        var docBookingStatus  = String(docRow[6]).trim(); // col G
        var docAttendStatus   = String(docRow[7]).trim(); // col H

        if (!leadId) return;

        var crmEntry = leadIdMap.get(leadId);
        if (!crmEntry) return; // lead not in CRM

        // Queue an update for each status column that has changed
        if (docContactStatus && crmEntry.contactStatus !== docContactStatus) {
          updates.push({ sheetRow: crmEntry.sheetRow, col: CONFIG.COL.CONTACT_STATUS, newStatus: docContactStatus });
          crmEntry.contactStatus = docContactStatus;
          updatedCount++;
        }
        if (docBookingStatus && crmEntry.bookingStatus !== docBookingStatus) {
          updates.push({ sheetRow: crmEntry.sheetRow, col: CONFIG.COL.BOOKING_STATUS, newStatus: docBookingStatus });
          crmEntry.bookingStatus = docBookingStatus;
          updatedCount++;
        }
        if (docAttendStatus && crmEntry.attendanceStatus !== docAttendStatus) {
          updates.push({ sheetRow: crmEntry.sheetRow, col: CONFIG.COL.ATTENDANCE_STATUS, newStatus: docAttendStatus });
          crmEntry.attendanceStatus = docAttendStatus;
          updatedCount++;
        }
      });

      logToSheet(
        'syncStatusFromDoctors',
        'Updated ' + updatedCount + ' status(es) from ' + doctorRaw,
        'OK'
      );

    } catch (docErr) {
      logToSheet(
        'syncStatusFromDoctors',
        'Error for doctor ' + doctorRaw + ': ' + docErr.message,
        'ERROR'
      );
    }
  });

  // ----------------------------------------------------------
  // 4. Write all status updates to CRM (cols K/L/M) in one pass
  // ----------------------------------------------------------
  updates.forEach(function(upd) {
    crmSheet.getRange(upd.sheetRow, upd.col).setValue(upd.newStatus);
  });

  SpreadsheetApp.flush();

  var totalMsg = 'Sync complete — ' + updates.length + ' CRM status(es) updated';
  logToSheet('syncStatusFromDoctors', totalMsg, 'OK');
  Logger.log('syncStatusFromDoctors: ' + totalMsg);
}

/**
 * Calculates daily KPIs from the CRM sheet and sends an Arabic HTML
 * report to CONFIG.REPORT_EMAIL.
 *
 * Metrics:
 *   - leads_today          rows with created_time date = today
 *   - by_platform_today    per-platform breakdown for today
 *   - no_contact_24h       status = "جديد" AND created_time < now − 24 h
 *   - total_booked         status = "تم الحجز"   (all time)
 *   - total_converted      status = "اتحول لعميل" (all time)
 *   - total_showed         status = "حضر"          (all time)
 */
function sendDailyReport() {
  try {
    var crmSS    = SpreadsheetApp.openById(CONFIG.CRM_SPREADSHEET_ID);
    var crmSheet = crmSS.getSheetByName(CONFIG.CRM_SHEET);

    var crmLastRow = crmSheet.getLastRow();
    if (crmLastRow < 2) {
      logToSheet('sendDailyReport', 'No CRM data — report skipped', 'OK');
      return;
    }

    // Read cols A–M (13 columns): Lead_ID … attendance_status
    var data = crmSheet.getRange(2, 1, crmLastRow - 1, 13).getValues();

    var now        = new Date();
    var todayStr   = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    var oneDayMs   = 24 * 60 * 60 * 1000;
    var cutoff24h  = new Date(now.getTime() - oneDayMs);

    // ----------------------------------------------------------
    // Metric accumulators
    // ----------------------------------------------------------
    var leadsToday      = 0;
    var platformCounts  = {};  // { platformName: count }
    var noContact24h    = 0;   // contact_status = "جديد" AND > 24 h old
    var totalContacted  = 0;   // contact_status = "تم التواصل"
    var totalNoContact  = 0;   // contact_status = "لم يتم التواصل"
    var totalBooked     = 0;   // booking_status = "تم الحجز"
    var totalShowed     = 0;   // attendance_status = "حضر"
    var totalNoShow     = 0;   // attendance_status = "لم يحضر"
    var totalReschedule = 0;   // attendance_status = "إعادة جدولة"

    data.forEach(function(row) {
      var createdRaw      = row[1];                            // col B
      var platform        = String(row[5]  || '').trim();      // col F
      var contactStatus   = String(row[10] || '').trim();      // col K
      var bookingStatus   = String(row[11] || '').trim();      // col L
      var attendStatus    = String(row[12] || '').trim();      // col M

      var createdDate = (createdRaw instanceof Date) ? createdRaw : new Date(createdRaw);
      var isValidDate = !isNaN(createdDate.getTime());

      // Today's leads
      if (isValidDate) {
        var rowDateStr = Utilities.formatDate(createdDate, Session.getScriptTimeZone(), 'yyyy-MM-dd');
        if (rowDateStr === todayStr) {
          leadsToday++;
          platformCounts[platform] = (platformCounts[platform] || 0) + 1;
        }
      }

      // No-contact in last 24 h: contact_status still "جديد" and older than 24 h
      if (contactStatus === 'جديد' && isValidDate && createdDate < cutoff24h) {
        noContact24h++;
      }

      // All-time counters by status column
      if (contactStatus === 'تم التواصل')    totalContacted++;
      if (contactStatus === 'لم يتم التواصل') totalNoContact++;
      if (bookingStatus  === 'تم الحجز')      totalBooked++;
      if (attendStatus   === 'حضر')            totalShowed++;
      if (attendStatus   === 'لم يحضر')       totalNoShow++;
      if (attendStatus   === 'إعادة جدولة')   totalReschedule++;
    });

    // ----------------------------------------------------------
    // Build platform breakdown rows
    // ----------------------------------------------------------
    var platformRows = Object.keys(platformCounts).map(function(p) {
      return '<tr><td style="padding:6px 12px;border:1px solid #ddd;">' + p + '</td>'
           + '<td style="padding:6px 12px;border:1px solid #ddd;text-align:center;">' + platformCounts[p] + '</td></tr>';
    }).join('');

    if (!platformRows) {
      platformRows = '<tr><td colspan="2" style="padding:6px 12px;border:1px solid #ddd;color:#999;">لا توجد بيانات</td></tr>';
    }

    // Highlight no-contact cell in red when non-zero
    var noContactStyle = noContact24h > 0
      ? 'background:#fce8e6;color:#c62828;font-weight:bold;'
      : '';

    // ----------------------------------------------------------
    // Build HTML email (RTL Arabic)
    // ----------------------------------------------------------
    var formattedDate = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy/MM/dd');

    var html = '<!DOCTYPE html>'
      + '<html dir="rtl" lang="ar">'
      + '<head><meta charset="UTF-8">'
      + '<style>'
      + '  body { font-family: Arial, sans-serif; direction: rtl; background: #f5f5f5; margin: 0; padding: 20px; }'
      + '  .container { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px;'
      + '               box-shadow: 0 2px 8px rgba(0,0,0,.1); overflow: hidden; }'
      + '  .header { background: #1a73e8; color: #fff; padding: 20px 24px; }'
      + '  .header h2 { margin: 0; font-size: 20px; }'
      + '  .header p  { margin: 4px 0 0; font-size: 13px; opacity: .85; }'
      + '  .section { padding: 16px 24px; }'
      + '  .section h3 { margin: 0 0 10px; font-size: 15px; color: #1a73e8; border-bottom: 2px solid #e8f0fe; padding-bottom: 6px; }'
      + '  table { width: 100%; border-collapse: collapse; font-size: 14px; }'
      + '  th { background: #e8f0fe; color: #1a73e8; padding: 8px 12px; border: 1px solid #ddd; text-align: right; }'
      + '  td { padding: 6px 12px; border: 1px solid #ddd; }'
      + '  tr:nth-child(even) td { background: #fafafa; }'
      + '  .footer { background: #f1f3f4; padding: 12px 24px; font-size: 12px; color: #777; text-align: center; }'
      + '</style>'
      + '</head><body>'
      + '<div class="container">'

      // Header
      + '<div class="header">'
      + '  <h2>تقرير كادينا اليومي</h2>'
      + '  <p>' + formattedDate + '</p>'
      + '</div>'

      // Today's summary
      + '<div class="section">'
      + '  <h3>ملخص اليوم</h3>'
      + '  <table>'
      + '    <tr><th>المؤشر</th><th style="text-align:center;">العدد</th></tr>'
      + '    <tr><td>عدد الليدز اليوم</td><td style="text-align:center;font-weight:bold;">' + leadsToday + '</td></tr>'
      + '    <tr><td style="' + noContactStyle + '">ليدز بدون تواصل (أكثر من 24 ساعة)</td>'
      + '        <td style="text-align:center;' + noContactStyle + '">' + noContact24h + '</td></tr>'
      + '  </table>'
      + '</div>'

      // Platform breakdown
      + '<div class="section">'
      + '  <h3>الليدز اليوم حسب المنصة</h3>'
      + '  <table>'
      + '    <tr><th>المنصة</th><th style="text-align:center;">العدد</th></tr>'
      + platformRows
      + '  </table>'
      + '</div>'

      // All-time counters — broken out by status column
      + '<div class="section">'
      + '  <h3>إجمالي الأداء (كل الوقت)</h3>'
      + '  <table>'
      + '    <tr><th>المؤشر</th><th style="text-align:center;">العدد</th></tr>'
      // contact_status
      + '    <tr><td style="background:#e8f0fe;font-weight:bold;" colspan="2">حالة التواصل</td></tr>'
      + '    <tr><td>تم التواصل</td><td style="text-align:center;">'         + totalContacted  + '</td></tr>'
      + '    <tr><td>لم يتم التواصل</td><td style="text-align:center;">'     + totalNoContact  + '</td></tr>'
      // booking_status
      + '    <tr><td style="background:#e6f4ea;font-weight:bold;" colspan="2">حالة الحجز</td></tr>'
      + '    <tr><td>تم الحجز</td><td style="text-align:center;">'            + totalBooked     + '</td></tr>'
      // attendance_status
      + '    <tr><td style="background:#fce8e6;font-weight:bold;" colspan="2">حالة الحضور</td></tr>'
      + '    <tr><td>حضر</td><td style="text-align:center;">'                 + totalShowed     + '</td></tr>'
      + '    <tr><td>لم يحضر</td><td style="text-align:center;">'             + totalNoShow     + '</td></tr>'
      + '    <tr><td>إعادة جدولة</td><td style="text-align:center;">'         + totalReschedule + '</td></tr>'
      + '  </table>'
      + '</div>'

      + '<div class="footer">تم الإرسال تلقائياً من نظام CRM كادينا</div>'
      + '</div>'
      + '</body></html>';

    // ----------------------------------------------------------
    // Send email
    // ----------------------------------------------------------
    MailApp.sendEmail({
      to:       CONFIG.REPORT_EMAIL,
      subject:  'تقرير كادينا اليومي - ' + formattedDate,
      htmlBody: html
    });

    logToSheet('sendDailyReport', 'Report sent to ' + CONFIG.REPORT_EMAIL, 'OK');
    Logger.log('sendDailyReport: report sent to ' + CONFIG.REPORT_EMAIL);

  } catch (e) {
    logToSheet('sendDailyReport', e.message, 'ERROR');
    Logger.log('sendDailyReport ERROR: ' + e.message);
  }
}

/**
 * Removes ALL existing project triggers then re-creates the four
 * scheduled triggers for the CRM automation pipeline.
 *
 * Trigger schedule:
 *   syncAllLeads          → every 15 minutes
 *   distributeToDoctor    → every 30 minutes
 *   syncStatusFromDoctors → every 30 minutes
 *   sendDailyReport       → daily, 9–10 AM (script timezone)
 *
 * Run this ONCE after setup, or whenever you need to reset the schedule.
 */
function setupAllTriggers() {
  // ----------------------------------------------------------
  // 1. Delete every existing trigger for this project
  // ----------------------------------------------------------
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    ScriptApp.deleteTrigger(trigger);
  });

  // ----------------------------------------------------------
  // 2. syncAllLeads — every 15 minutes
  // ----------------------------------------------------------
  ScriptApp.newTrigger('syncAllLeads')
    .timeBased()
    .everyMinutes(15)
    .create();

  // ----------------------------------------------------------
  // 3. distributeToDoctor — every 30 minutes
  // ----------------------------------------------------------
  ScriptApp.newTrigger('distributeToDoctor')
    .timeBased()
    .everyMinutes(30)
    .create();

  // ----------------------------------------------------------
  // 4. syncStatusFromDoctors — every 30 minutes
  // ----------------------------------------------------------
  ScriptApp.newTrigger('syncStatusFromDoctors')
    .timeBased()
    .everyMinutes(30)
    .create();

  // ----------------------------------------------------------
  // 5. syncBookedToDoctors — every 30 minutes
  // ----------------------------------------------------------
  ScriptApp.newTrigger('syncBookedToDoctors')
    .timeBased()
    .everyMinutes(30)
    .create();

  // ----------------------------------------------------------
  // 6. syncAttendanceFromDoctors — every 30 minutes
  // ----------------------------------------------------------
  ScriptApp.newTrigger('syncAttendanceFromDoctors')
    .timeBased()
    .everyMinutes(30)
    .create();

  // ----------------------------------------------------------
  // 7. sendDailyReport — daily between 9 AM and 10 AM
  // ----------------------------------------------------------
  ScriptApp.newTrigger('sendDailyReport')
    .timeBased()
    .everyDays(1)
    .atHour(9)
    .create();

  logToSheet('setupAllTriggers', 'Triggers set up successfully', 'OK');
  Logger.log('setupAllTriggers: 6 triggers created successfully');
}

// ------------------------------------------------------------
// DOCTOR SHEETS FUNCTIONS
// ------------------------------------------------------------

/**
 * One-time setup: creates the "Doctors" admin tab inside the CRM
 * spreadsheet (if it doesn't already exist) with the doctor roster.
 *
 * Doctors tab columns:
 *   A: doctor_name  B: active (Yes / No)
 *
 * The tab is the source of truth for which doctors get their own
 * per-doctor tab populated by syncBookedToDoctors().
 */
function setupDoctorSheets() {
  var ss           = SpreadsheetApp.openById(CONFIG.CRM_SPREADSHEET_ID);
  var doctorsSheet = getOrCreateSheet(ss, CONFIG.DOCTORS_SHEET);

  if (doctorsSheet.getLastRow() === 0) {
    // Write header row
    var headerRange = doctorsSheet.getRange(1, 1, 1, 2);
    headerRange.setValues([['doctor_name', 'active']]);
    headerRange
      .setBackground('#673ab7')
      .setFontColor('#ffffff')
      .setFontWeight('bold');
    doctorsSheet.setFrozenRows(1);

    // Add data-validation dropdown for column B (active)
    doctorsSheet.getRange(2, 2, doctorsSheet.getMaxRows() - 1, 1)
      .setDataValidation(
        SpreadsheetApp.newDataValidation()
          .requireValueInList(['Yes', 'No'], true)
          .setAllowInvalid(false)
          .build()
      );

    // Sample row
    doctorsSheet.getRange(2, 1, 1, 2).setValues([['DrAhmed', 'Yes']]);

    doctorsSheet.setColumnWidth(1, 180);
    doctorsSheet.setColumnWidth(2, 80);
  }

  logToSheet('setupDoctorSheets', 'Doctors tab ready', 'OK');
  Logger.log('setupDoctorSheets: complete');
}

/**
 * Reads all active doctors from the "Doctors" tab, then for each doctor:
 *   - Gets or creates a tab named after them inside the CRM spreadsheet.
 *   - Creates the tab headers on first use (purple #673ab7, white, bold).
 *   - Appends every CRM row where:
 *       doctor_name matches (case-insensitive) AND
 *       booking_status = "تم الحجز" AND
 *       Lead_ID is NOT already present in the doctor tab.
 *
 * Doctor tab columns:
 *   A:Lead_ID  B:full_name  C:phone  D:service_name
 *   E:booking_date  F:attendance_status  G:notes
 *
 * attendance_status dropdown: حضر / لم يحضر / إعادة جدولة
 *
 * Runs every 30 minutes via setupAllTriggers().
 */
function syncBookedToDoctors() {
  try {
    var ss          = SpreadsheetApp.openById(CONFIG.CRM_SPREADSHEET_ID);
    var crmSheet    = ss.getSheetByName(CONFIG.CRM_SHEET);
    var doctorsMeta = ss.getSheetByName(CONFIG.DOCTORS_SHEET);

    if (!doctorsMeta) {
      logToSheet('syncBookedToDoctors', 'Doctors tab missing — run setupDoctorSheets() first', 'ERROR');
      return;
    }

    // ----------------------------------------------------------
    // 1. Load active doctors from the Doctors tab
    // ----------------------------------------------------------
    var metaLastRow = doctorsMeta.getLastRow();
    if (metaLastRow < 2) {
      logToSheet('syncBookedToDoctors', 'No doctors in Doctors tab', 'OK');
      return;
    }

    var metaData     = doctorsMeta.getRange(2, 1, metaLastRow - 1, 2).getValues();
    var activeDoctors = metaData.filter(function(r) {
      return String(r[1]).trim().toLowerCase() === 'yes';
    }).map(function(r) {
      return String(r[0]).trim();
    });

    if (activeDoctors.length === 0) {
      logToSheet('syncBookedToDoctors', 'No active doctors found', 'OK');
      return;
    }

    // ----------------------------------------------------------
    // 2. Read ALL CRM data once (20 columns)
    // ----------------------------------------------------------
    var crmLastRow = crmSheet.getLastRow();
    if (crmLastRow < 2) {
      logToSheet('syncBookedToDoctors', 'CRM has no data rows', 'OK');
      return;
    }

    // Read cols A–S (19 cols) — everything except synced_to_doctor (T)
    var crmData = crmSheet.getRange(2, 1, crmLastRow - 1, 19).getValues();

    // Col indices (0-based):
    // 0=Lead_ID 1=created_time 2=full_name 3=phone 4=email
    // 5=platform 6=campaign_name 7=doctor_name 8=service_name
    // 9=form_answer 10=contact_status 11=booking_status
    // 12=attendance_status 13=first_contact_time 14=response_time_hrs
    // 15=no_booking_reason 16=no_show_reason 17=sales_agent 18=notes

    var COL = {
      LEAD_ID:           0,
      FULL_NAME:         2,
      PHONE:             3,
      SERVICE_NAME:      8,
      BOOKING_STATUS:    11,
      ATTENDANCE_STATUS: 12,
      FIRST_CONTACT:     13,
      NOTES:             18,
      DOCTOR_NAME:       7
    };

    // ----------------------------------------------------------
    // 3. Process each active doctor
    // ----------------------------------------------------------
    var ATTEND_VALUES = CONFIG.ATTENDANCE_STATUS_VALUES; // ['حضر','لم يحضر','إعادة جدولة']
    var HEADER_BG     = '#673ab7';
    var DOC_HEADERS   = ['Lead_ID','full_name','phone','service_name',
                         'booking_date','attendance_status','notes'];

    activeDoctors.forEach(function(doctorName) {
      try {
        var doctorKey = doctorName.toLowerCase();

        // Get or create the per-doctor tab
        var docSheet  = getOrCreateSheet(ss, doctorName);
        var isNew     = docSheet.getLastRow() === 0;

        if (isNew) {
          // Write headers
          var hRange = docSheet.getRange(1, 1, 1, DOC_HEADERS.length);
          hRange.setValues([DOC_HEADERS]);
          hRange.setBackground(HEADER_BG)
                .setFontColor('#ffffff')
                .setFontWeight('bold');
          docSheet.setFrozenRows(1);

          // Attendance dropdown on col F (column 6), whole column
          var maxRows = docSheet.getMaxRows() - 1;
          docSheet.getRange(2, 6, maxRows, 1)
            .setDataValidation(
              SpreadsheetApp.newDataValidation()
                .requireValueInList(ATTEND_VALUES, true)
                .setAllowInvalid(false)
                .build()
            );

          // Column widths
          [1,2,3,4,5,6,7].forEach(function(c, i) {
            var widths = [130, 160, 120, 140, 130, 140, 180];
            docSheet.setColumnWidth(c, widths[i]);
          });
        }

        // Load existing Lead_IDs from doctor tab col A
        var existingIds = new Set();
        var docLastRow  = docSheet.getLastRow();

        if (docLastRow > 1) {
          docSheet.getRange(2, 1, docLastRow - 1, 1).getValues()
            .forEach(function(r) {
              var id = String(r[0]).trim();
              if (id) existingIds.add(id);
            });
        }

        // Find matching CRM rows: booked + this doctor + not already synced
        var rowsToAppend = [];

        crmData.forEach(function(row) {
          var crmDoctor      = String(row[COL.DOCTOR_NAME]).trim().toLowerCase();
          var bookingStatus  = String(row[COL.BOOKING_STATUS]).trim();
          var leadId         = String(row[COL.LEAD_ID]).trim();

          if (crmDoctor !== doctorKey)       return;
          if (bookingStatus !== 'تم الحجز') return;
          if (!leadId)                       return;
          if (existingIds.has(leadId))       return;

          // booking_date = first_contact_time (best proxy available)
          var bookingDate = row[COL.FIRST_CONTACT] || '';

          rowsToAppend.push([
            leadId,                              // A Lead_ID
            row[COL.FULL_NAME],                  // B full_name
            row[COL.PHONE],                      // C phone
            row[COL.SERVICE_NAME],               // D service_name
            bookingDate,                         // E booking_date
            row[COL.ATTENDANCE_STATUS] || '',    // F attendance_status
            row[COL.NOTES]             || ''     // G notes
          ]);

          existingIds.add(leadId); // prevent duplicates within same batch
        });

        // Append new rows in one batch
        if (rowsToAppend.length > 0) {
          var writeStart = docSheet.getLastRow() + 1;
          docSheet
            .getRange(writeStart, 1, rowsToAppend.length, 7)
            .setValues(rowsToAppend);
        }

        var msg = 'Synced ' + rowsToAppend.length + ' booked lead(s) to tab "' + doctorName + '"';
        logToSheet('syncBookedToDoctors', msg, 'OK');
        Logger.log('syncBookedToDoctors: ' + msg);

      } catch (docErr) {
        logToSheet('syncBookedToDoctors',
          'Error for doctor "' + doctorName + '": ' + docErr.message, 'ERROR');
      }
    });

    SpreadsheetApp.flush();

  } catch (e) {
    logToSheet('syncBookedToDoctors', e.message, 'ERROR');
    Logger.log('syncBookedToDoctors ERROR: ' + e.message);
  }
}

/**
 * Reads the attendance_status column (F) from each active doctor's tab
 * and writes any changes back to CRM column M (attendance_status).
 *
 * Deduplication: only rows where the doctor's value differs from the
 * current CRM value are updated.
 *
 * Runs every 30 minutes via setupAllTriggers().
 */
function syncAttendanceFromDoctors() {
  try {
    var ss          = SpreadsheetApp.openById(CONFIG.CRM_SPREADSHEET_ID);
    var crmSheet    = ss.getSheetByName(CONFIG.CRM_SHEET);
    var doctorsMeta = ss.getSheetByName(CONFIG.DOCTORS_SHEET);

    if (!doctorsMeta) {
      logToSheet('syncAttendanceFromDoctors', 'Doctors tab missing', 'ERROR');
      return;
    }

    // ----------------------------------------------------------
    // 1. Load active doctors
    // ----------------------------------------------------------
    var metaLastRow  = doctorsMeta.getLastRow();
    if (metaLastRow < 2) return;

    var metaData     = doctorsMeta.getRange(2, 1, metaLastRow - 1, 2).getValues();
    var activeDoctors = metaData
      .filter(function(r) { return String(r[1]).trim().toLowerCase() === 'yes'; })
      .map(function(r)    { return String(r[0]).trim(); });

    if (activeDoctors.length === 0) return;

    // ----------------------------------------------------------
    // 2. Read ALL CRM data once — build Lead_ID → {sheetRow, attendStatus}
    // ----------------------------------------------------------
    var crmLastRow = crmSheet.getLastRow();
    if (crmLastRow < 2) return;

    // Read cols A (Lead_ID) and M (attendance_status) — columns 1 and 13
    var crmData = crmSheet.getRange(2, 1, crmLastRow - 1, 13).getValues();

    var leadMap = new Map(); // Lead_ID → { sheetRow, attendStatus }
    crmData.forEach(function(row, i) {
      var leadId = String(row[0]).trim();
      if (leadId) {
        leadMap.set(leadId, {
          sheetRow:     i + 2,                    // 1-based sheet row
          attendStatus: String(row[12]).trim()    // col M = index 12
        });
      }
    });

    // ----------------------------------------------------------
    // 3. For each doctor tab, collect attendance updates
    // ----------------------------------------------------------
    var updates      = []; // { sheetRow, newStatus }
    var totalUpdated = 0;

    activeDoctors.forEach(function(doctorName) {
      try {
        var docSheet = ss.getSheetByName(doctorName);
        if (!docSheet) return; // tab doesn't exist yet — skip

        var docLastRow = docSheet.getLastRow();
        if (docLastRow < 2) return;

        // Read col A (Lead_ID) and col F (attendance_status)
        var docData      = docSheet.getRange(2, 1, docLastRow - 1, 6).getValues();
        var docUpdated   = 0;

        docData.forEach(function(docRow) {
          var leadId    = String(docRow[0]).trim(); // col A
          var docAttend = String(docRow[5]).trim(); // col F

          if (!leadId || !docAttend) return;

          var crmEntry = leadMap.get(leadId);
          if (!crmEntry)                            return; // not in CRM
          if (crmEntry.attendStatus === docAttend)  return; // unchanged

          updates.push({ sheetRow: crmEntry.sheetRow, newStatus: docAttend });
          crmEntry.attendStatus = docAttend; // prevent double-write from another doctor
          docUpdated++;
        });

        logToSheet('syncAttendanceFromDoctors',
          'Read ' + docUpdated + ' update(s) from "' + doctorName + '"', 'OK');

      } catch (docErr) {
        logToSheet('syncAttendanceFromDoctors',
          'Error reading "' + doctorName + '": ' + docErr.message, 'ERROR');
      }
    });

    // ----------------------------------------------------------
    // 4. Write all attendance updates to CRM col M in one pass
    // ----------------------------------------------------------
    updates.forEach(function(upd) {
      crmSheet.getRange(upd.sheetRow, CONFIG.COL.ATTENDANCE_STATUS)
              .setValue(upd.newStatus);
      totalUpdated++;
    });

    SpreadsheetApp.flush();

    var summary = 'Sync complete — ' + totalUpdated + ' CRM attendance(s) updated';
    logToSheet('syncAttendanceFromDoctors', summary, 'OK');
    Logger.log('syncAttendanceFromDoctors: ' + summary);

  } catch (e) {
    logToSheet('syncAttendanceFromDoctors', e.message, 'ERROR');
    Logger.log('syncAttendanceFromDoctors ERROR: ' + e.message);
  }
}

// ------------------------------------------------------------
// DASHBOARD FUNCTION
// ------------------------------------------------------------

/**
 * Rebuilds the Dashboard tab from scratch with three sections of
 * COUNTIFS/AVERAGEIFS formulas that all reference the CRM sheet live.
 *
 * Section A — Overall Summary        (header: #1a73e8 blue)
 * Section B — By Platform            (header: #34a853 green)
 * Section C — By Doctor              (header: #673ab7 purple)
 *
 * Safe to re-run: the tab is fully cleared before writing.
 * Unique doctor names are read from CRM column H at build time;
 * re-run this function whenever the doctor roster changes.
 */
function setupDashboard() {
  var crmSS   = SpreadsheetApp.openById(CONFIG.CRM_SPREADSHEET_ID);
  var dash    = getOrCreateSheet(crmSS, CONFIG.DASHBOARD_SHEET);
  var crmName = CONFIG.CRM_SHEET;

  // ----------------------------------------------------------
  // Style helpers
  // ----------------------------------------------------------
  var BLUE_DARK    = '#1a73e8';
  var GREEN_DARK   = '#137333';
  var ORANGE_DARK  = '#e37400';
  var WHITE        = '#ffffff';
  var LABEL_BG     = '#f8f9fa';
  var TOTALS_BG    = '#e8f0fe';
  var BORDER_COLOR = '#dadce0';

  function styleHeader(range, bg) {
    range.setBackground(bg).setFontColor(WHITE)
         .setFontWeight('bold').setFontSize(11)
         .setHorizontalAlignment('center');
  }
  function styleColHeaders(range, bg) {
    range.setBackground(bg).setFontColor(WHITE)
         .setFontWeight('bold').setFontSize(10)
         .setHorizontalAlignment('center');
  }
  function styleLabel(range) {
    range.setBackground(LABEL_BG).setFontWeight('bold')
         .setFontSize(10).setHorizontalAlignment('right');
  }
  function styleValue(range) {
    range.setBackground(WHITE).setFontSize(10)
         .setHorizontalAlignment('center');
  }
  function styleTotals(range, bg) {
    range.setBackground(bg || TOTALS_BG)
         .setFontWeight('bold').setFontSize(10)
         .setHorizontalAlignment('center');
  }
  function applyBorders(range) {
    range.setBorder(true, true, true, true, true, true,
                    BORDER_COLOR, SpreadsheetApp.BorderStyle.SOLID);
  }
  function pct(numeratorCell, denominatorCell) {
    // Returns a formula string: numerator/denominator as %, or — if zero
    return 'IF(' + denominatorCell + '=0,"—",'
         + 'TEXT(' + numeratorCell + '/' + denominatorCell + ',"0.0%"))';
  }

  // ----------------------------------------------------------
  // CRM column letters
  // ----------------------------------------------------------
  var F_PLATFORM  = 'F';   // platform
  var K_CONTACT   = 'K';   // contact_status
  var L_BOOKING   = 'L';   // booking_status
  var M_ATTEND    = 'M';   // attendance_status
  var O_RESPONSE  = 'O';   // response_time_hours

  function cr(col) {
    // Returns a full-column range string for use inside formulas
    return "'" + crmName + "'!" + col + ":" + col;
  }
  function countPlat(platform) {
    return 'COUNTIF(' + cr(F_PLATFORM) + ',"' + platform + '")';
  }
  function countPlatVal(platform, col, val) {
    return 'COUNTIFS(' + cr(F_PLATFORM) + ',"' + platform + '",'
                       + cr(col)        + ',"' + val       + '")';
  }
  function avgResponsePlat(platform) {
    // Average response hours for this platform where value > 0
    return 'IFERROR(AVERAGEIFS(' + cr(O_RESPONSE) + ','
                                 + cr(F_PLATFORM)  + ',"' + platform + '",'
                                 + cr(O_RESPONSE)  + ',">0"),"—")';
  }

  // ----------------------------------------------------------
  // Clear and configure columns
  // Section 1 & 2 use 8 cols (B–I): label + 7 data cols
  // ----------------------------------------------------------
  dash.clearContents();
  dash.clearFormats();
  dash.setFrozenRows(0);

  dash.setColumnWidth(1, 20);   // A spacer
  dash.setColumnWidth(2, 175);  // B platform / label
  dash.setColumnWidth(3, 100);  // C إجمالي الليدز
  dash.setColumnWidth(4, 115);  // D تم التواصل / % رد
  dash.setColumnWidth(5, 115);  // E تم الحجز   / % تحويل
  dash.setColumnWidth(6, 100);  // F حضر        / % حضور
  dash.setColumnWidth(7, 135);  // G اتحول لعميل / متوسط وقت الرد
  dash.setColumnWidth(8, 130);  // H Conversion Rate%

  var SPAN      = 7;         // number of data columns (B–H)
  var platforms = ['Meta', 'Snapchat', 'TikTok'];

  var currentRow = 2; // row 1 = breathing room

  // ===========================================================
  // SECTION 1 — أداء المنصات
  // Cols: المنصة | إجمالي الليدز | تم التواصل | تم الحجز |
  //       حضر | اتحول لعميل | Conversion Rate%
  // ===========================================================
  dash.getRange(currentRow, 2, 1, SPAN).merge()
      .setValue('📊  أداء المنصات');
  styleHeader(dash.getRange(currentRow, 2, 1, SPAN), BLUE_DARK);
  applyBorders(dash.getRange(currentRow, 2, 1, SPAN));
  currentRow++;

  // Column headers
  var s1Headers = [
    'المنصة', 'إجمالي الليدز', 'تم التواصل',
    'تم الحجز', 'حضر', 'اتحول لعميل', 'Conversion Rate%'
  ];
  dash.getRange(currentRow, 2, 1, SPAN).setValues([s1Headers]);
  styleColHeaders(dash.getRange(currentRow, 2, 1, SPAN), '#1557b0');
  applyBorders(dash.getRange(currentRow, 2, 1, SPAN));
  currentRow++;

  // Data rows — one per platform
  var s1DataStart = currentRow;
  platforms.forEach(function(p) {
    // Conversion Rate% = تم الحجز / إجمالي الليدز
    var totalCell  = 'C' + currentRow;
    var bookedCell = 'E' + currentRow;

    var rowData = [
      p,
      '=' + countPlat(p),
      '=' + countPlatVal(p, K_CONTACT, 'تم التواصل'),
      '=' + countPlatVal(p, L_BOOKING, 'تم الحجز'),
      '=' + countPlatVal(p, M_ATTEND,  'حضر'),
      '=' + countPlatVal(p, M_ATTEND,  'اتحول لعميل'),
      '=' + pct(bookedCell, totalCell)
    ];
    dash.getRange(currentRow, 2, 1, SPAN).setValues([rowData]);
    styleLabel(dash.getRange(currentRow, 2));
    styleValue(dash.getRange(currentRow, 3, 1, SPAN - 1));
    applyBorders(dash.getRange(currentRow, 2, 1, SPAN));
    currentRow++;
  });

  // Totals row
  var s1End = currentRow - 1;
  var s1Totals = ['الإجمالي'];
  ['C','D','E','F','G'].forEach(function(col) {
    s1Totals.push('=SUM(' + col + s1DataStart + ':' + col + s1End + ')');
  });
  s1Totals.push('=' + pct('E' + currentRow, 'C' + currentRow));
  dash.getRange(currentRow, 2, 1, SPAN).setValues([s1Totals]);
  styleTotals(dash.getRange(currentRow, 2, 1, SPAN), '#dae8fc');
  dash.getRange(currentRow, 2).setHorizontalAlignment('right');
  applyBorders(dash.getRange(currentRow, 2, 1, SPAN));
  currentRow++;

  currentRow++; // spacer

  // ===========================================================
  // SECTION 2 — جودة الليدز
  // Cols: المنصة | % رد على الاتصال | % تحويل لحجز |
  //       % حضور | متوسط وقت الرد (ساعة)
  // ===========================================================
  var S2_SPAN = 5; // 5 columns: B–F

  dash.getRange(currentRow, 2, 1, S2_SPAN).merge()
      .setValue('📈  جودة الليدز');
  styleHeader(dash.getRange(currentRow, 2, 1, S2_SPAN), GREEN_DARK);
  applyBorders(dash.getRange(currentRow, 2, 1, S2_SPAN));
  currentRow++;

  var s2Headers = [
    'المنصة', '% رد على الاتصال', '% تحويل لحجز',
    '% حضور', 'متوسط وقت الرد (ساعة)'
  ];
  dash.getRange(currentRow, 2, 1, S2_SPAN).setValues([s2Headers]);
  styleColHeaders(dash.getRange(currentRow, 2, 1, S2_SPAN), '#137333');
  applyBorders(dash.getRange(currentRow, 2, 1, S2_SPAN));
  currentRow++;

  var s2DataStart = currentRow;
  platforms.forEach(function(p) {
    // Each % = specific status count / total leads for that platform
    var totalFormula    = countPlat(p);
    var contactedFormula = countPlatVal(p, K_CONTACT, 'تم التواصل');
    var bookedFormula   = countPlatVal(p, L_BOOKING,  'تم الحجز');
    var showedFormula   = countPlatVal(p, M_ATTEND,   'حضر');

    var rowData = [
      p,
      '=IFERROR(TEXT((' + contactedFormula + ')/(' + totalFormula + '),"0.0%"),"—")',
      '=IFERROR(TEXT((' + bookedFormula   + ')/(' + totalFormula + '),"0.0%"),"—")',
      '=IFERROR(TEXT((' + showedFormula   + ')/(' + totalFormula + '),"0.0%"),"—")',
      '=' + avgResponsePlat(p)
    ];
    dash.getRange(currentRow, 2, 1, S2_SPAN).setValues([rowData]);
    styleLabel(dash.getRange(currentRow, 2));
    styleValue(dash.getRange(currentRow, 3, 1, S2_SPAN - 1));
    applyBorders(dash.getRange(currentRow, 2, 1, S2_SPAN));
    currentRow++;
  });

  // Overall averages row
  var s2End = currentRow - 1;
  var totalAllFormula   = 'COUNTA(' + cr('A') + ')-1';
  var contactedAllFml   = 'COUNTIF(' + cr(K_CONTACT) + ',"تم التواصل")';
  var bookedAllFml      = 'COUNTIF(' + cr(L_BOOKING)  + ',"تم الحجز")';
  var showedAllFml      = 'COUNTIF(' + cr(M_ATTEND)   + ',"حضر")';

  var s2Totals = [
    'الإجمالي',
    '=IFERROR(TEXT((' + contactedAllFml + ')/(' + totalAllFormula + '),"0.0%"),"—")',
    '=IFERROR(TEXT((' + bookedAllFml   + ')/(' + totalAllFormula + '),"0.0%"),"—")',
    '=IFERROR(TEXT((' + showedAllFml   + ')/(' + totalAllFormula + '),"0.0%"),"—")',
    '=IFERROR(AVERAGEIF(' + cr(O_RESPONSE) + ',">0"),"—")'
  ];
  dash.getRange(currentRow, 2, 1, S2_SPAN).setValues([s2Totals]);
  styleTotals(dash.getRange(currentRow, 2, 1, S2_SPAN), '#d9ead3');
  dash.getRange(currentRow, 2).setHorizontalAlignment('right');
  applyBorders(dash.getRange(currentRow, 2, 1, S2_SPAN));
  currentRow++;

  currentRow++; // spacer

  // ===========================================================
  // SECTION 3 — تنبيهات
  // 3 fixed alert rows with live formulas
  // ===========================================================
  var S3_SPAN = 4;

  dash.getRange(currentRow, 2, 1, S3_SPAN).merge()
      .setValue('🔔  تنبيهات');
  styleHeader(dash.getRange(currentRow, 2, 1, S3_SPAN), ORANGE_DARK);
  applyBorders(dash.getRange(currentRow, 2, 1, S3_SPAN));
  currentRow++;

  var s3ColHeaders = ['التنبيه', 'القيمة', '', ''];
  dash.getRange(currentRow, 2, 1, S3_SPAN).setValues([s3ColHeaders]);
  styleColHeaders(dash.getRange(currentRow, 2, 1, S3_SPAN), '#b45309');
  applyBorders(dash.getRange(currentRow, 2, 1, S3_SPAN));
  currentRow++;

  // Alert 1: leads with no contact for more than 24 hours
  // contact_status = "جديد" AND created_time < NOW() - 1
  var alert1Formula = '=COUNTIFS('
    + cr(K_CONTACT) + ',"جديد",'
    + cr('B')       + ',"<"&(NOW()-1))';

  // Alert 2: leads booked but not yet attended (booking=تم الحجز, attendance=blank)
  var alert2Formula = '=COUNTIFS('
    + cr(L_BOOKING) + ',"تم الحجز",'
    + cr(M_ATTEND)  + ',"")';

  // Alert 3: best platform this week (most leads since Monday)
  // Uses array COUNTIFS against the 3 platform names; INDEX/MATCH picks the max
  var weekStart = 'TODAY()-WEEKDAY(TODAY(),2)+1'; // Monday of current week
  var alert3Formula = '=IFERROR(INDEX({"Meta","Snapchat","TikTok"},'
    + 'MATCH(MAX('
    +   'COUNTIFS(' + cr(F_PLATFORM) + ',{"Meta","Snapchat","TikTok"},'
                    + cr('B')        + ',">="&(' + weekStart + ')))'
    + ','
    +   'COUNTIFS(' + cr(F_PLATFORM) + ',{"Meta","Snapchat","TikTok"},'
                    + cr('B')        + ',">="&(' + weekStart + '))'
    + ',0)),"—")';

  var alerts = [
    ['ليدز بدون تواصل أكثر من 24 ساعة', alert1Formula],
    ['ليدز حجزت ولم تحضر بعد',           alert2Formula],
    ['أفضل منصة هذا الأسبوع',            alert3Formula]
  ];

  alerts.forEach(function(pair, idx) {
    dash.getRange(currentRow, 2).setValue(pair[0]);
    dash.getRange(currentRow, 3).setFormula(pair[1]);
    styleLabel(dash.getRange(currentRow, 2));

    var valueCell = dash.getRange(currentRow, 3);
    styleValue(valueCell);
    valueCell.setFontWeight('bold');

    // Highlight the no-contact alert row in red when value > 0
    if (idx === 0) {
      // Conditional formatting not available via Apps Script on formula cells,
      // so we style the label red as a permanent visual cue.
      dash.getRange(currentRow, 2).setFontColor('#c62828');
    }

    dash.getRange(currentRow, 4, 1, 2).setBackground(WHITE); // fill unused cols
    applyBorders(dash.getRange(currentRow, 2, 1, S3_SPAN));
    currentRow++;
  });

  // ----------------------------------------------------------
  // Flush and log
  // ----------------------------------------------------------
  SpreadsheetApp.flush();
  logToSheet('setupDashboard', 'Dashboard rebuilt — 3 sections', 'OK');
  Logger.log('setupDashboard: complete');
}

// ------------------------------------------------------------
// MIGRATION FUNCTION
// ------------------------------------------------------------

/**
 * One-time migration: upgrades an existing CRM sheet that has a single
 * "lead_status" column (K) to the 3-column status model without touching
 * any existing data rows.
 *
 * What this function does:
 *   1. Locates "lead_status" in the header row — aborts safely if not found
 *      (already migrated) or if contact_status already exists.
 *   2. Renames that column header to "contact_status".
 *   3. Inserts 2 blank columns immediately after it.
 *      Google Sheets shifts all data and existing formulas right automatically.
 *   4. Writes "booking_status" and "attendance_status" headers into the new cols.
 *   5. Replaces the old lead_status dropdown on K with the new contact_status list.
 *   6. Adds booking_status and attendance_status dropdowns on L and M.
 *   7. Locates the response_time_hours column by scanning the (now-shifted)
 *      header row, then explicitly rewrites its formula to reference the
 *      updated first_contact_time column (one col to its left).
 *   8. Applies the blue header style to the two new header cells.
 *   9. Flushes and logs the result.
 *
 * Safe to inspect: if the sheet was already migrated the function exits
 * without making any changes.
 */
function updateCRMColumns() {
  try {
    var ss    = SpreadsheetApp.openById(CONFIG.CRM_SPREADSHEET_ID);
    var sheet = ss.getSheetByName(CONFIG.CRM_SHEET);

    if (!sheet) {
      throw new Error('CRM sheet "' + CONFIG.CRM_SHEET + '" not found');
    }

    var lastCol = sheet.getLastColumn();
    if (lastCol < 1) {
      throw new Error('CRM sheet appears to be empty');
    }

    // ----------------------------------------------------------
    // 1. Read the full header row and locate key columns
    // ----------------------------------------------------------
    var headerValues = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

    var leadStatusCol       = -1; // 1-based; the col we rename
    var contactStatusCol    = -1; // guard: already migrated?
    var responseTimeCol     = -1; // 1-based; we'll rewrite its formula

    headerValues.forEach(function(h, i) {
      var hTrim = String(h).trim().toLowerCase();
      if (hTrim === 'lead_status')          leadStatusCol    = i + 1;
      if (hTrim === 'contact_status')       contactStatusCol = i + 1;
      if (hTrim === 'response_time_hours')  responseTimeCol  = i + 1;
    });

    // Guard: already migrated
    if (contactStatusCol !== -1) {
      var msg = 'Migration skipped — contact_status column already exists at col ' + contactStatusCol;
      logToSheet('updateCRMColumns', msg, 'OK');
      Logger.log('updateCRMColumns: ' + msg);
      return;
    }

    // Guard: source column not found
    if (leadStatusCol === -1) {
      throw new Error('lead_status column not found in header row — cannot migrate');
    }

    // ----------------------------------------------------------
    // 2. Rename the existing lead_status header → contact_status
    // ----------------------------------------------------------
    sheet.getRange(1, leadStatusCol).setValue('contact_status');

    // ----------------------------------------------------------
    // 3. Insert 2 blank columns immediately after lead_status col
    //    Sheets auto-shifts all data, formulas, and validations right.
    // ----------------------------------------------------------
    sheet.insertColumnsAfter(leadStatusCol, 2);

    // After the insert, the new columns are at:
    var bookingCol    = leadStatusCol + 1;  // L (booking_status)
    var attendanceCol = leadStatusCol + 2;  // M (attendance_status)

    // response_time_hours shifted right by 2 if it was after lead_status
    if (responseTimeCol !== -1 && responseTimeCol > leadStatusCol) {
      responseTimeCol += 2;
    }

    // ----------------------------------------------------------
    // 4. Write headers for the two new columns
    // ----------------------------------------------------------
    sheet.getRange(1, bookingCol).setValue('booking_status');
    sheet.getRange(1, attendanceCol).setValue('attendance_status');

    // Apply matching blue header style to new cells
    sheet.getRange(1, bookingCol, 1, 2)
         .setBackground('#1a73e8')
         .setFontColor('#ffffff')
         .setFontWeight('bold');

    // ----------------------------------------------------------
    // 5. Replace old lead_status dropdown on K with contact_status list
    // ----------------------------------------------------------
    var dataRows = sheet.getMaxRows() - 1;

    sheet.getRange(2, leadStatusCol, dataRows, 1)
         .clearDataValidations()
         .setDataValidation(
           SpreadsheetApp.newDataValidation()
             .requireValueInList(CONFIG.CONTACT_STATUS_VALUES, true)
             .setAllowInvalid(false)
             .build()
         );

    // ----------------------------------------------------------
    // 6. Add dropdowns for the two new columns
    // ----------------------------------------------------------
    sheet.getRange(2, bookingCol, dataRows, 1)
         .setDataValidation(
           SpreadsheetApp.newDataValidation()
             .requireValueInList(CONFIG.BOOKING_STATUS_VALUES, true)
             .setAllowInvalid(false)
             .build()
         );

    sheet.getRange(2, attendanceCol, dataRows, 1)
         .setDataValidation(
           SpreadsheetApp.newDataValidation()
             .requireValueInList(CONFIG.ATTENDANCE_STATUS_VALUES, true)
             .setAllowInvalid(false)
             .build()
         );

    // ----------------------------------------------------------
    // 7. Rewrite the response_time_hours formula
    //    It must reference the first_contact_time column (one col to
    //    its left).  Sheets updates formula refs automatically on insert,
    //    but we rewrite explicitly to be certain and self-documenting.
    // ----------------------------------------------------------
    if (responseTimeCol !== -1) {
      var firstContactCol = responseTimeCol - 1; // always one col to the left
      var firstContactLetter = columnToLetter(firstContactCol);
      var formula = '=IF(' + firstContactLetter + '2="","",ROUND(('
                  + firstContactLetter + '2-B2)*24,1))';
      sheet.getRange(2, responseTimeCol).setFormula(formula);
      Logger.log('updateCRMColumns: set response_time formula in col '
                 + columnToLetter(responseTimeCol) + '2 → ' + formula);
    } else {
      Logger.log('updateCRMColumns: response_time_hours column not found — formula not updated');
    }

    // ----------------------------------------------------------
    // 8. Flush and log success
    // ----------------------------------------------------------
    SpreadsheetApp.flush();

    var successMsg = 'Migration complete — lead_status (col '
      + columnToLetter(leadStatusCol) + ') renamed to contact_status; '
      + 'booking_status added at col ' + columnToLetter(bookingCol) + '; '
      + 'attendance_status added at col ' + columnToLetter(attendanceCol);

    logToSheet('updateCRMColumns', successMsg, 'OK');
    Logger.log('updateCRMColumns: ' + successMsg);

  } catch (e) {
    logToSheet('updateCRMColumns', e.message, 'ERROR');
    Logger.log('updateCRMColumns ERROR: ' + e.message);
  }
}

/**
 * Converts a 1-based column number to its spreadsheet letter(s).
 * e.g. 1→A, 26→Z, 27→AA, 28→AB
 *
 * @param {number} col  1-based column index
 * @returns {string}
 */
function columnToLetter(col) {
  var letter = '';
  while (col > 0) {
    var rem = (col - 1) % 26;
    letter  = String.fromCharCode(65 + rem) + letter;
    col     = Math.floor((col - 1) / 26);
  }
  return letter;
}
