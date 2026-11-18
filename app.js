/* Notes-Werkstatt (Handy-App): Substack Notes planen, schreiben, posten, auswerten. Abgleich über die Drive-Brücke. */
'use strict';
const VER = 'v1';
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const uid = () => [...crypto.getRandomValues(new Uint8Array(8))].map(b => b.toString(16).padStart(2, '0')).join('');
const p2 = n => String(n).padStart(2, '0');
const isoD = d => d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
const heute = () => isoD(new Date());
const jetzt = () => { const d = new Date(); return isoD(d) + 'T' + p2(d.getHours()) + ':' + p2(d.getMinutes()); };
const vorTagen = n => { const d = new Date(); d.setDate(d.getDate() - n); return isoD(d); };
const datDE = s => { const m = /^(\d{4})-(\d\d)-(\d\d)/.exec(s || ''); return m ? m[3] + '.' + m[2] + '.' + m[1] : ''; };
const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } };
function msg(s, err) { const e = $('#toast'); e.textContent = s; e.className = err ? 'err' : ''; e.style.display = 'block'; clearTimeout(msg.t); msg.t = setTimeout(() => e.style.display = 'none', err ? 7000 : 3200); }
const hash = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return String(h); };
const num = v => (v === '' || v == null || isNaN(Number(v))) ? null : Number(v);
const WT = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

const SPR = ['DE', 'EN', 'ES', 'GL'];
const SPRN = { DE: 'Deutsch', EN: 'Englisch', ES: 'Spanisch', GL: 'Galicisch' };
const STR = ['Camino', 'ISO / KI', 'Journalismus', 'Sonstiges'];
const TYP = { beob: 'Beobachtung', zwi: 'Zwischenmeldung', nicht: 'Du bist nicht allein', meil: 'Meilenstein' };
const TYPHINT = { beob: 'Kurze persönliche Geschichte mit einer Erkenntnis, keine Liste.', zwi: 'Ehrliche Zwischenmeldung, gern mit einer Zahl aus der Arbeit.', nicht: 'Ermutigung, in der sich Leser wiedererkennen.', meil: 'Auch ein kleiner Erfolg wird sichtbar gemacht.' };
const STAT = ['Idee', 'Entwurf', 'Bereit', 'Gepostet'];

/* ---------- Daten ---------- */
const leer = () => ({ format: 'notes', version: 1, stand: 0, notes: [], autoren: [], geloescht: [], einst: { url: '', sprachen: ['DE', 'EN'], boosttag: 4, dialogProTag: 3 }, tage: {} });
let D = (() => { const j = lsGet('nw_data', null); if (j && Array.isArray(j.notes)) { const l = leer(); j.einst = Object.assign(l.einst, j.einst || {}); j.tage = j.tage || {}; j.autoren = j.autoren || []; j.geloescht = j.geloescht || []; return j; } return leer(); })();
let QUIET = false;
function save() { D.stand = Date.now(); try { localStorage.setItem('nw_data', JSON.stringify(D)); } catch (e) { msg('Der Speicher im Handy ist voll.', 1); } if (!QUIET) drvSoon(4000); }
const findN = id => D.notes.find(n => n.id === id);
const findA = id => D.autoren.find(a => a.id === id);
const gepostet = n => n.status === 'Gepostet';
const tag = n => (n.gepostet || '').slice(0, 10);

/* ---------- Kopieren ---------- */
async function kopie(t) { try { await navigator.clipboard.writeText(t); return true; } catch (e) { const a = document.createElement('textarea'); a.value = t; a.style.position = 'fixed'; a.style.opacity = '0'; document.body.appendChild(a); a.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (x) { } a.remove(); return ok; } }

/* ---------- Ansicht ---------- */
let TAB = 'heute', FIL = '';
const TABS = [['heute', '📅 Heute'], ['notes', '✏️ Notes'], ['dialog', '💬 Dialog'], ['auswertung', '📊 Auswertung'], ['mehr', '⚙ Mehr']];
function render() {
  $('#hs').textContent = 'Substack Notes · ' + VER;
  $('#nv').innerHTML = TABS.map(([k, n]) => `<button class="${TAB === k ? 'on' : ''}" onclick="TAB='${k}';render()">${n}</button>`).join('');
  $('#m').innerHTML = { heute: viewHeute, notes: viewNotes, dialog: viewDialog, auswertung: viewAuswertung, mehr: viewMehr }[TAB]();
  if (TAB === 'mehr') drvShow();
}

