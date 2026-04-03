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
