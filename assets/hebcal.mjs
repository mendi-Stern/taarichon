// Hebrew calendar helpers built on the ICU Hebrew calendar that ships with every modern
// browser and Node (Intl). Shared by the static build (Node) and the on-page tools (browser).
// All dates are handled as UTC noon so DST and time zones can never shift a day.

const FMT = new Intl.DateTimeFormat("en-u-ca-hebrew", {
  day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
});

export const MONTH_HE = {
  "Tishri": "תשרי", "Heshvan": "חשוון", "Kislev": "כסלו", "Tevet": "טבת", "Shevat": "שבט",
  "Adar I": "אדר א׳", "Adar": "אדר", "Adar II": "אדר ב׳", "Nisan": "ניסן", "Iyar": "אייר",
  "Sivan": "סיוון", "Tamuz": "תמוז", "Av": "אב", "Elul": "אלול",
};

export const MONTH_ORDER = ["Tishri", "Heshvan", "Kislev", "Tevet", "Shevat", "Adar I", "Adar",
  "Adar II", "Nisan", "Iyar", "Sivan", "Tamuz", "Av", "Elul"];

export const WEEKDAY_HE = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
export const GREG_MONTH_HE = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט",
  "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];

const DAY_MS = 86400000;

export function utcDate(y, m, d) {
  return new Date(Date.UTC(y, m - 1, d, 12));
}

export function parseISO(s) {
  const [y, m, d] = s.split("-").map(Number);
  return utcDate(y, m, d);
}

export function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

export function addDays(date, n) {
  return new Date(date.getTime() + n * DAY_MS);
}

export function isLeapYear(hy) {
  return ((7 * hy + 1) % 19) < 7;
}

/** Gregorian Date -> { year, month (ICU English name), day } */
export function toHebrew(date) {
  const parts = Object.fromEntries(FMT.formatToParts(date).map((p) => [p.type, p.value]));
  return { year: Number(parts.year || parts.relatedYear), month: parts.month, day: Number(parts.day) };
}

const yearCache = new Map();

/** All days of a Hebrew year: Map "Month|day" -> Date */
function yearTable(hy) {
  if (yearCache.has(hy)) return yearCache.get(hy);
  const table = new Map();
  let d = utcDate(hy - 3761, 8, 20); // Rosh Hashana is always between Sep 5 and Oct 5
  for (let i = 0; i < 420; i++, d = addDays(d, 1)) {
    const h = toHebrew(d);
    if (h.year === hy) table.set(`${h.month}|${h.day}`, d);
  }
  yearCache.set(hy, table);
  return table;
}

export function monthLength(hy, month) {
  const table = yearTable(hy);
  let n = 0;
  for (let day = 1; day <= 30; day++) if (table.has(`${month}|${day}`)) n = day;
  return n;
}

/** Hebrew date -> Gregorian Date, or null if that day does not exist in that year. */
export function fromHebrew(hy, month, day) {
  return yearTable(hy).get(`${month}|${day}`) || null;
}

/** Months of a Hebrew year in order: 12 in a plain year, 13 (Adar I + Adar II) in a leap year. */
export function monthsOfYear(hy) {
  return MONTH_ORDER.filter((month) => monthLength(hy, month) > 0);
}

/** Every day of a Hebrew year, grouped by month: [{ month, days: [{ day, date }] }] */
export function yearCalendar(hy) {
  return monthsOfYear(hy).map((month) => ({
    month,
    days: Array.from({ length: monthLength(hy, month) }, (_, i) => ({ day: i + 1, date: fromHebrew(hy, month, i + 1) })),
  }));
}

/** Map a month name onto a target year (handles Adar in leap / non-leap years). */
export function mapMonth(month, fromLeap, targetHy) {
  const toLeap = isLeapYear(targetHy);
  if (month === "Adar" && toLeap) return "Adar II"; // common custom (Shulchan Aruch O.C. 55:10)
  if ((month === "Adar I" || month === "Adar II") && !toLeap) return "Adar";
  return month;
}

