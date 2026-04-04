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
  ATTENDANCE_STATUS_VALUES: ['حاضر', 'لم يحضر', 'إعادة جدولة']
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
    var totalShowed     = 0;   // attendance_status = "حاضر"
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
      if (attendStatus   === 'حاضر')          totalShowed++;
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
  // 5. sendDailyReport — daily between 9 AM and 10 AM
  // ----------------------------------------------------------
  ScriptApp.newTrigger('sendDailyReport')
    .timeBased()
    .everyDays(1)
    .atHour(9)
    .create();

  logToSheet('setupAllTriggers', 'Triggers set up successfully', 'OK');
  Logger.log('setupAllTriggers: 4 triggers created successfully');
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
  // Shared style helpers
  // ----------------------------------------------------------
  var BLUE         = '#1a73e8';
  var GREEN        = '#34a853';
  var PURPLE       = '#673ab7';
  var WHITE        = '#ffffff';
  var LABEL_BG     = '#f8f9fa';
  var BORDER_COLOR = '#dadce0';

  function styleHeader(range, bg) {
    range.setBackground(bg).setFontColor(WHITE)
         .setFontWeight('bold').setFontSize(11)
         .setHorizontalAlignment('center');
  }
  function styleSubHeader(range, bg) {
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
  function applyBorders(range) {
    range.setBorder(true, true, true, true, true, true,
                    BORDER_COLOR, SpreadsheetApp.BorderStyle.SOLID);
  }

  // ----------------------------------------------------------
  // 0. Clear and set column widths
  //    Sections span cols B–I (8 data cols) to fit 3-status tables
  // ----------------------------------------------------------
  dash.clearContents();
  dash.clearFormats();
  dash.setFrozenRows(0);

  dash.setColumnWidth(1, 30);   // A — spacer
  dash.setColumnWidth(2, 190);  // B — label / platform / doctor
  dash.setColumnWidth(3, 90);   // C
  dash.setColumnWidth(4, 120);  // D
  dash.setColumnWidth(5, 120);  // E
  dash.setColumnWidth(6, 120);  // F
  dash.setColumnWidth(7, 120);  // G
  dash.setColumnWidth(8, 120);  // H
  dash.setColumnWidth(9, 110);  // I — rate %

  // ----------------------------------------------------------
  // Formula helpers — column letters match new CRM layout
  // ----------------------------------------------------------
  var CONTACT_COL  = 'K';  // contact_status
  var BOOKING_COL  = 'L';  // booking_status
  var ATTEND_COL   = 'M';  // attendance_status
  var PLATFORM_COL = 'F';
  var DOCTOR_COL   = 'H';
  var RESPONSE_COL = 'O';  // response_time_hours (was M)

  function colRange(col) {
    return "'" + crmName + "'!" + col + ":" + col;
  }
  // COUNTIF value in a specific CRM column
  function countIn(crmCol, value) {
    return 'COUNTIF(' + colRange(crmCol) + ',"' + value + '")';
  }
  // COUNTIFS platform + value in a specific CRM column
  function countPlatformIn(platform, crmCol, value) {
    return 'COUNTIFS('
      + colRange(PLATFORM_COL) + ',"' + platform + '",'
      + colRange(crmCol)       + ',"' + value    + '"'
      + ')';
  }
  // COUNTIF platform total
  function countPlatform(platform) {
    return 'COUNTIF(' + colRange(PLATFORM_COL) + ',"' + platform + '")';
  }
  // COUNTIFS doctor (cell ref) + value in a specific CRM column
  function countDoctorIn(doctorCell, crmCol, value) {
    return 'COUNTIFS('
      + colRange(DOCTOR_COL) + ',' + doctorCell + ','
      + colRange(crmCol)     + ',"' + value + '"'
      + ')';
  }
  // COUNTIF doctor total
  function countDoctor(doctorCell) {
    return 'COUNTIF(' + colRange(DOCTOR_COL) + ',' + doctorCell + ')';
  }
  // Rate %: bookedCell / totalCell, avoids div-by-zero
  function rate(bookedCell, totalCell) {
    return 'IF(' + totalCell + '=0,"—",TEXT(' + bookedCell + '/' + totalCell + ',"0.0%"))';
  }

  // ----------------------------------------------------------
  // 1. Read unique doctor names from CRM col H
  // ----------------------------------------------------------
  var crmSheet = crmSS.getSheetByName(crmName);
  var lastRow  = crmSheet.getLastRow();
  var doctors  = [];

  if (lastRow > 1) {
    var hVals = crmSheet.getRange(2, 8, lastRow - 1, 1).getValues();
    var seen  = {};
    hVals.forEach(function(r) {
      var d = String(r[0]).trim();
      if (d && d !== 'unknown' && !seen[d]) { seen[d] = true; doctors.push(d); }
    });
    doctors.sort();
  }

  var currentRow = 2; // row 1 left as breathing room

  // ===========================================================
  // SECTION A — Overall Summary  (blue, cols B:I)
  // ===========================================================
  var aSpan = 8; // cols B–I

  dash.getRange(currentRow, 2, 1, aSpan).merge()
      .setValue('📊  ملخص عام  —  Overall Summary');
  styleHeader(dash.getRange(currentRow, 2, 1, aSpan), BLUE);
  applyBorders(dash.getRange(currentRow, 2, 1, aSpan));
  currentRow++;

  // Sub-header row
  dash.getRange(currentRow, 2, 1, aSpan)
      .setValues([['المؤشر', 'القيمة', '', '', '', '', '', '']]);
  styleLabel(dash.getRange(currentRow, 2));
  styleValue(dash.getRange(currentRow, 3));
  currentRow++;

  // --- Totals & response time ---
  var aSummary1 = [
    ['إجمالي الليدز — Total Leads',
     '=COUNTA(' + colRange('A') + ')-1'],
    ['متوسط وقت الاستجابة (ساعة) — Avg Response Hrs',
     '=IFERROR(AVERAGEIF(' + colRange(RESPONSE_COL) + ',">0"),"—")']
  ];
  aSummary1.forEach(function(pair) {
    dash.getRange(currentRow, 2).setValue(pair[0]);
    dash.getRange(currentRow, 3).setFormula(pair[1]);
    styleLabel(dash.getRange(currentRow, 2));
    styleValue(dash.getRange(currentRow, 3));
    applyBorders(dash.getRange(currentRow, 2, 1, aSpan));
    currentRow++;
  });

  // --- contact_status group ---
  dash.getRange(currentRow, 2, 1, aSpan).merge()
      .setValue('حالة التواصل — Contact Status');
  styleSubHeader(dash.getRange(currentRow, 2, 1, aSpan), '#1557b0');
  applyBorders(dash.getRange(currentRow, 2, 1, aSpan));
  currentRow++;

  [['جديد',              countIn(CONTACT_COL, 'جديد')],
   ['تم التواصل',        countIn(CONTACT_COL, 'تم التواصل')],
   ['لم يتم التواصل',   countIn(CONTACT_COL, 'لم يتم التواصل')]
  ].forEach(function(pair) {
    dash.getRange(currentRow, 2).setValue(pair[0]);
    dash.getRange(currentRow, 3).setFormula('=' + pair[1]);
    styleLabel(dash.getRange(currentRow, 2));
    styleValue(dash.getRange(currentRow, 3));
    applyBorders(dash.getRange(currentRow, 2, 1, aSpan));
    currentRow++;
  });

  // --- booking_status group ---
  dash.getRange(currentRow, 2, 1, aSpan).merge()
      .setValue('حالة الحجز — Booking Status');
  styleSubHeader(dash.getRange(currentRow, 2, 1, aSpan), '#137333');
  applyBorders(dash.getRange(currentRow, 2, 1, aSpan));
  currentRow++;

  [['لم يتم الرد',  countIn(BOOKING_COL, 'لم يتم الرد')],
   ['استفسار',       countIn(BOOKING_COL, 'استفسار')],
   ['تم الحجز',      countIn(BOOKING_COL, 'تم الحجز')]
  ].forEach(function(pair) {
    dash.getRange(currentRow, 2).setValue(pair[0]);
    dash.getRange(currentRow, 3).setFormula('=' + pair[1]);
    styleLabel(dash.getRange(currentRow, 2));
    styleValue(dash.getRange(currentRow, 3));
    applyBorders(dash.getRange(currentRow, 2, 1, aSpan));
    currentRow++;
  });

  // --- attendance_status group ---
  dash.getRange(currentRow, 2, 1, aSpan).merge()
      .setValue('حالة الحضور — Attendance Status');
  styleSubHeader(dash.getRange(currentRow, 2, 1, aSpan), '#4527a0');
  applyBorders(dash.getRange(currentRow, 2, 1, aSpan));
  currentRow++;

  [['حاضر',             countIn(ATTEND_COL, 'حاضر')],
   ['لم يحضر',          countIn(ATTEND_COL, 'لم يحضر')],
   ['إعادة جدولة',      countIn(ATTEND_COL, 'إعادة جدولة')]
  ].forEach(function(pair) {
    dash.getRange(currentRow, 2).setValue(pair[0]);
    dash.getRange(currentRow, 3).setFormula('=' + pair[1]);
    styleLabel(dash.getRange(currentRow, 2));
    styleValue(dash.getRange(currentRow, 3));
    applyBorders(dash.getRange(currentRow, 2, 1, aSpan));
    currentRow++;
  });

  currentRow++; // spacer

  // ===========================================================
  // SECTION B — By Platform  (green, 3 sub-tables)
  // Each sub-table: Platform | Total | val1 | val2 | val3 | Rate%
  // cols B–H = 7 cols
  // ===========================================================
  var bSpan     = 7;
  var platforms = ['Meta', 'Snapchat', 'TikTok'];

  dash.getRange(currentRow, 2, 1, bSpan).merge()
      .setValue('📱  حسب المنصة  —  By Platform');
  styleHeader(dash.getRange(currentRow, 2, 1, bSpan), GREEN);
  applyBorders(dash.getRange(currentRow, 2, 1, bSpan));
  currentRow++;

  // Helper: render one platform sub-table
  function renderPlatformSubTable(titleText, subBg, statusCol, colHeaders, statusValues) {
    // sub-table title
    dash.getRange(currentRow, 2, 1, bSpan).merge().setValue(titleText);
    styleSubHeader(dash.getRange(currentRow, 2, 1, bSpan), subBg);
    applyBorders(dash.getRange(currentRow, 2, 1, bSpan));
    currentRow++;

    // column headers
    var hRow = ['Platform', 'Total'].concat(colHeaders).concat(['Rate %']);
    dash.getRange(currentRow, 2, 1, bSpan).setValues([hRow]);
    styleSubHeader(dash.getRange(currentRow, 2, 1, bSpan), subBg);
    applyBorders(dash.getRange(currentRow, 2, 1, bSpan));
    currentRow++;

    var dataRowStart = currentRow;
    platforms.forEach(function(p) {
      var totalCell  = 'C' + currentRow;
      // first status value = "positive" outcome for rate
      var posCell    = 'D' + currentRow;
      var rowData    = [p, '=' + countPlatform(p)];
      statusValues.forEach(function(sv) {
        rowData.push('=' + countPlatformIn(p, statusCol, sv));
      });
      rowData.push('=' + rate(posCell, totalCell));

      dash.getRange(currentRow, 2, 1, bSpan).setValues([rowData]);
      styleLabel(dash.getRange(currentRow, 2));
      styleValue(dash.getRange(currentRow, 3, 1, bSpan - 1));
      applyBorders(dash.getRange(currentRow, 2, 1, bSpan));
      currentRow++;
    });

    // totals row
    var s = dataRowStart, e = currentRow - 1;
    var totRow = ['الإجمالي'];
    for (var c = 3; c <= 3 + statusValues.length; c++) {
      var letter = String.fromCharCode(64 + c); // C=3, D=4, …
      totRow.push('=SUM(' + letter + s + ':' + letter + e + ')');
    }
    totRow.push('=' + rate('D' + currentRow, 'C' + currentRow));
    dash.getRange(currentRow, 2, 1, bSpan).setValues([totRow]);
    dash.getRange(currentRow, 2, 1, bSpan).setFontWeight('bold')
        .setBackground('#e6f4ea');
    applyBorders(dash.getRange(currentRow, 2, 1, bSpan));
    currentRow++;
    currentRow++; // spacer between sub-tables
  }

  renderPlatformSubTable(
    'حالة التواصل',  '#1557b0', CONTACT_COL,
    ['جديد', 'تم التواصل', 'لم يتم التواصل'],
    ['جديد', 'تم التواصل', 'لم يتم التواصل']
  );
  renderPlatformSubTable(
    'حالة الحجز',   '#137333', BOOKING_COL,
    ['لم يتم الرد', 'استفسار', 'تم الحجز'],
    ['لم يتم الرد', 'استفسار', 'تم الحجز']
  );
  renderPlatformSubTable(
    'حالة الحضور',  '#4527a0', ATTEND_COL,
    ['حاضر', 'لم يحضر', 'إعادة جدولة'],
    ['حاضر', 'لم يحضر', 'إعادة جدولة']
  );

  // ===========================================================
  // SECTION C — By Doctor  (purple)
  // Doctor | Total | Contacted | Booked | Showed | Booking Rate%
  // cols B–G = 6 cols
  // ===========================================================
  var cSpan = 6;

  dash.getRange(currentRow, 2, 1, cSpan).merge()
      .setValue('👨‍⚕️  حسب الطبيب  —  By Doctor');
  styleHeader(dash.getRange(currentRow, 2, 1, cSpan), PURPLE);
  applyBorders(dash.getRange(currentRow, 2, 1, cSpan));
  currentRow++;

  var cColHeaders = ['Doctor', 'Total', 'تم التواصل', 'تم الحجز', 'حاضر', 'Booking Rate%'];
  dash.getRange(currentRow, 2, 1, cSpan).setValues([cColHeaders]);
  styleSubHeader(dash.getRange(currentRow, 2, 1, cSpan), '#4527a0');
  applyBorders(dash.getRange(currentRow, 2, 1, cSpan));
  currentRow++;

  if (doctors.length === 0) {
    dash.getRange(currentRow, 2, 1, cSpan).merge()
        .setValue('لا توجد بيانات حتى الآن — No data yet')
        .setFontColor('#999999').setHorizontalAlignment('center');
    applyBorders(dash.getRange(currentRow, 2, 1, cSpan));
    currentRow++;
  } else {
    var cDataStart = currentRow;
    doctors.forEach(function(doctor) {
      var bCell = 'B' + currentRow; // doctor name cell for COUNTIFS
      var cCell = 'C' + currentRow; // total
      var eCell = 'E' + currentRow; // booked

      var rowData = [
        doctor,
        '=' + countDoctor(bCell),
        '=' + countDoctorIn(bCell, CONTACT_COL, 'تم التواصل'),
        '=' + countDoctorIn(bCell, BOOKING_COL,  'تم الحجز'),
        '=' + countDoctorIn(bCell, ATTEND_COL,   'حاضر'),
        '=' + rate(eCell, cCell)
      ];
      dash.getRange(currentRow, 2, 1, cSpan).setValues([rowData]);
      styleLabel(dash.getRange(currentRow, 2));
      styleValue(dash.getRange(currentRow, 3, 1, cSpan - 1));
      applyBorders(dash.getRange(currentRow, 2, 1, cSpan));
      currentRow++;
    });

    // Doctor totals row
    var cs = cDataStart, ce = currentRow - 1;
    var cTotals = [
      'الإجمالي',
      '=SUM(C' + cs + ':C' + ce + ')',
      '=SUM(D' + cs + ':D' + ce + ')',
      '=SUM(E' + cs + ':E' + ce + ')',
      '=SUM(F' + cs + ':F' + ce + ')',
      '=' + rate('E' + currentRow, 'C' + currentRow)
    ];
    dash.getRange(currentRow, 2, 1, cSpan).setValues([cTotals]);
    dash.getRange(currentRow, 2, 1, cSpan).setFontWeight('bold')
        .setBackground('#ede7f6');
    applyBorders(dash.getRange(currentRow, 2, 1, cSpan));
    currentRow++;
  }

  // ----------------------------------------------------------
  // Final flush
  // ----------------------------------------------------------
  SpreadsheetApp.flush();
  logToSheet('setupDashboard', 'Dashboard built with ' + doctors.length + ' doctor(s)', 'OK');
  Logger.log('setupDashboard: complete — ' + doctors.length + ' doctor(s) in Section C');
}
