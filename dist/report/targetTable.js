"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatAsciiTargetTable = formatAsciiTargetTable;
const flagsShort_js_1 = require("../improve/flagsShort.js");
const SCORE_MAX = 100;
function padCell(text, width, align = "left") {
    const w = Math.max(width, text.length);
    if (align === "center") {
        const pad = w - text.length;
        const left = Math.floor(pad / 2);
        return " ".repeat(left) + text + " ".repeat(pad - left);
    }
    return text.padEnd(w);
}
function tableRow(cells, widths, aligns) {
    const parts = cells.map((c, i) => ` ${padCell(c, widths[i], aligns[i])} `);
    return `│${parts.join("│")}│`;
}
function tableSeparator(widths) {
    return `├${widths.map((w) => "─".repeat(w + 2)).join("┼")}┤`;
}
/** Box-drawing table: id | score | flag (same style as /metamorph). */
function formatAsciiTargetTable(title, targets) {
    if (targets.length === 0)
        return [];
    const sorted = [...targets].sort((a, b) => a.score - b.score || a.id.localeCompare(b.id));
    const rows = sorted.map((t) => ({
        id: t.id,
        score: `${t.score}/${SCORE_MAX}`,
        flag: (0, flagsShort_js_1.displayFlag)(t.flags),
    }));
    const widths = [
        Math.max(2, ...rows.map((r) => r.id.length), "id".length),
        Math.max(5, ...rows.map((r) => r.score.length), "score".length),
        Math.max(4, ...rows.map((r) => r.flag.length), "flag".length),
    ];
    const aligns = ["left", "left", "left"];
    const lines = [`## ${title} (${sorted.length})`, ""];
    lines.push(tableRow(["id", "score", "flag"], widths, ["center", "center", "center"]));
    lines.push(tableSeparator(widths));
    for (const r of rows) {
        lines.push(tableRow([r.id, r.score, r.flag], widths, aligns));
    }
    lines.push("");
    return lines;
}
//# sourceMappingURL=targetTable.js.map