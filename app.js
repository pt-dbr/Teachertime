'use strict';

const conference = 'Konferenzen';
const types = ['Lehrerkonferenz','Schulkonferenz','Fachkonferenz','Teilkonferenz'];
const activities = ['Unterricht', 'Vertretung', 'Aufsicht', 'Elterngespräch', 'Vorbereitung', 'Korrekturen', 'Arbeitsmaterial', 'Besprechung', conference, 'Sonstiges'];
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
function start(kind, title = '', slot = null, details = {}) {
  return save(db => {
    if (timer(db.entries, kind)) throw new Error('timer');
    db.entries.push({id:id(), kind, title, ...details, start:Date.now(), end:null, slot, day:dateKey(new Date())});
  });
}
function stop(entryId) {
  save(db => {
    const entry = db.entries.find(item => item.id === entryId && item.end === null);
    if (entry) entry.end = Math.max(Date.now(), entry.start + 1000);
  });
}
function label(item) {
  return item.conferenceType ? item.conferenceType + (item.subject ? ' · ' + item.subject : '') : item.kind;
}
function conferenceFields(item) {
  return `<label data-type>Konferenzart <select name="conferenceType">${options(types,item?.conferenceType)}</select></label>
    <label data-subject>Fach <input name="subject" maxlength="100" value="${escape(item?.subject)}"></label>`;
}
function bindConferenceFields() {
  const kind = editor.elements.kind, type = editor.elements.conferenceType;
  const update = () => {
    const isConference = !kind || kind.value === conference;
    editor.querySelector('[data-type]').hidden = !isConference;
    editor.querySelector('[data-subject]').hidden = !isConference || type.value !== 'Fachkonferenz';
  };
  if (kind) kind.addEventListener('change',update);
  type.addEventListener('change',update);
  update();
}
function details(values, kind) {
  if (kind !== conference) return {};
  const conferenceType = values.get('conferenceType');
  return {conferenceType,subject:conferenceType === 'Fachkonferenz' ? values.get('subject').trim() : ''};
}
function slotDetails(slot) {
  return slot.conferenceType ? {conferenceType:slot.conferenceType,subject:slot.subject} : {};
}
function dayAdjustments(key, db = data) {
  return (db.adjustments ?? []).filter(change => change.day === key);
}
function scheduleAt(key, db = data) {
  return (db.scheduleStarts ?? []).reduce((latest,start) => start <= key && start > latest ? start : latest,'');
}
function newSchedule() {
  const today = dateKey(new Date());
  edit('Neuer Stundenplan',`<p>Ab dem gewählten Datum beginnt ein leerer Wochenplan. Einmalige Termine und erfasste Zeiten bleiben gespeichert.</p>
    <label>Gültig ab <input name="effective" type="date" min="${today}" value="${today}" required></label>`, values => {
    const effective = values.get('effective');
    if (!isDate(effective) || effective < today) throw new Error('Wähle heute oder ein zukünftiges Datum.');
    if ((data.scheduleStarts ?? []).includes(effective)) throw new Error('Für dieses Datum gibt es bereits einen Stundenplan. Wähle das Datum im Wochenplan, um ihn zu bearbeiten.');
    if (!save(db => {
      db.scheduleStarts = [...new Set([...(db.scheduleStarts ?? []),effective])].sort();
    })) return false;
    date = effective;
    render();
    note('Stundenplan ab '+dateLabel(dayStart(effective))+' geöffnet.');
    return true;
  });
}
function datedSlots(key, db = data) {
  const weekday = dayStart(key).getDay(), version = scheduleAt(key,db);
  return db.slots.filter(slot => slot.weekly
    ? Number(slot.day) === weekday && (slot.scheduleFrom ?? '') === version
    : slot.day === key);
}
function mondayFor(key) {
  const d = dayStart(key);
  return offsetDay(d,-((d.getDay()+6)%7));
}
function lessonDialog(value, mode) {
  const [key,slotId] = value.split('|');
  if (!isDate(key)) return;
  const previous = dayAdjustments(key).find(change => change.slot.id === slotId);
  const slot = previous?.slot ?? datedSlots(key).find(item => item.id === slotId);
  if (!slot || slot.kind !== 'Unterricht') return;
  const original = slot.title || 'Unterricht';
  const replace = mode === 'lessonReplace';
  edit(replace ? 'Vertretung eintragen' : 'Minusstunde eintragen',
    `<p>${escape(dateLabel(dayStart(key))+' · '+slot.start+'–'+slot.end+' · '+original)}</p>
    ${replace ? `<label>Neue Stunde <input name="replacement" maxlength="300" required value="${escape(previous?.replacement)}" placeholder="z. B. Deutsch 8b"></label>`
      : '<p>Diese Stunde entfällt an diesem Tag und zählt als Minusstunde.</p>'}`, values => {
    const replacement = replace ? values.get('replacement').trim() : null;
    if (replace && !replacement) throw new Error('Gib den Namen der Vertretungsstunde ein.');
    return save(db => {
      db.adjustments = [...(db.adjustments ?? []).filter(change => change.day !== key || change.slot.id !== slotId),
        {day:key,slot,replacement}];
    });
  }, previous ? button('Änderung zurücknehmen','lessonReset',value) : '');
}
function monthlyBalance(key) {
  const d = dayStart(key);
  const first = new Date(d.getFullYear(),d.getMonth(),1);
  const last = new Date(d.getFullYear(),d.getMonth()+1,1);
  let covers = 0, missed = 0, coverMinutes = 0, missedMinutes = 0;
  const minutes = slot => timeMinutes(slot.end)-timeMinutes(slot.start);
  for (let day = first; day < last; day = offsetDay(day,1)) {
    const dayKey = dateKey(day);
    const adjustments = dayAdjustments(dayKey);
    missed += adjustments.length;
    missedMinutes += adjustments.reduce((sum, change) => sum+minutes(change.slot),0);
    const replacements = slotsFor(dayKey).filter(slot => slot.kind === 'Vertretung');
    covers += replacements.length;
    coverMinutes += replacements.reduce((sum,slot) => sum+minutes(slot),0);
  }
  return {covers,missed,coverMinutes,missedMinutes};
}
function balanceView() {
  const {covers,missed,coverMinutes,missedMinutes} = monthlyBalance(date);
  const net = covers-missed, netMinutes = coverMinutes-missedMinutes;
  const sign = number => number > 0 ? '+' : number < 0 ? '−' : '';
  const count = number => Math.abs(number) === 1 ? 'Stunde' : 'Stunden';
  const month = dayStart(date).toLocaleDateString('de-DE',{month:'long',year:'numeric'});
  return `<section><h2>Stundenkonto · ${month}</h2><div class="balance-grid">
    <div><strong>Vertretungsstunden</strong><span class="metric">${covers} ${count(covers)}</span><small>${duration(coverMinutes*60000)}</small></div>
    <div><strong>Minusstunden</strong><span class="metric">${missed} ${count(missed)}</span><small>${duration(missedMinutes*60000)}</small></div>
    <div><strong>Überstundensaldo</strong><span class="metric">${sign(net)}${Math.abs(net)} ${count(net)}</span><small>${sign(netMinutes)}${duration(Math.abs(netMinutes)*60000)}</small></div>
    </div><p class="muted space">Bei einem direkten Ersatz zählen eine Vertretungsstunde und eine Minusstunde. Der Saldo bleibt dabei null.</p></section>`;
}
function slotsFor(key, db = data) {
  const changes = dayAdjustments(key,db);
  const slots = datedSlots(key,db).filter(slot => !changes.some(change => change.slot.id === slot.id));
  for (const change of changes) {
    if (change.replacement) slots.push({...change.slot,kind:'Vertretung',title:change.replacement,
      weekly:false,day:key,replacementKey:key+'|'+change.slot.id});
  }
  return slots.sort((a,b) => a.start.localeCompare(b.start));
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
    return `<div class="row"><div><strong>${escape(slot.title || label(slot))}</strong><small>${escape(label(slot))} · ${slot.start}–${slot.end}</small></div>${booked ? (booked.end === null ? '<span class="muted">Timer läuft</span>' : button('Bearbeiten','entry',booked.id)) : button('Erfassen','book',slot.id)}</div>`;
  }).join('');
  const entryRows = entries.map(e => {
    const format = n => inputTime(n).replace('T', ' · ');
    return `<div class="row"><div><strong>${escape(e.title || label(e))}</strong><small>${escape(label(e))} · ${format(e.start)} – ${e.end === null ? 'läuft' : format(e.end)}</small></div>${e.end === null ? button('Stoppen','stop',e.id) : button('Bearbeiten','entry',e.id)}</div>`;
  }).join('');
  return heading('Tag', dateInput()+button('+ Zeit nachtragen','entry','','primary')) +
    `<section><h2 class="section-title">Arbeitszeit erfassen</h2>${work ?
      `<p>${escape(work.title || label(work))}</p><div class="clock" id="clock"></div>${button('Timer stoppen','stop',work.id,'primary')}` :
      `<div class="grid">${activities.map(kind => button(kind,'start',kind)).join('')}</div>`}
      <div class="status"><div><strong>Anwesenheit</strong><p class="muted">${atSchool ? 'Seit '+inputTime(atSchool.start).replace('T',' · ') : 'Keine laufende Anwesenheit'}</p></div>
      ${atSchool ? button('Anwesenheit beenden','stop',atSchool.id) : button('Anwesenheit starten','start',presence)}</div></section>
      <section><h2 class="section-title">Tagesplan</h2>${planRows || '<p class="empty">Für diesen Tag ist nichts geplant.</p>'}</section>
      <section><h2 class="section-title">Erfasste Zeiten</h2>${entryRows || '<p class="empty">Hier erscheinen deine Buchungen.</p>'}</section>`;
}
const schoolDays = ['Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag','Sonntag'];
function gridTime(minutes) { return pad(Math.floor(minutes/60)) + ':' + pad(minutes%60); }
function timeMinutes(time) {
  const [hours,minutes] = time.split(':').map(Number);
  return hours*60+minutes;
}
const morning = [
  ['Frühaufsicht','07:40','07:55','Aufsicht'],
  ['1. Stunde','07:55','08:55','Unterricht'],
  ['Erste Pause','08:55','09:10','Aufsicht'],
  ['2. Stunde','09:10','10:10','Unterricht'],
  ['3. Stunde','10:15','11:15','Unterricht'],
  ['Zweite Pause','11:15','11:35','Aufsicht'],
  ['4. Stunde','11:35','12:35','Unterricht'],
  ['5. Stunde','12:40','13:40','Unterricht']
];
const bands = [['00:00–06:00',0,360],['06:00–14:00',360,840],
  ['14:00–20:00',840,1200],['20:00–24:00',1200,1440]];
