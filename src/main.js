import "./style.css";
import { openDB } from "idb";

/*
    schema:
    - habit { name: string, id: int}
    - log { id: int, habitId: int, timestamp: ??? }
*/

/**
 * @typedef {Object} Habit
 * @property {number} id
 * @property {string} name
 */

/**
 * @typedef {Object} Log
 * @property {number} id
 * @property {number} habitId
 * @property {number} timestamp
 */

const dbName = "pawsome-habit-tracker";
// NOTE(emi): thats where the indexed db is gonna go (update: its here LOL)
let db = await openDB(dbName, 1, {
    upgrade(db) {
        db.createObjectStore("habits", {
            keyPath: "id",
            autoIncrement: true,
        });
        const logStore = db.createObjectStore("logs", {
            keyPath: "id",
            autoIncrement: true,
        });
        logStore.createIndex("habitId", "habitId");
        logStore.createIndex("timestamp", "timestamp");
    },
});
const last14Days = getLast14Days();
let isAddingHabit = false;
let dragStartX;
let draggingHabitId = null;
let revealedHabitId = null;
let justDragged = false;

/** @type {Habit[]} */
const habits = await db.getAll("habits");
// if (habits.length == 0) {
//     const medicationHabit = { id: 1, name: "medication" };
//     const hydrateHabit = { id: 2, name: "drink water" };
//     const journalHabit = { id: 3, name: "journal" };

//     await db.add("habits", medicationHabit);
//     habits.push(medicationHabit);

//     await db.add("habits", hydrateHabit);
//     habits.push(hydrateHabit);
//     await db.add("habits", journalHabit);
//     habits.push(journalHabit);
// }

/** @type {Log[]} */
const log = await db.getAll("logs");
/** @type {Log[]} */
// const log = [];

const app = document.getElementById("app");
app.onclick = onClickCheckMark;
app.onpointerdown = function (event) {
    const card = event.target.closest(".habit-card");
    if (card === null || card.dataset.ghost === "true") {
        return;
    }
    draggingHabitId = card.dataset.id;
    dragStartX = event.clientX;
};

document.onpointermove = function (event) {
    if (draggingHabitId === null) {
        return;
    }
    const delta = Math.min(Math.max(event.clientX - dragStartX, -80), 0); // if delta < -80 we should reveal delete and otherwise move it
    const card = document.querySelector(`[data-id="${draggingHabitId}"]`);
    card.style.transform = `translateX(${delta}px)`;
};
document.onpointerup = function (event) {
    if (draggingHabitId === null) {
        return;
    }
    const delta = Math.min(Math.max(event.clientX - dragStartX, -80), 0);
    if (delta <= -60) {
        revealedHabitId = draggingHabitId;
    } else {
        const card = document.querySelector(`[data-id="${draggingHabitId}"]`);
        card.style.transform = `translateX(0px)`;
    }

    if (Math.abs(delta) > 5) {
        justDragged = true;
    }
    draggingHabitId = null;
};
document.onclick = function (event) {
    if (event.target.closest(".habit-card--ghost") == null && isAddingHabit) {
        isAddingHabit = false;
    }
};
render();