/* Vorschlag: Typ, Strang, Sprache, die zuletzt am seltensten vorkamen */
function vorschlag() {
  const von = vorTagen(14), P = D.notes.filter(n => gepostet(n) && tag(n) >= von);
  const wenig = (liste, f) => liste.map(x => [x, P.filter(n => f(n) === x).length]).sort((a, b) => a[1] - b[1])[0][0];
  const spr = D.einst.sprachen.length ? D.einst.sprachen : ['DE'];
  return { typ: wenig(Object.keys(TYP), n => n.typ), strang: wenig(STR, n => n.strang), sprache: wenig(spr, n => n.sprache) };
}
function viewHeute() {
  const h = heute(), E = D.einst, T = D.tage[h] || {};
  const heutePost = D.notes.filter(n => gepostet(n) && tag(n) === h).length;
  const bereit = D.notes.filter(n => n.status === 'Bereit').sort((a, b) => (a.geplant || '9').localeCompare(b.geplant || '9'));
  const dialogHeute = D.autoren.filter(a => a.letzter === h).length;
  const wd = new Date().getDay(), boostHeute = wd === Number(E.boosttag);
  let k1;
  if (heutePost) k1 = `<div class="card done"><b>✓ Eine Note ist heute gepostet.</b><div class="mu">Gut. Mehr braucht es heute nicht.</div></div>`;
  else if (bereit.length) { const n = bereit[0]; k1 = `<div class="card"><b>1. Diese Note ist bereit</b><div class="mu">${esc(n.sprache)} · ${esc(n.strang)} · ${esc(TYP[n.typ])}</div><p>${esc(n.text).replace(/\n/g, '<br>')}</p><button class="btn big" onclick="posten('${n.id}')">Kopieren und Substack öffnen</button><div class="row"><button class="btn alt" style="flex:1" onclick="habGepostet('${n.id}')">Habe gepostet</button><button class="btn grau" style="flex:1" onclick="openNote('${n.id}')">Bearbeiten</button></div></div>`; }
  else { const v = vorschlag(); k1 = `<div class="card"><b>1. Heute fehlt noch eine Note</b><p class="mu">Vorschlag aus den letzten 14 Tagen: <b>${esc(TYP[v.typ])}</b> im Strang <b>${esc(v.strang)}</b> auf <b>${SPRN[v.sprache]}</b>. ${esc(TYPHINT[v.typ])}</p><button class="btn big" onclick="neueNote('${v.typ}','${v.strang}','${v.sprache}')">Note anlegen</button></div>`; }
  const wer = D.autoren.filter(a => a.letzter !== h).sort((a, b) => (a.letzter || '').localeCompare(b.letzter || '')).slice(0, Math.max(0, Number(E.dialogProTag) - dialogHeute));
  const k2 = !D.autoren.length ? `<div class="card"><b>2. Dialog</b><p class="mu">Trage im Reiter „Dialog“ Autoren ein, bei denen du kommentieren willst. Hier erscheinen dann jeden Tag die, bei denen du am längsten nicht warst.</p></div>`
    : `<div class="card ${dialogHeute >= E.dialogProTag ? 'done' : ''}"><b>2. Dialog: ${dialogHeute} von ${E.dialogProTag} heute</b><div class="mu">Ein echter Kommentar zählt mehr als zehn Likes.</div>${wer.map(a => `<div class="row"><div style="flex:1"><b>${esc(a.name)}</b><span class="tag">${a.groesse === 'groesser' ? 'größer, restacken' : 'ähnlich groß'}</span><div class="mu">${a.letzter ? 'zuletzt ' + datDE(a.letzter) : 'noch nie'}</div></div>${a.url ? `<button class="btn alt s" onclick="window.open('${esc(a.url)}','_blank')">Öffnen</button>` : ''}<button class="btn s" onclick="kommentiert('${a.id}')">Kommentiert</button></div>`).join('') || '<p class="mu">Für heute geschafft.</p>'}</div>`;
  const k3 = boostHeute ? `<div class="card ${T.boost ? 'done' : ''}"><b>3. Heute ist Boost-Tag (${WT[wd]})</b><div class="mu">Link zur eigenen Note im Boost-Thread teilen, mindestens drei andere Notes lesen und liken, bei Resonanz kommentieren.</div><div class="row"><button class="btn ${T.boost ? 'alt' : ''}" onclick="boostTag()">${T.boost ? '✓ Erledigt' : 'Boost erledigt'}</button></div></div>` : `<p class="mu">Boost-Tag ist ${WT[E.boosttag]}.</p>`;
  const w = []; for (let i = 0; i < 7; i++) w.push(vorTagen(i));
  const np = D.notes.filter(n => gepostet(n) && w.includes(tag(n))).length, nd = D.autoren.filter(a => w.includes(a.letzter)).length, nb = w.filter(d => D.tage[d] && D.tage[d].boost).length;
  return `${k1}${k2}${k3}<div class="sum">Letzte 7 Tage: ${np} Notes gepostet · ${nd} Autoren kommentiert · ${nb} Boost${nb === 1 ? '' : 's'}</div>`;
}
function kommentiert(id) { const a = findA(id); a.letzter = heute(); a.geaendert = Date.now(); save(); render(); }
function boostTag() { const h = heute(); D.tage[h] = D.tage[h] || {}; D.tage[h].boost = !D.tage[h].boost; save(); render(); }

