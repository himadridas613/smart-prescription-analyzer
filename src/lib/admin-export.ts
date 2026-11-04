/** Client-side export helpers for admin tables (CSV + printable PDF). */

export function exportCsv(filename: string, rows: Array<Record<string, unknown>>) {
  if (!rows.length) return;
  const headers = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const escape = (v: unknown) => {
    const s = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
    return `"${s.replace(/"/g, '""')}"`;
  };
  const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportPdf(title: string, rows: Array<Record<string, unknown>>) {
  if (!rows.length) return;
  const headers = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const cell = (v: unknown) =>
    (v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v)).replace(/[<>&]/g, (c) =>
      c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&amp;",
    );
  const html = `<!doctype html><html><head><title>${title}</title><style>
    body{font-family:ui-sans-serif,system-ui,sans-serif;padding:24px;color:#0f172a}
    h1{font-size:18px;margin:0 0 4px} p{color:#64748b;font-size:12px;margin:0 0 16px}
    table{width:100%;border-collapse:collapse;font-size:10px}
    th,td{border:1px solid #e2e8f0;padding:5px 6px;text-align:left;vertical-align:top;word-break:break-word}
    th{background:#eff6ff}
  </style></head><body><h1>${title}</h1><p>Generated ${new Date().toLocaleString()} · ${rows.length} rows</p>
  <table><thead><tr>${headers.map((h) => `<th>${cell(h)}</th>`).join("")}</tr></thead>
  <tbody>${rows.map((r) => `<tr>${headers.map((h) => `<td>${cell(r[h])}</td>`).join("")}</tr>`).join("")}</tbody>
  </table></body></html>`;
  const w = window.open("", "_blank", "width=1100,height=800");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 400);
}
