"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateReportHtml = generateReportHtml;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const config_js_1 = require("../config.js");
function escapeHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function scoreColor(score) {
    if (score >= 70)
        return "#22c55e";
    if (score >= 40)
        return "#f59e0b";
    return "#ef4444";
}
function svgBarChart(items) {
    if (items.length === 0)
        return "";
    const barHeight = 24;
    const gap = 8;
    const labelWidth = 160;
    const chartWidth = 300;
    const totalHeight = items.length * (barHeight + gap);
    const maxVal = Math.max(...items.map((i) => i.value), 1);
    const bars = items
        .map((item, idx) => {
        const y = idx * (barHeight + gap);
        const barW = Math.round((item.value / maxVal) * chartWidth);
        return `
        <text x="${labelWidth - 8}" y="${y + barHeight / 2 + 5}" text-anchor="end" font-size="12" fill="#555">${escapeHtml(item.label)}</text>
        <rect x="${labelWidth}" y="${y}" width="${barW}" height="${barHeight}" fill="${item.color}" rx="3"/>
        <text x="${labelWidth + barW + 6}" y="${y + barHeight / 2 + 5}" font-size="12" fill="#333">${item.value}</text>
      `;
    })
        .join("");
    return `<svg width="${labelWidth + chartWidth + 60}" height="${totalHeight}" xmlns="http://www.w3.org/2000/svg">${bars}</svg>`;
}
function copyButton(text) {
    // Store text in a data attribute (HTML-escaped) and retrieve via getAttribute — avoids
    // any inline JS string escaping bugs regardless of quotes or special chars in text.
    const safeAttr = escapeHtml(text);
    return `<button data-copy="${safeAttr}" onclick="navigator.clipboard.writeText(this.getAttribute('data-copy')).then(()=>{this.textContent='Copied!';setTimeout(()=>this.textContent='Copy',1500)})" style="margin-left:8px;padding:2px 10px;font-size:12px;cursor:pointer;border:1px solid #ccc;border-radius:4px;background:#f5f5f5">Copy</button>`;
}
function commandBridge(label, command) {
    return `
    <div style="margin:8px 0;padding:8px 12px;background:#f8f8f8;border:1px solid #e0e0e0;border-radius:6px;display:flex;align-items:center;justify-content:space-between">
      <span style="font-size:13px;color:#555">${escapeHtml(label)}</span>
      <span>
        <code style="background:#eee;padding:2px 8px;border-radius:4px;font-size:12px">${escapeHtml(command)}</code>
        ${copyButton(command)}
      </span>
    </div>`;
}
function generateReportHtml(pluginRoot, analysis) {
    const config = (0, config_js_1.loadConfig)(pluginRoot);
    const { sessionCount, totals, agents, skills, languages, feedback } = analysis;
    const warmupMet = sessionCount >= config.warmupSessions;
    const allTargets = [...agents, ...skills].sort((a, b) => a.score - b.score);
    const flagged = allTargets.filter((t) => t.score < config.flagThreshold || t.flags.some((f) => f.confidence === "high" && f.type !== "hot-path"));
    // Score distribution chart data
    const scoreChartItems = allTargets.slice(0, 15).map((t) => ({
        label: t.id,
        value: t.score,
        color: scoreColor(t.score),
    }));
    // Language chart data
    const langItems = Object.entries(languages)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([lang, pct]) => ({
        label: lang,
        value: Math.round(pct * 100),
        color: "#6366f1",
    }));
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>metamorph — Habits Dashboard</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #fafafa; color: #222; line-height: 1.6; }
  .container { max-width: 900px; margin: 0 auto; padding: 24px 16px; }
  h1 { font-size: 24px; font-weight: 700; margin-bottom: 4px; }
  h2 { font-size: 18px; font-weight: 600; margin: 28px 0 12px; border-bottom: 2px solid #e5e7eb; padding-bottom: 6px; }
  h3 { font-size: 14px; font-weight: 600; margin: 16px 0 6px; }
  .meta { color: #888; font-size: 13px; margin-bottom: 16px; }
  .banner { background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 12px 16px; margin: 16px 0; }
  .banner.warmup { background: #eff6ff; border-color: #93c5fd; }
  .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin: 16px 0; }
  .stat-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 16px; }
  .stat-value { font-size: 28px; font-weight: 700; color: #111; }
  .stat-label { font-size: 12px; color: #888; margin-top: 2px; }
  .target-row { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 16px; margin: 8px 0; }
  .target-header { display: flex; align-items: center; gap: 12px; }
  .score-badge { font-size: 20px; font-weight: 700; min-width: 44px; text-align: right; }
  .target-id { font-family: monospace; font-size: 14px; font-weight: 600; }
  .flag-list { margin-top: 8px; }
  .flag { display: inline-block; font-size: 11px; padding: 2px 8px; border-radius: 12px; margin: 2px; background: #f3f4f6; border: 1px solid #d1d5db; }
  .flag.high { background: #fee2e2; border-color: #fca5a5; color: #991b1b; }
  .flag.low { background: #fef9c3; border-color: #fde047; color: #854d0e; }
  .charts { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
  @media(max-width: 640px) { .charts { grid-template-columns: 1fr; } }
  .chart-box { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; overflow-x: auto; }
  .feedback-box { margin: 16px 0; }
  .feedback-input { display: flex; gap: 8px; }
  .feedback-input input { flex: 1; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; }
  .feedback-input button { padding: 8px 16px; background: #111; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; }
  #feedback-cmd { margin-top: 8px; padding: 8px 12px; background: #f8f8f8; border: 1px solid #e0e0e0; border-radius: 6px; font-family: monospace; font-size: 12px; display: none; }
  .progress-bar { background: #e5e7eb; border-radius: 99px; height: 10px; overflow: hidden; margin: 8px 0; }
  .progress-fill { background: #6366f1; height: 100%; border-radius: 99px; transition: width 0.3s; }
</style>
</head>
<body>
<div class="container">
  <h1>metamorph</h1>
  <div class="meta">Habits Dashboard · Generated ${new Date(analysis.generatedAt).toLocaleString()} · Privacy: ${analysis.readMode}</div>

  ${!warmupMet ? `
  <div class="banner warmup">
    <strong>Warming up: ${sessionCount}/${config.warmupSessions} sessions</strong>
    <div class="progress-bar"><div class="progress-fill" style="width:${Math.round((sessionCount / config.warmupSessions) * 100)}%"></div></div>
    <div style="font-size:13px;color:#555;margin-top:4px">Collecting data — improvement suggestions unlock after warm-up completes.</div>
  </div>` : ""}

  <div class="stats-grid">
    <div class="stat-card"><div class="stat-value">${totals.sessions}</div><div class="stat-label">Sessions</div></div>
    <div class="stat-card"><div class="stat-value">${totals.toolCalls}</div><div class="stat-label">Tool Calls</div></div>
    <div class="stat-card"><div class="stat-value">${totals.agentRuns}</div><div class="stat-label">Agent Runs</div></div>
    <div class="stat-card"><div class="stat-value">${totals.skillLoads}</div><div class="stat-label">Skill Loads</div></div>
  </div>

  <div class="charts">
    <div class="chart-box">
      <h3>Utilization Scores</h3>
      ${svgBarChart(scoreChartItems)}
    </div>
    ${langItems.length > 0 ? `<div class="chart-box">
      <h3>Languages</h3>
      ${svgBarChart(langItems)}
    </div>` : ""}
  </div>

  ${flagged.length > 0 ? `
  <h2>Flagged Targets</h2>
  ${flagged.map((t) => `
  <div class="target-row">
    <div class="target-header">
      <div class="score-badge" style="color:${scoreColor(t.score)}">${t.score}</div>
      <div class="target-id">${escapeHtml(t.id)}</div>
      <div style="font-size:12px;color:#888">${t.invocations} runs</div>
    </div>
    <div class="flag-list">
      ${t.flags.map((f) => {
        const safeConf = f.confidence === "high" || f.confidence === "low" ? f.confidence : "low";
        return `<span class="flag ${safeConf}">${escapeHtml(f.type)}${f.target ? ` · ${escapeHtml(f.target)}` : ""}${f.section ? ` · "${escapeHtml(f.section)}"` : ""}</span>`;
    }).join("")}
    </div>
    ${warmupMet ? commandBridge(`Improve ${t.id}`, `/metamorph --target ${t.id}`) : ""}
  </div>`).join("")}
  ` : ""}

  ${warmupMet ? `
  <h2>Improvement Commands</h2>
  ${commandBridge("Run improvement suggestions (top 3)", "/metamorph")}
  ${commandBridge("Show dashboard status", "/metamorph --status")}
  ${commandBridge("List pending suggestions", "/metamorph-improve --list")}
  ${commandBridge("Rollback last change", "/metamorph-rollback --list")}
  ` : ""}

  <h2>Feedback</h2>
  <div class="feedback-box">
    ${feedback.length > 0 ? `<ul style="margin-bottom:12px">${feedback.map((f) => `<li style="font-size:13px;margin:4px 0">${escapeHtml(f)}</li>`).join("")}</ul>` : "<p style=\"font-size:13px;color:#888;margin-bottom:12px\">No feedback logged yet.</p>"}
    <div class="feedback-input">
      <input type="text" id="feedback-text" placeholder="Type feedback..." maxlength="500">
      <button onclick="(function(){const t=document.getElementById('feedback-text').value.trim();if(!t)return;const cmd='/metamorph-feedback \\"'+t.replace(/\\\\/g,'\\\\\\\\').replace(/\\"/g,'\\\\\\"')+'\\"';const el=document.getElementById('feedback-cmd');el.textContent=cmd;el.style.display='block'})()">Generate command</button>
    </div>
    <div id="feedback-cmd"></div>
    <div style="font-size:11px;color:#aaa;margin-top:4px">Paste the generated command into Claude Code to log your feedback.</div>
  </div>

</div>
</body>
</html>`;
    const reportPath = path.join(pluginRoot, "report.html");
    fs.writeFileSync(reportPath, html, "utf8");
}
//# sourceMappingURL=reportHtml.js.map