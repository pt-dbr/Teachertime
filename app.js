'use strict';

const activities = ['Unterricht', 'Vertretung', 'Aufsicht', 'Elterngespräch', 'Vorbereitung', 'Korrekturen', 'Arbeitsmaterial', 'Besprechung', 'Sonstiges'];
const presence = 'Anwesenheit';
const weekdays = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const storageKey = 'lehrzeit:v1:' + location.pathname.replace(/index\.html$/, '').replace(/\/?$/, '/');
const main = document.querySelector('#main');
const dialog = document.querySelector('#dialog');
const editor = document.querySelector('#editor');
let data, readError, tab = 'day', date = dateKey(new Date()), period = 'Tag';
let noticeTimer, prompted = false;
try {
  const stored = localStorage.getItem(storageKey);
  data = stored ? JSON.parse(stored) : {entries: [], slots: [], school: null};
  if (!Array.isArray(data.entries) || !Array.isArray(data.slots)) throw new Error();
} catch {
  readError = 'Der lokale Speicher konnte nicht gelesen werden. Prüfe die Safari-Einstellungen.';
  data = {entries: [], slots: [], school: null};
}

function escape(text) {
  return String(text ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function pad(n) { return String(n).padStart(2, '0'); }
function dateKey(d) { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
function localTime(d) { return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function inputTime(n) { const d = new Date(n); return `${dateKey(d)}T${localTime(d)}`; }
function dayStart(key) { return new Date(key + 'T00:00'); }
function offsetDay(d, count) { const next = new Date(d); next.setDate(next.getDate() + count); return next; }
function dateLabel(d) { return d.toLocaleDateString('de-DE', {day:'numeric', month:'short', year:'numeric'}); }
function duration(ms) {
  const m = Math.floor(Math.max(0, ms)/60000);
  return `${Math.floor(m/60)} Std. ${m%60} Min.`;
}
function id() { return crypto.randomUUID(); }
function note(message) {
  const box = document.querySelector('#notice');
  box.textContent = message;
  box.hidden = false;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => { box.hidden = true; }, 5500);
}
function save(update) {
  if (readError) { note(readError); return false; }
  try {
    const newest = localStorage.getItem(storageKey);
    const next = newest ? JSON.parse(newest) : structuredClone(data);
    update(next);
    localStorage.setItem(storageKey, JSON.stringify(next));
    data = next;
    render();
    return true;
  } catch (error) {
    note(error.message === 'timer' ? 'Für diesen Bereich läuft bereits ein Timer.' : 'Änderung konnte lokal nicht gespeichert werden.');
    return false;
  }
}
function button(label, action, value = '', style = '') {
  return `<button type="button" class="${style}" data-action="${action}" data-value="${escape(value)}">${escape(label)}</button>`;
}
function options(values, selected) {
  return values.map(value => `<option${value === selected ? ' selected' : ''}>${escape(value)}</option>`).join('');
}
function heading(title, actions = '') {
  return `<div class="head"><h1>${title}</h1><div class="actions">${actions}</div></div>`;
}
function dateInput() {
  return `<label>Datum <input type="date" id="date" value="${date}"></label>`;
}
function timer(entries, type) { return entries.find(e => e.end === null && (e.kind === presence) === (type === presence)); }
function start(kind, title = '', slot = null) {
  return save(db => {
    if (timer(db.entries, kind)) throw new Error('timer');
    db.entries.push({id:id(), kind, title, start:Date.now(), end:null, slot, day:dateKey(new Date())});
  });
}
function stop(entryId) {
  save(db => {
    const entry = db.entries.find(item => item.id === entryId && item.end === null);
    if (entry) entry.end = Math.max(Date.now(), entry.start + 1000);
  });
}
function slotsFor(key) {
  const weekday = dayStart(key).getDay();
  return data.slots.filter(slot => slot.weekly ? Number(slot.day) === weekday : slot.day === key)
    .sort((a,b) => a.start.localeCompare(b.start));
}
function rangeEntries(startAt, endAt, now = Date.now()) {
  return data.entries.filter(e => e.start < endAt && (e.end ?? Math.max(now,e.start+1)) > startAt);
}
function dayView() {
  const work = timer(data.entries, 'work'), atSchool = timer(data.entries, presence);
  const d = dayStart(date);
  const entries = rangeEntries(+d, +offsetDay(d,1)).sort((a,b) => a.start-b.start);
  const slots = slotsFor(date);
  const planRows = slots.map(slot => {
    const booked = data.entries.find(e => e.slot === slot.id && e.day === date);
    return `<div class="row"><div><strong>${escape(slot.title || slot.kind)}</strong><small>${escape(slot.kind)} · ${slot.start}–${slot.end}</small></div>${booked ? (booked.end === null ? '<span class="muted">Timer läuft</span>' : button('Bearbeiten','entry',booked.id)) : button('Erfassen','book',slot.id)}</div>`;
  }).join('');
  const entryRows = entries.map(e => {
    const format = n => inputTime(n).replace('T', ' · ');
    return `<div class="row"><div><strong>${escape(e.title || e.kind)}</strong><small>${escape(e.kind)} · ${format(e.start)} – ${e.end === null ? 'läuft' : format(e.end)}</small></div>${e.end === null ? button('Stoppen','stop',e.id) : button('Bearbeiten','entry',e.id)}</div>`;
  }).join('');
  return heading('Tag', dateInput()+button('+ Zeit nachtragen','entry','','primary')) +
    `<section><h2 class="section-title">Arbeitszeit erfassen</h2>${work ?
      `<p>${escape(work.title || work.kind)}</p><div class="clock" id="clock"></div>${button('Timer stoppen','stop',work.id,'primary')}` :
      `<div class="grid">${activities.map(kind => button(kind,'start',kind)).join('')}</div>`}
      <div class="status"><div><strong>Anwesenheit</strong><p class="muted">${atSchool ? 'Seit '+inputTime(atSchool.start).replace('T',' · ') : 'Keine laufende Anwesenheit'}</p></div>
      ${atSchool ? button('Anwesenheit beenden','stop',atSchool.id) : button('Anwesenheit starten','start',presence)}</div></section>
      <section><h2 class="section-title">Tagesplan</h2>${planRows || '<p class="empty">Für diesen Tag ist nichts geplant.</p>'}</section>
      <section><h2 class="section-title">Erfasste Zeiten</h2>${entryRows || '<p class="empty">Hier erscheinen deine Buchungen.</p>'}</section>`;
}
function planView() {
  const weekly = data.slots.filter(s => s.weekly).sort((a,b) => ((+a.day+6)%7)-((+b.day+6)%7)||a.start.localeCompare(b.start));
  const single = data.slots.filter(s => !s.weekly).sort((a,b) => (a.day+a.start).localeCompare(b.day+b.start));
  const rows = slots => slots.map(s => `<div class="row"><div><strong>${escape(s.title || s.kind)}</strong><small>${escape(s.weekly ? weekdays[+s.day] : dateLabel(dayStart(s.day)))} · ${s.start}–${s.end} · ${escape(s.kind)}</small></div>${button('Bearbeiten','slot',s.id)}</div>`).join('');
  return heading('Stundenplan',button('CSV importieren','csv')+button('+ Termin','slot','','primary'))+
    `<section><h2 class="section-title">Wöchentlich</h2>${rows(weekly) || '<p class="empty">Lege wiederkehrenden Unterricht und Aufsichten an.</p>'}</section>
    <section><h2 class="section-title">Einzeltermine</h2>${rows(single) || '<p class="empty">Hier erscheinen Vertretungen, Aufsichten und Elterngespräche.</p>'}</section>`;
}
function reportRange() {
  const d = dayStart(date);
  if (period === 'Monat') return [new Date(d.getFullYear(),d.getMonth(),1),new Date(d.getFullYear(),d.getMonth()+1,1)];
  if (period === 'Woche') {
    const monday = offsetDay(d,-((d.getDay()+6)%7));
    return [monday,offsetDay(monday,7)];
  }
  return [d,offsetDay(d,1)];
}
function union(ranges) {
  let end = -Infinity, total = 0;
  for (const [a,b] of ranges.sort((x,y) => x[0]-y[0])) {
    if (b > end) { total += Math.max(0,b-Math.max(a,end)); end = b; }
  }
  return total;
}
function statsView() {
  const [a,b] = reportRange(), now = Date.now();
  const entries = rangeEntries(+a,+b,now);
  const sum = predicate => union(entries.filter(predicate).map(e => [Math.max(e.start,+a),Math.min(e.end ?? now,+b)]));
  const work = sum(e => e.kind !== presence), atSchool = sum(e => e.kind === presence);
  const rows = activities.map(kind => {
    const time = sum(e => e.kind === kind);
    return time ? `<div class="row"><div><strong>${kind}</strong><progress max="${Math.max(work,1)}" value="${time}" aria-label="${kind}"></progress></div><span>${duration(time)}</span></div>` : '';
  }).join('');
  return heading('Statistik', dateInput()+`<label>Zeitraum <select id="period">${options(['Tag','Woche','Monat'],period)}</select></label>`)+
    `<p class="muted">${dateLabel(a)}${period === 'Tag' ? '' : ' – '+dateLabel(offsetDay(b,-1))}</p>
    <div class="metrics"><section><h2>Arbeitszeit</h2><span class="metric">${duration(work)}</span></section>
    <section><h2>Anwesenheit</h2><span class="metric">${duration(atSchool)}</span></section></div>
    <section><h2 class="section-title">Nach Tätigkeit</h2>${rows || '<p class="empty">Keine Arbeitszeit im gewählten Zeitraum.</p>'}
    <p class="muted space">Überschneidungen zählen in der gesamten Arbeitszeit einmal.</p></section>`;
}
function settingsView() {
  return heading('Einstellungen')+`<section><h2 class="section-title">Deine Daten</h2><p>Lehrzeit speichert Einträge, Stundenplan und Dienstort in diesem Browser. Beim Löschen der Website-Daten gehen die Einträge verloren. Sichere deine Daten bei Bedarf in „Auf meinem iPad“.</p><div class="actions space">${button('Sicherung laden','restore')}${button('Sicherung speichern','export')}</div></section>
  <section><h2 class="section-title">Dienstort</h2><p>${data.school ? 'Dienstort gespeichert.' : 'Am Schulstandort kannst du den aktuellen Standort als Dienstort speichern.'} Bei geöffneter App kann Lehrzeit prüfen, ob du außerhalb bist, und dir die Frage „Arbeitest du gerade?“ stellen. Anwesenheit startest und beendest du manuell.</p><div class="actions space">${button('Aktuellen Standort speichern','school')}${data.school ? button('Standort prüfen','check')+button('Dienstort entfernen','unSchool','','danger') : ''}</div></section>`;
}
function render() {
  main.innerHTML = (readError ? `<p role="alert">${readError}</p>` : '') + ({day:dayView,plan:planView,stats:statsView,settings:settingsView}[tab]());
  for (const item of document.querySelectorAll('[data-tab]')) {
    if (item.dataset.tab === tab) item.setAttribute('aria-current','page');
    else item.removeAttribute('aria-current');
  }
  updateClock();
}
function updateClock() {
  const clock = document.querySelector('#clock');
  if (!clock) return;
  const seconds = Math.max(0, Math.floor((Date.now()-timer(data.entries,'work').start)/1000));
  clock.textContent = [Math.floor(seconds/3600),Math.floor(seconds/60)%60,seconds%60].map(pad).join(':');
}
function edit(title, fields, handle, extra = '') {
  editor.innerHTML = `<h2>${title}</h2>${fields}<p id="formError" role="alert" hidden></p><div class="actions"><button class="primary">Speichern</button>${button('Abbrechen','close')}${extra}</div>`;
  editor.onsubmit = async event => {
    event.preventDefault();
    try { if (await handle(new FormData(editor))) dialog.close(); }
    catch (error) {
      const feedback = editor.querySelector('#formError');
      feedback.textContent = error.message;
      feedback.hidden = false;
    }
  };
  if (!dialog.open) dialog.showModal();
}
function entryEditor(entryId, slot) {
  const entry = data.entries.find(item => item.id === entryId);
  const now = Date.now();
  const startAt = entry?.start ?? (slot ? +new Date(date+'T'+slot.start) : date === dateKey(new Date()) ? now-1800000 : +new Date(date+'T08:00'));
  const endAt = entry?.end ?? (slot ? +new Date(date+'T'+slot.end) : startAt+1800000);
  edit(entry ? 'Zeit bearbeiten' : 'Zeit nachtragen', `
    <label>Tätigkeit <select name="kind">${options([...activities,presence],entry?.kind ?? slot?.kind ?? 'Vorbereitung')}</select></label>
    <label>Titel oder Notiz <input name="title" value="${escape(entry?.title ?? slot?.title)}" maxlength="300"></label>
    <div class="field-row"><label>Beginn <input name="start" type="datetime-local" value="${inputTime(startAt)}" required></label>
    <label>Ende <input name="end" type="datetime-local" value="${inputTime(endAt)}" required></label></div>`, values => {
    const start = +new Date(values.get('start')), end = +new Date(values.get('end'));
    if (!(end > start && end <= Date.now())) throw new Error('Das Ende muss nach dem Beginn liegen und darf nicht in der Zukunft sein.');
    return save(db => {
      const updated = {id:entryId || id(), kind:values.get('kind'),title:values.get('title').trim(),start,end,slot:entry?.slot ?? slot?.id ?? null,day:entry?.day ?? date};
      db.entries = [...db.entries.filter(e => e.id !== updated.id), updated];
    });
  }, entry ? button('Löschen','deleteEntry',entry.id,'danger') : '');
}
function slotEditor(slotId) {
  const slot = data.slots.find(item => item.id === slotId);
  const weekly = slot?.weekly ?? true;
  edit(slot ? 'Termin bearbeiten' : 'Termin hinzufügen', `
    <label>Tätigkeit <select name="kind">${options(activities,slot?.kind)}</select></label>
    <label>Titel, z. B. Mathematik 7b <input name="title" maxlength="300" value="${escape(slot?.title)}"></label>
    <label class="inline"><input type="checkbox" name="weekly"${weekly ? ' checked' : ''}> Wöchentlich wiederholen</label>
    <label id="weekday">Wochentag <select name="weekday">${options(weekdays,slot?.weekly ? weekdays[+slot.day] : weekdays[dayStart(date).getDay()])}</select></label>
    <label id="slotDate">Datum <input type="date" name="date" value="${escape(slot && !slot.weekly ? slot.day : date)}" required></label>
    <div class="field-row"><label>Beginn <input type="time" name="start" value="${slot?.start ?? '08:00'}" required></label><label>Ende <input type="time" name="end" value="${slot?.end ?? '08:45'}" required></label></div>`, values => {
    if (values.get('end') <= values.get('start')) throw new Error('Das Ende muss nach dem Beginn liegen.');
    const repeats = values.has('weekly');
    return save(db => {
      const updated = {id:slotId || id(),kind:values.get('kind'),title:values.get('title').trim(),weekly:repeats,day:repeats ? weekdays.indexOf(values.get('weekday')) : values.get('date'),start:values.get('start'),end:values.get('end')};
      db.slots = [...db.slots.filter(s => s.id !== updated.id), updated];
    });
  }, slot ? button('Löschen','deleteSlot',slot.id,'danger') : '');
  const toggle = editor.elements.weekly;
  const visibility = () => {
    editor.querySelector('#weekday').hidden = !toggle.checked;
    editor.querySelector('#slotDate').hidden = toggle.checked;
  };
  toggle.onchange = visibility;
  visibility();
}
function book(slotId) {
  const slot = data.slots.find(s => s.id === slotId);
  if (!slot) return;
  const startAt = +new Date(date+'T'+slot.start), endAt = +new Date(date+'T'+slot.end);
  editor.onsubmit = event => event.preventDefault();
  editor.innerHTML = `<h2>${escape(slot.title || slot.kind)}</h2><p>${slot.start}–${slot.end}</p><div class="actions">
    ${endAt <= Date.now() ? button('Planzeit buchen','bookExact',slot.id,'primary') : ''}
    ${button('Zeiten anpassen','bookEdit',slot.id)}
    ${date === dateKey(new Date()) && !timer(data.entries,'work') ? button('Timer starten','bookStart',slot.id) : ''}
    ${button('Abbrechen','close')}</div>`;
  dialog.showModal();
}
function csvRows(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r\n|\n|\r/);
  const result = [];
  for (const [index,line] of lines.entries()) {
    if (!line.trim()) continue;
    const [day,start,end,kind,...title] = line.split(';').map(field => field.trim());
    if (day.toLowerCase() === 'tag' && result.length === 0) continue;
    const weekday = weekdays.findIndex(item => item.toLowerCase() === day.toLowerCase());
    const activity = activities.find(item => item.toLowerCase() === kind?.toLowerCase());
    if (weekday < 0 || !isTime(start) || !isTime(end) || end <= start || !activity || !title.length) {
      throw new Error(`Zeile ${index+1} ist ungültig. Format: Tag;Beginn;Ende;Tätigkeit;Titel`);
    }
    result.push({id:id(),kind:activity,title:title.join(';'),weekly:true,day:weekday,start,end});
  }
  if (!result.length) throw new Error('Die Datei enthält keine Termine.');
  return result;
}
function isTime(value) { return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value); }
function isDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && dateKey(dayStart(value)) === value;
}
function csvImport() {
  edit('Stundenplan importieren', '<p>UTF-8, Semikolon als Trennzeichen. Beispiel: Mo;08:00;08:45;Unterricht;Mathematik 7b</p><label>CSV-Datei <input name="file" type="file" accept=".csv,.txt,text/plain,text/csv"></label><label>Oder CSV-Text einfügen <textarea name="csv" rows="5"></textarea></label>', async values => {
    const file = values.get('file');
    const rows = csvRows(file.size ? await file.text() : values.get('csv'));
    return save(db => {
      for (const row of rows) {
        const same = s => s.weekly && s.day === row.day && s.start === row.start && s.end === row.end &&
          s.title === row.title && s.kind === row.kind;
        if (!db.slots.some(same)) db.slots.push(row);
      }
    });
  });
}
function exportBackup() {
  if (readError) { note(readError); return; }
  const url = URL.createObjectURL(new Blob([JSON.stringify({version:1,...data},null,2)], {type:'application/json'}));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'Lehrzeit-Sicherung-' + dateKey(new Date()) + '.json';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url),30000);
}
function restore() {
  edit('Sicherung laden', '<p>Die Sicherung ersetzt deine aktuellen Einträge und Plantermine. Sichere den aktuellen Stand bei Bedarf vorher.</p><label>Lehrzeit-Sicherung <input name="file" type="file" accept=".json,application/json" required></label>', async values => {
    let backup;
    try { backup = JSON.parse(await values.get('file').text()); }
    catch { throw new Error('Die Datei enthält keine lesbare Sicherung.'); }
    if (!validBackup(backup)) throw new Error('Die Datei ist keine gültige Lehrzeit-Sicherung.');
    if (!confirm('Aktuelle Daten durch diese Sicherung ersetzen?')) return false;
    return save(db => { db.entries = backup.entries; db.slots = backup.slots; db.school = backup.school; });
  });
}
function validBackup(db) {
  const hasIdTitle = row => row && typeof row.id === 'string' && typeof row.title === 'string';
  const validSchool = s => s === null || (s && Number.isFinite(s.lat) && Math.abs(s.lat) <= 90
    && Number.isFinite(s.lon) && Math.abs(s.lon) <= 180 && Number.isFinite(s.radius) && s.radius >= 50 && s.radius <= 1000);
  const isTimestamp = n => Number.isFinite(n) && Math.abs(n) <= 8.64e15;
  if (!(db?.version === 1 && Array.isArray(db.entries) && Array.isArray(db.slots) && validSchool(db.school))) return false;
  if (!db.entries.every(e => hasIdTitle(e) && [...activities,presence].includes(e.kind) && isTimestamp(e.start)
    && (e.end === null || (isTimestamp(e.end) && e.end > e.start)) && isDate(e.day)
    && (e.slot === null || typeof e.slot === 'string'))) return false;
  if (!db.slots.every(s => hasIdTitle(s) && activities.includes(s.kind) && isTime(s.start) && isTime(s.end) &&
    s.end > s.start && typeof s.weekly === 'boolean' && (s.weekly ? Number.isInteger(s.day) && s.day >= 0 && s.day <= 6 : isDate(s.day)))) return false;
  return [db.entries,db.slots].every(rows => new Set(rows.map(row => row.id)).size === rows.length) &&
    [presence,'work'].every(type => db.entries.filter(e => e.end === null &&
      (e.kind === presence) === (type === presence)).length <= 1);
}
function locate(handle, showError = true) {
  if (!navigator.geolocation) {
    if (showError) note('Standort ist hier nicht verfügbar.');
    return;
  }
  navigator.geolocation.getCurrentPosition(({coords}) => handle(coords), () => {
    if (showError) note('Der Standort konnte nicht ermittelt werden. Prüfe die Standortfreigabe für Safari.');
  }, {enableHighAccuracy:true,timeout:10000,maximumAge:30000});
}
function distance(lat1,lon1,lat2,lon2) {
  const rad = n => n*Math.PI/180;
  const h = Math.sin(rad(lat2-lat1)/2)**2 + Math.cos(rad(lat1))*Math.cos(rad(lat2))*Math.sin(rad(lon2-lon1)/2)**2;
  return 12742000*Math.asin(Math.sqrt(Math.min(1,h)));
}
function checkSchool(manual = false) {
  if (!data.school || (!manual && (prompted || timer(data.entries,'work')))) return;
  locate(coords => {
    const school = data.school;
    if (!school || document.hidden) return;
    const meters = distance(school.lat,school.lon,coords.latitude,coords.longitude);
    if (meters - coords.accuracy > school.radius && !timer(data.entries,'work') && !dialog.open) {
      prompted = true;
      editor.onsubmit = event => event.preventDefault();
      editor.innerHTML = `<h2>Arbeitest du gerade?</h2><p>Du bist außerhalb des Dienstorts. Wähle eine Tätigkeit, um den Timer zu starten.</p><div class="grid">${activities.map(kind => button(kind,'start',kind)).join('')}</div>${button('Nein','close')}`;
      dialog.showModal();
    } else if (manual) {
      note(meters + coords.accuracy <= school.radius ? 'Du bist am Dienstort.' :
        meters - coords.accuracy > school.radius ? 'Du bist außerhalb des Dienstorts.' : 'Der Standort ist für diese Prüfung zu ungenau.');
    }
  }, manual);
}
function deleteItem(collection, value) {
  if (!confirm('Diesen Eintrag löschen?')) return;
  if (save(db => { db[collection] = db[collection].filter(item => item.id !== value); })) dialog.close();
}
function bookAction(action, value) {
  const slot = slotsFor(date).find(s => s.id === value);
  if (!slot) return;
  if (action === 'bookEdit') { entryEditor('',slot); return; }
  if (action === 'bookStart' && date === dateKey(new Date())) {
    if (start(slot.kind,slot.title,slot.id)) dialog.close();
    return;
  }
  if (action !== 'bookExact') return;
  const startAt = +new Date(date+'T'+slot.start), endAt = +new Date(date+'T'+slot.end);
  if (!(endAt > startAt && endAt <= Date.now())) return;
  if (save(db => {
    if (!db.entries.some(e => e.slot === slot.id && e.day === date)) {
      db.entries.push({id:id(),kind:slot.kind,title:slot.title,start:startAt,end:endAt,slot:slot.id,day:date});
    }
  })) dialog.close();
}

