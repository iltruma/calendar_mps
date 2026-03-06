// === Constants ===

const MONTHS = [
    "GEN", "FEB", "MAR", "APR", "MAG", "GIU",
    "LUG", "AGO", "SET", "OTT", "NOV", "DIC"
];

const ABSENCE_TYPES = [
    { code: "F",  label: "Ferie" },
    { code: "E",  label: "Ex Festivita" },
];

const DEFAULT_BUDGETS = {
    F: { total: 18, unit: "giorni" },
    E: { total: 30, unit: "ore" },
};

// Returns default hours for E based on day of week
// Mon-Thu: 7h30m = 7.5h, Fri: 7h
function getDefaultHoursForDay(date) {
    const dow = date.day(); // 0=Sun, 5=Fri, 6=Sat
    return dow === 5 ? 7 : 7.5;
}

// Format decimal hours to hh:mm string
function formatHours(decimalHours) {
    const h = Math.floor(decimalHours);
    const m = Math.round((decimalHours - h) * 60);
    return `${h}:${String(m).padStart(2, "0")}`;
}

// Parse hh:mm or decimal input to decimal hours
function parseHoursInput(input) {
    input = input.trim().replace(",", ".");
    if (input.includes(":")) {
        const [h, m] = input.split(":");
        return parseInt(h, 10) + parseInt(m || 0, 10) / 60;
    }
    return parseFloat(input);
}

// Festivita nazionali (mese 1-indexed) -> returns Map("m-d" -> label)
function getHolidays(year) {
    const fixed = [
        [1, 1,   "Capodanno"],
        [1, 6,   "Epifania"],
        [4, 25,  "Liberazione"],
        [5, 1,   "Lavoratori"],
        [6, 2,   "Repubblica"],
        [8, 15,  "Ferragosto"],
        [11, 1,  "Ognissanti"],
        [12, 8,  "Immacolata"],
        [12, 25, "Natale"],
        [12, 26, "S.Stefano"],
    ];

    const easter = computeEaster(year);
    const easterDay = dayjs(easter);
    const easterMon = easterDay.add(1, "day");

    const holidays = new Map();
    for (const [m, d, label] of fixed) {
        holidays.set(`${m}-${d}`, label);
    }
    holidays.set(`${easterDay.month() + 1}-${easterDay.date()}`, "Pasqua");
    holidays.set(`${easterMon.month() + 1}-${easterMon.date()}`, "Pasquetta");

    return holidays;
}

// Prefestivi: giorno prima di ogni festivita (se lavorativo)
// + 31 dicembre (prefestivo di Capodanno)
function getPrefestivi(year, holidays) {
    const prefestivi = new Map();

    // 31 dicembre e sempre prefestivo
    prefestivi.set(`12-31`, "Pre Capod.");

    for (const [key, label] of holidays) {
        const [m, d] = key.split("-").map(Number);
        const prev = dayjs(new Date(year, m - 1, d)).subtract(1, "day");
        const prevKey = `${prev.month() + 1}-${prev.date()}`;
        const prevDow = prev.day();

        // Solo se il giorno prima e lavorativo (non weekend, non gia festivo)
        if (prevDow !== 0 && prevDow !== 6 && !holidays.has(prevKey) && !prefestivi.has(prevKey)) {
            prefestivi.set(prevKey, `Pre ${label}`);
        }
    }

    return prefestivi;
}

function computeEaster(year) {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month - 1, day);
}

// === State ===

let state = {
    year: dayjs().year(),
    profileId: null,
};

function getStorageKey() {
    return "calendar_mps_data";
}

function loadAllData() {
    const raw = localStorage.getItem(getStorageKey());
    if (!raw) return { profiles: {} };
    try { return JSON.parse(raw); } catch { return { profiles: {} }; }
}

function saveAllData(data) {
    localStorage.setItem(getStorageKey(), JSON.stringify(data));
}

