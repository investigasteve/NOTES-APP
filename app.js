/* Notes-Werkstatt (Handy-App): Substack Notes planen, schreiben, posten, auswerten. Abgleich über die Drive-Brücke. */
'use strict';
const VER = 'v3';
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
const leer = () => ({ format: 'notes', version: 1, stand: 0, notes: [], autoren: [], mappen: [], gedanken: [], geloescht: [], einst: { url: '', sprachen: ['DE', 'EN'], boosttag: 4, dialogProTag: 3 }, tage: {} });
let D = (() => { const j = lsGet('nw_data', null); if (j && Array.isArray(j.notes)) { const l = leer(); j.einst = Object.assign(l.einst, j.einst || {}); j.tage = j.tage || {}; j.autoren = j.autoren || []; j.mappen = j.mappen || []; j.gedanken = j.gedanken || []; j.geloescht = j.geloescht || []; return j; } return leer(); })();
let QUIET = false;
function save() { D.stand = Date.now(); try { localStorage.setItem('nw_data', JSON.stringify(D)); } catch (e) { msg('Der Speicher im Handy ist voll.', 1); } if (!QUIET) drvSoon(4000); }
const findN = id => D.notes.find(n => n.id === id);
const findA = id => D.autoren.find(a => a.id === id);
const findM = id => D.mappen.find(m => m.id === id);
const findG = id => D.gedanken.find(g => g.id === id);
const gepostet = n => n.status === 'Gepostet';
const tag = n => (n.gepostet || '').slice(0, 10);

/* ---------- Kopieren ---------- */
async function kopie(t) { try { await navigator.clipboard.writeText(t); return true; } catch (e) { const a = document.createElement('textarea'); a.value = t; a.style.position = 'fixed'; a.style.opacity = '0'; document.body.appendChild(a); a.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (x) { } a.remove(); return ok; } }

/* ---------- Ansicht ---------- */
let TAB = 'heute', FIL = '';
const TABS = [['heute', '📅 Heute'], ['notes', '✏️ Notes'], ['gedanken', '🎙 Gedanken'], ['dialog', '💬 Dialog'], ['auswertung', '📊 Zahlen'], ['mehr', '⚙ Mehr']];
function render() {
  $('#hs').textContent = 'Substack Notes · ' + VER;
  $('#nv').innerHTML = TABS.map(([k, n]) => `<button class="${TAB === k ? 'on' : ''}" onclick="TAB='${k}';render()">${n}</button>`).join('');
  $('#m').innerHTML = { heute: viewHeute, notes: viewNotes, gedanken: viewGedanken, dialog: viewDialog, auswertung: viewAuswertung, mehr: viewMehr }[TAB]();
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
function ovClose() { const o = $('#ov'); o.style.display = 'none'; o.innerHTML = ''; document.body.style.overflow = ''; if (GD && GD.url) URL.revokeObjectURL(GD.url); CUR = null; GD = null; render(); }
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

/* ---------- Gedanken: Aufnahmen und Texte, nach Mappen (Themen) geordnet ---------- */
const ARTEN = ['Artikel', 'Buch', 'Notes-Material', 'Sonstiges'];
const mmss = s => { s = Math.max(0, Math.round(s || 0)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return (h ? h + ':' + p2(m) : m) + ':' + p2(s % 60); };
const toB64 = b => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.onerror = () => rej(r.error); r.readAsDataURL(b); });
let _db; const db = () => _db || (_db = new Promise((res, rej) => { const r = indexedDB.open('nw', 1); r.onupgradeneeded = () => { r.result.createObjectStore('blobs'); r.result.createObjectStore('chunks'); }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }));
const idb = async (st, mode, f) => { const d = await db(); return new Promise((res, rej) => { const tx = d.transaction(st, mode); const q = f(tx.objectStore(st)); tx.oncomplete = () => res(q && q.result); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error); }); };
const bPut = (k, v) => idb('blobs', 'readwrite', s => s.put(v, k)), bGet = k => idb('blobs', 'readonly', s => s.get(k)), bDel = k => idb('blobs', 'readwrite', s => s.delete(k));
const cPut = (k, v) => idb('chunks', 'readwrite', s => s.put(v, k)), cDel = k => idb('chunks', 'readwrite', s => s.delete(k));
async function cAll() { const d = await db(); return new Promise(res => { const o = {}; const tx = d.transaction('chunks'); const r = tx.objectStore('chunks').openCursor(); r.onsuccess = () => { const c = r.result; if (c) { o[c.key] = c.value; c.continue(); } }; tx.oncomplete = () => res(o); tx.onerror = () => res(o); }); }
let GM = null, GD = null;
const titelG = g => g.titel || (g.transkript || '').trim().slice(0, 45) || ('Gedanke vom ' + datDE(g.datum));
const mappenName = id => id ? (findM(id) || {}).name || '(Mappe fehlt)' : 'Eingang (ohne Mappe)';
const inMappe = id => D.gedanken.filter(g => (g.mappe || '') === id).sort((a, b) => (a.datum || '').localeCompare(b.datum || '') || (a.erstellt || 0) - (b.erstellt || 0));

