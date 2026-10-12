/**
 * Wordt analytics -> Google Sheet, all inside one Google account.
 *
 * No Google Cloud project, service account, or billing is needed. This script
 * lives in the spreadsheet (Extensions > Apps Script), calls Render's logs API
 * on a timer, and writes the tabs itself.
 *
 * ---------------------------------------------------------------------------
 * SETUP (once)
 *   1. Open your sheet -> Extensions > Apps Script. Delete the placeholder code
 *      and paste this whole file. Save.
 *   2. Reload the sheet. A "Wordt Analytics" menu appears in the toolbar.
 *   3. Menu -> "Discover Render (just the API key)" and paste your Render API
 *      key; it looks up the workspace and service for you. (Use "Configure
 *      manually" if you already have the srv-... and workspace ids.) Read the
 *      key at https://dashboard.render.com/u/settings#api-keys.
 *   4. Menu -> "Dry run" to test the Render call without writing anything.
 *   5. Menu -> "Create 15-minute trigger" to run it automatically.
 *
 * Run it by hand any time with Menu -> "Sync now".
 * ---------------------------------------------------------------------------
 */

var KNOWN_TYPES = ['game_start', 'picks_locked', 'pool_built', 'word_submitted', 'rare_letter_used', 'round_scored', 'game_over'];
var RESERVED_KEYS = ['ts', 'gameId', 'roomCode', 'round', 'type', 'playerId'];

var EVENTS_SHEET = 'Events';
var META_SHEET = 'Meta';

var EVENTS_HEADERS = ['event_id', 'timestamp', 'gameId', 'roomCode', 'round', 'type', 'playerId', 'details'];
var GAMES_HEADERS = ['gameId', 'roomCode', 'startedAt', 'endedAt', 'playerCount', 'teamMode', 'roundSeconds', 'rounds', 'winners', 'finalStandings', 'totalValidWords'];
var WORDS_HEADERS = ['word', 'submissions', 'valid', 'invalid', 'totalPoints', 'avgPoints'];
var LETTERS_HEADERS = ['letter', 'timesInPool', 'timesPicked', 'timesInValidWords', 'pointsFromValidWords'];
var REJECTIONS_HEADERS = ['reason', 'count', 'wrongTries'];
var META_HEADERS = ['key', 'value'];

var ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
var RENDER_API_BASE = 'https://api.render.com/v1';
var PAGE_LIMIT = 100;
var MAX_PAGES = 60;
var WINDOW_HOURS = 24;
var OVERLAP_MINUTES = 10;

var META_LAST_TIMESTAMP = 'lastProcessedTimestamp';
var META_LAST_RUN = 'lastRunAt';
var META_EVENTS_TOTAL = 'eventsTotal';

// ---------------------------------------------------------------------------
// Menu
// ---------------------------------------------------------------------------

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Wordt Analytics')
    .addItem('Sync now', 'syncLogs')
    .addItem('Dry run', 'dryRun')
    .addItem('Discover Render (just the API key)', 'discoverRender')
    .addItem('Configure manually', 'configure')
    .addItem('Create 15-minute trigger', 'createTrigger')
    .addToUi();
}

function configure() {
  var props = PropertiesService.getScriptProperties();
  var ui = SpreadsheetApp.getUi();

  var key = ui.prompt('Render API key', props.getProperty('RENDER_API_KEY') || '', ui.ButtonSet.OK_CANCEL);
  if (key.getSelectedButton() !== ui.Button.OK) return;

  var service = ui.prompt('Render service id (srv_...)', props.getProperty('RENDER_SERVICE_ID') || '', ui.ButtonSet.OK_CANCEL);
  if (service.getSelectedButton() !== ui.Button.OK) return;

  var owner = ui.prompt('Render workspace / owner id', props.getProperty('RENDER_OWNER_ID') || '', ui.ButtonSet.OK_CANCEL);
  if (owner.getSelectedButton() !== ui.Button.OK) return;

  props.setProperties({
    RENDER_API_KEY: key.getResponseText().trim(),
    RENDER_SERVICE_ID: service.getResponseText().trim(),
    RENDER_OWNER_ID: owner.getResponseText().trim()
  });
  ui.alert('Saved. Next, run "Dry run", then "Create 15-minute trigger".');
}