function getProfile() {
    const data = loadAllData();
    return data.profiles[state.profileId] || null;
}

function saveProfile(profile) {
    const data = loadAllData();
    data.profiles[state.profileId] = profile;
    saveAllData(data);
}

function saveLastProfileId(id) {
    localStorage.setItem("calendar_mps_last_profile", id || "");
}

function loadLastProfileId() {
    return localStorage.getItem("calendar_mps_last_profile") || null;
}

function createProfile(name) {
    const data = loadAllData();
    const id = "p_" + Date.now();
    data.profiles[id] = {
        name: name,
        budgets: JSON.parse(JSON.stringify(DEFAULT_BUDGETS)),
        // absences: { "2026-3-15": { type: "F" }, "2026-3-16": { type: "E", hours: 3.5 } }
        absences: {},
    };
    saveAllData(data);
    return id;
}

function deleteProfile(id) {
    const data = loadAllData();
    delete data.profiles[id];
    saveAllData(data);
}

// === DOM References ===

const yearEl = document.getElementById("current-year");
const prevYearBtn = document.getElementById("prev-year");
const nextYearBtn = document.getElementById("next-year");
const profileSelect = document.getElementById("profile-select");
const newProfileBtn = document.getElementById("new-profile-btn");
const deleteProfileBtn = document.getElementById("delete-profile-btn");
const appContent = document.getElementById("app-content");
const noProfileMsg = document.getElementById("no-profile-msg");
const calendarBody = document.getElementById("calendar-body");
const calendarHead = document.querySelector("#calendar-table thead tr");

// === Rendering ===

function render() {
    yearEl.textContent = state.year;
    populateProfileSelect();

    if (!state.profileId || !getProfile()) {
        appContent.classList.add("hidden");
        noProfileMsg.classList.remove("hidden");
        return;
    }

    noProfileMsg.classList.add("hidden");
    appContent.classList.remove("hidden");

    renderCalendar();
    updateCounters();
}

function populateProfileSelect() {
    const data = loadAllData();
    const profiles = data.profiles || {};
    const ids = Object.keys(profiles);

    profileSelect.innerHTML = '<option value="">-- Seleziona profilo --</option>';
    for (const id of ids) {
        const opt = document.createElement("option");
        opt.value = id;
        opt.textContent = profiles[id].name;
        if (id === state.profileId) opt.selected = true;
        profileSelect.appendChild(opt);
    }
}

