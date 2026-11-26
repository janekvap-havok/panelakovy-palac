"use strict";

const year = 2026;
const total = 24;
const storageKey = "panelak-palace:2026";
const windowLabels = { opened: "otevřené", available: "připravené k otevření", locked: "ještě zamčené" };
const courtyardLabel = "Zpátky na nádvoří";
const finaleNote = "Všech 24 koček je venku. A po klidu na sídlišti je veta.";
const windows = document.querySelector("#windows");
const progress = document.querySelector("#progress");
const calendarNote = document.querySelector("#calendar-note");
const defaultCalendarNote = calendarNote.textContent;
const cheatNote = document.querySelector("#cheat-note");
const storageNote = document.querySelector("#storage-note");
const reveal = document.querySelector("#reveal");
const revealTitle = document.querySelector("#reveal-title");
const revealDone = document.querySelector("#reveal-done");
const portrait = document.querySelector("#portrait");
const portraitLoading = document.querySelector("#portrait-loading");
const portraitCredit = document.querySelector("#portrait-credit");
const imageError = document.querySelector("#image-error");
const scene = document.querySelector(".scene");
const building = document.querySelector(".building");
const perches = document.querySelector("#perches");
const replay = document.querySelector("#replay");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

const doors = new Map();
let opened = new Set();
let finalePlayed = false;
let climbing = false;
let openingDoor = false;
let portraitRequest;
let renderedDay;
let cheatBackup = null;
let lastP = -Infinity;
let palaceTaps = 0;
let firstPalaceTap = -Infinity;

function availableDay(date = new Date()) {
  if (cheatBackup) return total;
  if (date.getFullYear() < year || (date.getFullYear() === year && date.getMonth() < 11)) {
    return 0;
  }
  return date.getFullYear() > year ? total : Math.min(date.getDate(), total);
}

function loadProgress() {
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved === null) return;
    const data = JSON.parse(saved);
    if (!Array.isArray(data?.opened)) throw new Error("Missing calendar progress");
    data.opened.filter((day) => Number.isInteger(day) && day >= 1 && day <= total)
      .forEach((day) => opened.add(day));
    finalePlayed = opened.size === total && data.finalePlayed === true;
  } catch (error) {
    console.warn("Could not read Advent calendar progress.", error);
    storageNote.hidden = false;
  }
}

function saveProgress() {
  if (cheatBackup) return;
  try {
    localStorage.setItem(storageKey, JSON.stringify({ opened: [...opened], finalePlayed }));
    storageNote.hidden = true;
  } catch (error) {
    console.warn("Could not save Advent calendar progress.", error);
    storageNote.hidden = false;
  }
}

function catImage(day, scrap = false) {
  return `cats/${day}${scrap ? "-scrap" : ""}.webp${scrap ? "?v=3" : ""}`;
}

function addThumbnail(day, button) {
  const thumbnail = new Image();
  thumbnail.alt = "";
  thumbnail.src = catImage(day, true);
  button.prepend(thumbnail);
  return thumbnail;
}

function updateWindows() {
  const date = new Date();
  const unlocked = availableDay(date);
  const today = date.getFullYear() === year && date.getMonth() === 11 ? date.getDate() : 0;
  for (const [day, button] of doors) {
    const isOpen = opened.has(day);
    const state = isOpen ? "opened" : day <= unlocked ? "available" : "locked";
    button.dataset.state = state;
    button.dataset.today = String(day === today);
    button.setAttribute("aria-label", `Okénko ${day} — ${day}. prosince, ${windowLabels[state]}${day === today ? ", dnes" : ""}`);
    const existingThumbnail = button.querySelector("img");
    if (isOpen && !existingThumbnail) {
      addThumbnail(day, button);
    } else if (!isOpen) {
      existingThumbnail?.remove();
    }
  }
  progress.textContent = `${opened.size} z ${total}`;
  progress.setAttribute("aria-label", `Otevřená okénka: ${progress.textContent}`);
  renderedDay = date.toDateString();
}

