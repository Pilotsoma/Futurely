# NextStep — Live Portal Sprint Auto-Orchestrator

Paste this entire file into Claude Code and it will execute all 8 commands
automatically, in order, without stopping.

## Your operating rules

1. Read each command file completely before starting it.
2. Complete every step inside the command fully before moving to the next command.
3. If a step fails, debug and fix it — do not skip. Try up to 3 times before marking blocked.
4. After each command finishes, print a one-line status: `✅ CMD Px complete — [what was done]`
5. If a command is still blocked after 3 fix attempts, print `⚠️ CMD Px blocked — [reason]`
   and continue to the next command anyway.
6. Never ask for confirmation. Never pause. Work through all commands without stopping.
7. When reading a command file and it says "read this file first", actually read that file
   before continuing. Do not skip prerequisite reads.
8. TypeScript must pass (`npx tsc --noEmit` = 0 errors) after every command that touches code.

## Execution sequence

Read and execute each file in this exact order:

1. `.claude/commands/live-portal/cmd_P0_fix_database.md`
2. `.claude/commands/live-portal/cmd_P1_normalize_grades.md`
3. `.claude/commands/live-portal/cmd_P2_portal_api_client.md`
4. `.claude/commands/live-portal/cmd_P3_portal_connect_screen.md`
5. `.claude/commands/live-portal/cmd_P4_add_to_navigator.md`
6. `.claude/commands/live-portal/cmd_P5_dashboard_status_card.md`
7. `.claude/commands/live-portal/cmd_P6_grade_viewer_live_data.md`
8. `.claude/commands/live-portal/cmd_P7_verify_smoke_test.md`

## Start now

Begin with CMD P0. Read `.claude/commands/live-portal/cmd_P0_fix_database.md`
and execute it completely before moving to CMD P1.