let band = bands[1][0];
function gridTable(name, columns, rows) {
  return `<div class="week-scroll" tabindex="0" aria-label="${name}"><table class="week-grid">
    <thead><tr><th scope="col">Zeit</th>${columns.map(column => `<th scope="col">${column}</th>`).join('')}</tr></thead>
    <tbody>${rows}</tbody></table></div>`;
}
function gridCard(item, action, caption, variant = '') {
  return `<button type="button" class="grid-slot ${variant}" data-action="${action}" data-value="${escape(item.id)}">
    <strong>${item.kind === 'Vertretung' ? '<b class="cover-mark">V</b> ' : ''}${escape(item.title || label(item))}</strong><small>${escape(caption)}</small></button>`;
}
function gridAdd(action,value,description) {
  return `<button type="button" class="grid-add" data-action="${action}" data-value="${value}"
    aria-label="${description}">+</button>`;
}
function lessonCard(slot,key,change) {
  const value = key+'|'+slot.id;
  const template = change?.slot ?? slot;
  const title = escape(template.title || label(template));
  const time = template.start+'–'+template.end;
  if (change?.replacement) {
    return `<button type="button" class="grid-slot lesson-split" data-action="lessonReplace" data-value="${escape(value)}">
      <strong class="lesson-new"><b>V</b> ${escape(change.replacement)}</strong>
      <span class="lesson-old"><b>M</b> ${title}<small>${time}</small></span></button>`;
  }
  if (change) {
    return `<button type="button" class="grid-slot lesson-minus" data-action="lessonMinus" data-value="${escape(value)}">
      <strong><b>M</b> ${title}</strong><small>${time}</small></button>`;
  }
  if (slot.kind !== 'Unterricht') {
    return gridCard(slot,'slot',time,slot.kind === 'Vertretung' ? 'lesson-cover' : 'grid-duty');
  }
  return `<div class="lesson-normal">${gridCard(slot,'slot',time)}
    <div class="lesson-actions">
      <button type="button" data-action="lessonMinus" data-value="${escape(value)}" aria-label="Als Minusstunde markieren">−</button>
      <button type="button" data-action="lessonReplace" data-value="${escape(value)}" aria-label="Durch Vertretung ersetzen">✎</button>
    </div></div>`;
}
function weeklyGrid() {
  const monday = mondayFor(date);
  const days = schoolDays.slice(0,5).map((name,index) => {
    const key = dateKey(offsetDay(monday,index)), changes = dayAdjustments(key);
    const slots = datedSlots(key).filter(slot => !changes.some(change => change.slot.id === slot.id));
    slots.push(...changes.map(change => change.slot));
    return {name,key,slots,changes};
  });
  const rows = morning.map(([name,start,end]) => {
    const cells = days.map(({name:day,key,slots,changes}) => {
      const booked = slots.filter(slot => slot.start === start)
        .map(slot => lessonCard(slot,key,changes.find(change => change.slot.id === slot.id))).join('');
      return `<td>${booked || gridAdd('gridSlot',key+'|'+start,name+' am '+day+' hinzufügen')}</td>`;
    });
    return `<tr><th scope="row">${name}<small>${start}–${end}</small></th>${cells.join('')}</tr>`;
  });
  const headers = days.map(({name,key}) => name+'<small>'+key.slice(8,10)+'.'+key.slice(5,7)+'.</small>');
  return gridTable('Vormittagsplan',headers,rows.join(''));
}
function scheduledOn(key, db = data) {
  return slotsFor(key,db).map(slot => ({
    ...slot, startAt:+new Date(key+'T'+slot.start), endAt:+new Date(key+'T'+slot.end)
  })).filter(slot => slot.endAt > slot.startAt);
}
const quarterMinutes = 15;