/* ---------- Notes ---------- */
function viewNotes() {
  const L = D.notes.filter(n => !FIL || n.status === FIL).sort((a, b) => (b.erstellt || 0) - (a.erstellt || 0));
  const z = s => D.notes.filter(n => n.status === s).length;
  return `<button class="btn big" onclick="neueNote()">＋ Neue Note</button>
  <div class="chips"><button class="${FIL === '' ? 'on' : ''}" onclick="FIL='';render()">Alle (${D.notes.length})</button>${STAT.map(s => `<button class="${FIL === s ? 'on' : ''}" onclick="FIL='${s}';render()">${s} (${z(s)})</button>`).join('')}</div>
  ${L.map(n => `<div class="card" onclick="openNote('${n.id}')"><div>${esc((n.text || n.stichworte || '(leer)').slice(0, 110))}</div><div><span class="tag">${n.sprache}</span><span class="tag">${esc(n.strang)}</span><span class="tag">${esc(TYP[n.typ])}</span><span class="tag">${n.status}${gepostet(n) ? ' ' + datDE(n.gepostet) : ''}</span>${gepostet(n) && num(n.likes) != null ? `<span class="tag">♥ ${n.likes}</span>` : ''}</div></div>`).join('') || '<p class="mu">Noch keine Notes in dieser Ansicht.</p>'}`;
}
function neueNote(typ, strang, sprache) {
  const v = vorschlag(), n = { id: uid(), sprache: sprache || v.sprache, strang: strang || v.strang, typ: typ || v.typ, stichworte: '', text: '', status: 'Idee', geplant: '', gepostet: '', likes: '', komm: '', impr: '', abos: '', boost: false, fb: false, erstellt: Date.now(), geaendert: Date.now() };
  D.notes.push(n); save(); openNote(n.id);
}
function ovShow(h) { const o = $('#ov'); o.innerHTML = `<div class="sheet">${h}</div>`; o.style.display = 'block'; o.scrollTop = 0; document.body.style.overflow = 'hidden'; }
function ovClose() { const o = $('#ov'); o.style.display = 'none'; o.innerHTML = ''; document.body.style.overflow = ''; CUR = null; render(); }
let CUR = null;
const sel = (opts, cur, fn, lab) => `<select onchange="${fn}(this.value)">${opts.map(o => { const v = Array.isArray(o) ? o[0] : o, l = Array.isArray(o) ? o[1] : o; return `<option value="${esc(v)}" ${v === cur ? 'selected' : ''}>${esc(lab ? lab(l) : l)}</option>`; }).join('')}</select>`;
function openNote(id) { CUR = id; noteHtml(); }
function noteHtml() {
  const n = findN(CUR); if (!n) return;
  const zahlen = gepostet(n) ? `<h3 style="margin:22px 0 4px">Zahlen (später nachtragen)</h3>
  <div class="row"><div style="flex:1;min-width:110px"><label>Likes</label><input type="number" inputmode="numeric" value="${esc(n.likes)}" oninput="nSet('likes',this.value)"></div><div style="flex:1;min-width:110px"><label>Kommentare</label><input type="number" inputmode="numeric" value="${esc(n.komm)}" oninput="nSet('komm',this.value)"></div></div>
  <div class="row"><div style="flex:1;min-width:110px"><label>Impressionen</label><input type="number" inputmode="numeric" value="${esc(n.impr)}" oninput="nSet('impr',this.value)"></div><div style="flex:1;min-width:110px"><label>Neue Abonnenten</label><input type="number" inputmode="numeric" value="${esc(n.abos)}" oninput="nSet('abos',this.value)"></div></div>
  <label>Gepostet am</label><input type="datetime-local" value="${esc(n.gepostet)}" onchange="nSet('gepostet',this.value)">
  <div class="ck" style="margin-top:12px"><input type="checkbox" style="width:24px;min-height:24px" ${n.boost ? 'checked' : ''} onchange="nSet('boost',this.checked)"><span>Diese Note wurde geboostet</span></div>` : '';
  ovShow(`<div class="row"><button class="btn s" onclick="ovClose()">← Fertig</button><span class="mu" style="flex:1;text-align:right">wird von selbst gespeichert</span></div>
  <div class="row"><div style="flex:1;min-width:120px"><label>Sprache</label>${sel(SPR, n.sprache, 'nSetR_sprache', x => SPRN[x])}</div><div style="flex:1;min-width:120px"><label>Strang</label>${sel(STR, n.strang, 'nSetR_strang')}</div></div>
  <label>Notiztyp</label>${sel(Object.entries(TYP), n.typ, 'nSetR_typ')}<p class="mu" style="margin:4px 0 0">${esc(TYPHINT[n.typ])}</p>
  <label>Stichworte / Material (für Gemini)</label><textarea oninput="nSet('stichworte',this.value)" placeholder="Was ist passiert? Was soll die Note sagen?">${esc(n.stichworte)}</textarea>
  <div class="row"><button class="btn alt s" onclick="kopierePrompt()">📋 Gemini-Auftrag kopieren</button></div>
  <label>Text der Note</label><textarea id="nt" style="min-height:190px" oninput="nSet('text',this.value);zaehl()">${esc(n.text)}</textarea><div class="mu" id="nz"></div>
  <div class="row"><div style="flex:1;min-width:120px"><label>Stand</label>${sel(STAT, n.status, 'nSetR_status')}</div><div style="flex:1;min-width:120px"><label>Geplant für</label><input type="date" value="${esc(n.geplant)}" onchange="nSet('geplant',this.value)"></div></div>
  <div class="row" style="margin-top:14px"><button class="btn big" onclick="posten('${n.id}')">Kopieren und Substack öffnen</button></div>
  <div class="row"><button class="btn alt" style="flex:1" onclick="habGepostet('${n.id}')">Habe gepostet</button><button class="btn alt" style="flex:1" onclick="fbText()">Facebook-Text kopieren</button></div>${zahlen}
  <div class="row" style="margin-top:26px"><button class="btn grau s" id="dl" onclick="nLoeschen()">Note löschen</button></div>`);
  zaehl();
}
function zaehl() { const e = $('#nz'), t = ($('#nt') || {}).value || ''; if (e) e.textContent = t.length + ' Zeichen · ' + (t.trim() ? t.trim().split(/\s+/).length : 0) + ' Wörter'; }
let dT; function nSet(k, v) { const n = findN(CUR); if (!n) return; n[k] = v; n.geaendert = Date.now(); clearTimeout(dT); dT = setTimeout(save, 400); }
function nSetR(k, v) { nSet(k, v); save(); noteHtml(); }
const nSetR_sprache = v => nSetR('sprache', v), nSetR_strang = v => nSetR('strang', v), nSetR_typ = v => nSetR('typ', v), nSetR_status = v => { const n = findN(CUR); if (v === 'Gepostet' && !n.gepostet) n.gepostet = jetzt(); nSetR('status', v); };
function geminiPrompt(n) {
  const stil = n.sprache === 'DE' ? 'Verwende deutsche Anführungszeichen („so“) und keine Gendersprache. ' : n.sprache === 'GL' ? 'Schreibe normatives Galicisch ohne Hispanismen und ohne Anglizismen. ' : n.sprache === 'ES' ? 'Vermeide Anglizismen. ' : '';
  return `Du schreibst eine Substack Note für Steffen Pfeiffer, Journalist und Pilger in Fisterra an der Costa da Morte in Galicien. Seine Stimme: trocken, mit galicischer Retranca, direkt, ohne Gefühlsduselei.

Sprache der Note: ${SPRN[n.sprache]}. ${stil}
Strang: ${n.strang}
Notiztyp: ${TYP[n.typ]}. ${TYPHINT[n.typ]}
Material von Steffen: ${n.stichworte.trim() || '(keines, schlage ein passendes Thema aus dem Strang vor)'}

Regeln: 40 bis 90 Wörter, ein einziger Gedanke, keine Liste, keine Hashtags, kein Emoji-Feuerwerk. Der erste Satz muss ohne Kontext funktionieren. Am Ende steht eine Erkenntnis oder eine offene Frage an die Leser. Erfinde keine Fakten und keine Zahlen. Liefere drei Varianten, nummeriert.`;
}
async function kopierePrompt() { const n = findN(CUR); msg(await kopie(geminiPrompt(n)) ? 'Auftrag kopiert. In Gemini einfügen, die beste Variante hier als Text einfügen.' : 'Kopieren hat nicht geklappt.', 0); }
async function fbText() { const n = findN(CUR); if (!n.text.trim()) { msg('Die Note hat noch keinen Text.', 1); return; } const t = n.text.trim() + '\n\nMehr dazu bei Substack' + (D.einst.url ? ': ' + D.einst.url : '.'); n.fb = true; save(); msg(await kopie(t) ? 'Facebook-Text kopiert.' : 'Kopieren hat nicht geklappt.', 0); }
async function posten(id) {
  const n = findN(id); if (!n || !n.text.trim()) { msg('Die Note hat noch keinen Text.', 1); return; }
  if (n.status === 'Idee' || n.status === 'Entwurf') { n.status = 'Bereit'; n.geaendert = Date.now(); save(); }
  const ok = await kopie(n.text.trim());
  window.open('https://substack.com/notes', '_blank');
  msg(ok ? 'Text kopiert. In Substack einfügen und absenden, danach hier „Habe gepostet“ tippen.' : 'Kopieren hat nicht geklappt. Bitte den Text von Hand kopieren.', !ok);
}
function habGepostet(id) { const n = findN(id); if (!n) return; n.status = 'Gepostet'; if (!n.gepostet) n.gepostet = jetzt(); n.geaendert = Date.now(); save(); msg('Als gepostet vermerkt. Die Zahlen kannst du in ein paar Tagen nachtragen.'); if (CUR) noteHtml(); else render(); }
function nLoeschen() {
  const b = $('#dl'); if (b.dataset.s !== '1') { b.dataset.s = '1'; b.textContent = 'Wirklich löschen? Nochmal tippen'; b.style.color = '#b3261e'; setTimeout(() => { if (b && b.isConnected) { b.dataset.s = ''; b.textContent = 'Note löschen'; b.style.color = ''; } }, 4000); return; }
  D.notes = D.notes.filter(x => x.id !== CUR); D.geloescht.push({ id: CUR, t: Date.now() }); save(); ovClose(); msg('Gelöscht.');
}