function viewGedanken() {
  if (GM === null) {
    const eing = inMappe('').length;
    return `<div class="sum">Sammle hier Gedanken, Beobachtungen und Spaziergänge als Aufnahme oder Text. Jede Mappe ist ein Thema. Später wird daraus ein Artikel, ein Buchkapitel oder Material für Notes.</div>
    <button class="btn big rot" onclick="recOpen('')">● Schnell aufnehmen</button>
    <div class="card"><b>Neue Mappe</b><label>Name des Themas</label><input id="mn" placeholder="z. B. Spaziergang zum Cabo"><label>Wofür?</label><select id="ma">${ARTEN.map(a => `<option>${a}</option>`).join('')}</select><div class="row"><button class="btn" onclick="mappeNeu()">Mappe anlegen</button></div></div>
    ${D.mappen.slice().sort((a, b) => (b.geaendert || 0) - (a.geaendert || 0)).map(m => { const n = inMappe(m.id); return `<div class="card" onclick="GM='${m.id}';render()"><b>${esc(m.name)}</b><span class="tag">${esc(m.art)}</span><div class="mu">${n.length} Gedanke${n.length === 1 ? '' : 'n'}${n.filter(g => g.audio && !(g.transkript || '').trim()).length ? ' · ' + n.filter(g => g.audio && !(g.transkript || '').trim()).length + ' ohne Text' : ''}</div></div>`; }).join('')}
    ${eing ? `<div class="card" onclick="GM='';render()"><b>Eingang</b><span class="tag">noch ohne Mappe</span><div class="mu">${eing} Gedanke${eing === 1 ? '' : 'n'}</div></div>` : ''}`;
  }
  const m = GM ? findM(GM) : null, L = inMappe(GM), mitText = L.filter(g => (g.transkript || '').trim()), art = m ? m.art : 'Sonstiges';
  return `<div class="row"><button class="btn s" onclick="GM=null;render()">← Alle Mappen</button></div>
  ${m ? `<label>Name der Mappe</label><input value="${esc(m.name)}" oninput="mSet('name',this.value)"><label>Wofür?</label><select onchange="mSet('art',this.value);render()">${ARTEN.map(a => `<option ${a === m.art ? 'selected' : ''}>${a}</option>`).join('')}</select>` : `<h3 style="margin:8px 0">Eingang</h3><p class="mu">Hier landen Schnellaufnahmen. Im Gedanken kannst du sie einer Mappe zuordnen.</p>`}
  <div class="row" style="margin-top:14px"><button class="btn rot" style="flex:1" onclick="recOpen('${GM}')">● Aufnehmen</button><button class="btn alt" style="flex:1" onclick="gedNeuText()">＋ Text</button></div>
  ${L.map((g, i) => `<div class="card" onclick="openGed('${g.id}')"><b>${i + 1}. ${esc(titelG(g))}</b><div class="mu">${datDE(g.datum)}${g.audio ? ' · 🎙 ' + mmss(g.audio.sek) : ''}${g.audio && !(g.transkript || '').trim() ? ' · <b style="color:var(--rot)">Text fehlt</b>' : ''}</div>${(g.transkript || '').trim() ? `<div class="mu">${esc(g.transkript.trim().slice(0, 100))}${g.transkript.trim().length > 100 ? '…' : ''}</div>` : ''}</div>`).join('') || '<p class="mu">Noch nichts in dieser Mappe.</p>'}
  ${mitText.length ? `<div class="sum"><b>Fertig machen</b><div class="mu">Der Auftrag enthält alle ${mitText.length} Texte der Mappe in der Reihenfolge der Aufnahmen. In Gemini einfügen.</div>
  <div class="row"><button class="btn" onclick="gAuftrag('artikel')">📋 Artikelauftrag kopieren</button></div>
  ${art === 'Buch' ? `<div class="row"><button class="btn alt" onclick="gAuftrag('kapitel')">📋 Kapitelauftrag kopieren</button></div>` : ''}
  <div class="row"><button class="btn alt" onclick="gAuftrag('notes')">📋 Notes-Ideen kopieren</button><button class="btn grau" onclick="gAuftrag('roh')">Alle Texte kopieren</button></div></div>` : ''}
  ${m ? `<div class="row" style="margin-top:22px"><button class="btn grau s" id="ml" onclick="mappeWeg()">Mappe auflösen</button></div>` : ''}`;
}
function mappeNeu() { const name = ($('#mn').value || '').trim(); if (!name) { msg('Bitte einen Namen für das Thema eintragen.', 1); return; } const m = { id: uid(), name, art: $('#ma').value, geaendert: Date.now() }; D.mappen.push(m); save(); GM = m.id; render(); }
function mSet(k, v) { const m = findM(GM); if (!m) return; m[k] = v; m.geaendert = Date.now(); clearTimeout(dT); dT = setTimeout(save, 400); }
function mappeWeg() {
  const b = $('#ml'); if (b.dataset.s !== '1') { b.dataset.s = '1'; b.textContent = 'Wirklich? Die Gedanken wandern in den Eingang. Nochmal tippen'; b.style.color = '#b3261e'; setTimeout(() => { if (b && b.isConnected) { b.dataset.s = ''; b.textContent = 'Mappe auflösen'; b.style.color = ''; } }, 4000); return; }
  D.gedanken.filter(g => g.mappe === GM).forEach(g => { g.mappe = ''; g.geaendert = Date.now(); });
  D.mappen = D.mappen.filter(x => x.id !== GM); D.geloescht.push({ id: GM, t: Date.now() }); GM = null; save(); render(); msg('Mappe aufgelöst.');
}
function gNeu(o) { const g = Object.assign({ id: uid(), mappe: GM || '', titel: '', datum: heute(), transkript: '', notiz: '', audio: null, erstellt: Date.now(), geaendert: Date.now() }, o || {}); D.gedanken.push(g); save(); return g; }
function gedNeuText() { const g = gNeu(); openGed(g.id); }
async function gAuftrag(art) {
  const L = inMappe(GM).filter(g => (g.transkript || '').trim()), name = GM ? findM(GM).name : 'Eingang';
  const stoff = L.map((g, i) => `### Gedanke ${i + 1}${g.titel ? ': ' + g.titel : ''} (${datDE(g.datum)})\n${g.transkript.trim()}`).join('\n\n');
  const kopf = `Du bist Schreibpartner von Steffen Pfeiffer, Journalist und Pilger in Fisterra an der Costa da Morte in Galicien. Verwende dafür deinen Schreibskill für Steffens Stimme, falls vorhanden. Seine Stimme: trocken, mit galicischer Retranca, direkt, feuilletonistisch, ohne Gefühlsduselei.\nUnten stehen die rohen, gesprochenen Gedanken zum Thema „${name}“ in der Reihenfolge der Aufnahmen.\n\nRegeln: Nutze ausschließlich, was in den Gedanken steht. Erfinde keine Fakten, Zahlen, Namen oder Orte. Wo etwas unklar oder lückenhaft ist, setze [?] und nenne diese Stellen am Ende. Deutsche Anführungszeichen („so“), keine Gendersprache, Fließtext in Absätzen, keine Listen im Text.\n\n`;
  const aufg = { artikel: `Aufgabe: Schreibe daraus einen Substack-Artikel auf Deutsch. Liefere 1) drei Titelvorschläge, 2) den Artikel (ca. 600 bis 1.000 Wörter, je nach Material), 3) die Liste der offenen Fragen.`, kapitel: `Aufgabe: Schreibe daraus den Entwurf eines Buchkapitels auf Deutsch. Liefere 1) eine kurze Gliederung des Kapitels, 2) den Kapiteltext (Länge nach Material, ca. 1.500 bis 2.500 Wörter), 3) die Liste der offenen Fragen und der Stellen, an denen noch Material fehlt.`, notes: `Aufgabe: Schlage aus dem Material fünf Substack Notes vor (je 40 bis 90 Wörter, ein Gedanke, keine Liste, keine Hashtags, der erste Satz muss ohne Kontext funktionieren). Nenne zu jeder Note, welcher Typ es ist: Beobachtung, Zwischenmeldung, „Du bist nicht allein“ oder Meilenstein.` }[art];
  const t = art === 'roh' ? stoff : kopf + aufg + '\n\n' + stoff;
  msg(await kopie(t) ? (art === 'roh' ? 'Alle Texte kopiert.' : 'Auftrag kopiert. Jetzt in Gemini einfügen.') : 'Kopieren hat nicht geklappt.', 0);
}