// Everything except the API key can be discovered from Render itself, so the
// only thing you really need to paste is the API key.
function discoverRender() {
  var props = PropertiesService.getScriptProperties();
  var ui = SpreadsheetApp.getUi();

  var prompt = ui.prompt('Render API key', props.getProperty('RENDER_API_KEY') || '', ui.ButtonSet.OK_CANCEL);
  if (prompt.getSelectedButton() !== ui.Button.OK) return;
  var apiKey = prompt.getResponseText().trim();
  if (!apiKey) { ui.alert('No API key entered.'); return; }

  var owners = unwrap(fetchJson(buildUrl(RENDER_API_BASE + '/owners', { limit: 100 }), apiKey), 'owner');
  if (!owners.length) { ui.alert('This key cannot see any Render workspaces.'); return; }

  var ownerId = pickOne(ui, owners, 'workspace', function (owner) { return owner.name + ' (' + owner.id + ')'; });
  if (!ownerId) return;

  var services = unwrap(fetchJson(buildUrl(RENDER_API_BASE + '/services', { ownerId: ownerId, limit: 100 }), apiKey), 'service')
    .filter(function (service) { return service && service.id; });

  var candidates = services.filter(function (service) { return !service.ownerId || service.ownerId === ownerId; });
  if (!candidates.length) candidates = services;
  if (!candidates.length) { ui.alert('No services found in workspace ' + ownerId + '.'); return; }

  var serviceId = pickOne(ui, candidates, 'service', function (service) {
    return (service.name || '(unnamed)') + ' [' + (service.type || 'service') + '] (' + service.id + ')';
  });
  if (!serviceId) return;

  props.setProperties({
    RENDER_API_KEY: apiKey,
    RENDER_OWNER_ID: ownerId,
    RENDER_SERVICE_ID: serviceId
  });

  ui.alert(
    'Saved.\n\n' +
    'Workspace: ' + ownerId + '\n' +
    'Service: ' + serviceId + '\n\n' +
    'Next, run "Dry run".'
  );
}

function unwrap(response, key) {
  var list = Object.prototype.toString.call(response) === '[object Array]' ? response : [];
  return list.map(function (row) { return row && row[key] ? row[key] : row; })
    .filter(function (item) { return item && item.id; });
}

function pickOne(ui, items, label, describe) {
  if (items.length === 1) return String(items[0].id);

  var lines = items.map(function (item, index) {
    return (index + 1) + ') ' + describe(item);
  }).join('\n');

  var prompt = ui.prompt('Choose a ' + label + ' by number\n\n' + lines, '1', ui.ButtonSet.OK_CANCEL);
  if (prompt.getSelectedButton() !== ui.Button.OK) return null;

  var index = parseInt(prompt.getResponseText(), 10) - 1;
  if (isNaN(index) || index < 0 || index >= items.length) {
    ui.alert('Invalid choice.');
    return null;
  }
  return String(items[index].id);
}

function createTrigger() {
  var existing = ScriptApp.getProjectTriggers();
  for (var i = 0; i < existing.length; i++) {
    if (existing[i].getHandlerFunction() === 'syncLogs') ScriptApp.deleteTrigger(existing[i]);
  }
  ScriptApp.newTrigger('syncLogs').timeBased().everyMinutes(15).create();
  SpreadsheetApp.getUi().alert('A trigger now runs the sync every 15 minutes.');
}

// ---------------------------------------------------------------------------
// Entry points
// ---------------------------------------------------------------------------

function syncLogs() {
  runSync(false);
}

function dryRun() {
  runSync(true);
}