document.addEventListener('click', event => {
  const control = event.target.closest('button');
  if (!control) return;
  if (control.dataset.tab) { tab = control.dataset.tab; render(); return; }
  const {action,value} = control.dataset;
  switch (action) {
    case 'start': if (start(value) && dialog.open) dialog.close(); break;
    case 'stop': stop(value); break;
    case 'entry': entryEditor(value); break;
    case 'slot': slotEditor(value); break;
    case 'book': book(value); break;
    case 'bookEdit': case 'bookExact': case 'bookStart': bookAction(action,value); break;
    case 'deleteEntry': deleteItem('entries',value); break;
    case 'deleteSlot': deleteItem('slots',value); break;
    case 'close': dialog.close(); break;
    case 'csv': csvImport(); break;
    case 'export': exportBackup(); break;
    case 'restore': restore(); break;
    case 'school':
      locate(coords => {
        if (coords.accuracy > 150) { note('Der Standort ist zu ungenau. Versuch es am Schulstandort erneut.'); return; }
        if (save(db => { db.school = {lat:coords.latitude,lon:coords.longitude,radius:200}; })) note('Dienstort lokal gespeichert.');
      });
      break;
    case 'check': checkSchool(true); break;
    case 'unSchool': save(db => { db.school = null; }); break;
  }
});
main.addEventListener('change', event => {
  const {id,value} = event.target;
  if (id === 'date' && isDate(value)) date = value;
  else if (id === 'period') period = value;
  else return;
  render();
});
window.addEventListener('storage', event => {
  if (event.key === storageKey && event.newValue) { data = JSON.parse(event.newValue); render(); }
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) prompted = false;
  else { render(); checkSchool(); }
});
setInterval(updateClock,1000);
render();
checkSchool();
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => note('Offline-Modus ist hier nicht verfügbar.'));
}