/* Aufnahme */
let REC = { on: false };
function pickMime() { if (!window.MediaRecorder) return ''; for (const m of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']) if (MediaRecorder.isTypeSupported(m)) return m; return ''; }
const extOf = m => /mp4|aac|m4a/.test(m) ? 'm4a' : /ogg/.test(m) ? 'ogg' : /mpeg|mp3/.test(m) ? 'mp3' : /wav/.test(m) ? 'wav' : 'webm';
function recOpen(mappe) {
  ovShow(`<h2 style="margin-top:4px">Neue Aufnahme</h2><p class="mu">Mappe: <b>${esc(mappenName(mappe))}</b></p>
  <label>Titel (kann auch später ergänzt werden)</label><input id="rp" placeholder="z. B. Am Leuchtturm" autocomplete="off">
  <p class="mu">Die App bitte geöffnet lassen, dann bleibt der Bildschirm an. Du kannst jederzeit pausieren.</p>
  <div class="zeit" id="rz">0:00</div><div class="pegel"><i id="rl"></i></div>
  <div id="rb"><button class="btn big rot" onclick="recStart('${mappe}')">● Aufnahme starten</button><div class="row"><button class="btn grau" style="flex:1" onclick="ovClose()">Abbrechen</button></div></div>`);
}
async function recStart(mappe) {
  const titel = ($('#rp') || {}).value || '';
  if (!navigator.mediaDevices || !window.MediaRecorder) { msg('Dieses Handy kann hier nicht aufnehmen. Bitte Chrome oder Safari verwenden.', 1); return; }
  let stream; try { stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } }); } catch (e) { msg('Das Mikrofon ist nicht freigegeben. Bitte die Freigabe erlauben und noch einmal tippen.', 1); return; }
  const mime = pickMime(); let mr;
  try { mr = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 32000 } : { audioBitsPerSecond: 32000 }); } catch (e) { mr = new MediaRecorder(stream); }
  REC = { on: true, stream, mr, id: uid(), n: 0, parts: [], pp: [], t0: Date.now(), acc: 0, paused: false, titel, mappe, mime: mr.mimeType || mime || 'audio/webm' };
  mr.ondataavailable = e => { if (e.data && e.data.size) { REC.parts.push(e.data); REC.pp.push(cPut(REC.id + ':' + String(REC.n++).padStart(6, '0'), e.data).catch(() => { })); } };
  mr.onstop = recFinish; mr.start(5000);
  try { const AC = window.AudioContext || window.webkitAudioContext; REC.ac = new AC(); const src = REC.ac.createMediaStreamSource(stream); REC.an = REC.ac.createAnalyser(); REC.an.fftSize = 512; src.connect(REC.an); REC.buf = new Uint8Array(REC.an.fftSize); } catch (e) { }
  try { REC.wl = await navigator.wakeLock.request('screen'); } catch (e) { }
  REC.timer = setInterval(recTick, 200);
  $('#rb').innerHTML = `<div class="row"><button class="btn big rot" onclick="recStop()">■ Aufnahme beenden</button></div><div class="row"><button class="btn alt" style="flex:1" id="rpz" onclick="recPause()">⏸ Pause</button></div>`;
  $('#rp').disabled = true;
}
const recSek = () => (REC.acc + (REC.paused ? 0 : Date.now() - REC.t0)) / 1000;
function recTick() { const z = $('#rz'); if (z) z.textContent = mmss(recSek()); if (REC.an) { REC.an.getByteTimeDomainData(REC.buf); let m = 0; for (const v of REC.buf) m = Math.max(m, Math.abs(v - 128)); const l = $('#rl'); if (l) l.style.width = Math.min(100, m * 1.6) + '%'; } }
function recPause() { if (!REC.on) return; if (!REC.paused) { REC.mr.pause(); REC.acc += Date.now() - REC.t0; REC.paused = true; $('#rpz').textContent = '▶ Weiter aufnehmen'; } else { REC.mr.resume(); REC.t0 = Date.now(); REC.paused = false; $('#rpz').textContent = '⏸ Pause'; } }
function recStop() { if (!REC.on) return; const s = Math.round(recSek()); REC.sek = s; REC.on = false; clearInterval(REC.timer); try { if (REC.mr.state !== 'inactive') REC.mr.stop(); } catch (e) { recFinish(); } }
async function recFinish() {
  const R = REC; try { R.stream.getTracks().forEach(t => t.stop()); } catch (e) { } try { R.ac && R.ac.close(); } catch (e) { } try { R.wl && R.wl.release(); } catch (e) { }
  await Promise.all(R.pp);
  const blob = new Blob(R.parts, { type: R.mime.split(';')[0] });
  if (!blob.size) { msg('Es wurde nichts aufgenommen.', 1); ovClose(); return; }
  const aid = uid(), ext = extOf(R.mime);
  const g = gNeu({ mappe: R.mappe || '', titel: R.titel, audio: { id: aid, name: 'gedankenaudio-' + aid + '.' + ext, mime: blob.type, size: blob.size, sek: R.sek || 0 } });
  await bPut(aid, blob);
  for (let i = 0; i < R.n; i++) await cDel(R.id + ':' + String(i).padStart(6, '0')).catch(() => { });
  REC = { on: false }; msg('Aufnahme gespeichert.'); openGed(g.id);
}
async function recRetten() {
  const all = await cAll(), ids = {};
  for (const k of Object.keys(all)) { const [r] = k.split(':'); (ids[r] = ids[r] || []).push(k); }
  for (const r of Object.keys(ids)) {
    if (REC.on && REC.id === r) continue;
    const keys = ids[r].sort();
    if (D.gedanken.some(g => g.audio && g.audio.id === r) || await bGet(r)) { for (const k of keys) await cDel(k).catch(() => { }); continue; }
    const blob = new Blob(keys.map(k => all[k]), { type: all[keys[0]].type || 'audio/webm' });
    if (!blob.size) continue;
    gNeu({ mappe: '', titel: 'Gerettete Aufnahme', audio: { id: r, name: 'gedankenaudio-' + r + '.' + extOf(blob.type), mime: blob.type, size: blob.size, sek: Math.round(blob.size / 4000) } });
    await bPut(r, blob); for (const k of keys) await cDel(k).catch(() => { });
    msg('Eine unterbrochene Aufnahme wurde gerettet.');
  }
  render();
}

