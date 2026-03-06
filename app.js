// === Constants ===

const MONTHS = [
    "GEN", "FEB", "MAR", "APR", "MAG", "GIU",
    "LUG", "AGO", "SET", "OTT", "NOV", "DIC"
];

const ABSENCE_TYPES = ["F", "R", "FS"];

const ABSENCE_CYCLE = ["", "F", "R", "FS"]; // click cycles through these

const DEFAULT_BUDGETS = {
    F:  { total: 20, unit: "giorni" },
    R:  { total: 56, unit: "ore" },
    FS: { total: 4,  unit: "giorni" },
};

// Festivita nazionali fisse (mese 0-indexed, giorno)
// Include anche festivita specifiche settore bancario (Santo Patrono non incluso — varia per citta)
function getHolidays(year) {
    const fixed = [
        [0, 1],   // Capodanno
        [0, 6],   // Epifania
        [3, 25],  // Liberazione
        [4, 1],   // Festa dei Lavoratori
        [5, 2],   // Festa della Repubblica
        [7, 15],  // Ferragosto
        [10, 1],  // Tutti i Santi
        [11, 8],  // Immacolata
        [11, 25], // Natale
        [11, 26], // Santo Stefano
        [11, 31], // San Silvestro (banche chiuse)
    ];

    // Pasqua e Pasquetta (algoritmo anonimo di Gauss)
    const easter = computeEaster(year);
    const easterMon = new Date(easter);
    easterMon.setDate(easterMon.getDate() + 1);

    const holidays = new Set();
    for (const [m, d] of fixed) {
        holidays.add(`${m}-${d}`);
    }
    holidays.add(`${easter.getMonth()}-${easter.getDate()}`);
    holidays.add(`${easterMon.getMonth()}-${easterMon.getDate()}`);

    return holidays;
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
    const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month, day);
}

// === State ===

let state = {
    year: new Date().getFullYear(),
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

function createProfile(name) {
    const data = loadAllData();
    const id = "p_" + Date.now();
    data.profiles[id] = {
        name: name,
        budgets: JSON.parse(JSON.stringify(DEFAULT_BUDGETS)),
        absences: {}, // key: "year-month-day" -> value: "F"|"R"|"FS"
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

    // Preserve selection
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

    // Header: Mese + days 1-31
    calendarHead.innerHTML = '<th class="month-col">Mese</th>';
    for (let d = 1; d <= 31; d++) {
        const th = document.createElement("th");
        th.textContent = d;
        calendarHead.appendChild(th);
    }

    // Body
    calendarBody.innerHTML = "";
    for (let m = 0; m < 12; m++) {
        const tr = document.createElement("tr");

        // Month label
        const monthTd = document.createElement("td");
        monthTd.className = "month-cell";
        monthTd.textContent = MONTHS[m];
        tr.appendChild(monthTd);

        const daysInMonth = new Date(year, m + 1, 0).getDate();

        for (let d = 1; d <= 31; d++) {
            const td = document.createElement("td");
            td.className = "day-cell";

            if (d > daysInMonth) {
                td.classList.add("empty", "blocked");
                tr.appendChild(td);
                continue;
            }

            const date = new Date(year, m, d);
            const dow = date.getDay(); // 0=Sun, 6=Sat
            const isWeekend = dow === 0 || dow === 6;
            const isHoliday = holidays.has(`${m}-${d}`);
            const key = `${year}-${m}-${d}`;
            const profile = getProfile();
            const value = profile.absences[key] || "";

            if (isWeekend) td.classList.add("weekend", "blocked");
            if (isHoliday) td.classList.add("holiday", "blocked");

            if (value && !isWeekend && !isHoliday) {
                td.setAttribute("data-value", value);
                td.textContent = value;
            }

            if (!isWeekend && !isHoliday) {
                td.dataset.key = key;
                td.addEventListener("click", onCellClick);
            }

            tr.appendChild(td);
        }

        calendarBody.appendChild(tr);
    }
}

function updateCounters() {
    const profile = getProfile();
    if (!profile) return;

    const counts = { F: 0, R: 0, FS: 0 };

    // Count only absences for the current year
    for (const [key, val] of Object.entries(profile.absences)) {
        if (key.startsWith(state.year + "-") && counts.hasOwnProperty(val)) {
            counts[val]++;
        }
    }

    for (const type of ABSENCE_TYPES) {
        const el = document.getElementById(`counter-${type}`);
        const budget = profile.budgets[type] || DEFAULT_BUDGETS[type];
        const used = type === "R" ? counts[type] : counts[type]; // ROL: 1 giorno = 1 unita nel conteggio
        el.querySelector(".used").textContent = used;
        el.querySelector(".total").textContent = budget.total;

        if (used > budget.total) {
            el.classList.add("over-budget");
        } else {
            el.classList.remove("over-budget");
        }
    }
}

// === Event Handlers ===

function onCellClick(e) {
    const td = e.currentTarget;
    const key = td.dataset.key;
    const profile = getProfile();
    const current = profile.absences[key] || "";
    const idx = ABSENCE_CYCLE.indexOf(current);
    const next = ABSENCE_CYCLE[(idx + 1) % ABSENCE_CYCLE.length];

    if (next === "") {
        delete profile.absences[key];
        td.removeAttribute("data-value");
        td.textContent = "";
    } else {
        profile.absences[key] = next;
        td.setAttribute("data-value", next);
        td.textContent = next;
    }

    saveProfile(profile);
    updateCounters();
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
    render();
});

newProfileBtn.addEventListener("click", () => {
    const name = prompt("Nome del profilo (es. nome dipendente):");
    if (!name || !name.trim()) return;
    const id = createProfile(name.trim());
    state.profileId = id;
    render();
});

deleteProfileBtn.addEventListener("click", () => {
    if (!state.profileId) return;
    const profile = getProfile();
    if (!confirm(`Eliminare il profilo "${profile.name}"?`)) return;
    deleteProfile(state.profileId);
    state.profileId = null;
    render();
});

document.querySelectorAll(".edit-budget-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
        if (!state.profileId) return;
        const type = btn.dataset.type;
        const profile = getProfile();
        const budget = profile.budgets[type] || DEFAULT_BUDGETS[type];
        const input = prompt(`Budget ${type} (${budget.unit}):`, budget.total);
        if (input === null) return;
        const val = parseInt(input, 10);
        if (isNaN(val) || val < 0) return;
        profile.budgets[type] = { total: val, unit: budget.unit };
        saveProfile(profile);
        updateCounters();
    });
});

// === Init ===

render();
