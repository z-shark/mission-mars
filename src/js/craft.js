const PARTS = {
  relay_radio: (c) => `<g class="part" style="--d:${c}"><line x1="120" y1="40" x2="120" y2="28" class="strut"/><path d="M104 22 Q120 38 136 22 Z" class="ci"/><circle cx="120" cy="22" r="2" class="ci2"/></g>`,
  camera: (c) => `<g class="part" style="--d:${c}"><rect x="140" y="64" width="22" height="18" rx="3" class="ci"/><circle cx="151" cy="73" r="5" class="lens"/></g>`,
  dust_sensor: (c) => `<g class="part" style="--d:${c}"><path d="M92 40 L84 22 L100 22 Z" class="ci"/><circle cx="92" cy="18" r="2" class="ci2"/><circle cx="85" cy="14" r="1.5" class="ci2"/><circle cx="99" cy="13" r="1.5" class="ci2"/></g>`,
  thermometer: (c) => `<g class="part" style="--d:${c}"><rect x="64" y="52" width="26" height="4" rx="2" class="ci"/><circle cx="62" cy="54" r="5" class="hot"/></g>`,
  magnetometer: (c) => `<g class="part" style="--d:${c}"><line x1="150" y1="44" x2="190" y2="26" class="strut"/><circle cx="192" cy="25" r="6" class="ci"/><path d="M189 22 v6 h2 v-4 h2 v4 h2 v-6" class="mag"/></g>`,
  radiation_sensor: (c) => `<g class="part" style="--d:${c}"><rect x="72" y="70" width="22" height="18" rx="3" class="ci"/><circle cx="83" cy="79" r="5" class="rad"/></g>`,
};

export function renderCraft(state, ctx, text) {
  const ids = state.instruments ?? [];
  const tanks = Math.round((state.propellantKg ?? 0) / 10);
  const panelScale = state.profile === "engineer" ? Math.max(0.6, Math.min(1.8, state.arrayAreaM2 / 1.5)) : 1;
  const pw = 34 * panelScale;
  const body = `<rect x="104" y="40" width="32" height="56" rx="4" class="cb"/><rect x="110" y="48" width="20" height="6" rx="2" class="cw"/>`;
  const panels = `<g class="cp"><rect x="${(104 - 6 - pw).toFixed(1)}" y="58" width="${pw.toFixed(1)}" height="24" rx="2"/><rect x="${(136 + 6).toFixed(1)}" y="58" width="${pw.toFixed(1)}" height="24" rx="2"/><line x1="98" y1="70" x2="104" y2="70" class="strut"/><line x1="136" y1="70" x2="142" y2="70" class="strut"/></g>`;
  const parts = ids.map((id, i) => (PARTS[id] ? PARTS[id](`${i * 0.1}s`) : "")).join("");
  const rows = [];
  for (let n = 0; n < tanks; n += 1) {
    const col = n % 8;
    const row = Math.floor(n / 8);
    rows.push(`<rect x="${58 + col * 15}" y="${108 + row * 18}" width="12" height="15" rx="3" class="ct" style="--d:${n * 0.03}s"/>`);
  }
  const empty = ids.length === 0 && tanks === 0 ? `<text x="120" y="150" text-anchor="middle" class="hint">${text.empty}</text>` : "";
  return `<figure class="craft"><svg viewBox="0 0 240 160" role="img" aria-label="${text.alt}">${panels}${body}${parts}${rows.join("")}${empty}</svg><figcaption>${text.caption}</figcaption></figure>`;
}