/* Gedanke ansehen und bearbeiten */
async function openGed(id) {
  const g = findG(id); if (!g) return;
  const blob = g.audio ? await bGet(g.audio.id).catch(() => null) : null;
  GD = { id, blob, url: blob ? URL.createObjectURL(blob) : '', file: blob ? new File([blob], g.audio.name, { type: blob.type || g.audio.mime }) : null };
  gedHtml();
}
function gedHtml() {
  const g = findG(GD.id); if (!g) return;
  const audio = g.audio ? (GD.blob ? `<audio controls preload="metadata" src="${GD.url}"></audio><div class="row"><button class="btn alt s" onclick="gedSenden()">Aufnahme senden / speichern</button></div>` : `<div class="sum">Die Aufnahme liegt auf dem Gerät, mit dem sie gemacht wurde, und in Google Drive (${esc(g.audio.name)}).</div>`)
    : `<div class="row"><label class="btn alt s" style="margin:0">🎙 Aufnahme aus Datei hinzufügen<input type="file" accept="audio/*,video/*" style="display:none" onchange="gedAudioDatei(this)"></label></div>`;
  ovShow(`<div class="row"><button class="btn s" onclick="ovClose()">← Fertig</button><span class="mu" style="flex:1;text-align:right">wird von selbst gespeichert</span></div>
  <label>Mappe</label><select onchange="gSet('mappe',this.value)"><option value="">Eingang (ohne Mappe)</option>${D.mappen.map(m => `<option value="${m.id}" ${g.mappe === m.id ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select>
  <label>Titel</label><input value="${esc(g.titel)}" placeholder="${esc(titelG(g))}" oninput="gSet('titel',this.value)">
  <label>Datum</label><input type="date" value="${esc(g.datum)}" onchange="gSet('datum',this.value)">
  <h3 style="margin:22px 0 4px">Aufnahme</h3>${audio}
  <h3 style="margin:22px 0 4px">Text</h3><p class="mu" style="margin:0 0 6px">Aufnahme bei Gemini hochladen, den Text kopieren und hier einfügen.</p>
  <div class="row"><button class="btn alt s" onclick="gedEinfuegen()">📋 Text einfügen</button></div>
  <textarea id="gt" style="min-height:220px" oninput="gSet('transkript',this.value)" placeholder="Hier steht der Text des Gedankens oder du tippst ihn direkt ein.">${esc(g.transkript)}</textarea>
  <label>Notizen (nur für uns)</label><textarea oninput="gSet('notiz',this.value)">${esc(g.notiz)}</textarea>
  <div class="row" style="margin-top:26px"><button class="btn grau s" id="gl" onclick="gedLoeschen()">Gedanke löschen</button></div>`);
}
function gSet(k, v) { const g = findG(GD.id); if (!g) return; g[k] = v; g.geaendert = Date.now(); clearTimeout(dT); dT = setTimeout(save, 400); }
async function gedEinfuegen() {
  let tx = ''; try { tx = await navigator.clipboard.readText(); } catch (e) { msg('Das Einfügen wurde vom Handy nicht erlaubt. Bitte lange in das Textfeld tippen und „Einfügen“ wählen.', 1); return; }
  if (!tx.trim()) { msg('In der Zwischenablage steht kein Text.', 1); return; }
  const g = findG(GD.id), a = $('#gt'); g.transkript = (g.transkript || '').trim() ? g.transkript.replace(/\s+$/, '') + '\n\n' + tx : tx; a.value = g.transkript; g.geaendert = Date.now(); save(); msg('Text eingefügt.');
}
function gedSenden() {
  const g = findG(GD.id), f = GD.file;
  if (navigator.canShare && navigator.canShare({ files: [f] })) { navigator.share({ files: [f], title: titelG(g) }).catch(() => { }); return; }
  const a = document.createElement('a'); a.href = GD.url; a.download = g.audio.name; document.body.appendChild(a); a.click(); a.remove(); msg('Die Aufnahme wurde im Handy gespeichert (Ordner „Downloads“).');
}
function dauer(b) { return new Promise(res => { const a = new Audio(), u = URL.createObjectURL(b); a.preload = 'metadata'; a.onloadedmetadata = () => { res(isFinite(a.duration) ? Math.round(a.duration) : 0); URL.revokeObjectURL(u); }; a.onerror = () => { res(0); URL.revokeObjectURL(u); }; a.src = u; setTimeout(() => res(0), 4000); }); }
async function gedAudioDatei(inp) {
  const f = inp.files[0]; if (!f) return; const g = findG(GD.id), aid = uid(), ext = extOf(f.type || f.name);
  await bPut(aid, f); const sek = await dauer(f);
  g.audio = { id: aid, name: 'gedankenaudio-' + aid + '.' + ext, mime: f.type || 'audio/' + ext, size: f.size, sek }; g.geaendert = Date.now(); save(); msg('Aufnahme hinzugefügt.'); openGed(g.id);
}
function gedLoeschen() {
  const b = $('#gl'); if (b.dataset.s !== '1') { b.dataset.s = '1'; b.textContent = 'Wirklich löschen? Nochmal tippen'; b.style.color = '#b3261e'; setTimeout(() => { if (b && b.isConnected) { b.dataset.s = ''; b.textContent = 'Gedanke löschen'; b.style.color = ''; } }, 4000); return; }
  const g = findG(GD.id); if (g.audio) bDel(g.audio.id).catch(() => { });
  D.gedanken = D.gedanken.filter(x => x.id !== g.id); D.geloescht.push({ id: g.id, t: Date.now() }); save(); ovClose(); msg('Gelöscht.');
}
const mdG = g => {
  const L = ['# ' + titelG(g), '', '- Mappe: ' + mappenName(g.mappe || ''), '- Art: ' + ((g.mappe && findM(g.mappe)) ? findM(g.mappe).art : ''), '- Datum: ' + datDE(g.datum)];
  if (g.audio) L.push('- Aufnahme: ' + g.audio.name + ' (' + mmss(g.audio.sek) + ')');
  if ((g.notiz || '').trim()) L.push('', '## Notizen', '', g.notiz.trim());
  L.push('', '## Transkript', '', (g.transkript || '').trim() || '(noch kein Text)', ''); return L.join('\n');
};

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
  for (const g of m.geloescht || []) { if (!tomb(D.geloescht, g.id)) { D.geloescht.push(g); ch = true; } const ln = findN(g.id); if (ln && (ln.geaendert || 0) <= g.t) { D.notes = D.notes.filter(x => x.id !== g.id); ch = true; } const la = findA(g.id); if (la && (la.geaendert || 0) <= g.t) { D.autoren = D.autoren.filter(x => x.id !== g.id); ch = true; } const lg = findG(g.id); if (lg && (lg.geaendert || 0) <= g.t) { D.gedanken = D.gedanken.filter(x => x.id !== g.id); ch = true; } const lm = findM(g.id); if (lm && (lm.geaendert || 0) <= g.t) { D.mappen = D.mappen.filter(x => x.id !== g.id); ch = true; } }
  const mix = (lokal, fern, find) => { for (const r of fern || []) { if (D.geloescht.some(g => g.id === r.id && g.t >= (r.geaendert || 0))) continue; const l = find(r.id); if (!l) { lokal.push(r); ch = true; } else if ((r.geaendert || 0) > (l.geaendert || 0)) { Object.assign(l, r); ch = true; } } };
  mix(D.notes, m.notes, findN); mix(D.autoren, m.autoren, findA); mix(D.mappen, m.mappen, findM); mix(D.gedanken, m.gedanken, findG);
  if (m.einst && (m.stand || 0) > (D.stand || 0)) { D.einst = Object.assign(D.einst, m.einst); ch = true; }
  return ch;
}
/* Texte vom Nachtdienst (MacBook) in leere Gedanken eintragen; eigener Text wird nie überschrieben */
function fuelleTexte(T) {
  let ch = false;
  for (const g of D.gedanken) {
    if (!g.audio || (g.transkript || '').trim()) continue;
    const t = T[g.audio.id]; if (!t || !String(t.text || '').trim()) continue;
    g.transkript = String(t.text).trim(); g.geaendert = Date.now(); ch = true;
  }
  if (ch) { QUIET = true; save(); QUIET = false; }
  return ch;
}
async function drvSync(manuell) {
  if (!DRV.url || DRV.busy || (document.hidden && !manuell)) return;
  if (REC.on) return;
  if (CUR || GD) { clearTimeout(DRV.t); DRV.t = setTimeout(() => drvSync(), 6000); return; }
  DRV.busy = true; let neu = false;
  try {
    DRV.st = 'Abgleich läuft …'; drvShow();
    const m = await drvGetF('notes-daten.json');
    if (m && Array.isArray(m.notes)) { QUIET = true; neu = mergeMaster(m); if (neu) save(); QUIET = false; }
    try { const T = await drvGetF('transkripte-daten.json'); if (T && fuelleTexte(T)) { neu = true; } } catch (e) { }
    const P = lsGet('nw_pf', {});
    for (const g of D.gedanken) { if (g.audio) { const k = g.audio.name + ':' + g.audio.size; if (!P[k]) { const b = await bGet(g.audio.id).catch(() => null); if (b) { DRV.st = 'Aufnahme wird übertragen …'; drvShow(); await drvPost({ name: g.audio.name, b64: await toB64(b) }); P[k] = 1; lsSet('nw_pf', P); } } } }
    const H = lsGet('nw_pushed', {});
    for (const g of D.gedanken) { const md = mdG(g), h = hash(md); if (H[g.id] !== h) { await drvPost({ name: 'gedanke-' + g.id + '.md', text: md }); H[g.id] = h; lsSet('nw_pushed', H); } }
    const mh = hash(JSON.stringify({ n: D.notes, a: D.autoren, m: D.mappen, d: D.gedanken, g: D.geloescht, e: D.einst }));
    if (lsGet('nw_mpushed', '') !== mh) { await drvPost({ name: 'notes-daten.json', text: JSON.stringify(D) }); await drvPost({ name: 'notes-auswertung.md', text: exportMd() }); lsSet('nw_mpushed', mh); }
    const z = new Date(); DRV.st = 'Verbunden. Letzter Abgleich: ' + p2(z.getHours()) + ':' + p2(z.getMinutes());
    if (neu && !CUR && !GD && !REC.on) render();
  } catch (e) { QUIET = false; DRV.st = 'Verbindung fehlgeschlagen: ' + (e && e.message || e); }
  DRV.busy = false; drvShow();
}

/* ---------- Start ---------- */
render();
try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) { }
recRetten().catch(() => { });
setTimeout(() => drvSync(), 1500); setInterval(() => drvSync(), 60000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) { drvSoon(800); if (TAB === 'heute' && !CUR && !GD) render(); } });
