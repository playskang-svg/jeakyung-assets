// Converts a Google Sheets "export?format=csv" payload into HTML tables.
//
// Layout convention observed across all 12 source sheets:
//   row 1  -> sheet title
//   row 2  -> workplace / revision meta line
//   row 3  -> one free-text note sentence
//   row 4+ -> one or more blocks, each optionally preceded by a lone-cell
//             heading row (e.g. "[1] 3개년 보호구 지급계획" or
//             "배점 구조 및 현재 점수"), followed by a header row and its
//             data rows, terminated by a fully blank row.
// This mirrors exactly how the sheets read when opened in Google Sheets —
// nothing is reformatted or reinterpreted, only laid out as HTML.

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  // Normalize line endings up front; Google exports CRLF.
  const s = text.replace(/\r\n/g, '\n');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function isBlankRow(row) {
  return row.every((c) => c.trim() === '');
}

function nonEmptyCells(row) {
  return row.filter((c) => c.trim() !== '');
}

function trimTrailingEmptyColumns(header, body) {
  let maxCol = -1;
  const scan = (row) => {
    for (let i = row.length - 1; i >= 0; i--) {
      if (row[i] && row[i].trim() !== '') {
        maxCol = Math.max(maxCol, i);
        break;
      }
    }
  };
  scan(header);
  body.forEach(scan);
  const width = maxCol + 1;
  return {
    header: header.slice(0, width),
    body: body.map((r) => r.slice(0, width)),
  };
}

function renderBlockHeading(text) {
  const m = text.match(/^(\[\d+\])\s*(.*)$/);
  if (m) {
    return `<h3 class="sheet-block-title"><span class="block-badge">${escapeHtml(m[1])}</span>${escapeHtml(m[2])}</h3>`;
  }
  return `<h3 class="sheet-block-title">${escapeHtml(text)}</h3>`;
}

function renderTable(header, body) {
  const { header: h, body: b } = trimTrailingEmptyColumns(header, body);
  const thead = `<tr>${h.map((c) => `<th>${escapeHtml(c)}</th>`).join('')}</tr>`;
  const rows = b
    .map((r) => `<tr>${h.map((_, i) => `<td>${escapeHtml(r[i] ?? '')}</td>`).join('')}</tr>`)
    .join('');
  return `<div class="table-scroll"><table class="doc-table sheet-table"><thead>${thead}</thead><tbody>${rows}</tbody></table></div>`;
}

export function cleanGoogleSheetCsv(csvText) {
  const rows = parseCsv(csvText).filter((r) => !(r.length === 1 && r[0] === ''));
  if (rows.length === 0) return '';

  const title = (rows[0] || []).find((c) => c.trim() !== '') || '';
  const meta = (rows[1] || []).find((c) => c.trim() !== '') || '';
  const note = (rows[2] || []).find((c) => c.trim() !== '') || '';

  let html = '';
  if (title) html += `<h1 class="sheet-title">${escapeHtml(title)}</h1>`;
  if (meta) html += `<p class="sheet-meta">${escapeHtml(meta)}</p>`;
  if (note) html += `<p class="sheet-note">${escapeHtml(note)}</p>`;

  let i = 3;
  let currentHeader = null;
  let currentBody = [];

  const flush = () => {
    if (currentHeader) {
      html += renderTable(currentHeader, currentBody);
      currentHeader = null;
      currentBody = [];
    }
  };

  while (i < rows.length) {
    const row = rows[i];
    if (isBlankRow(row)) {
      flush();
      i++;
      continue;
    }
    if (currentHeader === null) {
      if (nonEmptyCells(row).length === 1) {
        html += renderBlockHeading(nonEmptyCells(row)[0]);
        i++;
        continue;
      }
      currentHeader = row;
      i++;
      continue;
    }
    currentBody.push(row);
    i++;
  }
  flush();

  return html;
}