function gridInstant(key, minute) {
  return minute === 1440 ? +offsetDay(dayStart(key),1) : +new Date(key+'T'+gridTime(minute));
}

function gridRange(key, first, last) {
  return {
    key,
    time:gridTime(Math.min(first,last)),
    startAt:gridInstant(key,Math.min(first,last)),
    endAt:gridInstant(key,Math.max(first,last)+quarterMinutes)
  };
}

function workConflict(db, start, end, ignoredId, kind) {
  const overlaps = (a,b) => a < end && b > start;
  const entry = db.entries.find(item => item.id !== ignoredId && (item.kind === presence) === (kind === presence) && overlaps(item.start,item.end ?? Infinity));
  if (entry) return 'Der Zeitraum überschneidet sich mit „'+(entry.title || label(entry))+'“. Wähle einen freien Zeitraum oder bearbeite den vorhandenen Eintrag.';
  if (kind === presence) return '';
  for (let day = dayStart(dateKey(new Date(start))); +day < end; day = offsetDay(day,1)) {
    const slot = scheduledOn(dateKey(day),db).find(item => overlaps(item.startAt,item.endAt));
    if (slot) return 'Der Zeitraum überschneidet sich mit dem Plantermin „'+(slot.title || label(slot))+'“. Wähle einen freien Zeitraum.';
  }
  return '';
}

let gridDrag = null;
let suppressGridClick = false;

function workGridCellAt(event) {
  return document.elementFromPoint(event.clientX,event.clientY)?.closest('[data-work-day]');
}

function paintGridSelection(cell) {
  const drag = gridDrag;
  const end = cell && cell.dataset.workDay === drag.key ? Number(cell.dataset.workMinute) : null;
  for (const item of drag.cells) {
    const minute = Number(item.dataset.workMinute);
    item.classList.toggle('grid-selected',end !== null &&
      minute >= Math.min(drag.first,end) && minute <= Math.max(drag.first,end));
  }
}