/* ---------- Dialog ---------- */
function viewDialog() {
  const L = [...D.autoren].sort((a, b) => (a.letzter || '').localeCompare(b.letzter || ''));
  return `<div class="card"><b>Autor hinzufügen</b><label>Name</label><input id="an"><label>Link zur Substack-Seite</label><input id="au" placeholder="https://…substack.com" autocapitalize="off" autocorrect="off"><label>Größe</label><select id="ag"><option value="aehnlich">ähnlich groß wie ich</option><option value="groesser">größer, deren Notes restacke ich</option></select><div class="row"><button class="btn" onclick="autorNeu()">Speichern</button></div></div>
  ${L.map(a => `<div class="card"><b>${esc(a.name)}</b><span class="tag">${a.groesse === 'groesser' ? 'größer' : 'ähnlich'}</span><div class="mu">${a.letzter ? 'zuletzt kommentiert: ' + datDE(a.letzter) : 'noch nie kommentiert'}</div><div class="row">${a.url ? `<button class="btn alt s" onclick="window.open('${esc(a.url)}','_blank')">Öffnen</button>` : ''}<button class="btn s" onclick="kommentiert('${a.id}')">Heute kommentiert</button><button class="btn grau s" onclick="autorWeg('${a.id}')">Entfernen</button></div></div>`).join('') || '<p class="mu">Noch keine Autoren. Such dir fünf bis zehn aus deiner Nische, bei denen du ehrlich etwas zu sagen hast (Camino, Galicien, Sprachen, Übersetzung, KI und Qualität).</p>'}`;
}
function autorNeu() {
  const name = $('#an').value.trim(); if (!name) { msg('Bitte einen Namen eintragen.', 1); return; }
  let url = $('#au').value.trim(); if (url && !/^https?:\/\//.test(url)) url = 'https://' + url;
  D.autoren.push({ id: uid(), name, url, groesse: $('#ag').value, letzter: '', geaendert: Date.now() }); save(); render();
}
function autorWeg(id) { D.autoren = D.autoren.filter(a => a.id !== id); D.geloescht.push({ id, t: Date.now() }); save(); render(); }

/* ---------- Auswertung ---------- */
const block = n => { const h = Number((n.gepostet || '').slice(11, 13)); return isNaN(h) ? '' : h < 11 ? 'Morgen (vor 11)' : h < 16 ? 'Mittag (11–16)' : 'Abend (ab 16)'; };
function gruppen(liste, f, namen) {
  const m = {}; liste.forEach(n => { const k = f(n); if (k === '' || k == null) return; (m[k] = m[k] || []).push(n); });
  return Object.keys(m).map(k => { const a = m[k], av = fn => { const w = a.map(fn).filter(v => v != null); return w.length ? w.reduce((s, v) => s + v, 0) / w.length : null; }; return { k: namen ? (namen[k] || k) : k, n: a.length, likes: av(x => num(x.likes)), komm: av(x => num(x.komm)), abos: av(x => num(x.abos)) }; }).sort((a, b) => (b.abos || 0) - (a.abos || 0) || (b.likes || 0) - (a.likes || 0));
}
const f1 = v => v == null ? '–' : (Math.round(v * 10) / 10).toString().replace('.', ',');
function tabelle(titel, g) {
  if (!g.length) return '';
  const best = g.length > 1 ? g[0].k : null;
  return `<h3 style="margin:18px 0 2px">${titel}</h3><table><tr><th></th><th>Anz.</th><th>Ø ♥</th><th>Ø 💬</th><th>Ø Abos</th></tr>${g.map(r => `<tr><td class="${r.k === best && r.n >= 3 ? 'b' : ''}">${esc(r.k)}</td><td>${r.n}</td><td>${f1(r.likes)}</td><td>${f1(r.komm)}</td><td>${f1(r.abos)}</td></tr>`).join('')}</table>`;
}
const mitZahlen = () => D.notes.filter(n => gepostet(n) && (num(n.likes) != null || num(n.abos) != null || num(n.komm) != null));
function viewAuswertung() {
  const P = D.notes.filter(gepostet), Z = mitZahlen();
  if (!P.length) return `<div class="sum">Noch keine Auswertung möglich. Sobald du Notes gepostet und ihre Zahlen nachgetragen hast, siehst du hier, welcher Typ, welche Sprache und welche Tageszeit bei dir am besten läuft.</div>`;
  const wochen = []; for (let i = 3; i >= 0; i--) { const von = vorTagen(i * 7 + 6), bis = vorTagen(i * 7); const w = P.filter(n => tag(n) >= von && tag(n) <= bis); wochen.push(`<tr><td>${datDE(von).slice(0, 5)}–${datDE(bis).slice(0, 5)}</td><td>${w.length}</td><td>${w.reduce((s, n) => s + (num(n.abos) || 0), 0)}</td></tr>`); }
  const wenig = Z.length < 8 ? `<div class="sum">Bisher ${Z.length} Notes mit Zahlen. Unter etwa 8 bis 10 sind die Unterschiede Zufall. Ein fett markierter Wert zählt erst ab drei Notes je Gruppe.</div>` : '';
  return `${wenig}<div class="sum">${P.length} Notes gepostet, davon ${Z.length} mit Zahlen. Neue Abonnenten insgesamt über Notes: ${P.reduce((s, n) => s + (num(n.abos) || 0), 0)}.</div>
  ${tabelle('Nach Notiztyp', gruppen(Z, n => n.typ, TYP))}${tabelle('Nach Sprache', gruppen(Z, n => n.sprache, SPRN))}${tabelle('Nach Strang', gruppen(Z, n => n.strang))}${tabelle('Nach Tageszeit', gruppen(Z, block))}${tabelle('Mit und ohne Boost', gruppen(Z, n => n.boost ? 'mit Boost' : 'ohne Boost'))}
  <h3 style="margin:18px 0 2px">Die letzten vier Wochen</h3><table><tr><th>Woche</th><th>Notes</th><th>Neue Abos</th></tr>${wochen.join('')}</table>
  <div class="row" style="margin-top:20px"><button class="btn" onclick="claudeKopie()">Für Claude auswerten (kopieren)</button></div>
  <p class="mu">Der Text enthält alle Notes mit Zahlen und die Fragen an Claude. Einfach im Chat einfügen.</p>`;
}
function exportMd() {
  const P = D.notes.filter(gepostet).sort((a, b) => (a.gepostet || '').localeCompare(b.gepostet || ''));
  const z = ['# Substack Notes – Daten zur Auswertung', '', 'Stand: ' + datDE(heute()) + ', ' + P.length + ' gepostete Notes.', '', '| Datum/Zeit | Sprache | Strang | Typ | Boost | Likes | Komm. | Impr. | Abos | Text |', '|---|---|---|---|---|---|---|---|---|---|'];
  P.forEach(n => z.push(`| ${(n.gepostet || '').replace('T', ' ')} | ${n.sprache} | ${n.strang} | ${TYP[n.typ]} | ${n.boost ? 'ja' : 'nein'} | ${n.likes} | ${n.komm} | ${n.impr} | ${n.abos} | ${(n.text || '').replace(/\s+/g, ' ').replace(/\|/g, '/').slice(0, 160)} |`));
  z.push('', 'Dialog: ' + D.autoren.length + ' Autoren in der Liste, in den letzten 7 Tagen kommentiert: ' + D.autoren.filter(a => a.letzter >= vorTagen(6)).length + '.');
  return z.join('\n');
}
async function claudeKopie() {
  const t = exportMd() + `\n\n## Aufgabe\n\nSteffens Substack hat wenige Abonnenten, seine größte Reichweite liegt auf Facebook. Bitte:\n1. Finde Muster: Welcher Notiztyp, welche Sprache, welcher Strang und welche Tageszeit bringen Likes, Kommentare und neue Abonnenten?\n2. Sage ehrlich, wo die Datenmenge für eine Aussage nicht reicht.\n3. Schlage für die nächsten 7 Tage einen Plan vor: je Tag Typ, Strang, Sprache und ein Thema, das zu den besten Mustern passt.\n4. Nenne zwei Notes, die man in einer anderen Sprache wiederholen sollte.`;
  msg(await kopie(t) ? 'Kopiert. Jetzt bei Claude einfügen.' : 'Kopieren hat nicht geklappt.', 0);
}

/* ---------- Mehr: Einstellungen und Abgleich ---------- */
function viewMehr() {
  const E = D.einst;
  return `<div class="sum"><b>Einstellungen</b>
  <label>Deine Substack-Adresse (für den Facebook-Text)</label><input value="${esc(E.url)}" oninput="eSet('url',this.value)" placeholder="https://….substack.com" autocapitalize="off" autocorrect="off">
  <label>In diesen Sprachen schreibst du Notes</label><div class="chips">${SPR.map(s => `<button class="${E.sprachen.includes(s) ? 'on' : ''}" onclick="eSpr('${s}')">${SPRN[s]}</button>`).join('')}</div>
  <label>Boost-Tag</label><select onchange="eSet('boosttag',Number(this.value))">${WT.map((w, i) => `<option value="${i}" ${i === Number(E.boosttag) ? 'selected' : ''}>${w}</option>`).join('')}</select>
  <label>Kommentare pro Tag (Ziel)</label><select onchange="eSet('dialogProTag',Number(this.value))">${[1, 2, 3, 4, 5].map(i => `<option ${i === Number(E.dialogProTag) ? 'selected' : ''}>${i}</option>`).join('')}</select></div>
  <div class="sum"><b>Abgleich mit Google Drive</b><div class="mu" id="drvst">${esc(DRV.st || '')}</div>
  <p class="mu">Alles wird von selbst im Drive-Ordner „Substack-Notes“ gesichert. Dort liegt auch die Datei „notes-auswertung.md“, die Claude lesen kann.</p>
  <label>Verbindungsadresse (einmalig eintragen)</label><input id="drvurl" value="${esc(DRV.url)}" placeholder="https://script.google.com/macros/s/…/exec" autocapitalize="off" autocorrect="off" spellcheck="false">
  <div class="row"><button class="btn" onclick="drvSetze()">${DRV.url ? 'Jetzt abgleichen' : 'Verbinden'}</button></div></div>`;
}
function eSet(k, v) { D.einst[k] = v; save(); }
function eSpr(s) { const a = D.einst.sprachen; D.einst.sprachen = a.includes(s) ? a.filter(x => x !== s) : [...a, s]; if (!D.einst.sprachen.length) D.einst.sprachen = [s]; save(); render(); }

const URL0 = 'https://script.google.com/macros/s/AKfycbwXl6wvYj9gMHTHwL0wfTCqcwdtAe8Tp5fnYUGtbuVEzkg8leIUlgnIh4cj-wyznfE/exec';
const DRV = { app: 'notes', url: (() => { try { return localStorage.getItem('nw_url') || URL0; } catch (e) { return URL0; } })(), busy: false, t: null, st: '' };
const drvPost = async b => { const r = await fetch(DRV.url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(Object.assign({ app: DRV.app }, b)) }); const j = await r.json(); if (!j.ok) throw new Error(j.err || 'Fehler'); return j; };
const drvGetF = async f => { const r = await fetch(DRV.url + (DRV.url.includes('?') ? '&' : '?') + 'a=get&app=' + DRV.app + '&f=' + encodeURIComponent(f) + '&_=' + Date.now()); const j = await r.json(); return j.ok ? JSON.parse(j.text) : null; };
function drvSoon(ms) { if (!DRV.url) return; clearTimeout(DRV.t); DRV.t = setTimeout(() => drvSync(), ms || 3000); }
function drvShow() { const e = $('#drvst'); if (e) e.textContent = DRV.st; }
function drvSetze() {
  const u = ($('#drvurl').value || '').trim();
  if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(u)) { msg('Das ist keine gültige Verbindungsadresse.', 1); return; }
  DRV.url = u; try { localStorage.setItem('nw_url', u); } catch (e) { } DRV.st = 'Abgleich läuft …'; drvShow(); drvSync(true);
}
function mergeMaster(m) {
  let ch = false;
  const tomb = (arr, id) => arr.some(g => g.id === id);
  for (const g of m.geloescht || []) { if (!tomb(D.geloescht, g.id)) { D.geloescht.push(g); ch = true; } const ln = findN(g.id); if (ln && (ln.geaendert || 0) <= g.t) { D.notes = D.notes.filter(x => x.id !== g.id); ch = true; } const la = findA(g.id); if (la && (la.geaendert || 0) <= g.t) { D.autoren = D.autoren.filter(x => x.id !== g.id); ch = true; } }
  const mix = (lokal, fern, find) => { for (const r of fern || []) { if (D.geloescht.some(g => g.id === r.id && g.t >= (r.geaendert || 0))) continue; const l = find(r.id); if (!l) { lokal.push(r); ch = true; } else if ((r.geaendert || 0) > (l.geaendert || 0)) { Object.assign(l, r); ch = true; } } };
  mix(D.notes, m.notes, findN); mix(D.autoren, m.autoren, findA);
  if (m.einst && (m.stand || 0) > (D.stand || 0)) { D.einst = Object.assign(D.einst, m.einst); ch = true; }
  return ch;
}
async function drvSync(manuell) {
  if (!DRV.url || DRV.busy || (document.hidden && !manuell)) return;
  if (CUR) { clearTimeout(DRV.t); DRV.t = setTimeout(() => drvSync(), 6000); return; }
  DRV.busy = true; let neu = false;
  try {
    DRV.st = 'Abgleich läuft …'; drvShow();
    const m = await drvGetF('notes-daten.json');
    if (m && Array.isArray(m.notes)) { QUIET = true; neu = mergeMaster(m); if (neu) save(); QUIET = false; }
    const mh = hash(JSON.stringify({ n: D.notes, a: D.autoren, g: D.geloescht, e: D.einst }));
    if (lsGet('nw_mpushed', '') !== mh) { await drvPost({ name: 'notes-daten.json', text: JSON.stringify(D) }); await drvPost({ name: 'notes-auswertung.md', text: exportMd() }); lsSet('nw_mpushed', mh); }
    const z = new Date(); DRV.st = 'Verbunden. Letzter Abgleich: ' + p2(z.getHours()) + ':' + p2(z.getMinutes());
    if (neu && !CUR) render();
  } catch (e) { QUIET = false; DRV.st = 'Verbindung fehlgeschlagen: ' + (e && e.message || e); }
  DRV.busy = false; drvShow();
}

/* ---------- Start ---------- */
render();
try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) { }
setTimeout(() => drvSync(), 1500); setInterval(() => drvSync(), 60000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) { drvSoon(800); if (TAB === 'heute' && !CUR) render(); } });