function renderCalendar() {
    const year = state.year;
    const holidays = getHolidays(year);
    const prefestivi = getPrefestivi(year, holidays);

    // Header
    calendarHead.innerHTML = '<th class="month-col"></th><th class="week-col">S</th>';
    for (let d = 1; d <= 31; d++) {
        const th = document.createElement("th");
        th.textContent = d;
        calendarHead.appendChild(th);
    }

    // Body
    calendarBody.innerHTML = "";
    for (let m = 0; m < 12; m++) {
        const tr = document.createElement("tr");

        const monthTd = document.createElement("td");
        monthTd.className = "month-cell";
        monthTd.textContent = MONTHS[m];
        tr.appendChild(monthTd);

        const weekTd = document.createElement("td");
        weekTd.className = "week-cell";
        weekTd.textContent = dayjs(new Date(year, m, 1)).isoWeek();
        tr.appendChild(weekTd);

        const daysInMonth = dayjs(new Date(year, m, 1)).daysInMonth();
        const profile = getProfile();

        for (let d = 1; d <= 31; d++) {
            const td = document.createElement("td");
            td.className = "day-cell";

            if (d > daysInMonth) {
                td.classList.add("empty", "blocked");
                tr.appendChild(td);
                continue;
            }

            const date = dayjs(new Date(year, m, d));
            const dow = date.day();
            const isWeekend = dow === 0 || dow === 6;
            const dayKey = `${m + 1}-${d}`;
            const holidayLabel = holidays.get(dayKey);
            const isHoliday = !!holidayLabel;
            const prefestivoLabel = prefestivi.get(dayKey);
            const isPrefestivo = !!prefestivoLabel && !isWeekend && !isHoliday;
            const key = `${year}-${m + 1}-${d}`;
            const absence = profile.absences[key] || null;

            // Holiday wins over weekend visually (red even on weekend)
            if (isHoliday) {
                td.classList.add("holiday", "blocked");
                td.textContent = holidayLabel;
                td.title = holidayLabel;
            } else if (isWeekend) {
                td.classList.add("weekend", "blocked");
            }

            if (isPrefestivo) {
                td.classList.add("prefestivo", "blocked");
                td.textContent = prefestivoLabel;
                td.title = prefestivoLabel;
            }

            if (!isWeekend && !isHoliday && !isPrefestivo) {
                const typeCode = absence ? absence.type : "";

                if (typeCode) {
                    td.setAttribute("data-value", typeCode);
                    if (typeCode === "E" && absence.hours != null) {
                        td.textContent = "E";
                        td.title = formatHours(absence.hours);
                    } else {
                        td.textContent = typeCode;
                    }
                }

                const select = document.createElement("select");
                select.className = "cell-select";
                select.dataset.key = key;
                select.dataset.dow = dow;

                const emptyOpt = document.createElement("option");
                emptyOpt.value = "";
                emptyOpt.textContent = "\u2014";
                if (!typeCode) emptyOpt.selected = true;
                select.appendChild(emptyOpt);

                for (const t of ABSENCE_TYPES) {
                    const opt = document.createElement("option");
                    opt.value = t.code;
                    opt.textContent = `${t.code} - ${t.label}`;
                    if (typeCode === t.code) opt.selected = true;
                    select.appendChild(opt);
                }

                select.addEventListener("change", onSelectChange);
                td.appendChild(select);
            }

            tr.appendChild(td);
        }

        calendarBody.appendChild(tr);
    }
}

function updateCounters() {
    const profile = getProfile();
    if (!profile) return;

    let fDays = 0;
    let eHours = 0;

    for (const [key, absence] of Object.entries(profile.absences)) {
        if (!key.startsWith(state.year + "-")) continue;
        if (absence.type === "F") fDays++;
        if (absence.type === "E" && absence.hours != null) eHours += absence.hours;
    }

    // Ferie counter
    const fEl = document.getElementById("counter-F");
    const fBudget = profile.budgets.F || DEFAULT_BUDGETS.F;
    fEl.querySelector(".used").textContent = fDays;
    fEl.querySelector(".total").textContent = fBudget.total;
    fEl.classList.toggle("over-budget", fDays > fBudget.total);

    // Ex Festivita counter (in ore, formato hh:mm)
    const eEl = document.getElementById("counter-E");
    const eBudget = profile.budgets.E || DEFAULT_BUDGETS.E;
    eEl.querySelector(".used").textContent = formatHours(eHours);
    eEl.querySelector(".total").textContent = formatHours(eBudget.total);
    eEl.classList.toggle("over-budget", eHours > eBudget.total);
}

// === Event Handlers ===

function onSelectChange(e) {
    const select = e.target;
    const key = select.dataset.key;
    const dow = parseInt(select.dataset.dow, 10);
    const td = select.parentElement;
    const value = select.value;
    const profile = getProfile();

    if (value === "") {
        delete profile.absences[key];
        td.removeAttribute("data-value");
        td.title = "";
        updateCellText(td, select, "");
    } else if (value === "F") {
        profile.absences[key] = { type: "F" };
        td.setAttribute("data-value", "F");
        td.title = "";
        updateCellText(td, select, "F");
    } else if (value === "E") {
        const defaultH = dow === 5 ? 7 : 7.5;
        const input = prompt(
            `Ore di Ex Festivita (default ${formatHours(defaultH)} per ${dow === 5 ? "venerdi" : "lun-gio"}).\nInserisci ore (es. 3:30 o 3.5) oppure premi OK per giornata intera:`,
            formatHours(defaultH)
        );
        if (input === null) {
            // User cancelled — revert select
            const prev = profile.absences[key];
            select.value = prev ? prev.type : "";
            return;
        }
        const hours = parseHoursInput(input);
        if (isNaN(hours) || hours <= 0 || hours > defaultH) {
            alert(`Valore non valido. Inserisci un valore tra 0:01 e ${formatHours(defaultH)}.`);
            const prev = profile.absences[key];
            select.value = prev ? prev.type : "";
            return;
        }
        profile.absences[key] = { type: "E", hours: hours };
        td.setAttribute("data-value", "E");
        td.title = formatHours(hours);
        updateCellText(td, select, "E");
    }

    saveProfile(profile);
    updateCounters();
}

