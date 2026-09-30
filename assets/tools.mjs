import {
  MONTH_HE, MONTH_ORDER, addDays, anniversary, barMitzvah, formatGregorian, formatHebrew,
  fromHebrew, gematria, hebrewNumeral, isLeapYear, parseISO, toHebrew, utcDate, yahrzeitOptions,
} from "./hebcal.mjs";

const $ = (sel, el = document) => el.querySelector(sel);
const h = (html) => { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content; };
const now = new Date();
const today = utcDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
const daysUntil = (d) => Math.round((d - today) / 86400000);

// today's date on the home page
const th = $("[data-today-hebrew]");
if (th) {
  th.textContent = formatHebrew(toHebrew(today));
  $("[data-today-greg]").textContent = formatGregorian(today);
}

// countdowns on holiday pages
for (const el of document.querySelectorAll("[data-countdown]")) {
  const n = daysUntil(parseISO(el.dataset.countdown));
  if (n > 1) el.textContent = `עוד ${n} ימים עד ${el.dataset.name}.`;
  else if (n === 1) el.textContent = `${el.dataset.name} מחר!`;
  else if (n === 0) el.textContent = `${el.dataset.name} היום!`;
}

const sunsetBox = `<div class="row"><label><input type="checkbox" name="sunset"> הלידה הייתה אחרי השקיעה</label></div>`;

