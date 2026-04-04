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

          // Build the 18-column CRM row
          // [A]Lead_ID [B]created_time [C]full_name [D]phone [E]email
          // [F]platform [G]campaign_name [H]doctor_name [I]service_name
          // [J]form_answer [K]lead_status [L]first_contact_time
          // [M]response_time_hours [N]no_booking_reason [O]no_show_reason
          // [P]sales_agent [Q]notes [R]synced_to_doctor
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
            'جديد',        // K — lead_status  (default: new)
            '',            // L — first_contact_time
            '',            // M — response_time_hours (formula-driven)
            '',            // N — no_booking_reason
            '',            // O — no_show_reason
            '',            // P — sales_agent
            '',            // Q — notes
            'No'           // R — synced_to_doctor
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
        .getRange(writeStartRow, 1, allNewRows.length, 18)
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
  var crmData = crmSheet.getRange(2, 1, crmLastRow - 1, 18).getValues();
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
          'Lead_ID', 'full_name', 'phone', 'platform',
          'service', 'lead_status', 'form_answer', 'notes'
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
        var syncedFlag   = String(crmRow[17]).trim();              // col R (index 17)
        var leadId       = String(crmRow[0]).trim();               // col A (index 0)

        if (crmDoctorKey !== doctorKey) return;
        if (syncedFlag === 'Yes') return;
        if (existingLeadIds.has(leadId)) return; // already in doctor sheet

        // Build the 8-column doctor row
        // A:Lead_ID B:full_name C:phone D:platform E:service F:lead_status G:form_answer H:notes
        rowsForDoctor.push([
          crmRow[0],   // Lead_ID
          crmRow[2],   // full_name
          crmRow[3],   // phone
          crmRow[5],   // platform
          crmRow[8],   // service_name
          crmRow[10],  // lead_status
          crmRow[9],   // form_answer
          crmRow[16]   // notes
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
          .getRange(writeStart, 1, rowsForDoctor.length, 8)
          .setValues(rowsForDoctor);
      }

      // --------------------------------------------------------
      // 3e. Mark synced rows in CRM column R = "Yes" in batch
      // --------------------------------------------------------
      crmRowsToMark.forEach(function(sheetRow) {
        crmSheet.getRange(sheetRow, 18).setValue('Yes'); // col R = column 18
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

  var crmData   = crmSheet.getRange(2, 1, crmLastRow - 1, 11).getValues();
  // columns read: A(0)=Lead_ID … K(10)=lead_status
  var leadIdMap = new Map(); // Lead_ID → { sheetRow, status }

  crmData.forEach(function(row, i) {
    var leadId = String(row[0]).trim();
    if (leadId) {
      leadIdMap.set(leadId, {
        sheetRow: i + 2,            // 1-based sheet row
        status:   String(row[10]).trim() // col K = index 10
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

      // Read col A (Lead_ID) and col F (lead_status) together
      var docData     = docSheet.getRange(2, 1, docLastRow - 1, 6).getValues();
      var updatedCount = 0;

      docData.forEach(function(docRow) {
        var leadId    = String(docRow[0]).trim();  // col A
        var docStatus = String(docRow[5]).trim();  // col F

        if (!leadId || !docStatus) return;

        var crmEntry = leadIdMap.get(leadId);
        if (!crmEntry) return;                     // lead not in CRM (shouldn't happen)
        if (crmEntry.status === docStatus) return; // no change

        updates.push({ sheetRow: crmEntry.sheetRow, newStatus: docStatus });
        // Keep the map current so later doctors can't re-overwrite with stale data
        crmEntry.status = docStatus;
        updatedCount++;
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
  // 4. Write all status updates to CRM column K in one pass
  // ----------------------------------------------------------
  updates.forEach(function(upd) {
    crmSheet.getRange(upd.sheetRow, 11).setValue(upd.newStatus); // col K = column 11
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

    // Read cols A–K (11 columns): Lead_ID … lead_status
    var data = crmSheet.getRange(2, 1, crmLastRow - 1, 11).getValues();

    var now        = new Date();
    var todayStr   = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    var oneDayMs   = 24 * 60 * 60 * 1000;
    var cutoff24h  = new Date(now.getTime() - oneDayMs);

    // ----------------------------------------------------------
    // Metric accumulators
    // ----------------------------------------------------------
    var leadsToday       = 0;
    var platformCounts   = {};  // { platformName: count }
    var noContact24h     = 0;
    var totalBooked      = 0;
    var totalConverted   = 0;
    var totalShowed      = 0;

    data.forEach(function(row) {
      var createdRaw = row[1];   // col B — created_time
      var platform   = String(row[5] || '').trim();  // col F
      var status     = String(row[10] || '').trim(); // col K

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

      // No-contact in last 24 h: still "جديد" and older than 24 h
      if (status === 'جديد' && isValidDate && createdDate < cutoff24h) {
        noContact24h++;
      }

      // All-time counters
      if (status === 'تم الحجز')      totalBooked++;
      if (status === 'اتحول لعميل')   totalConverted++;
      if (status === 'حضر')           totalShowed++;
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

      // All-time counters
      + '<div class="section">'
      + '  <h3>إجمالي الأداء (كل الوقت)</h3>'
      + '  <table>'
      + '    <tr><th>المؤشر</th><th style="text-align:center;">العدد</th></tr>'
      + '    <tr><td>تم الحجز</td><td style="text-align:center;">'      + totalBooked    + '</td></tr>'
      + '    <tr><td>حضر</td><td style="text-align:center;">'            + totalShowed    + '</td></tr>'
      + '    <tr><td>تحول لعميل</td><td style="text-align:center;">'    + totalConverted + '</td></tr>'
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
  var crmName = CONFIG.CRM_SHEET; // used inside formula strings

  // ----------------------------------------------------------
  // Shared style helpers
  // ----------------------------------------------------------
  var BLUE   = '#1a73e8';
  var GREEN  = '#34a853';
  var PURPLE = '#673ab7';
  var WHITE  = '#ffffff';
  var LABEL_BG  = '#f8f9fa';
  var VALUE_BG  = '#ffffff';
  var BORDER_COLOR = '#dadce0';

  function styleHeader(range, bg) {
    range.setBackground(bg)
         .setFontColor(WHITE)
         .setFontWeight('bold')
         .setFontSize(11)
         .setHorizontalAlignment('center');
  }

  function styleLabel(range) {
    range.setBackground(LABEL_BG)
         .setFontWeight('bold')
         .setFontSize(10)
         .setHorizontalAlignment('right');
  }

  function styleValue(range) {
    range.setBackground(VALUE_BG)
         .setFontSize(10)
         .setHorizontalAlignment('center');
  }

  function applyBorders(range) {
    range.setBorder(true, true, true, true, true, true,
                    BORDER_COLOR, SpreadsheetApp.BorderStyle.SOLID);
  }

  // ----------------------------------------------------------
  // 0. Clear everything and set column widths
  // ----------------------------------------------------------
  dash.clearContents();
  dash.clearFormats();
  dash.setFrozenRows(0);

  dash.setColumnWidth(1, 30);   // A — spacer
  dash.setColumnWidth(2, 200);  // B — label / platform / doctor
  dash.setColumnWidth(3, 110);  // C
  dash.setColumnWidth(4, 110);  // D
  dash.setColumnWidth(5, 110);  // E
  dash.setColumnWidth(6, 110);  // F
  dash.setColumnWidth(7, 110);  // G
  dash.setColumnWidth(8, 130);  // H — conversion %

  // ----------------------------------------------------------
  // Reusable COUNTIFS snippet builders
  // Formula column references (1-based → letter):
  //   K = lead_status   H = doctor_name   F = platform
  // ----------------------------------------------------------
  var STATUS_COL    = 'K';  // lead_status
  var PLATFORM_COL  = 'F';  // platform
  var DOCTOR_COL    = 'H';  // doctor_name
  var RESPONSE_COL  = 'M';  // response_time_hours
  var DATA_RANGE    = "'" + crmName + "'!{COL}:{COL}";

  function colRange(col) {
    return "'" + crmName + "'!" + col + ":" + col;
  }

  // COUNTIF for a specific status
  function countStatus(status) {
    return 'COUNTIF(' + colRange(STATUS_COL) + ',"' + status + '")';
  }

  // COUNTIFS platform + status
  function countPlatformStatus(platform, status) {
    return 'COUNTIFS('
      + colRange(PLATFORM_COL) + ',"' + platform + '",'
      + colRange(STATUS_COL)   + ',"' + status   + '"'
      + ')';
  }

  // COUNTIF platform (total)
  function countPlatform(platform) {
    return 'COUNTIF(' + colRange(PLATFORM_COL) + ',"' + platform + '")';
  }

  // COUNTIFS doctor + status
  function countDoctorStatus(doctorCell, status) {
    // doctorCell is a sheet reference like "B25" so we can drag/update easily
    return 'COUNTIFS('
      + colRange(DOCTOR_COL) + ',' + doctorCell + ','
      + colRange(STATUS_COL) + ',"' + status + '"'
      + ')';
  }

  // COUNTIF doctor (total)
  function countDoctor(doctorCell) {
    return 'COUNTIF(' + colRange(DOCTOR_COL) + ',' + doctorCell + ')';
  }

  // Conversion rate % formula: booked / total  (avoids div-by-zero)
  function convRate(bookedCell, totalCell) {
    return 'IF(' + totalCell + '=0,"—",'
         + 'TEXT(' + bookedCell + '/' + totalCell + ',"0.0%"))';
  }

  // ----------------------------------------------------------
  // 1. Read unique doctor names from CRM column H now
  //    (needed to build Section C row count before writing)
  // ----------------------------------------------------------
  var crmSheet  = crmSS.getSheetByName(crmName);
  var lastRow   = crmSheet.getLastRow();
  var doctors   = [];

  if (lastRow > 1) {
    var hVals = crmSheet.getRange(2, 8, lastRow - 1, 1).getValues(); // col H
    var seen  = {};
    hVals.forEach(function(r) {
      var d = String(r[0]).trim();
      if (d && d !== 'unknown' && !seen[d]) {
        seen[d] = true;
        doctors.push(d);
      }
    });
    doctors.sort();
  }

  // ----------------------------------------------------------
  // Helper — write a single row and return the next row number
  // ----------------------------------------------------------
  var currentRow = 2; // start at row 2 — leave row 1 as breathing room

  // ===========================================================
  // SECTION A — Overall Summary
  // ===========================================================

  // A1: section header spanning B:H
  var aHeaderRange = dash.getRange(currentRow, 2, 1, 7);
  aHeaderRange.merge()
              .setValue('📊  ملخص عام  —  Overall Summary');
  styleHeader(aHeaderRange, BLUE);
  applyBorders(aHeaderRange);
  currentRow++;

  // Column headers
  var aColHeaders = ['المؤشر', 'القيمة', '', '', '', '', ''];
  dash.getRange(currentRow, 2, 1, 7).setValues([aColHeaders]);
  styleLabel(dash.getRange(currentRow, 2));
  styleValue(dash.getRange(currentRow, 3));
  currentRow++;

  // Data rows  [ label , formula ]
  var summaryRows = [
    ['إجمالي الليدز — Total Leads',
     '=COUNTA(' + colRange('A') + ')-1'],

    ['تم الاتصال — Contacted',
     '=' + countStatus('تم الاتصال')],

    ['تم الحجز — Booked',
     '=' + countStatus('تم الحجز')],

    ['حضر — Showed Up',
     '=' + countStatus('حضر')],

    ['تحول لعميل — Converted',
     '=' + countStatus('اتحول لعميل')],

    ['متوسط وقت الاستجابة (ساعة) — Avg Response Hrs',
     '=IFERROR(AVERAGEIF(' + colRange(RESPONSE_COL) + ',">0"' + '),"—")']
  ];

  summaryRows.forEach(function(pair) {
    var labelCell = dash.getRange(currentRow, 2);
    var valueCell = dash.getRange(currentRow, 3);
    labelCell.setValue(pair[0]);
    valueCell.setFormula(pair[1]);
    styleLabel(labelCell);
    styleValue(valueCell);
    applyBorders(dash.getRange(currentRow, 2, 1, 7));
    currentRow++;
  });

  currentRow++; // blank spacer row

  // ===========================================================
  // SECTION B — By Platform
  // ===========================================================

  var bHeaderRange = dash.getRange(currentRow, 2, 1, 7);
  bHeaderRange.merge()
              .setValue('📱  حسب المنصة  —  By Platform');
  styleHeader(bHeaderRange, GREEN);
  applyBorders(bHeaderRange);
  currentRow++;

  // Column headers
  var bColHeaders = ['Platform', 'Total', 'Contacted', 'Booked', 'Showed', 'Converted', 'Conversion %'];
  dash.getRange(currentRow, 2, 1, 7).setValues([bColHeaders]);
  styleHeader(dash.getRange(currentRow, 2, 1, 7), '#188038'); // darker green for sub-header
  applyBorders(dash.getRange(currentRow, 2, 1, 7));
  currentRow++;

  var platforms = ['Meta', 'Snapchat', 'TikTok'];

  platforms.forEach(function(platform) {
    var totalCell   = 'C' + currentRow;
    var bookedCell  = 'E' + currentRow;

    var rowData = [
      platform,
      '=' + countPlatform(platform),
      '=' + countPlatformStatus(platform, 'تم الاتصال'),
      '=' + countPlatformStatus(platform, 'تم الحجز'),
      '=' + countPlatformStatus(platform, 'حضر'),
      '=' + countPlatformStatus(platform, 'اتحول لعميل'),
      '=' + convRate(bookedCell, totalCell)
    ];

    var rowRange = dash.getRange(currentRow, 2, 1, 7);
    rowRange.setValues([rowData]);
    styleLabel(dash.getRange(currentRow, 2));
    styleValue(dash.getRange(currentRow, 3, 1, 6));
    applyBorders(rowRange);
    currentRow++;
  });

  // Platform totals row
  var bTotalRowStart = currentRow - platforms.length; // first platform data row
  var bTotalRowEnd   = currentRow - 1;

  var bTotals = [
    'الإجمالي — Total',
    '=SUM(C' + bTotalRowStart + ':C' + bTotalRowEnd + ')',
    '=SUM(D' + bTotalRowStart + ':D' + bTotalRowEnd + ')',
    '=SUM(E' + bTotalRowStart + ':E' + bTotalRowEnd + ')',
    '=SUM(F' + bTotalRowStart + ':F' + bTotalRowEnd + ')',
    '=SUM(G' + bTotalRowStart + ':G' + bTotalRowEnd + ')',
    '=' + convRate('E' + currentRow, 'C' + currentRow)
  ];
  var bTotalsRange = dash.getRange(currentRow, 2, 1, 7);
  bTotalsRange.setValues([bTotals]);
  bTotalsRange.setFontWeight('bold').setBackground('#e6f4ea');
  applyBorders(bTotalsRange);
  currentRow++;

  currentRow++; // blank spacer row

  // ===========================================================
  // SECTION C — By Doctor
  // ===========================================================

  var cHeaderRange = dash.getRange(currentRow, 2, 1, 7);
  cHeaderRange.merge()
              .setValue('👨‍⚕️  حسب الطبيب  —  By Doctor');
  styleHeader(cHeaderRange, PURPLE);
  applyBorders(cHeaderRange);
  currentRow++;

  // Column headers
  var cColHeaders = ['Doctor', 'Total Leads', 'Booked', 'Conversion %', '', '', ''];
  dash.getRange(currentRow, 2, 1, 7).setValues([cColHeaders]);
  styleHeader(dash.getRange(currentRow, 2, 1, 4), '#4527a0'); // darker purple
  dash.getRange(currentRow, 6, 1, 3).setBackground(WHITE);
  applyBorders(dash.getRange(currentRow, 2, 1, 4));
  currentRow++;

  if (doctors.length === 0) {
    // Placeholder when no doctor data exists yet
    var placeholderRange = dash.getRange(currentRow, 2, 1, 4);
    placeholderRange.merge()
                    .setValue('لا توجد بيانات حتى الآن — No data yet')
                    .setFontColor('#999999')
                    .setHorizontalAlignment('center');
    applyBorders(placeholderRange);
    currentRow++;
  } else {
    doctors.forEach(function(doctor) {
      // Write the doctor name in col B so formulas can reference it
      // — avoids hard-coding Arabic/mixed strings inside COUNTIFS
      var doctorLabelCell = 'B' + currentRow;
      var totalCell       = 'C' + currentRow;
      var bookedCell      = 'D' + currentRow;

      var rowData = [
        doctor,
        '=' + countDoctor(doctorLabelCell),
        '=' + countDoctorStatus(doctorLabelCell, 'تم الحجز'),
        '=' + convRate(bookedCell, totalCell),
        '', '', ''
      ];

      var rowRange = dash.getRange(currentRow, 2, 1, 7);
      rowRange.setValues([rowData]);
      styleLabel(dash.getRange(currentRow, 2));
      styleValue(dash.getRange(currentRow, 3, 1, 2));
      dash.getRange(currentRow, 5, 1, 3).setBackground(WHITE);
      applyBorders(dash.getRange(currentRow, 2, 1, 4));
      currentRow++;
    });

    // Doctor totals row
    var cTotalRowStart = currentRow - doctors.length;
    var cTotalRowEnd   = currentRow - 1;

    var cTotals = [
      'الإجمالي — Total',
      '=SUM(C' + cTotalRowStart + ':C' + cTotalRowEnd + ')',
      '=SUM(D' + cTotalRowStart + ':D' + cTotalRowEnd + ')',
      '=' + convRate('D' + currentRow, 'C' + currentRow),
      '', '', ''
    ];
    var cTotalsRange = dash.getRange(currentRow, 2, 1, 7);
    cTotalsRange.setValues([cTotals]);
    dash.getRange(currentRow, 2, 1, 4)
        .setFontWeight('bold')
        .setBackground('#ede7f6');
    dash.getRange(currentRow, 6, 1, 3).setBackground(WHITE);
    applyBorders(dash.getRange(currentRow, 2, 1, 4));
    currentRow++;
  }

  // ----------------------------------------------------------
  // Final: freeze nothing, flush
  // ----------------------------------------------------------
  SpreadsheetApp.flush();

  logToSheet('setupDashboard', 'Dashboard built with ' + doctors.length + ' doctor(s)', 'OK');
  Logger.log('setupDashboard: complete — ' + doctors.length + ' doctor(s) in Section C');
}
