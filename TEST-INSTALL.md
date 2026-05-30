# metamorph test-install checklist

End-to-end verification per PLAN.md (todo 13).

- [ ] `/plugin marketplace add K3vin-h/metamorph` then `/plugin install metamorph`
- [ ] Run `/metamorph setup` and confirm `${CLAUDE_PLUGIN_DATA}/config.jsonc` updates
- [ ] Complete 5 sessions (warm-up); dashboard shows `warming up (n/5)`
- [ ] After warm-up, `/metamorph` returns suggestions (top N targets)
- [ ] `${CLAUDE_PLUGIN_DATA}/report.md` refreshes after SessionEnd with compact agent/skill tables
- [ ] Permissions: denied paths are skipped; deny globs win over allow
- [ ] Privacy: `redacted` mode stores metadata only (no raw prompts/commands in `data/`)
- [ ] Approve a suggestion via `/metamorph-improve --approve`; file validates and backup appears in `backups/`
- [ ] `/metamorph-rollback --file <path>` restores previous version
- [ ] `/metamorph feedback "..."` appears on next report run
- [ ] Token usage: only `/metamorph` invokes LLM; hooks are zero-token