function runSync(dryRun) {
  var config = readConfig();
  var ss = openSpreadsheet();
  var metaSheet = getOrCreateSheet(ss, META_SHEET, META_HEADERS);
  var meta = readMeta(metaSheet);

  var now = new Date();
  var endTime = now.toISOString();
  var startTime = computeStart(meta, now);

  var raw = fetchLogs(config, startTime, endTime);
  var incoming = extractEvents(raw);

  var eventsSheet = getOrCreateSheet(ss, EVENTS_SHEET, EVENTS_HEADERS);
  var existing = readExistingEvents(eventsSheet);
  var fresh = dedupeFresh(existing, incoming);

  if (dryRun) {
    Logger.log('DRY RUN window ' + startTime + ' -> ' + endTime);
    Logger.log('fetched ' + incoming.length + ', new ' + fresh.length + ', existing ' + existing.length);
    SpreadsheetApp.getUi().alert(
      'Dry run OK\n\n' +
      'Window: ' + startTime + ' -> ' + endTime + '\n' +
      'Fetched ' + incoming.length + ' events from Render (' + fresh.length + ' new)\n' +
      'Nothing was written to the sheet.'
    );
    return;
  }

  if (fresh.length) appendEvents(eventsSheet, fresh);

  var allEvents = readExistingEvents(eventsSheet);
  writeTable(getOrCreateSheet(ss, 'Games', GAMES_HEADERS), GAMES_HEADERS, buildGames(allEvents));
  writeTable(getOrCreateSheet(ss, 'Words', WORDS_HEADERS), WORDS_HEADERS, buildWords(allEvents));
  writeTable(getOrCreateSheet(ss, 'Letters', LETTERS_HEADERS), LETTERS_HEADERS, buildLetters(allEvents));
  writeTable(getOrCreateSheet(ss, 'Rejections', REJECTIONS_HEADERS), REJECTIONS_HEADERS, buildRejections(allEvents));

  var update = {};
  update[META_LAST_TIMESTAMP] = latestTimestamp(allEvents) || meta[META_LAST_TIMESTAMP] || '';
  update[META_LAST_RUN] = endTime;
  update[META_EVENTS_TOTAL] = String(allEvents.length);
  writeMeta(metaSheet, update);

  Logger.log('Synced. fetched=' + incoming.length + ' new=' + fresh.length + ' totalEvents=' + allEvents.length);
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

function readConfig() {
  var props = PropertiesService.getScriptProperties();
  var config = {
    apiKey: props.getProperty('RENDER_API_KEY'),
    serviceId: props.getProperty('RENDER_SERVICE_ID'),
    ownerId: props.getProperty('RENDER_OWNER_ID'),
    baseUrl: (props.getProperty('RENDER_API_URL') || RENDER_API_BASE).replace(/\/+$/, '')
  };
  var missing = [];
  if (!config.apiKey) missing.push('RENDER_API_KEY');
  if (!config.serviceId) missing.push('RENDER_SERVICE_ID');
  if (!config.ownerId) missing.push('RENDER_OWNER_ID');
  if (missing.length) {
    throw new Error('Missing script properties: ' + missing.join(', ') + '. Use Menu > Configure.');
  }
  return config;
}

function fetchLogs(config, startTime, endTime) {
  var collected = [];
  var seenIds = {};
  var seenCursors = {};
  var cursor = startTime;

  for (var page = 0; page < MAX_PAGES; page++) {
    var url = buildUrl(config.baseUrl + '/logs', {
      ownerId: config.ownerId,
      resource: config.serviceId,
      direction: 'forward',
      startTime: cursor,
      endTime: endTime,
      limit: PAGE_LIMIT
    });
    var data = fetchJson(url, config.apiKey);

    var logs = data.logs || [];
    for (var i = 0; i < logs.length; i++) {
      var entry = logs[i];
      if (!entry || typeof entry !== 'object') continue;
      var id = String(entry.id !== undefined ? entry.id : i);
      if (seenIds[id]) continue;
      seenIds[id] = true;
      collected.push(entry);
    }

    if (!data.hasMore) break;
    var next = data.nextStartTime;
    if (typeof next !== 'string' || seenCursors[next]) break;
    seenCursors[next] = true;
    cursor = next;
  }
  return collected;
}

function fetchJson(url, apiKey) {
  var headers = { Authorization: 'Bearer ' + apiKey, Accept: 'application/json' };
  var lastError = null;
  for (var attempt = 0; attempt < 3; attempt++) {
    var response;
    try {
      response = UrlFetchApp.fetch(url, { headers: headers, muteHttpExceptions: true });
    } catch (error) {
      lastError = error;
      Utilities.sleep(Math.min(Math.pow(2, attempt) * 1000, 8000));
      continue;
    }
    var code = response.getResponseCode();
    if (code === 429 || (code >= 500 && code < 600)) {
      lastError = new Error('Render returned HTTP ' + code);
      Utilities.sleep(Math.min(Math.pow(2, attempt) * 1000, 8000));
      continue;
    }
    if (code >= 400) {
      throw new Error('Render returned HTTP ' + code + ': ' + response.getContentText().slice(0, 200));
    }
    return JSON.parse(response.getContentText());
  }
  throw new Error('Render request failed: ' + lastError);
}

function buildUrl(base, params) {
  var parts = [];
  Object.keys(params).forEach(function (key) {
    var value = params[key];
    var list = Object.prototype.toString.call(value) === '[object Array]' ? value : [value];
    list.forEach(function (item) {
      parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(item));
    });
  });
  return base + '?' + parts.join('&');
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

function extractEvents(rawLogs) {
  var events = [];
  for (var i = 0; i < rawLogs.length; i++) {
    var message = rawLogs[i].message;
    if (typeof message !== 'string') continue;
    var lines = message.split(/\r?\n/);
    for (var j = 0; j < lines.length; j++) {
      var text = lines[j].trim();
      if (text.charAt(0) !== '{') continue;
      var obj;
      try { obj = JSON.parse(text); } catch (error) { continue; }
      var event = parseEvent(obj);
      if (event) events.push(event);
    }
  }
  return events;
}

function parseEvent(obj) {
  if (!obj || typeof obj !== 'object' || Object.prototype.toString.call(obj) === '[object Array]') return null;
  if (KNOWN_TYPES.indexOf(obj.type) === -1) return null;
  if (typeof obj.ts !== 'string' || obj.ts.trim() === '') return null;
  if (isNaN(Date.parse(obj.ts))) return null;

  var details = {};
  Object.keys(obj).forEach(function (key) {
    if (RESERVED_KEYS.indexOf(key) === -1) details[key] = obj[key];
  });

  var gameId = typeof obj.gameId === 'string' ? obj.gameId : null;
  var round = coerceRound(obj.round);
  return {
    event_id: eventIdFor(obj.ts, gameId, round, obj.type, typeof obj.playerId === 'string' ? obj.playerId : null, details),
    timestamp: obj.ts,
    gameId: gameId,
    roomCode: typeof obj.roomCode === 'string' ? obj.roomCode : null,
    round: round,
    type: obj.type,
    playerId: typeof obj.playerId === 'string' ? obj.playerId : null,
    details: details
  };
}

function coerceRound(value) {
  if (typeof value === 'number' && isFinite(value) && Math.floor(value) === value) return value;
  return null;
}

function eventIdFor(timestamp, gameId, round, type, playerId, details) {
  var payload = [
    timestamp,
    gameId || '',
    round === null || round === undefined ? '' : String(round),
    type,
    playerId || '',
    stableStringify(details)
  ].join('|');
  return sha1Hex(payload);
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Object.prototype.toString.call(value) === '[object Array]') {
    return '[' + value.map(stableStringify).join(',') + ']';
  }
  var keys = Object.keys(value).sort();
  return '{' + keys.map(function (key) {
    return JSON.stringify(key) + ':' + stableStringify(value[key]);
  }).join(',') + '}';
}