async function onClickCheckMark(event) {
    if (event.target?.dataset.action == "delete-habit") {
        const row = event.target.closest(".habit-row");
        const id = Number(row.dataset.habitId);
        await db.delete("habits", id);
        const idx = habits.findIndex((h) => h.id == id);
        habits.splice(idx, 1);
        revealedHabitId = null;
        render();
        return;
    }
    if (event.target?.dataset.action == "confirm-habit") {
        const ghostCard = event.target.closest(".habit-card");
        const inputElement = ghostCard.querySelector("input");
        const text = inputElement?.value.trim();
        if (!text || text === "") {
            ghostCard.classList.remove("shake");
            ghostCard.offsetWidth;
            ghostCard.classList.add("shake");
        } else {
            const habit = { name: text };
            const habitId = await db.add("habits", habit);
            habit.id = habitId;
            habits.push(habit);
            render();
        }

        isAddingHabit = false;
        return;
    }

    if (event.target.closest(".habit-card").dataset.ghost == "true") {
        isAddingHabit = true;
        return;
    }

    if (isAddingHabit) {
        return;
    }

    if (justDragged) {
        justDragged = false;
        return;
    }

    const id = event.target.closest(".habit-card").dataset.id;
    const entryLog = log.find(
        (l) =>
            l.habitId == id &&
            new Date(l.timestamp).toDateString() == new Date().toDateString(),
    );
    if (entryLog !== undefined) {
        await db.delete("logs", entryLog.id);
        // TODO(emi): prob should make this more efficient
        const index = log.indexOf(entryLog);
        log.splice(index, 1);
    } else {
        const timestamp = Date.now();
        const habitLog = {
            habitId: id,
            timestamp: timestamp,
        };
        const logId = await db.add("logs", habitLog);
        habitLog.id = logId;
        log.push(habitLog);
    }

    render();
}

/**
 * @param {Habit} habit
 */
function habitCardHTML(habit) {
    const today = new Date().toDateString();
    const logEntry = log.find(
        (l) =>
            l.habitId == habit.id &&
            new Date(l.timestamp).toDateString() === today,
    );
    const done = logEntry !== undefined;
    const emptyClass = done ? "" : " empty";
    const checkIcon = done ? "✓" : "";
    const status = done
        ? `erledigt um ${new Date(logEntry.timestamp).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}`
        : "noch nicht";
    return `
    <div class="habit-row" data-habit-id="${habit.id}">
      <div class="delete-action" data-action="delete-habit">x</div>
      <div class="habit-card${emptyClass}" data-id="${habit.id}">
        <div class="check">${checkIcon}</div>
        <div class="habit-info">
          <div class="name">${habit.name}</div>
          <div class="status">${status}</div>
        </div>
      </div>
    </div>
`;
}

function ghostHabitCardHTML() {
    return `
    <div class="habit-card habit-card--ghost" data-ghost="true">
      <div class="check" data-action="confirm-habit">+</div>
      <div class="habit-info">
        <div class="name"><input placeholder="add a new habit"></div>
        <div class="status"></div>
      </div>
    </div>
`;
}

function heatmapUnitHTML(date) {
    const ratio = completionRatioOn(date);
    return `
    <div style="--intensity: ${ratio}">
    </div>
`;
}

function heatmapHTML() {
    return `
    <div class="heatmap-container">
        ${last14Days.map(heatmapUnitHTML).reverse().join("")}
    </div>
`;
}

function getLast14Days() {
    const result = [...Array(14)];
    const today = new Date();
    for (let i = 0; i < 14; i++) {
        const copy = new Date(today);
        copy.setDate(copy.getDate() - i);
        result[i] = copy;
    }

    return result;
}

function completionRatioOn(date) {
    const day = date.toDateString();
    let doneTotal = 0;
    for (let i = 0; i < habits.length; i++) {
        const habit = habits[i];
        const doneOnDay = log.some(
            (l) =>
                l.habitId == habit.id &&
                new Date(l.timestamp).toDateString() === day,
        );
        if (doneOnDay) {
            doneTotal++;
        }
    }
    return doneTotal / habits.length;
}

function render() {
    const today = new Date().toDateString();
    const doneCount = log.filter(
        (l) => new Date(l.timestamp).toDateString() === today,
    ).length;
    document.querySelector("#app").innerHTML = `
    <div class="day-header">
    <div class="date">${new Date().toLocaleDateString("de-DE", { weekday: "long" })}</div>
      <div class="subtitle">${doneCount} of ${habits.length} heute erledigt</div>
    </div>
    <div class="habit-list">
      ${habits.map(habitCardHTML).join("")}
      ${ghostHabitCardHTML()}
    </div>
    ${heatmapHTML()}
`;
}