/** Same Hebrew date in another Hebrew year; a missing 30th rolls to the next day. */
export function anniversary(hDate, targetHy) {
  const month = mapMonth(hDate.month, isLeapYear(hDate.year), targetHy);
  const exact = fromHebrew(targetHy, month, hDate.day);
  if (exact) return { date: exact, shifted: false, month };
  const last = monthLength(targetHy, month);
  return { date: addDays(fromHebrew(targetHy, month, last), hDate.day - last), shifted: true, month };
}

const ONES = ["", "א", "ב", "ג", "ד", "ה", "ו", "ז", "ח", "ט"];
const TENS = ["", "י", "כ", "ל", "מ", "נ", "ס", "ע", "פ", "צ"];
const HUNDREDS = ["", "ק", "ר", "ש", "ת"];

/** 15 -> ט״ו, 787 -> תשפ״ז, 5 -> ה׳ */
export function hebrewNumeral(n) {
  let s = "";
  let rest = n % 1000;
  while (rest >= 400) { s += "ת"; rest -= 400; }
  s += HUNDREDS[Math.floor(rest / 100)];
  rest %= 100;
  if (rest === 15) s += "טו";
  else if (rest === 16) s += "טז";
  else s += TENS[Math.floor(rest / 10)] + ONES[rest % 10];
  if (s.length === 1) return s + "׳";
  return s.slice(0, -1) + "״" + s.slice(-1);
}

export function formatHebrew(h, { withYear = true } = {}) {
  const base = `${hebrewNumeral(h.day)} ב${MONTH_HE[h.month]}`;
  return withYear ? `${base} ${hebrewNumeral(h.year)}` : base;
}