const tools = {
  "bar-mitzvah"(root) {
    root.append(h(`<form>
      <label for="bd">תאריך לידה (לועזי)</label>
      <input id="bd" type="date" name="birth" required>
      ${sunsetBox}
      <div class="row"><label><input type="radio" name="kind" value="boy" checked> בר מצווה (בן, 13)</label>
      <label><input type="radio" name="kind" value="girl"> בת מצווה (בת, 12)</label></div>
    </form><div class="result" aria-live="polite"></div>`));
    const form = $("form", root), out = $(".result", root);
    const run = () => {
      if (!form.birth.value) return;
      const girl = form.kind.value === "girl";
      const r = barMitzvah(parseISO(form.birth.value), { afterSunset: form.sunset.checked, girl });
      const n = daysUntil(r.date);
      const notes = [];
      if (r.mappedAdar) notes.push(`נולד/ה ב${MONTH_HE[r.birthHebrew.month]}, ובשנת ${girl ? "בת" : "בר"} המצווה החודש המקביל הוא ${MONTH_HE[r.hebrew.month]} (לפי המנהג הנפוץ).`);
      if (r.shifted) notes.push(`בשנת ${girl ? "בת" : "בר"} המצווה אין ל׳ בחודש, ולכן התאריך עובר ליום שאחריו.`);
      out.replaceChildren(h(`
        <p class="label">תאריך הלידה העברי</p><p class="big">${formatHebrew(r.birthHebrew)}</p>
        <p class="label">${girl ? "בת" : "בר"} המצווה (גיל ${r.age})</p>
        <p class="big">${formatHebrew(r.hebrew)}</p>
        <p>${formatGregorian(r.date)}${n > 0 ? ` · בעוד ${n} ימים` : n === 0 ? " · היום!" : ""}</p>
        <p class="label">השבת הראשונה ביום הזה או אחריו</p><p>${formatGregorian(r.shabbat)}</p>
        ${notes.map((x) => `<p class="note">${x}</p>`).join("")}
        <p class="label">היום העברי מתחיל בערב, ולכן ${girl ? "הבת נעשית בת" : "הבן נעשה בר"} מצווה כבר בערב של ${formatGregorian(addDays(r.date, -1))}.</p>`));
    };
    form.addEventListener("input", run);
    form.addEventListener("change", run);
  },

  converter(root) {
    const y = toHebrew(today).year;
    root.append(h(`<form class="g2h"><fieldset><legend>לועזי ← עברי</legend>
      <label for="gd">תאריך לועזי</label><input id="gd" type="date" name="d">${sunsetBox.replace("הלידה הייתה", "")}
      </fieldset></form><div class="result r1" aria-live="polite"></div>
      <form class="h2g"><fieldset><legend>עברי ← לועזי</legend>
      <div class="inline">
        <select name="day" aria-label="יום">${Array.from({ length: 30 }, (_, i) => `<option value="${i + 1}">${hebrewNumeral(i + 1)}</option>`).join("")}</select>
        <select name="month" aria-label="חודש"></select>
        <input type="number" name="year" value="${y}" min="3762" max="6000" aria-label="שנה עברית">
      </div><p class="label">השנה בספרות, למשל ${y} = ${hebrewNumeral(y)}</p></fieldset></form>
      <div class="result r2" aria-live="polite"></div>`));
    const g = $(".g2h", root), hf = $(".h2g", root);
    g.addEventListener("input", () => {
      if (!g.d.value) return;
      const d = addDays(parseISO(g.d.value), g.sunset.checked ? 1 : 0);
      $(".r1", root).replaceChildren(h(`<p class="big">${formatHebrew(toHebrew(d))}</p>`));
    });
    const fillMonths = () => {
      const leap = isLeapYear(Number(hf.year.value));
      const cur = hf.month.value;
      hf.month.replaceChildren(...MONTH_ORDER.filter((m) => (leap ? m !== "Adar" : !m.startsWith("Adar ")))
        .map((m) => new Option(MONTH_HE[m], m)));
      if ([...hf.month.options].some((o) => o.value === cur)) hf.month.value = cur;
    };
    const run = () => {
      const hy = Number(hf.year.value);
      if (!(hy > 3761 && hy < 6001)) return;
      fillMonths();
      const d = fromHebrew(hy, hf.month.value, Number(hf.day.value));
      $(".r2", root).replaceChildren(h(d ? `<p class="big">${formatGregorian(d)}</p><p class="label">התאריך העברי מתחיל בערב הקודם.</p>`
        : `<p>אין תאריך כזה בשנה ${hebrewNumeral(hy)} (לחודש יש פחות ימים).</p>`));
    };
    fillMonths();
    hf.addEventListener("input", run);
    hf.addEventListener("change", run);
  },

  "hebrew-birthday"(root) {
    root.append(h(`<form><label for="bd">תאריך לידה (לועזי)</label>
      <input id="bd" type="date" name="birth">${sunsetBox}</form><div class="result" aria-live="polite"></div>`));
    const form = $("form", root), out = $(".result", root);
    const run = () => {
      if (!form.birth.value) return;
      const born = addDays(parseISO(form.birth.value), form.sunset.checked ? 1 : 0);
      const hb = toHebrew(born);
      const start = toHebrew(today).year;
      const rows = [];
      for (let hy = start; rows.length < 10 && hy < start + 12; hy++) {
        if (hy <= hb.year) continue;
        const a = anniversary(hb, hy);
        if (a.date < today) continue;
        rows.push(`<li>${formatGregorian(a.date)}: ${formatHebrew(toHebrew(a.date))} (גיל ${hy - hb.year})</li>`);
      }
      out.replaceChildren(h(`<p class="label">התאריך העברי של יום הלידה</p><p class="big">${formatHebrew(hb)}</p>
        <p class="label">יום ההולדת העברי בשנים הקרובות</p><ul>${rows.join("")}</ul>`));
    };
    form.addEventListener("input", run);
    form.addEventListener("change", run);
  },

  yahrzeit(root) {
    root.append(h(`<form><label for="dd">תאריך הפטירה (לועזי)</label>
      <input id="dd" type="date" name="death" required>
      <div class="row"><label><input type="checkbox" name="sunset"> הפטירה הייתה אחרי השקיעה</label></div>
    </form><div class="result" aria-live="polite"></div>`));
    const form = $("form", root), out = $(".result", root);
    const fmt = (o) => `${formatGregorian(o.date)}: ${formatHebrew(toHebrew(o.date))}`;
    const run = () => {
      if (!form.death.value) return;
      const hd = toHebrew(addDays(parseISO(form.death.value), form.sunset.checked ? 1 : 0));
      const start = toHebrew(today).year;
      const years = [];
      for (let hy = Math.max(start, hd.year + 1); years.length < 10 && hy < start + 12; hy++) {
        const opts = yahrzeitOptions(hd, hy);
        if (opts.every((o) => o.date < today)) continue;
        years.push({ hy, opts });
      }
      if (!years.length) return out.replaceChildren();
      const first = years[0];
      const split = years.some((y) => y.opts.length > 1);
      const nextHtml = first.opts.map((o) => `<p class="big">${formatGregorian(o.date)}</p><p>${formatHebrew(toHebrew(o.date))}${o.custom ? ` · ${o.custom}` : ""}${daysUntil(o.date) > 0 ? ` · בעוד ${daysUntil(o.date)} ימים` : ""}</p>`).join("");
      const rows = years.map((y) => y.opts.length === 1 ? `<li>${fmt(y.opts[0])} (השנה ה-${y.hy - hd.year})</li>`
        : `<li>השנה ה-${y.hy - hd.year}, יש שני מנהגים:<ul>${y.opts.map((o) => `<li>${fmt(o)} · ${o.custom}</li>`).join("")}</ul></li>`).join("");
      out.replaceChildren(h(`<p class="label">התאריך העברי של הפטירה</p><p class="big">${formatHebrew(hd)}</p>
        <p class="label">היארצייט הקרוב</p>${nextHtml}
        ${split ? `<p class="note">בחלק מהשנים יש הבדל בין המנהגים. כדאי לברר עם רב הקהילה לפי איזה מנהג המשפחה נוהגת.</p>` : ""}
        <p class="label">היארצייט בשנים הקרובות</p><ul>${rows}</ul>
        <p class="label">היום העברי מתחיל בערב, ולכן נר הנשמה מודלק כבר בערב הקודם.</p>`));
    };
    form.addEventListener("input", run);
    form.addEventListener("change", run);
  },


  countdown(root) {
    const target = new Date(`${root.dataset.target}T00:00:00`);
    const name = root.dataset.name;
    const el = document.createElement("div");
    root.append(el);
    const tick = () => {
      const diff = target - new Date();
      if (diff <= 0) { el.innerHTML = `<p class="big">${name} כבר כאן!</p>`; return; }
      const d = Math.floor(diff / 86400000);
      const hh = Math.floor(diff / 3600000) % 24;
      const mm = Math.floor(diff / 60000) % 60;
      const ss = Math.floor(diff / 1000) % 60;
      el.innerHTML = `<div class="values">
        <div>ימים<b>${d}</b></div><div>שעות<b>${hh}</b></div><div>דקות<b>${mm}</b></div><div>שניות<b>${ss}</b></div>
      </div>`;
    };
    tick();
    setInterval(tick, 1000);
  },

  gematria(root) {
    root.append(h(`<form><label for="gt">מילה, שם או משפט</label>
      <textarea id="gt" name="t" placeholder="למשל: שלום"></textarea></form><div class="result" aria-live="polite"></div>`));
    const form = $("form", root), out = $(".result", root);
    form.addEventListener("input", () => {
      const g = gematria(form.t.value);
      if (!g.letters) return out.replaceChildren();
      out.replaceChildren(h(`<div class="values">
        <div>גימטריה רגילה<b>${g.standard}</b></div><div>גימטריה גדולה<b>${g.gadol}</b></div>
        <div>מספר קטן<b>${g.katan}</b></div><div>מספר סידורי<b>${g.ordinal}</b></div></div>
        <p class="label">${g.letters} אותיות עבריות נספרו.</p>`));
    });
  },
};

// Prefill from the URL (?birth=2013-09-26&sunset=1&kind=girl) so results can be shared.
function prefill(root) {
  const params = new URLSearchParams(location.search);
  const form = root.querySelector("form");
  if (!form || ![...params.keys()].length) return;
  for (const [k, v] of params) {
    const field = form.elements[k];
    if (!field) continue;
    if (field instanceof RadioNodeList) field.value = v;
    else if (field.type === "checkbox") field.checked = v === "1";
    else field.value = v;
  }
  form.dispatchEvent(new Event("input", { bubbles: true }));
}

for (const el of document.querySelectorAll("[data-tool]")) {
  tools[el.dataset.tool]?.(el);
  prefill(el);
}
