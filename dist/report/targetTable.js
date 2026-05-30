"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatAsciiTargetTable = formatAsciiTargetTable;
const flagsShort_js_1 = require("../improve/flagsShort.js");
const SCORE_MAX = 100;
/** Horizontal padding inside each cell (more = less cramped). */
const CELL_PAD = 2;
const MIN_COL_WIDTHS = [26, 10, 10]; // id, score, flag
function padCell(text, width, align = "left") {
    const w = Math.max(width, text.length);
    if (align === "center") {
        const pad = w - text.length;
        const left = Math.floor(pad / 2);
        return " ".repeat(left) + text + " ".repeat(pad - left);
    }
    return text.padEnd(w);
}
function cellBlock(text, contentWidth, align) {
    const inner = padCell(text, contentWidth, align);
    return `${" ".repeat(CELL_PAD)}${inner}${" ".repeat(CELL_PAD)}`;
}
function blockWidth(contentWidth) {
    return contentWidth + CELL_PAD * 2;
}
function tableRow(cells, contentWidths, aligns) {
    const parts = cells.map((c, i) => cellBlock(c, contentWidths[i], aligns[i]));
    return `│${parts.join("│")}│`;
}
function tableTop(contentWidths) {
    return `┌${contentWidths.map((w) => "─".repeat(blockWidth(w))).join("┬")}┐`;
}
function tableMid(contentWidths) {
    return `├${contentWidths.map((w) => "─".repeat(blockWidth(w))).join("┼")}┤`;
}
function tableBottom(contentWidths) {
    return `└${contentWidths.map((w) => "─".repeat(blockWidth(w))).join("┴")}┘`;
}
/** Box-drawing table with top/bottom borders and relaxed column spacing. */
function formatAsciiTargetTable(title, targets) {
    if (targets.length === 0)
        return [];
    const sorted = [...targets].sort((a, b) => a.score - b.score || a.id.localeCompare(b.id));
    const rows = sorted.map((t) => ({
        id: t.id,
        score: `${t.score}/${SCORE_MAX}`,
        flag: (0, flagsShort_js_1.displayFlag)(t.flags),
    }));
    const contentWidths = [
        Math.max(MIN_COL_WIDTHS[0], ...rows.map((r) => r.id.length), "id".length),
        Math.max(MIN_COL_WIDTHS[1], ...rows.map((r) => r.score.length), "score".length),
        Math.max(MIN_COL_WIDTHS[2], ...rows.map((r) => r.flag.length), "flag".length),
    ];
    const headerAlign = ["center", "center", "center"];
    const rowAlign = ["left", "center", "center"];
    const lines = [`## ${title} (${sorted.length})`, ""];
    lines.push(tableTop(contentWidths));
    lines.push(tableRow(["id", "score", "flag"], contentWidths, headerAlign));
    lines.push(tableMid(contentWidths));
    for (const r of rows) {
        lines.push(tableRow([r.id, r.score, r.flag], contentWidths, rowAlign));
    }
    lines.push(tableBottom(contentWidths));
    lines.push("");
    return lines;
}
//# sourceMappingURL=targetTable.js.map