function sha1Hex(text) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_1, text, Utilities.Charset.UTF_8);
  var hex = '';
  for (var i = 0; i < bytes.length; i++) {
    var b = bytes[i];
    if (b < 0) b += 256;
    var part = b.toString(16);
    if (part.length === 1) part = '0' + part;
    hex += part;
  }
  return hex;
}

// ---------------------------------------------------------------------------
// Sheets
// ---------------------------------------------------------------------------

function openSpreadsheet() {
  var id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if (id) return SpreadsheetApp.openById(id);
  return SpreadsheetApp.getActiveSpreadsheet();
}

function getOrCreateSheet(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (headers) {
    var firstCell = sheet.getRange(1, 1).getValue();
    if (sheet.getLastRow() === 0 || firstCell === '') {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.setFrozenRows(1);
    }
  }
  return sheet;
}

function readExistingEvents(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var values = sheet.getRange(2, 1, lastRow - 1, EVENTS_HEADERS.length).getValues();
  var events = [];
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    if (!row[0] && !row[5]) continue;
    var details = {};
    try { details = row[7] ? JSON.parse(row[7]) : {}; } catch (error) { details = {}; }
    events.push({
      event_id: String(row[0]),
      timestamp: String(row[1]),
      gameId: row[2] ? String(row[2]) : null,
      roomCode: row[3] ? String(row[3]) : null,
      round: row[4] === '' || row[4] === null ? null : parseInt(row[4], 10),
      type: String(row[5]),
      playerId: row[6] ? String(row[6]) : null,
      details: details
    });
  }
  return events;
}