function updateCellText(td, select, text) {
    const textNode = td.firstChild;
    if (textNode && textNode.nodeType === Node.TEXT_NODE) {
        textNode.textContent = text;
    } else if (text) {
        td.insertBefore(document.createTextNode(text), select);
    }
}

prevYearBtn.addEventListener("click", () => {
    state.year--;
    render();
});

nextYearBtn.addEventListener("click", () => {
    state.year++;
    render();
});

profileSelect.addEventListener("change", (e) => {
    state.profileId = e.target.value || null;
    saveLastProfileId(state.profileId);
    render();
});

newProfileBtn.addEventListener("click", () => {
    const name = prompt("Nome del profilo (es. nome dipendente):");
    if (!name || !name.trim()) return;
    const id = createProfile(name.trim());
    state.profileId = id;
    saveLastProfileId(id);
    render();
});

deleteProfileBtn.addEventListener("click", () => {
    if (!state.profileId) return;
    const profile = getProfile();
    if (!confirm(`Eliminare il profilo "${profile.name}"?`)) return;
    deleteProfile(state.profileId);
    state.profileId = null;
    saveLastProfileId(null);
    render();
});

// === Export / Import ===

document.getElementById("export-btn").addEventListener("click", () => {
    const data = loadAllData();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `piano_assenze_${state.year}.json`;
    a.click();
    URL.revokeObjectURL(url);
});

document.getElementById("import-btn").addEventListener("click", () => {
    document.getElementById("import-file").click();
});

document.getElementById("import-file").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
        try {
            const data = JSON.parse(evt.target.result);
            if (!data.profiles || typeof data.profiles !== "object") {
                alert("File non valido: manca la struttura profili.");
                return;
            }
            if (!confirm("Importare i dati? I dati attuali verranno sovrascritti.")) return;
            saveAllData(data);
            state.profileId = null;
            render();
        } catch {
            alert("Errore nella lettura del file JSON.");
        }
    };
    reader.readAsText(file);
    e.target.value = "";
});

document.querySelectorAll(".edit-budget-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
        if (!state.profileId) return;
        const type = btn.dataset.type;
        const profile = getProfile();
        const budget = profile.budgets[type] || DEFAULT_BUDGETS[type];

        if (budget.unit === "ore") {
            const input = prompt(`Budget ${type} (ore, es. 30 o 30:00):`, budget.total);
            if (input === null) return;
            const val = parseHoursInput(input);
            if (isNaN(val) || val < 0) return;
            profile.budgets[type] = { total: val, unit: "ore" };
        } else {
            const input = prompt(`Budget ${type} (${budget.unit}):`, budget.total);
            if (input === null) return;
            const val = parseInt(input, 10);
            if (isNaN(val) || val < 0) return;
            profile.budgets[type] = { total: val, unit: budget.unit };
        }

        saveProfile(profile);
        updateCounters();
    });
});

// === Init ===

// Restore last used profile
const lastId = loadLastProfileId();
if (lastId) {
    const data = loadAllData();
    if (data.profiles[lastId]) {
        state.profileId = lastId;
    }
}

render();
