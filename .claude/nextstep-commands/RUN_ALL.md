# NextStep Auto-Orchestrator
# Paste this entire file into Claude Code and it will run all 10 commands automatically.

You are about to autonomously build the NextStep MVP. You have 10 command files in the `.claude/commands/` directory. Execute them in order, one at a time, completing each fully before starting the next.

## Your operating rules

1. Read each command file completely before starting it.
2. Complete every step in the command before moving on.
3. If a step fails, debug and fix it before proceeding — do not skip steps.
4. After each command completes, print a one-line summary: "✅ CMD XX complete — [what was done]"
5. If a command fails after 3 fix attempts, print "⚠️ CMD XX blocked — [reason]" and continue to the next command.
6. Never ask for confirmation. Never pause. Work through all 10 commands without stopping.

## Execution sequence

Read and execute each of these files in order:

1. `.claude/commands/cmd_01_setup_schema.md`
2. `.claude/commands/cmd_02_seed_students.md`
3. `.claude/commands/cmd_03_api_routes.md`
4. `.claude/commands/cmd_04_dashboard.md`
5. `.claude/commands/cmd_05_grade_viewer.md`
6. `.claude/commands/cmd_06_ai_chat.md`
7. `.claude/commands/cmd_07_college_roadmap.md`
8. `.claude/commands/cmd_08_settings_calendar.md`
9. `.claude/commands/cmd_09_web_app.md`
10. `.claude/commands/cmd_10_polish_demo.md`

## Start now

Begin with CMD 01. Read `.claude/commands/cmd_01_setup_schema.md` and execute it completely.