function appendEvents(sheet, events) {
  if (!events.length) return;
  var rows = events.map(eventToRow);
  var startRow = sheet.getLastRow() + 1;
  var needed = startRow + rows.length - 1;
  if (sheet.getMaxRows() < needed) sheet.insertRowsAfter(sheet.getMaxRows(), needed - sheet.getMaxRows());
  sheet.getRange(startRow, 1, rows.length, EVENTS_HEADERS.length).setValues(rows);
}

function eventToRow(event) {
  return [
    event.event_id,
    event.timestamp,
    event.gameId || '',
    event.roomCode || '',
    event.round === null || event.round === undefined ? '' : String(event.round),
    event.type,
    event.playerId || '',
    stableStringify(event.details)
  ];
}

function dedupeFresh(existing, events) {
  var seen = {};
  existing.forEach(function (event) { seen[event.event_id] = true; });
  return events.filter(function (event) {
    if (seen[event.event_id]) return false;
    seen[event.event_id] = true;
    return true;
  });
}

function writeTable(sheet, headers, rows) {
  sheet.clearContents();
  var values = [headers].concat(rows);
  if (sheet.getMaxRows() < values.length) {
    sheet.insertRowsAfter(sheet.getMaxRows(), values.length - sheet.getMaxRows());
  }
  sheet.getRange(1, 1, values.length, headers.length).setValues(values);
  sheet.setFrozenRows(1);
}

function readMeta(sheet) {
  var meta = {};
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return meta;
  var values = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
  for (var i = 0; i < values.length; i++) {
    if (values[i][0]) meta[String(values[i][0])] = String(values[i][1]);
  }
  return meta;
}

function writeMeta(sheet, meta) {
  var rows = Object.keys(meta).sort().map(function (key) { return [key, meta[key]]; });
  writeTable(sheet, META_HEADERS, rows);
}

// ---------------------------------------------------------------------------
// Summary tables (mirror the Python pipeline)
// ---------------------------------------------------------------------------

function buildGames(events) {
  var groups = {};
  var order = [];
  events.forEach(function (event) {
    if (!event.gameId) return;
    if (!groups[event.gameId]) { groups[event.gameId] = []; order.push(event.gameId); }
    groups[event.gameId].push(event);
  });

  var rows = order.map(function (gameId) {
    var group = groups[gameId];
    var start = firstOfType(group, 'game_start');
    var over = firstOfType(group, 'game_over');
    var startedAt = earliest(group);
    var endedAt = over ? over.timestamp : '';

    var standings = over && isArray(over.details.standings) ? over.details.standings : [];
    var winners = over && isArray(over.details.winners) ? over.details.winners : [];

    var final = '';
    var totalWords = 0;
    if (standings.length) {
      final = standings.map(function (entry) { return asText(entry.playerId) + ':' + asNum(entry.score); }).join('; ');
      totalWords = standings.reduce(function (sum, entry) { return sum + asInt(entry.validWordCount); }, 0);
    } else {
      totalWords = group.filter(function (event) { return event.type === 'word_submitted' && event.details.valid === true; }).length;
    }

    var rounds = group.map(function (event) { return event.round; }).filter(function (r) { return typeof r === 'number'; });
    var roomCode = '';
    for (var i = 0; i < group.length; i++) { if (group[i].roomCode) { roomCode = group[i].roomCode; break; } }

    return [
      gameId,
      roomCode,
      startedAt,
      endedAt,
      start ? asText(start.details.playerCount) : '',
      start ? asBool(start.details.teamMode) : '',
      start ? asText(start.details.roundSeconds) : '',
      rounds.length ? String(Math.max.apply(null, rounds)) : '0',
      winners.map(asText).join(', '),
      final,
      String(totalWords)
    ];
  });

  rows.sort(function (a, b) { return a[2] < b[2] ? 1 : a[2] > b[2] ? -1 : 0; });
  return rows;
}

function buildWords(events) {
  var stats = {};
  events.forEach(function (event) {
    if (event.type !== 'word_submitted') return;
    var word = event.details.word;
    if (typeof word !== 'string' || word.trim() === '') return;
    var key = word.trim().toUpperCase();
    var entry = stats[key] || (stats[key] = { submissions: 0, valid: 0, invalid: 0, points: 0 });
    entry.submissions++;
    if (event.details.valid === true) { entry.valid++; entry.points += asInt(event.details.points); }
    else { entry.invalid++; }
  });

  var rows = Object.keys(stats).map(function (word) {
    var entry = stats[word];
    var avg = entry.valid ? Math.round((entry.points / entry.valid) * 100) / 100 : 0;
    return [word, String(entry.submissions), String(entry.valid), String(entry.invalid), String(entry.points), String(avg)];
  });
  rows.sort(function (a, b) { return (asInt(b[4]) - asInt(a[4])) || (asInt(b[1]) - asInt(a[1])) || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0); });
  return rows;
}