async function openWindow(day, button) {
  if (openingDoor || reveal.open) return;
  portraitRequest = null;
  portrait.hidden = true;
  portraitLoading.hidden = true;
  imageError.hidden = true;
  portraitCredit.hidden = true;
  if (!opened.has(day) && day > availableDay()) {
    revealTitle.textContent = `Okénko ${day} se odemkne ${day}. prosince`;
    revealDone.textContent = courtyardLabel;
    reveal.showModal();
    return;
  }
  portrait.alt = `Kočičí ilustrace z okénka ${day}`;
  portrait.src = catImage(day);
  const request = portrait.decode().then(() => true, (error) => {
    console.warn(`Could not load illustration for window ${day}.`, error);
    return false;
  });
  portraitRequest = request;

  const firstOpen = !opened.has(day);
  if (firstOpen) {
    openingDoor = true;
    button.setAttribute("aria-busy", "true");
    try {
      const thumbnail = addThumbnail(day, button);
      try {
        await thumbnail.decode();
      } catch (error) {
        thumbnail.hidden = true;
        console.warn(`Could not load thumbnail for window ${day}.`, error);
      }
      opened.add(day);
      saveProgress();
      updateWindows();
      if (!reducedMotion.matches) {
        try {
          await button.querySelector(".shutter").animate(
            [{ transform: "translateY(0)" }, { transform: "translateY(-100%)" }],
            { duration: 360, easing: "steps(6, end)" }
          ).finished;
        } catch (error) {
          console.warn("The shutter animation was interrupted.", error);
        }
      }
    } finally {
      openingDoor = false;
      button.removeAttribute("aria-busy");
    }
  }
  revealTitle.textContent = `Okénko ${day} · ${day}. prosince`;
  portraitLoading.hidden = false;
  revealDone.textContent = opened.size === total && !finalePlayed
    ? "Pusť kočky ven!"
    : courtyardLabel;
  reveal.showModal();
  const loaded = await request;
  if (portraitRequest !== request || !reveal.open) return;
  portraitLoading.hidden = true;
  portrait.hidden = !loaded;
  portraitCredit.hidden = !loaded || day !== 24;
  imageError.hidden = loaded;
}

for (let day = 1; day <= total; day++) {
  const panel = document.createElement("div");
  panel.className = "panel";
  panel.dataset.windowLabel = day;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "window";
  button.dataset.day = day;
  button.innerHTML = `<span class="shutter" aria-hidden="true"><span class="number">${day}</span></span>`;
  button.addEventListener("click", () => openWindow(day, button));
  panel.append(button);
  windows.append(panel);
  doors.set(day, button);
}

const branchRows = [
  [24, [49]], [33, [43, 58]], [44, [35, 50, 65]], [54, [28, 43, 58, 73]],
  [65, [22, 39, 57, 78]], [75, [20, 35, 50, 65, 81]], [86, [13, 30, 48, 65, 84]]
];
const topCat = 11;
const branchSpots = branchRows.flatMap(([y, xs]) => xs.map((x) => ({ x, y })))
  .map((spot, index) => ({ ...spot, day: index === 0 ? topCat : index + 1 === topCat ? 1 : index + 1 }));

function climbFrames(door, facade, tree, perchX, perchY, angle) {
  const doorX = door.left + door.width / 2;
  const sillY = door.bottom - door.height * .18;
  const stacked = tree.top >= facade.bottom;
  const side = doorX < facade.left + facade.width / 2 ? -1 : 1;
  const trunkX = tree.left + tree.width * .5;
  const trunkY = tree.top + tree.height * .92;
  const laneX = trunkX + side * tree.width * .59;
  const shoulderY = Math.min(facade.bottom, tree.top - 4);
  const landingX = stacked ? laneX : doorX;
  const groundY = stacked ? trunkY : facade.bottom + 8;
  const approachX = stacked ? trunkX + side * tree.width * .35 : tree.left + tree.width * .15;
  const step = tree.width * .034;
  const pose = (x, y, tilt, scale = 1) =>
    `translate(-50%, -100%) translate(${x - perchX}px, ${y - perchY}px) rotate(${tilt}deg) scale(${scale})`;
  const frame = (offset, x, y, tilt, scale = 1, opacity = 1) =>
    ({ offset, opacity, transform: pose(x, y, tilt, scale), easing: "steps(3, end)" });
  return [
    frame(0, doorX, sillY, -7, .45, 0),
    frame(.08, doorX, sillY - step, 12, .8),
    ...(stacked ? [frame(.18, laneX, shoulderY, side * 13, .85)] : []),
    frame(stacked ? .36 : .24, landingX, groundY, -13),
    frame(stacked ? .41 : .29, landingX, groundY, 8, .83),
    frame(stacked ? .51 : .43, approachX, (groundY + trunkY) / 2 - step, -8),
    frame(stacked ? .59 : .56, approachX + (trunkX - approachX) * .45, trunkY, 9),
    frame(stacked ? .67 : .63, trunkX, trunkY, -7),
    frame(.76, trunkX - step * 1.5, trunkY + (perchY - trunkY) * .43, 13),
    frame(.89, trunkX + step, trunkY + (perchY - trunkY) * .77, -9),
    frame(1, perchX, perchY, angle)
  ];
}