function cancelGridSelection() {
  const selection = gridDrag;
  if (!selection) return;
  gridDrag = null;
  for (const cell of selection.cells) cell.classList.remove('grid-selected');
  if (selection.origin.hasPointerCapture(selection.pointerId)) selection.origin.releasePointerCapture(selection.pointerId);
}

main.addEventListener('pointerdown', event => {
  if (gridDrag || !event.isPrimary || event.button !== 0) return;
  suppressGridClick = false;
  const cell = event.target.closest('[data-work-day]');
  const control = event.target.closest('button');
  if (!cell || (control && control.dataset.action !== 'workCell')) return;
  const key = cell.dataset.workDay;
  gridDrag = {origin:cell,key,first:Number(cell.dataset.workMinute),pointerId:event.pointerId,
    cells:cell.closest('table').querySelectorAll('[data-work-day="'+key+'"]'), moved:false};
  cell.setPointerCapture(event.pointerId);
  paintGridSelection(cell);
  event.preventDefault();
});
main.addEventListener('pointermove', event => {
  if (gridDrag?.pointerId !== event.pointerId) return;
  const cell = workGridCellAt(event);
  if (cell !== gridDrag.origin) gridDrag.moved = true;
  paintGridSelection(cell);
});
main.addEventListener('pointerup', event => {
  if (gridDrag?.pointerId !== event.pointerId) return;
  const {key,first,moved} = gridDrag;
  const cell = workGridCellAt(event);
  suppressGridClick = true;
  cancelGridSelection();
  if (!cell || cell.dataset.workDay !== key) return;
  const last = Number(cell.dataset.workMinute);
  if (!moved && first === last) {
    workCell(key+'|'+gridTime(first));
    return;
  }
  const range = gridRange(key,first,last);
  if (range.endAt <= range.startAt) {
    note('Dieser Zeitraum ist an diesem Tag nicht verfügbar.');
    return;
  }
  const conflict = workConflict(data,range.startAt,range.endAt);
  if (conflict) note(conflict);
  else entryEditor('',null,range,true);
});
main.addEventListener('pointercancel', event => {
  if (gridDrag?.pointerId === event.pointerId) {
    suppressGridClick = true;
    cancelGridSelection();
  }
});
main.addEventListener('lostpointercapture', event => {
  if (gridDrag?.pointerId === event.pointerId) {
    suppressGridClick = true;
    cancelGridSelection();
  }
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && gridDrag) {
    suppressGridClick = true;
    cancelGridSelection();
    event.preventDefault();
  }
});
document.addEventListener('click', event => {
  if (suppressGridClick && event.detail && event.target.closest('[data-work-day]')) {
    suppressGridClick = false;
    event.preventDefault();
    event.stopImmediatePropagation();
  }
},true);