function buildLetters(events) {
  var inPool = {};
  var picked = {};
  var inWords = {};
  var points = {};
  var valuesByRound = {};

  events.forEach(function (event) {
    if (event.type === 'pool_built' && event.details.letterValues && event.details.letterValues.values) {
      valuesByRound[event.gameId + '#' + event.round] = event.details.letterValues.values;
    }
  });

  events.forEach(function (event) {
    if (event.type === 'pool_built') {
      asLetters(event.details.pool).forEach(function (letter) { inPool[letter] = (inPool[letter] || 0) + 1; });
    } else if (event.type === 'picks_locked') {
      asLetters(event.details.letters).forEach(function (letter) { picked[letter] = (picked[letter] || 0) + 1; });
    } else if (event.type === 'word_submitted' && event.details.valid === true) {
      var word = event.details.word;
      if (typeof word !== 'string') return;
      var values = valuesByRound[event.gameId + '#' + event.round] || {};
      word.trim().toUpperCase().split('').forEach(function (letter) {
        if (ALPHABET.indexOf(letter) === -1) return;
        inWords[letter] = (inWords[letter] || 0) + 1;
        points[letter] = (points[letter] || 0) + asInt(values[letter]);
      });
    }
  });

  return ALPHABET.split('').map(function (letter) {
    return [
      letter,
      String(inPool[letter] || 0),
      String(picked[letter] || 0),
      String(inWords[letter] || 0),
      String(points[letter] || 0)
    ];
  });
}

function buildRejections(events) {
  var stats = {};
  events.forEach(function (event) {
    if (event.type !== 'word_submitted' || event.details.valid !== false) return;
    var reason = typeof event.details.reason === 'string' && event.details.reason ? event.details.reason : 'UNKNOWN';
    var entry = stats[reason] || (stats[reason] = { count: 0, wrongTries: 0 });
    entry.count++;
    if (event.details.countsAsWrongTry === true) entry.wrongTries++;
  });

  var rows = Object.keys(stats).map(function (reason) {
    return [reason, String(stats[reason].count), String(stats[reason].wrongTries)];
  });
  rows.sort(function (a, b) { return (asInt(b[1]) - asInt(a[1])) || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0); });
  return rows;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeStart(meta, now) {
  var last = meta[META_LAST_TIMESTAMP];
  if (last && !isNaN(Date.parse(last))) {
    return new Date(Date.parse(last) - OVERLAP_MINUTES * 60000).toISOString();
  }
  return new Date(now.getTime() - WINDOW_HOURS * 3600000).toISOString();
}

function latestTimestamp(events) {
  var latest = null;
  events.forEach(function (event) {
    var t = Date.parse(event.timestamp);
    if (isNaN(t)) return;
    if (latest === null || t > latest) latest = t;
  });
  return latest === null ? null : new Date(latest).toISOString();
}

function firstOfType(events, type) {
  for (var i = 0; i < events.length; i++) { if (events[i].type === type) return events[i]; }
  return null;
}

function earliest(events) {
  var best = null;
  var bestTime = null;
  events.forEach(function (event) {
    var t = Date.parse(event.timestamp);
    if (isNaN(t)) return;
    if (bestTime === null || t < bestTime) { bestTime = t; best = event.timestamp; }
  });
  return best || '';
}

function asLetters(value) {
  if (!isArray(value)) return [];
  var out = [];
  value.forEach(function (item) {
    if (typeof item === 'string' && item.trim()) out.push(item.trim().toUpperCase());
  });
  return out;
}

function isArray(value) {
  return Object.prototype.toString.call(value) === '[object Array]';
}

function asText(value) {
  if (value === null || value === undefined) return '';
  return String(value);
}

function asNum(value) {
  var n = Number(value);
  return isFinite(n) ? String(n) : '0';
}

function asInt(value) {
  var n = Number(value);
  return isFinite(n) ? Math.trunc(n) : 0;
}

function asBool(value) {
  if (value === true) return 'true';
  if (value === false) return 'false';
  return '';
}