export function formatGregorian(date, { weekday = true } = {}) {
  const d = `${date.getUTCDate()} ב${GREG_MONTH_HE[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
  return weekday ? `יום ${WEEKDAY_HE[date.getUTCDay()]}, ${d}` : d;
}

export function weekday(date) {
  return WEEKDAY_HE[date.getUTCDay()];
}

/**
 * Yahrzeit in Hebrew year `hy`. Returns one option when customs agree, two when they differ:
 *  - died in Adar of a plain year, anniversary in a leap year: Adar I (Ashkenazi, Rema O.C. 568:7)
 *    or Adar II (Sephardi, Shulchan Aruch there). Note: bar mitzvah uses Adar II for everyone.
 *  - died on a 30th that the target month lacks: the 29th or the 1st of the next month.
 */
export function yahrzeitOptions(death, hy) {
  if (death.month === "Adar" && isLeapYear(hy)) {
    return ["Adar I", "Adar II"].map((month) => {
      const exact = fromHebrew(hy, month, death.day);
      const date = exact || addDays(fromHebrew(hy, month, 29), 1);
      return { date, custom: month === "Adar I" ? "מנהג אשכנז (הרמ״א): אדר א׳" : "מנהג ספרד (השולחן ערוך): אדר ב׳" };
    });
  }
  const a = anniversary(death, hy);
  if (a.shifted) {
    return [{ date: addDays(a.date, -1), custom: "יש נוהגים ביום האחרון של החודש (כ״ט)" },
      { date: a.date, custom: "ויש נוהגים ב-א׳ בחודש שאחריו" }];
  }
  return [{ date: a.date, custom: null }];
}

/** Bar / bat mitzvah: 13 (boy) or 12 (girl) Hebrew years after the Hebrew birth date. */
export function barMitzvah(birthDate, { afterSunset = false, girl = false } = {}) {
  const born = afterSunset ? addDays(birthDate, 1) : birthDate;
  const h = toHebrew(born);
  const targetHy = h.year + (girl ? 12 : 13);
  const a = anniversary(h, targetHy);
  let shabbat = a.date;
  while (shabbat.getUTCDay() !== 6) shabbat = addDays(shabbat, 1);
  return { birthHebrew: h, date: a.date, hebrew: toHebrew(a.date), shifted: a.shifted, shabbat,
    age: girl ? 12 : 13, mappedAdar: a.month !== h.month };
}

// ---------- gematria ----------
const GEMATRIA = {
  "א": 1, "ב": 2, "ג": 3, "ד": 4, "ה": 5, "ו": 6, "ז": 7, "ח": 8, "ט": 9, "י": 10, "כ": 20,
  "ך": 20, "ל": 30, "מ": 40, "ם": 40, "נ": 50, "ן": 50, "ס": 60, "ע": 70, "פ": 80, "ף": 80,
  "צ": 90, "ץ": 90, "ק": 100, "ר": 200, "ש": 300, "ת": 400,
};
const FINALS_GADOL = { "ך": 500, "ם": 600, "ן": 700, "ף": 800, "ץ": 900 };
const ALPHABET = "אבגדהוזחטיכלמנסעפצקרשת";

export function gematria(text) {
  let standard = 0, gadol = 0, katan = 0, ordinal = 0, letters = 0;
  for (const ch of text) {
    const v = GEMATRIA[ch];
    if (!v) continue;
    letters++;
    standard += v;
    gadol += FINALS_GADOL[ch] || v;
    katan += v % 9 === 0 ? 9 : v % 9 || 9;
    const base = { "ך": "כ", "ם": "מ", "ן": "נ", "ף": "פ", "ץ": "צ" }[ch] || ch;
    ordinal += ALPHABET.indexOf(base) + 1;
  }
  return { standard, gadol, katan, ordinal, letters };
}

// ---------- holidays (Israel) ----------
// Each rule returns { start, end, notes[] } for a Hebrew year.
function dayOf(hy, month, day) {
  return fromHebrew(hy, month, day);
}
const adar = (hy) => (isLeapYear(hy) ? "Adar II" : "Adar");

export const HOLIDAYS = [
  {
    slug: "rosh-hashana", name: "ראש השנה", days: 2,
    rule: (hy) => ({ start: dayOf(hy, "Tishri", 1) }),
    about: "ראש השנה פותח את השנה העברית החדשה ואת עשרת ימי התשובה. נוהגים לתקוע בשופר, לאכול סימנים (תפוח בדבש, רימון) ולהתפלל תפילות מיוחדות. זה החג היחיד שנמשך יומיים גם בארץ ישראל.",
  },
  {
    slug: "yom-kippur", name: "יום כיפור", days: 1,
    rule: (hy) => ({ start: dayOf(hy, "Tishri", 10) }),
    about: "יום כיפור, יום הכיפורים, הוא היום הקדוש ביותר בשנה. יום של צום ותפילה שבו מבקשים סליחה ומחילה. הצום מתחיל לפני השקיעה בערב החג ונמשך עד צאת הכוכבים למחרת, כ-25 שעות.",
  },
  {
    slug: "sukkot", name: "סוכות", days: 7,
    rule: (hy) => ({ start: dayOf(hy, "Tishri", 15) }),
    about: "בסוכות יושבים בסוכה שבעה ימים, זכר לסוכות שבהן ישבו בני ישראל במדבר, ומברכים על ארבעת המינים. בארץ היום הראשון הוא יום טוב, ואחריו ימי חול המועד. היום השביעי הוא הושענא רבה.",
  },
  {
    slug: "simchat-torah", name: "שמחת תורה", days: 1,
    rule: (hy) => ({ start: dayOf(hy, "Tishri", 22) }),
    about: "בארץ ישראל שמחת תורה חל באותו יום עם שמיני עצרת, מיד אחרי שבעת ימי סוכות. מסיימים את קריאת התורה ומתחילים אותה מחדש, ורוקדים בהקפות עם ספרי התורה.",
  },
  {
    slug: "hanukkah", name: "חנוכה", days: 8, eveLabel: "הדלקת הנר הראשון",
    rule: (hy) => ({ start: dayOf(hy, "Kislev", 25) }),
    about: "חנוכה, חג האורים, מציין את ניצחון המכבים ואת נס פך השמן בבית המקדש. במשך שמונה לילות מדליקים נרות בחנוכייה: נר אחד בלילה הראשון, ומוסיפים נר בכל לילה. את הנר הראשון מדליקים בערב שלפני היום הראשון של החג.",
  },
  {
    slug: "tu-bishvat", name: "ט״ו בשבט", days: 1,
    rule: (hy) => ({ start: dayOf(hy, "Shevat", 15) }),
    about: "ט״ו בשבט הוא ראש השנה לאילנות. נוהגים לאכול פירות משבעת המינים ופירות יבשים, ובישראל הוא הפך גם ליום של נטיעות ושל מודעות לסביבה. זה לא יום טוב, ואין בו איסור מלאכה.",
  },
  {
    slug: "purim", name: "פורים", days: 1,
    rule: (hy) => {
      const start = dayOf(hy, adar(hy), 14);
      const shushan = dayOf(hy, adar(hy), 15);
      const notes = [];
      if (isLeapYear(hy)) notes.push(`השנה ${hebrewNumeral(hy)} היא שנה מעוברת, ולכן פורים חל באדר ב׳.`);
      notes.push(`שושן פורים, שנחגג בירושלים, חל ביום ${weekday(shushan)}, ${formatGregorian(shushan, { weekday: false })}.`);
      if (shushan.getUTCDay() === 6) notes.push("השנה חל פורים המשולש בירושלים: ט״ו באדר חל בשבת, ולכן חגיגות שושן פורים מתחלקות על פני שלושה ימים (שישי, שבת וראשון).");
      return { start, notes };
    },
    about: "פורים מציין את הצלת היהודים בפרס מגזרת המן, כפי שמסופר במגילת אסתר. מצוות היום הן קריאת המגילה, משלוח מנות, מתנות לאביונים וסעודת פורים. מקובל גם להתחפש.",
  },
  {
    slug: "pesach", name: "פסח", days: 7, eveLabel: "ליל הסדר",
    rule: (hy) => ({ start: dayOf(hy, "Nisan", 15) }),
    about: "פסח, חג החירות, מציין את יציאת מצרים. בערב החג מקיימים את ליל הסדר וקוראים בהגדה. במשך שבעת ימי החג בארץ אוכלים מצות ולא אוכלים חמץ. היום הראשון והשביעי הם ימים טובים, וביניהם חול המועד.",
  },
  {
    slug: "yom-hashoah", name: "יום השואה", days: 1, noEve: true,
    rule: (hy) => {
      let start = dayOf(hy, "Nisan", 27);
      const notes = [];
      if (start.getUTCDay() === 5) { start = addDays(start, -1); notes.push("כ״ז בניסן חל השנה ביום שישי, ולכן יום השואה הוקדם ליום חמישי."); }
      else if (start.getUTCDay() === 0) { start = addDays(start, 1); notes.push("כ״ז בניסן חל השנה ביום ראשון, ולכן יום השואה נדחה ליום שני, כדי שהטקסים לא יתקיימו במוצאי שבת."); }
      return { start, notes };
    },
    about: "יום הזיכרון לשואה ולגבורה מתחיל בערב בטקס ממלכתי ביד ושם. בעשר בבוקר נשמעת צפירה של שתי דקות בכל הארץ. המועד נקבע לפי כ״ז בניסן, וזז כשהוא נופל ליד שבת.",
  },
  {
    slug: "yom-hazikaron", name: "יום הזיכרון", days: 1, noEve: true,
    rule: (hy) => ({ start: addDays(atzmaut(hy).start, -1), notes: atzmaut(hy).notes }),
    about: "יום הזיכרון לחללי מערכות ישראל ולנפגעי פעולות האיבה חל תמיד יום אחד לפני יום העצמאות. הוא מתחיל בערב בצפירה של דקה אחת, ובבוקר נשמעת צפירה של שתי דקות.",
  },
  {
    slug: "yom-haatzmaut", name: "יום העצמאות", days: 1, noEve: true,
    rule: (hy) => atzmaut(hy),
    about: "יום העצמאות מציין את הכרזת המדינה ב-ה׳ באייר תש״ח (14 במאי 1948). בערב החג מתקיים טקס הדלקת המשואות בהר הרצל. כדי למנוע חילול שבת, המועד מוקדם או נדחה כשה׳ באייר נופל בסמוך לשבת.",
  },
  {
    slug: "lag-baomer", name: "ל״ג בעומר", days: 1,
    rule: (hy) => ({ start: dayOf(hy, "Iyar", 18) }),
    about: "ל״ג בעומר, היום ה-33 בספירת העומר, קשור בהילולת רבי שמעון בר יוחאי ובמרד בר כוכבא. נוהגים להדליק מדורות בערב החג, ורבים עולים למירון.",
  },
  {
    slug: "shavuot", name: "שבועות", days: 1,
    rule: (hy) => ({ start: dayOf(hy, "Sivan", 6) }),
    about: "שבועות מציין את מתן תורה בהר סיני, וגם את חג הביכורים וקציר החיטים. נוהגים לאכול מאכלי חלב ולקרוא את מגילת רות, ורבים לומדים תורה כל הלילה (תיקון ליל שבועות). בארץ החג נמשך יום אחד.",
  },
  {
    slug: "tisha-bav", name: "תשעה באב", days: 1, eveLabel: "תחילת הצום",
    rule: (hy) => {
      let start = dayOf(hy, "Av", 9);
      const notes = [];
      if (start.getUTCDay() === 6) { start = addDays(start, 1); notes.push("ט׳ באב חל השנה בשבת, ולכן הצום נדחה ליום ראשון, י׳ באב (״תשעה באב נדחה״)."); }
      return { start, notes };
    },
    about: "תשעה באב הוא יום אבל וצום לזכר חורבן בית המקדש הראשון והשני ואסונות נוספים. הצום מתחיל בשקיעה בערב ונמשך עד צאת הכוכבים למחרת. קוראים את מגילת איכה ואומרים קינות.",
  },
  {
    slug: "tu-bav", name: "ט״ו באב", days: 1,
    rule: (hy) => ({ start: dayOf(hy, "Av", 15) }),
    about: "ט״ו באב, חג האהבה העברי, היה בימי בית המקדש יום שמח שבו בנות ירושלים יצאו לחולל בכרמים. היום הוא נחגג כיום של אהבה וזוגיות, ורבים בוחרים בו להתחתן.",
  },
];

function atzmaut(hy) {
  const five = dayOf(hy, "Iyar", 5);
  const dow = five.getUTCDay();
  const notes = [];
  let start = five;
  if (dow === 5) { start = addDays(five, -1); notes.push("ה׳ באייר חל השנה ביום שישי, ולכן יום העצמאות הוקדם ליום חמישי (ד׳ באייר) ויום הזיכרון ליום רביעי."); }
  else if (dow === 6) { start = addDays(five, -2); notes.push("ה׳ באייר חל השנה בשבת, ולכן יום העצמאות הוקדם ליום חמישי (ג׳ באייר) ויום הזיכרון ליום רביעי."); }
  else if (dow === 1) { start = addDays(five, 1); notes.push("ה׳ באייר חל השנה ביום שני, ולכן יום העצמאות נדחה ליום שלישי (ו׳ באייר), כדי שיום הזיכרון לא יתחיל במוצאי שבת."); }
  return { start, notes };
}

/** Occurrence of a holiday in a Hebrew year. */
export function holidayIn(holiday, hy) {
  const r = holiday.rule(hy);
  const end = addDays(r.start, holiday.days - 1);
  return { hy, start: r.start, end, eve: addDays(r.start, -1), notes: r.notes || [],
    hebrewStart: toHebrew(r.start), hebrewEnd: toHebrew(end) };
}

/** Holiday days of a Hebrew year: Map ISO date -> [{ holiday, occ, dayNumber }] */
export function holidaysByDate(hy) {
  const map = new Map();
  for (const holiday of HOLIDAYS) {
    const occ = holidayIn(holiday, hy);
    for (let i = 0; i < holiday.days; i++) {
      const key = isoDate(addDays(occ.start, i));
      if (!map.has(key)) map.set(key, []);
      map.get(key).push({ holiday, occ, dayNumber: i + 1 });
    }
  }
  return map;
}

/** Occurrence whose first day falls in a Gregorian year. */
export function holidayInGregorianYear(holiday, gy) {
  for (const hy of [gy + 3760, gy + 3761]) {
    const occ = holidayIn(holiday, hy);
    if (occ.start.getUTCFullYear() === gy) return occ;
  }
  return null;
}