function workGrid() {
  const anchor = dayStart(date), monday = offsetDay(anchor,-((anchor.getDay()+6)%7));
  const [,from,to] = bands.find(item => item[0] === band);
  const now = Date.now();
  const columns = schoolDays.map((name,index) => {
    const day = offsetDay(monday,index), key = dateKey(day);
    return {name,day,key,planned:scheduledOn(key),entries:rangeEntries(+day,+offsetDay(day,1),now)};
  });
  const rows = [];
  for (let minute = from; minute < to; minute += quarterMinutes) {
    const time = gridTime(minute);
    const cells = columns.map(({key,name,planned,entries}) => {
      const rowStart = gridInstant(key,minute), rowEnd = gridInstant(key,minute+quarterMinutes);
      const overlaps = (start,end) => start < rowEnd && end > rowStart;
      const first = start => minute === from || start >= rowStart;
      const blocks = [];
      for (const slot of planned) {
        if (!overlaps(slot.startAt,slot.endAt)) continue;
        const color = slot.kind === 'Vertretung' ? 'lesson-cover' : 'grid-plan';
        blocks.push(first(slot.startAt) ? gridCard(slot.replacementKey ? {...slot,id:slot.replacementKey} : slot,slot.replacementKey ? 'lessonReplace' : 'slot',slot.start+'–'+slot.end+' · Plan',color)
          : `<div class="grid-cont ${color}" aria-hidden="true"></div>`);
      }
      let recorded = false, continuesAfter = false;
      for (const entry of entries) {
        const end = entry.end ?? Math.max(now,entry.start+1);
        if (!overlaps(entry.start,end)) continue;
        const caption = localTime(new Date(entry.start))+'–'+(entry.end === null ? 'läuft · Stoppen' : localTime(new Date(entry.end)));
        recorded = true;
        continuesAfter ||= end > rowEnd && minute+quarterMinutes < to;
        const action = entry.end === null ? 'stop' : 'workEdit';
        blocks.push(first(entry.start) ? gridCard(entry,action,caption,'grid-record')
          : `<button type="button" class="grid-record grid-record-cont" data-action="${action}"
            data-value="${escape(entry.id)}" aria-label="${escape((entry.title || label(entry))+' · '+caption)}"></button>`);
      }
      const edges = recorded ? ' work-recorded'+(continuesAfter ? ' record-after' : '') : '';
      return `<td class="work-cell${edges}" data-work-day="${key}" data-work-minute="${minute}">${blocks.join('')}
        ${recorded ? '' : gridAdd('workCell',key+'|'+time,'Eintrag am '+name+' '+key+' um '+time+' hinzufügen')}</td>`;
    });
    rows.push(`<tr><th scope="row">${time}</th>${cells.join('')}</tr>`);
  }
  const headers = columns.map(({name,day}) => name+'<small>'+pad(day.getDate())+'.'+pad(day.getMonth()+1)+'.</small>');
  return gridTable('Arbeitszeitraster',headers,rows.join(''));
}
function workCell(value) {
  const [key,time] = value.split('|');
  if (!isDate(key) || !isTime(time)) return;
  edit('Was möchtest du eintragen?',`<p>${dateLabel(dayStart(key))} · ${time}</p><div class="actions">
    ${button('Termin planen','workPlan',value)}${button('Arbeitszeit nachtragen','workEntry',value)}</div>`,() => false);
  editor.querySelector('.primary').hidden = true;
}
function planView() {
  const week = mondayFor(date);
  const weekly = schoolDays.flatMap((_,index) => datedSlots(dateKey(offsetDay(week,index))).filter(slot => slot.weekly));
  const from = scheduleAt(date);
  const custom = weekly.filter(slot => slot.day < 1 || slot.day > 5 || !morning.some(block => block[1] === slot.start));
  const single = data.slots.filter(s => !s.weekly).sort((a,b) => (a.day+a.start).localeCompare(b.day+b.start));
  const rows = items => items.map(s => `<div class="row"><div><strong>${escape(s.title || label(s))}</strong><small>${s.weekly ? weekdays[s.day] : dateLabel(dayStart(s.day))} · ${s.start}–${s.end} · ${escape(label(s))}</small></div>${button('Bearbeiten','slot',s.id)}</div>`).join('');
  return heading('Stundenplan',button('CSV importieren','csv')+button('Neuer Stundenplan','newSchedule')+button('+ Termin','slot','','primary'))+
    `<section class="week-card"><h2 class="section-title">Vormittagsplan</h2>
    ${from ? `<p class="muted section-title">Stundenplan gültig ab ${dateLabel(dayStart(from))}</p>` : ''}<div class="actions section-title">${button('Vorige Woche','weekStep','-7')}${dateInput()}${button('Nächste Woche','weekStep','7')}</div>
    ${weeklyGrid()}</section>${balanceView()}
    <section class="week-card"><div class="head"><h2>Arbeitszeitraster</h2><div class="actions">
        <label>Uhrzeit <select id="workBand">${options(bands.map(item => item[0]),band)}</select></label></div></div>
    <p class="muted section-title">Ziehe über freie Felder eines Tages, um Arbeitszeit einzutragen. Mit + kannst du auch einen Termin planen.</p>${workGrid()}</section>
    ${custom.length ? `<section><h2 class="section-title">Weitere wöchentliche Termine</h2>${rows(custom)}</section>` : ''}
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
  const clip = (start,end,limit = +b) => [Math.max(start,+a),Math.min(end,limit)];
  const entries = rangeEntries(+a,+b,now).map(entry => ({
    ...entry, range:clip(entry.start,entry.end ?? now,Math.min(now,+b))
  }));
  const actual = entries.filter(entry => entry.kind !== presence);
  const planned = [];
  for (let day = a; day < b; day = offsetDay(day,1)) planned.push(...scheduledOn(dateKey(day)));
  const automatic = planned.filter(slot => (slot.weekly || slot.kind === 'Vertretung') && slot.endAt <= now)
    .map(slot => ({...slot,range:clip(slot.startAt,slot.endAt)}));
  const covers = automatic.filter(slot => slot.kind === 'Vertretung').map(slot => slot.range);
  const actualRanges = actual.map(entry => entry.range);
  const remaining = automatic.flatMap(slot => {
    const occupied = slot.kind === 'Unterricht' ? [...actualRanges,...covers] : actualRanges;
    const fragments = occupied.reduce((ranges,[start,end]) => ranges.flatMap(([left,right]) => {
      if (right <= start || left >= end) return [[left,right]];
      return [[left,Math.min(start,right)],[Math.max(end,left),right]].filter(([x,y]) => y > x);
    }),[slot.range]);
    return fragments.map(range => ({...slot,range}));
  });
  const sum = predicate => union([...actual,...remaining].filter(predicate).map(item => item.range));
  const work = sum(() => true);
  const atSchool = union(entries.filter(entry => entry.kind === presence).map(entry => entry.range));
  const rows = activities.map(kind => {
    const time = sum(e => e.kind === kind);
    const breakdown = kind === conference ? types.map(type => {
      const subtotal = sum(e => e.kind === conference && e.conferenceType === type);
      return subtotal ? `<small>${type} · ${duration(subtotal)}</small>` : '';
    }).join('') : '';
    return time ? `<div class="row"><div><strong>${kind}</strong>${breakdown}<progress max="${Math.max(work,1)}" value="${time}" aria-label="${kind}"></progress></div><span>${duration(time)}</span></div>` : '';
  }).join('');
  return heading('Statistik', dateInput()+`<label>Zeitraum <select id="period">${options(['Tag','Woche','Monat'],period)}</select></label>`)+
    `<p class="muted">${dateLabel(a)}${period === 'Tag' ? '' : ' – '+dateLabel(offsetDay(b,-1))}</p>
    <div class="metrics"><section><h2>Arbeitszeit</h2><span class="metric">${duration(work)}</span><p class="muted">Erfasste Zeiten und abgeschlossene Stundenplantermine</p></section>
    <section><h2>Anwesenheit</h2><span class="metric">${duration(atSchool)}</span></section>
    <section><h2>Planzeit</h2><span class="metric">${duration(union(planned.map(slot => clip(slot.startAt,slot.endAt))))}</span><p class="muted">Termine aus dem Stundenplan</p></section></div>
    <section><h2 class="section-title">Nach Tätigkeit</h2>${rows || '<p class="empty">Keine Arbeitszeit im gewählten Zeitraum.</p>'}
    <p class="muted space">Abgelaufene Wochenplantermine und Vertretungen zählen automatisch. Andere Einzeltermine zählen nach der Erfassung. Überschneidungen zählen in der Arbeitszeit einmal.</p></section>${balanceView()}`;
}
function settingsView() {
  return heading('Einstellungen')+`<section><h2 class="section-title">Deine Daten</h2><p>Lehrzeit speichert Einträge, Stundenplan und Dienstort in diesem Browser. Beim Löschen der Website-Daten gehen die Einträge verloren. Sichere deine Daten bei Bedarf in „Auf meinem iPad“.</p><div class="actions space">${button('Sicherung laden','restore')}${button('Sicherung speichern','export')}</div></section>
  <section><h2 class="section-title">Dienstort</h2><p>${data.school ? 'Dienstort gespeichert.' : 'Am Schulstandort kannst du den aktuellen Standort als Dienstort speichern.'} Bei geöffneter App kann Lehrzeit prüfen, ob du außerhalb bist, und dir die Frage „Arbeitest du gerade?“ stellen. Anwesenheit startest und beendest du manuell.</p><div class="actions space">${button('Aktuellen Standort speichern','school')}${data.school ? button('Standort prüfen','check')+button('Dienstort entfernen','unSchool','','danger') : ''}</div></section>`;
}
function render() {
  cancelGridSelection();
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
function entryEditor(entryId, slot, cell, fromGrid = false) {
  const entry = data.entries.find(item => item.id === entryId);
  const now = Date.now();
  const startAt = entry?.start ?? (cell ? cell.startAt : slot ? +new Date(date+'T'+slot.start) : date === dateKey(new Date()) ? now-1800000 : +new Date(date+'T08:00'));
  const endAt = entry?.end ?? (cell ? cell.endAt : slot ? +new Date(date+'T'+slot.end) : startAt+1800000);
  edit(entry ? 'Zeit bearbeiten' : 'Zeit nachtragen', `
    <label>Tätigkeit <select name="kind">${options([...activities,presence],entry?.kind ?? slot?.kind ?? 'Vorbereitung')}</select></label>
    ${conferenceFields(entry ?? slot)}
    <label>Titel oder Notiz <input name="title" value="${escape(entry?.title ?? slot?.title)}" maxlength="300"></label>
    <div class="field-row"><label>Beginn <input name="start" type="datetime-local" value="${inputTime(startAt)}" required></label>
    <label>Ende <input name="end" type="datetime-local" value="${inputTime(endAt)}" required></label></div>
    ${fromGrid ? '<p id="entryDuration" aria-live="polite"></p>' : ''}`, values => {
    const start = entry && fromGrid && inputTime(entry.start) === values.get('start') ? entry.start : +new Date(values.get('start'));
    const end = entry && fromGrid && inputTime(entry.end) === values.get('end') ? entry.end : +new Date(values.get('end'));
    if (!(end > start && end <= Date.now())) throw new Error('Das Ende muss nach dem Beginn liegen und darf nicht in der Zukunft sein.');
    const checkConflict = fromGrid && (!entry || entry.start !== start || entry.end !== end || entry.kind !== values.get('kind'));
    if (checkConflict) {
      const latest = localStorage.getItem(storageKey);
      const message = workConflict(latest ? JSON.parse(latest) : data,start,end,entryId,values.get('kind'));
      if (message) throw new Error(message);
    }
    return save(db => {
      const updated = {id:entryId || id(), kind:values.get('kind'),...details(values,values.get('kind')),title:values.get('title').trim(),start,end,slot:entry?.slot ?? slot?.id ?? null,day:entry?.day ?? cell?.key ?? date};
      db.entries = [...db.entries.filter(e => e.id !== updated.id), updated];
    });
  }, entry ? button('Löschen','deleteEntry',entry.id,'danger') : '');
  if (fromGrid) {
    const displayDuration = () => {
      const minutes = Math.round((+new Date(editor.elements.end.value)-+new Date(editor.elements.start.value))/60000);
      editor.querySelector('#entryDuration').textContent = minutes > 0 ? 'Dauer: '+minutes+' Minuten' : 'Dauer: –';
    };
    editor.elements.start.addEventListener('input',displayDuration);
    editor.elements.end.addEventListener('input',displayDuration);
    displayDuration();
  }
  bindConferenceFields();
}
function slotEditor(slotId, cell) {
  const slot = data.slots.find(item => item.id === slotId);
  const weekly = slot?.weekly ?? (cell?.weekly ?? !cell?.key);
  const start = slot?.start ?? cell?.time ?? '08:00';
  const end = slot?.end ?? cell?.end ?? gridTime(Math.min(1439,timeMinutes(start)+45));
  edit(slot ? 'Termin bearbeiten' : 'Termin hinzufügen', `
    <label>Tätigkeit <select name="kind">${options(activities,slot?.kind ?? cell?.kind)}</select></label>
    ${conferenceFields(slot)}
    <label><span id="slot-title-label">Fach oder Titel</span> <input name="title" maxlength="300" value="${escape(slot?.title)}"></label>
    <label class="inline"><input type="checkbox" name="weekly"${weekly ? ' checked' : ''}> Wöchentlich wiederholen</label>
    <label id="weekday">Wochentag <select name="weekday">${options(weekdays,slot?.weekly ? weekdays[+slot.day] : weekdays[cell?.day ?? dayStart(cell?.key ?? date).getDay()])}</select></label>
    <label id="slotDate">Datum <input type="date" name="date" value="${escape(slot && !slot.weekly ? slot.day : cell?.key ?? date)}" required></label>
    <div class="field-row"><label>Beginn <input type="time" name="start" value="${start}" required></label><label>Ende <input type="time" name="end" value="${end}" required></label></div>`, values => {
    if (values.get('end') <= values.get('start')) throw new Error('Das Ende muss nach dem Beginn liegen.');
    const repeats = values.has('weekly');
    return save(db => {
      const updated = {id:slotId || id(),kind:values.get('kind'),...details(values,values.get('kind')),title:values.get('title').trim(),weekly:repeats,day:repeats ? weekdays.indexOf(values.get('weekday')) : values.get('date'),start:values.get('start'),end:values.get('end')};
      if (repeats) {
        const version = slot?.weekly ? slot.scheduleFrom : scheduleAt(cell?.key ?? date,db);
        if (version) updated.scheduleFrom = version;
      }
      db.slots = [...db.slots.filter(s => s.id !== updated.id), updated];
    });
  }, slot ? button('Löschen','deleteSlot',slot.id,'danger') : '');
  bindConferenceFields();
  const toggle = editor.elements.weekly;
  const visibility = () => {
    editor.querySelector('#weekday').hidden = !toggle.checked;
    editor.querySelector('#slotDate').hidden = toggle.checked;
  };
  const kind = editor.elements.kind;
  const updateTitle = () => {
    editor.querySelector('#slot-title-label').textContent = kind.value === 'Aufsicht' ? 'Pausenbereich' : 'Fach oder Titel';
    editor.elements.title.placeholder = kind.value === 'Aufsicht' ? 'z. B. Schulhof' : 'z. B. Mathematik 7b';
  };
  kind.addEventListener('change',() => {
    if (kind.value === 'Vertretung' && !slot) {
      toggle.checked = false;
      visibility();
    }
    updateTitle();
  });
  updateTitle();
  toggle.onchange = visibility;
  visibility();
}
function book(slotId) {
  const slot = data.slots.find(s => s.id === slotId);
  if (!slot) return;
  const startAt = +new Date(date+'T'+slot.start), endAt = +new Date(date+'T'+slot.end);
  editor.onsubmit = event => event.preventDefault();
  editor.innerHTML = `<h2>${escape(slot.title || label(slot))}</h2><p>${slot.start}–${slot.end}</p><div class="actions">
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
    const conferenceType = types.find(type => type.toLowerCase() === kind?.toLowerCase());
    const activity = conferenceType ? conference : activities.find(item => item.toLowerCase() === kind?.toLowerCase() && item !== conference);
    const extra = conferenceType ? {conferenceType,subject:''} : {};
    if (weekday < 0 || !isTime(start) || !isTime(end) || end <= start || !activity || !title.length) {
      throw new Error(`Zeile ${index+1} ist ungültig. Format: Tag;Beginn;Ende;Tätigkeit;Titel`);
    }
    result.push({id:id(),kind:activity,...extra,title:title.join(';'),weekly:true,day:weekday,start,end});
  }
  if (!result.length) throw new Error('Die Datei enthält keine Termine.');
  return result;
}
function isTime(value) { return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value); }
function isDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && dateKey(dayStart(value)) === value;
}
function csvImport() {
  const targetDate = date;
  edit('Stundenplan importieren', '<p>UTF-8, Semikolon als Trennzeichen. Beispiel: Mo;08:00;08:45;Unterricht;Mathematik 7b</p><label>CSV-Datei <input name="file" type="file" accept=".csv,.txt,text/plain,text/csv"></label><label>Oder CSV-Text einfügen <textarea name="csv" rows="5"></textarea></label>', async values => {
    const file = values.get('file');
    const rows = csvRows(file.size ? await file.text() : values.get('csv'));
    return save(db => {
      const version = scheduleAt(targetDate,db);
      for (const row of rows) {
        const same = s => s.weekly && (s.scheduleFrom ?? '') === version && s.day === row.day && s.start === row.start && s.end === row.end &&
          s.title === row.title && s.kind === row.kind && s.conferenceType === row.conferenceType;
        if (!db.slots.some(same)) db.slots.push(version ? {...row,scheduleFrom:version} : row);
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
    return save(db => { db.entries = backup.entries; db.slots = backup.slots; db.school = backup.school; db.adjustments = backup.adjustments ?? []; db.scheduleStarts = backup.scheduleStarts ?? []; });
  });
}
function validBackup(db) {
  const hasIdTitle = row => row && typeof row.id === 'string' && typeof row.title === 'string';
  const validDetails = row => row.kind === conference
    ? types.includes(row.conferenceType) && typeof row.subject === 'string' && row.subject.length <= 100
    : row.conferenceType === undefined && row.subject === undefined;
  const validSchool = s => s === null || (s && Number.isFinite(s.lat) && Math.abs(s.lat) <= 90
    && Number.isFinite(s.lon) && Math.abs(s.lon) <= 180 && Number.isFinite(s.radius) && s.radius >= 50 && s.radius <= 1000);
  const isTimestamp = n => Number.isFinite(n) && Math.abs(n) <= 8.64e15;
  if (!(db?.version === 1 && Array.isArray(db.entries) && Array.isArray(db.slots) && validSchool(db.school))) return false;
  if (!db.entries.every(e => hasIdTitle(e) && validDetails(e) && [...activities,presence].includes(e.kind) && isTimestamp(e.start)
    && (e.end === null || (isTimestamp(e.end) && e.end > e.start)) && isDate(e.day)
    && (e.slot === null || typeof e.slot === 'string'))) return false;
  if (!db.slots.every(s => hasIdTitle(s) && validDetails(s) && activities.includes(s.kind) && isTime(s.start) && isTime(s.end) &&
    s.end > s.start && typeof s.weekly === 'boolean' && (s.weekly ? Number.isInteger(s.day) && s.day >= 0 && s.day <= 6 : isDate(s.day)))) return false;
  const starts = db.scheduleStarts ?? [];
  if (!Array.isArray(starts) || !starts.every(isDate) || new Set(starts).size !== starts.length) return false;
  if (db.slots.some(slot => slot.scheduleFrom !== undefined && (!slot.weekly || !starts.includes(slot.scheduleFrom)))) return false;
  if (db.adjustments !== undefined && (!Array.isArray(db.adjustments) || !db.adjustments.every(change =>
    change && isDate(change.day) && hasIdTitle(change.slot) && change.slot.kind === 'Unterricht' &&
    isTime(change.slot.start) && isTime(change.slot.end) && change.slot.end > change.slot.start &&
    (change.replacement === null || (typeof change.replacement === 'string' && change.replacement.trim() && change.replacement.length <= 300))
  ) || new Set(db.adjustments.map(change => change.day+'|'+change.slot.id)).size !== db.adjustments.length)) return false;
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
    if (start(slot.kind,slot.title,slot.id,slotDetails(slot))) dialog.close();
    return;
  }
  if (action !== 'bookExact') return;
  const startAt = +new Date(date+'T'+slot.start), endAt = +new Date(date+'T'+slot.end);
  if (!(endAt > startAt && endAt <= Date.now())) return;
  if (save(db => {
    if (!db.entries.some(e => e.slot === slot.id && e.day === date)) {
      db.entries.push({id:id(),kind:slot.kind,title:slot.title,...slotDetails(slot),start:startAt,end:endAt,slot:slot.id,day:date});
    }
  })) dialog.close();
}

document.addEventListener('click', event => {
  const control = event.target.closest('button');
  if (!control) return;
  if (control.dataset.tab) { tab = control.dataset.tab; render(); return; }
  const {action,value} = control.dataset;
  switch (action) {
    case 'start':
      if (value === conference) {
        edit('Konferenz starten',conferenceFields(),values => start(conference,'',null,details(values,conference)));
        editor.querySelector('.primary').textContent = 'Timer starten';
        bindConferenceFields();
      } else if (start(value) && dialog.open) dialog.close();
      break;
    case 'stop': stop(value); break;
    case 'entry': entryEditor(value); break;
    case 'workEdit': entryEditor(value,null,null,true); break;
    case 'slot': slotEditor(value); break;
    case 'gridSlot': {
      const [key,time] = value.split('|');
      const block = morning.find(item => item[1] === time);
      if (block && isDate(key)) slotEditor('',{key,weekly:true,time,end:block[2],kind:block[3]});
      break;
    }
    case 'lessonMinus': case 'lessonReplace': lessonDialog(value,action); break;
    case 'lessonReset': {
      const [key,slotId] = value.split('|');
      if (save(db => { db.adjustments = (db.adjustments ?? []).filter(change => change.day !== key || change.slot.id !== slotId); })) dialog.close();
      break;
    }
    case 'workCell': workCell(value); break;
    case 'workPlan': case 'workEntry': {
      const [key,time] = value.split('|');
      if (!isDate(key) || !isTime(time)) break;
      if (action === 'workEntry') {
        const minute = timeMinutes(time), range = gridRange(key,minute,minute);
        entryEditor('',null,range,true);
      }
      else slotEditor('',{key,time,end:gridTime(Math.min(1439,timeMinutes(time)+15))});
      break;
    }
    case 'weekStep': {
      date = dateKey(offsetDay(dayStart(date),Number(value)));
      render();
      break;
    }
    case 'book': book(value); break;
    case 'bookEdit': case 'bookExact': case 'bookStart': bookAction(action,value); break;
    case 'deleteEntry': deleteItem('entries',value); break;
    case 'deleteSlot': deleteItem('slots',value); break;
    case 'close': dialog.close(); break;
    case 'csv': csvImport(); break;
    case 'newSchedule': newSchedule(); break;
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
  else if (id === 'workBand') band = value;
  else return;
  render();
});
window.addEventListener('storage', event => {
  if (event.key === storageKey && event.newValue) { data = JSON.parse(event.newValue); render(); }
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { prompted = false; cancelGridSelection(); }
  else { render(); checkSchool(); }
});
setInterval(updateClock,1000);
render();
checkSchool();
if ('serviceWorker' in navigator) {
  const workers = navigator.serviceWorker;
  let controller = workers.controller;
  workers.addEventListener('controllerchange', () => {
    if (controller && workers.controller) note('Lehrzeit wurde aktualisiert. Öffne die App nach dem Speichern erneut.');
    controller = workers.controller;
  });
  workers.register('./sw.js',{updateViaCache:'none'}).then(registration => {
    const checkUpdate = () => {
      if (!document.hidden && navigator.onLine) registration.update().catch(() => {});
    };
    document.addEventListener('visibilitychange',checkUpdate);
    checkUpdate();
  }).catch(() => note('Offline-Modus ist hier nicht verfügbar.'));
}