function drawCats(animate) {
  perches.replaceChildren();
  const tree = perches.getBoundingClientRect();
  const facade = building.getBoundingClientRect();
  return branchSpots.map(({ x, y, day }) => {
    const cat = new Image();
    const angle = day === topCat ? 0 : (day * 17) % 29 - 14;
    cat.className = "scrap";
    cat.dataset.cat = day;
    cat.alt = "";
    cat.src = catImage(day, true);
    cat.style.left = `${x}%`;
    cat.style.top = `${y}%`;
    cat.style.setProperty("--angle", `${angle}deg`);
    perches.append(cat);
    if (!animate) return Promise.resolve();

    const door = doors.get(day).getBoundingClientRect();
    const endX = tree.left + (x / 100) * tree.width;
    const endY = tree.top + (y / 100) * tree.height;
    const animation = cat.animate(climbFrames(door, facade, tree, endX, endY, angle), {
      duration: day === topCat ? 2900 : 2530,
      delay: ((day - 1) % 6) * 90 + Math.floor((day - 1) / 6) * 450,
      fill: "backwards"
    });
    return animation.finished;
  });
}

async function playFinale() {
  if (climbing || opened.size !== total) return;
  climbing = true;
  finalePlayed = true;
  saveProgress();
  replay.hidden = false;
  replay.setAttribute("aria-disabled", "true");
  calendarNote.textContent = finaleNote;
  const motion = !reducedMotion.matches;
  const followClimb = motion && scene.getBoundingClientRect().height > innerHeight;
  let followTimer;
  try {
    if (followClimb) {
      scene.scrollIntoView({ block: "start", behavior: "instant" });
      followTimer = setTimeout(() => perches.parentElement.scrollIntoView({ block: "end", behavior: "smooth" }), 1750);
    } else if (perches.getBoundingClientRect().bottom > innerHeight) {
      perches.parentElement.scrollIntoView({ block: "end", behavior: motion ? "smooth" : "instant" });
    }
    await Promise.all(drawCats(motion));
  } catch (error) {
    console.warn("Tree climb animation was interrupted.", error);
    drawCats(false);
  } finally {
    clearTimeout(followTimer);
    climbing = false;
    replay.removeAttribute("aria-disabled");
  }
}

reveal.addEventListener("close", () => {
  if (opened.size === total && !finalePlayed) void playFinale();
});
replay.addEventListener("click", () => void playFinale());

function toggleCheatMode() {
  if (reveal.open || openingDoor || climbing) return;
  lastP = -Infinity;
  palaceTaps = 0;
  if (cheatBackup) {
    ({ opened, finalePlayed } = cheatBackup);
    cheatBackup = null;
    if (!finalePlayed) perches.replaceChildren();
    replay.hidden = !finalePlayed;
    calendarNote.textContent = finalePlayed ? finaleNote : defaultCalendarNote;
    cheatNote.textContent = "Zkušební režim je vypnutý.";
  } else {
    cheatBackup = { opened, finalePlayed };
    opened = new Set(opened);
    cheatNote.textContent = "Zkušební režim: všechna okénka jsou dostupná. Postup se neukládá.";
  }
  updateWindows();
}

window.addEventListener("keydown", (event) => {
  if (event.repeat) return;
  if (event.key.toLowerCase() !== "p" || event.ctrlKey || event.altKey || event.metaKey ||
      event.isComposing || reveal.open || openingDoor || climbing) {
    lastP = -Infinity;
    return;
  }
  const now = performance.now();
  if (now - lastP > 650) lastP = now;
  else toggleCheatMode();
});

document.querySelector("#palace-word").addEventListener("click", () => {
  const now = performance.now();
  if (palaceTaps === 0 || now - firstPalaceTap > 2500) {
    firstPalaceTap = now;
    palaceTaps = 0;
  }
  if (++palaceTaps === 5) {
    palaceTaps = 0;
    toggleCheatMode();
  }
});

function refreshDate() {
  if (new Date().toDateString() !== renderedDay) updateWindows();
}

loadProgress();
updateWindows();
window.addEventListener("focus", refreshDate);
document.addEventListener("visibilitychange", refreshDate);
setInterval(refreshDate, 1000);
if (opened.size === total) {
  if (finalePlayed) {
    drawCats(false);
    replay.hidden = false;
    calendarNote.textContent = finaleNote;
  } else {
    void playFinale();
  }
}
