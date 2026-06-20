import { describe, test, expect } from 'vitest';

// Covers buildSimulationReport — the pure function behind the Simulator's
// "Copy" / "Download" results export.

function emailRun(overrides = {}) {
    return {
        timestamp: '2026-06-20 10:00:00',
        channelValue: 'Email',
        channelLabel: 'Email (Exchange)',
        trueConditions: ['Recipient is external', 'contains: Credit Card Number'],
        userOverride: false,
        phases: [
            {
                title: 'Phase 1: Client-side Pre-send',
                policyResults: [{
                    name: 'Financial', priority: 0, enabled: true, skipped: false,
                    rules: [
                        { name: 'Block CC', priority: 0, enabled: true, matched: true, actions: { monitor: true, notify: true, override: false, block: true }, ruleBlock: true },
                        { name: 'Watcher', priority: 1, enabled: true, matched: false, actions: {} }
                    ]
                }]
            },
            {
                title: 'Phase 2: Server-side Transport',
                policyResults: [{
                    name: 'Financial', priority: 0, enabled: true, skipped: false,
                    rules: [
                        { name: 'Legacy rule', priority: 0, enabled: false, skipped: true, skipReason: 'Rule disabled' },
                        { name: 'Server scan', priority: 1, enabled: true, deferred: true, actions: {} }
                    ]
                }]
            }
        ],
        outcome: { title: 'Combined Final Outcome', matchedAny: true, actions: { monitor: true, notify: true, block: true }, overrodeBlock: false, failedOverrideBlock: false },
        ...overrides
    };
}

describe('buildSimulationReport', () => {
    test('returns an empty string for a missing run', () => {
        expect(window.buildSimulationReport(null)).toBe('');
    });

    test('includes the header, channel, and conditions set to True', () => {
        const report = window.buildSimulationReport(emailRun());
        expect(report).toContain('Purview Playground — Simulation Report');
        expect(report).toContain('Generated: 2026-06-20 10:00:00');
        expect(report).toContain('Channel: Email (Exchange)');
        expect(report).toContain('  - Recipient is external');
        expect(report).toContain('  - contains: Credit Card Number');
        expect(report).toContain('User applied Override: No');
    });

    test('renders both phases with per-rule outcomes', () => {
        const report = window.buildSimulationReport(emailRun());
        expect(report).toContain('== Phase 1: Client-side Pre-send ==');
        expect(report).toContain('Policy: Financial (Priority 0)');
        expect(report).toContain('Rule: Block CC — MATCH | Actions: MONITOR, NOTIFY, BLOCK | Evaluation halted (block)');
        expect(report).toContain('Rule: Watcher — No match');
        expect(report).toContain('== Phase 2: Server-side Transport ==');
        expect(report).toContain('Rule: Legacy rule — Skipped (Rule disabled)');
        expect(report).toContain('Rule: Server scan — Deferred to server');
    });

    test('summarises the final outcome and actions', () => {
        const report = window.buildSimulationReport(emailRun());
        expect(report).toContain('== Combined Final Outcome ==');
        expect(report).toContain('Rules matched: Yes');
        expect(report).toContain('Actions: Monitor, Notify, Block');
    });

    test('notes when no conditions are set to True', () => {
        const report = window.buildSimulationReport(emailRun({ trueConditions: [] }));
        expect(report).toContain('  (none — all conditions False)');
    });

    test('reports the default-allow outcome when nothing matched', () => {
        const report = window.buildSimulationReport(emailRun({
            outcome: { title: 'Combined Final Outcome', matchedAny: false, actions: {}, overrodeBlock: false, failedOverrideBlock: false }
        }));
        expect(report).toContain('Rules matched: No');
        expect(report).toContain('Outcome: No rules matched. Default allow behavior applies.');
    });

    test('describes a successful override (block bypassed)', () => {
        const run = emailRun({
            userOverride: true,
            phases: [{
                title: 'Phase 1: Client-side Pre-send',
                policyResults: [{
                    name: 'Financial', priority: 0, enabled: true, skipped: false,
                    rules: [{ name: 'Block CC', priority: 0, enabled: true, matched: true, actions: { monitor: true, notify: false, override: true, block: true }, ruleBlock: false, overrodeBlock: true }]
                }]
            }],
            outcome: { title: 'Combined Final Outcome', matchedAny: true, actions: { monitor: true, notify: false, block: false }, overrodeBlock: true, failedOverrideBlock: false }
        });
        const report = window.buildSimulationReport(run);
        expect(report).toContain('Rule: Block CC — MATCH | Actions: MONITOR, OVERRIDE, BLOCK | Block bypassed via override');
        expect(report).toContain('Actions: Monitor; Block bypassed via override');
    });

    test('describes a failed override (still blocked)', () => {
        const run = emailRun({
            phases: [{
                title: 'Phase 1: Client-side Pre-send',
                policyResults: [{
                    name: 'Financial', priority: 0, enabled: true, skipped: false,
                    rules: [{ name: 'Block CC', priority: 0, enabled: true, matched: true, actions: { monitor: false, notify: false, override: true, block: true }, ruleBlock: true, failedOverrideBlock: true }]
                }]
            }],
            outcome: { title: 'Combined Final Outcome', matchedAny: true, actions: { monitor: false, notify: false, block: true }, overrodeBlock: false, failedOverrideBlock: true }
        });
        const report = window.buildSimulationReport(run);
        expect(report).toContain('Blocked (user did not override) — evaluation halted');
        // The final outcome line must show only the failed-override note — Block
        // is NOT an active action when the override failed.
        const outcomeActions = report.split('\n').find(l => l.startsWith('Actions: '));
        expect(outcomeActions).toBe('Actions: Blocked (user did not override)');
    });

    test('marks a matched rule with no configured actions as NONE', () => {
        const run = emailRun({
            phases: [{
                title: 'Endpoint Evaluation',
                policyResults: [{
                    name: 'P', priority: 0, enabled: true, skipped: false,
                    rules: [{ name: 'Audit only', priority: 0, enabled: true, matched: true, actions: { monitor: false, notify: false, override: false, block: false } }]
                }]
            }]
        });
        const report = window.buildSimulationReport(run);
        expect(report).toContain('Rule: Audit only — MATCH | Actions: NONE');
    });
});
