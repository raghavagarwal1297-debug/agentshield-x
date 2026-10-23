// Extra response fields the dashboard (client/) reads. These are additive:
// every field of the original API contract stays as it was.

const STEP_STATUS = { ALLOW: 'completed', REDACT: 'completed', BLOCK: 'blocked', NEEDS_APPROVAL: 'pending_approval', REJECTED: 'rejected' };

// /api/chat result -> adds message, verdict flags and step action/status.
export function chatView(result) {
  if (!result || typeof result !== 'object') return result;
  const decisions = result.decisions || [];
  const steps = (result.steps || []).map((s) => ({ ...s, action: s.tool, status: STEP_STATUS[s.outcome] || 'completed' }));
  const stopped = decisions.find((d) => d.outcome === 'BLOCK') || decisions.find((d) => d.outcome === 'NEEDS_APPROVAL');
  const blocked = decisions.some((d) => d.outcome === 'BLOCK');
  const approval_required = !!result.pending_approval_id;
  const verdict = blocked ? 'blocked'
    : approval_required ? 'needs_approval'
      : decisions.some((d) => d.outcome === 'REDACT') ? 'redacted'
        : decisions.some((d) => d.unguarded) ? 'unguarded' : 'allowed';
  return {
    ...result,
    steps,
    tool_calls: steps,
    message: result.reply || '',
    blocked,
    approval_required,
    layer_stopped_at: stopped?.layer || null,
    verdict,
    timestamp: new Date().toISOString(),
  };
}

// Metrics tab shape, built from a saved test run (tests/results/latest.json).
// Values that were never measured are null, never invented.
export function metricsView(run) {
  const off = run?.off || {};
  const on = run?.on || {};
  const cases = run?.cases || [];
  const attacks = cases.filter((c) => c.set === 'attack');
  const legit = cases.filter((c) => c.set === 'legit');
  return {
    has_run: !!run,
    summary: {
      asr_seen_off: off.asr ?? null,
      asr_seen_on: on.asr ?? null,
      asr_unseen_off: null, // held-out set pending
      asr_unseen_on: null,
      task_completion: on.task_completion ?? null,
      false_positive_rate: on.false_positive_rate ?? null,
      permission_enforcement: on.permission_enforcement ?? null,
      explanation_quality: null,
      latency_off_ms: off.avg_ms_per_request ?? null,
      latency_on_ms: on.avg_ms_per_request ?? null,
      latency_overhead_ms: on.avg_guard_ms_per_request ?? null, // time spent inside the guard
    },
    attack_comparison: attacks.map((c) => ({
      category: `${c.id} ${c.title}`,
      total: 1,
      off_success: c.off && !c.off.error ? Number(!!c.off.achieved) : null,
      on_success: c.enforce && !c.enforce.error ? Number(!!c.enforce.achieved) : null,
    })),
    latency_by_layer: [
      { name: 'Request, guard OFF', latency: off.avg_ms_per_request ?? 0 },
      { name: 'Request, guard ON', latency: on.avg_ms_per_request ?? 0 },
      { name: 'Guard hooks (all layers)', latency: on.avg_guard_ms_per_request ?? 0 },
    ],
    what_got_through: attacks.filter((c) => c.enforce?.achieved).map((c) => ({
      id: c.id, attack_type: c.title, vector: c.enforce.tools.join(', ') || 'reply only',
      why_escaped: c.enforce.effect, mitigating_layer: c.layer || 'none', status: 'open',
    })),
    false_positives: legit.filter((c) => (on.false_positives || []).includes(c.id)).map((c) => ({
      id: c.id, task: c.title, trigger: (c.enforce.rules || []).join(', ') || 'task not completed',
      resolution: c.enforce.blocked ? 'blocked' : 'not completed',
    })),
    test_cases_summary: {
      dev_attacks_total: attacks.length,
      heldout_attacks_total: 0,
      legitimate_tasks_total: legit.length,
      errored: [...new Set([...(off.errors || []), ...(on.errors || [])])],
      last_run: run?.finished || null,
      model: run?.llm?.agent_model || null,
      demo_mode: run?.llm?.demo_mode || null,
    },
  };
}
