// Placeholder guard used before the real guard modules exist (Prompt 2).
// Every hook ALLOWs. The real pipeline replaces this in guard/index.js.
const allow = (stage, layer) => ({
  stage, outcome: 'ALLOW', rule_ids: [], risk: 0, layer,
  explanation: 'Guard is off - no checks were run.', would_block: false,
});

export const noopGuard = {
  mode: 'off',
  async checkInput() { return allow('input', 'scanner'); },
  async checkDocument({ content }) { return { ...allow('document', 'scanner'), content }; },
  async checkToolCall() { return allow('tool', 'firewall'); },
  async checkToolOutput({ output }) { return { ...allow('tool', 'scanner'), output }; },
  async checkEgress({ text }) { return { ...allow('egress', 'egress'), text }; },
};
