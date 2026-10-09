(() => {
  "use strict";

  const ASSET_ROOT = new URL("media/ritual-demo/", document.baseURI);
  const MAP = { width: 2800, height: 4600 };
  const TAU = Math.PI * 2;
  const SPRITE_NAMES = ["cat", "cat2", "enemy1", "enemy2", "enemy3", "pillar"];
  const SAFE_ZONES = [
    { x: 1400, y: 2240, radius: 600, color: "rgba(205,244,190,.7)", edge: "#f3ffe1", label: "МИРНЫЙ ЦЕНТР" },
    { x: 650, y: 1000, radius: 185, color: "rgba(255,237,190,.76)", edge: "#fff1bc", label: "ОСТРОВОК ХРАНИТЕЛЯ" },
  ];
  const DANGER_ZONES = [
    { kind: "frog", x: 340, y: 650, radius: 620, color: "rgba(226,159,190,.58)", edge: "#f4b7d1", label: "ОПАСНАЯ ЗОНА · ЛАПКА ЖАБЫ" },
    { kind: "rainbow", x: 2440, y: 720, radius: 620, color: "rgba(150,166,222,.62)", edge: "#bdc8ff", label: "ОПАСНАЯ ЗОНА · РАДУГА" },
    { kind: "unicorn", x: 1450, y: 4230, radius: 620, color: "rgba(224,184,125,.62)", edge: "#f4d796", label: "ОПАСНАЯ ЗОНА · ЕДИНОРОГ" },
  ];
  const INTRO_DIALOGUE = [
    { speaker: "КОТ-ПРОРИЦАТЕЛЬ", text: "Карты показали мне прореху в завтрашнем дне." },
    { speaker: "ТЫ", text: "Что скрывается за этой прорехой?" },
    { speaker: "КОТ-ПРОРИЦАТЕЛЬ", text: "Гадальщица стёрла своё имя из колоды, чтобы сама судьба не смогла её найти." },
    { speaker: "ТЫ", text: "И как вернуть её?" },
    { speaker: "КОТ-ПРОРИЦАТЕЛЬ", text: "Три дара разбудят Пепельное зеркало. А 50 мер красной пыли нужно отнести Хранителю в северо-западной роще." },
    { speaker: "КОТ-ПРОРИЦАТЕЛЬ", text: "Он обменяет её на Лунный жетон. А когда зеркало ответит, я вытяну нить гадальщицы обратно в наш мир." },
  ];
  const sprites = Object.fromEntries(SPRITE_NAMES.map((name) => {
    const image = new Image();
    image.src = new URL(`${name}.png`, ASSET_ROOT).href;
    return [name, image];
  }));

  let game = null;
  let animationFrame = 0;
  let previousFrame = 0;
  const heldKeys = new Set();
  const hasTouch = navigator.maxTouchPoints > 0 || matchMedia("(pointer: coarse)").matches;

  function findGamePage() {
    const root = document.querySelector("#ritual-demo-2-game");
    if (!root) {
      if (game) stopGame();
      return;
    }
    if (game?.root !== root) {
      stopGame();
      startGame(root);
    }
  }

  const pageObserver = new MutationObserver(findGamePage);
  pageObserver.observe(document.body, { childList: true, subtree: true });
  findGamePage();

  function makeGame(root) {
    const stage = root.querySelector(".ritual-demo__stage");
    const screen = root.querySelector(".ritual-demo__screen");
    const canvas = root.querySelector("canvas");
    const ctx = canvas.getContext("2d", { alpha: false });
    const altar = { x: 1400, y: 2240 };
    const gameState = {
      root, stage, screen, canvas, ctx,
      view: { width: 390, height: 845, dpr: 1, scale: 1 },
      zoom: 1, landscape: false,
      altar,
      player: { x: 1400, y: 2490, radius: 21, speed: 245, hp: 8, maxHp: 8, invulnerable: 0, facing: 1, walk: 0, attackTimer: 0, muzzle: 0 },
      pillars: [
        { x: 1400, y: 2160, item: "unicorn", label: "ВОЛОС ЕДИНОРОГА", color: "#d8b4ff", placed: false },
        { x: 1250, y: 2310, item: "frog", label: "ЛАПКА ЖАБЫ", color: "#f58cbd", placed: false },
        { x: 1550, y: 2310, item: "rainbow", label: "РАДУГА В БАНКЕ", color: "#76d1e1", placed: false },
      ],
      pickups: [
        { kind: "frog", x: 340, y: 650, label: "Лапка жабы", tint: "#f5a1ca", collected: false },
        { kind: "rainbow", x: 2440, y: 720, label: "Радуга в банке", tint: "#90ddf0", collected: false },
        { kind: "unicorn", x: 1450, y: 4230, label: "Волос единорога", tint: "#d8b4ff", collected: false },
      ],
      npc: { x: 1500, y: 2390, radius: 25, walk: 0 },
      questCat: { x: 650, y: 1000, radius: 25, walk: 0 },
      inventory: { frog: false, rainbow: false, unicorn: false },
      enemies: [], bullets: [], dustDrops: [], particles: [], scenery: [],
      dust: 0, clock: 0, spawnTimer: 0.65, randomSpawnEnabled: true,
      spawnedGuardians: false, spawnedRainbowWave: false, won: false,
      dialogueOpen: false, dialogueIndex: 0, dialogueLines: [], storySeen: false, npcQuestAccepted: false,
      npcRewarded: false, moonTokens: 0,
      camera: { x: 0, y: 0 }, joystick: null,
      touch: hasTouch,
      fullscreenButton: root.querySelector("[data-ritual2-fullscreen]"),
      dialogue: root.querySelector("[data-r2-dialogue]"),
      dialoguePortrait: root.querySelector(".ritual-demo2__portrait"),
      dialogueSpeaker: root.querySelector("[data-r2-speaker]"),
      dialogueText: root.querySelector("[data-r2-text]"),
      dialogueNext: root.querySelector("[data-r2-next]"),
      stageFullscreenButton: null,
    };
    seedScenery(gameState);
    return gameState;
  }

  function startGame(root) {
    game = makeGame(root);
    game.stage.classList.toggle("ritual-demo__stage--landscape", game.landscape);
    placeCameraAtPlayer(game);
    addFullscreenControl(game);
    const loading = root.querySelector(".ritual-demo__loading");
    if (loading) loading.hidden = true;
    game.onKeyDown = (event) => {
      if (event.target instanceof HTMLElement && event.target.closest("button, input, textarea, select")) return;
      const key = event.key.toLowerCase();
      if (key === "escape" && game.stage.classList.contains("ritual-demo__stage--expanded")) {
        game.stage.classList.remove("ritual-demo__stage--expanded");
        syncFullscreenUI();
        return;
      }
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)) event.preventDefault();
      if (key === "e" && !event.repeat) {
        if (game.dialogueOpen) advanceDialogue();
        else if (!interactWithNpc()) {
          if (!interact()) toggleRandomSpawn();
        }
        return;
      }
      if (key === "t" && !event.repeat) { toggleOrientation(); return; }
      heldKeys.add(key);
    };
    game.onKeyUp = (event) => heldKeys.delete(event.key.toLowerCase());
    game.onBlur = () => { heldKeys.clear(); game.joystick = null; };
    game.onClick = (event) => {
      if (event.target.closest("[data-r2-next]")) { advanceDialogue(); return; }
      if (event.target.closest("[data-ritual2-fullscreen]")) toggleFullscreen();
      if (event.target.closest("[data-ritual2-spawn]")) toggleRandomSpawn();
      if (event.target.closest("[data-ritual2-orientation]")) toggleOrientation();
      if (event.target.closest("[data-ritual2-restart]")) restartGame();
    };
    game.onPointerDown = (event) => {
      if (!handleCanvasTap(event)) beginJoystick(event);
    };
    game.onPointerMove = moveJoystick;
    game.onPointerUp = endJoystick;
    game.onWheel = handleWheelZoom;
    game.onFullscreenChange = syncFullscreenUI;
    window.addEventListener("keydown", game.onKeyDown);
    window.addEventListener("keyup", game.onKeyUp);
    window.addEventListener("blur", game.onBlur);
    root.addEventListener("click", game.onClick);
    game.canvas.addEventListener("pointerdown", game.onPointerDown);
    game.canvas.addEventListener("pointermove", game.onPointerMove);
    game.canvas.addEventListener("pointerup", game.onPointerUp);
    game.canvas.addEventListener("pointercancel", game.onPointerUp);
    game.canvas.addEventListener("wheel", game.onWheel, { passive: false });
    document.addEventListener("fullscreenchange", game.onFullscreenChange);
    document.addEventListener("webkitfullscreenchange", game.onFullscreenChange);
    window.addEventListener("resize", resizeCanvas);
    resizeCanvas();
    syncDemoControls();
    syncFullscreenUI();
    previousFrame = 0;
    animationFrame = requestAnimationFrame(frame);
  }

  function stopGame() {
    if (animationFrame) cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    previousFrame = 0;
    if (!game) return;
    window.removeEventListener("keydown", game.onKeyDown);
    window.removeEventListener("keyup", game.onKeyUp);
    window.removeEventListener("blur", game.onBlur);
    window.removeEventListener("resize", resizeCanvas);
    game.root.removeEventListener("click", game.onClick);
    game.canvas.removeEventListener("pointerdown", game.onPointerDown);
    game.canvas.removeEventListener("pointermove", game.onPointerMove);
    game.canvas.removeEventListener("pointerup", game.onPointerUp);
    game.canvas.removeEventListener("pointercancel", game.onPointerUp);
    game.canvas.removeEventListener("wheel", game.onWheel);
    document.removeEventListener("fullscreenchange", game.onFullscreenChange);
    document.removeEventListener("webkitfullscreenchange", game.onFullscreenChange);
    game.stageFullscreenButton?.remove();
    game = null;
    heldKeys.clear();
  }

  function restartGame() {
    if (!game) return;
    const root = game.root;
    stopGame();
    startGame(root);
  }

  function addFullscreenControl(s) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "ritual-demo__stage-fullscreen";
    button.dataset.ritual2Fullscreen = "";
    button.hidden = true;
    button.style.display = "none";
    button.textContent = "На весь экран";
    button.setAttribute("aria-label", "На весь экран");
    s.screen.append(button);
    s.stageFullscreenButton = button;
  }

  async function toggleFullscreen() {
    if (!game) return;
    const stage = game.stage;
    if (stage.classList.contains("ritual-demo__stage--expanded")) {
      stage.classList.remove("ritual-demo__stage--expanded");
      syncFullscreenUI();
      resizeCanvas();
      return;
    }
    try {
      if (document.fullscreenElement || document.webkitFullscreenElement) {
        if (document.exitFullscreen) await document.exitFullscreen();
        else document.webkitExitFullscreen?.();
      } else if (stage.requestFullscreen) {
        await stage.requestFullscreen();
      } else if (stage.webkitRequestFullscreen) {
        await stage.webkitRequestFullscreen();
      } else {
        stage.classList.toggle("ritual-demo__stage--expanded");
      }
    } catch {
      stage.classList.toggle("ritual-demo__stage--expanded");
    }
    resizeCanvas();
    syncFullscreenUI();
  }

  function syncFullscreenUI() {
    if (!game) return;
    const active = Boolean(document.fullscreenElement || document.webkitFullscreenElement || game.stage.classList.contains("ritual-demo__stage--expanded"));
    for (const button of [game.fullscreenButton, game.stageFullscreenButton]) {
      if (!button) continue;
      if (button === game.stageFullscreenButton) {
        button.hidden = !active;
        button.style.display = active ? "block" : "none";
      }
      button.textContent = active ? "Свернуть" : "На весь экран";
      button.setAttribute("aria-pressed", String(active));
      button.setAttribute("aria-label", active ? "Свернуть игру" : "На весь экран");
    }
    requestAnimationFrame(resizeCanvas);
  }

  function syncDemoControls() {
    if (!game) return;
    const spawnButton = game.root.querySelector("[data-ritual2-spawn]");
    if (spawnButton) {
      const enabled = game.randomSpawnEnabled;
      spawnButton.textContent = `Спавн врагов: ${enabled ? "вкл" : "выкл"}`;
      spawnButton.setAttribute("aria-pressed", String(enabled));
      spawnButton.setAttribute("aria-label", `${enabled ? "Отключить" : "Включить"} случайный спавн врагов`);
    }
    const orientationButton = game.root.querySelector("[data-ritual2-orientation]");
    if (orientationButton) {
      orientationButton.textContent = `Ландшафт: ${game.landscape ? "вкл" : "выкл"}`;
      orientationButton.setAttribute("aria-pressed", String(game.landscape));
      orientationButton.setAttribute("aria-label", `${game.landscape ? "Выключить" : "Включить"} горизонтальную ориентацию`);
    }
  }

  function resizeCanvas() {
    if (!game) return;
    const rect = game.canvas.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const pixelWidth = Math.round(rect.width * dpr);
    const pixelHeight = Math.round(rect.height * dpr);
    const referenceHeight = game.landscape && rect.height < 300 ? 980 : 844;
    const scale = clamp(Math.min(rect.width / 390, rect.height / referenceHeight), game.landscape ? 0.15 : 0.5, 1.4);
    const changed = rect.width !== game.view.width || rect.height !== game.view.height || dpr !== game.view.dpr || scale !== game.view.scale;
    game.view = { width: rect.width, height: rect.height, dpr, scale };
    if (game.canvas.width !== pixelWidth || game.canvas.height !== pixelHeight) {
      game.canvas.width = pixelWidth;
      game.canvas.height = pixelHeight;
      game.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    if (changed) placeCameraAtPlayer(game);
  }

  function handleWheelZoom(event) {
    if (!game) return;
    event.preventDefault();
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? game.view.height : 1;
    const delta = clamp(event.deltaY * unit, -160, 160);
    game.zoom = clamp(game.zoom * Math.exp(-delta * 0.0005), 0.65, 1.6);
    placeCameraAtPlayer(game);
  }

  function toggleOrientation() {
    if (!game) return;
    const current = game;
    current.landscape = !current.landscape;
    current.stage.classList.toggle("ritual-demo__stage--landscape", current.landscape);
    syncDemoControls();
    requestAnimationFrame(() => {
      if (game !== current) return;
      resizeCanvas();
      placeCameraAtPlayer(current);
    });
  }

  function beginJoystick(event) {
    if (!game?.touch || event.button !== 0) return;
    const point = canvasPoint(event);
    if (point.x > Math.min(game.view.width * 0.42, 330) || point.y < game.view.height * 0.54) return;
    event.preventDefault();
    game.canvas.setPointerCapture(event.pointerId);
    game.joystick = { pointerId: event.pointerId, originX: point.x, originY: point.y, dx: 0, dy: 0 };
    updateJoystick(point.x, point.y);
  }

  function moveJoystick(event) {
    if (!game?.joystick || game.joystick.pointerId !== event.pointerId) return;
    const point = canvasPoint(event);
    updateJoystick(point.x, point.y);
  }

  function endJoystick(event) {
    if (game?.joystick?.pointerId === event.pointerId) game.joystick = null;
  }

  function canvasPoint(event) {
    const rect = game.canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function handleCanvasTap(event) {
    if (!game || event.button !== 0) return false;
    if (game.dialogueOpen) return true;
    const point = canvasPoint(event);
    const scale = worldScale(game);
    const world = {
      x: game.camera.x + point.x / scale,
      y: game.camera.y + point.y / scale,
    };
    const clickedNpc = [game.npc, game.questCat].find((npc) =>
      Math.abs(world.x - npc.x) < 70 && world.y > npc.y - 85 && world.y < npc.y + 38
    );
    if (clickedNpc) {
      if (distance(game.player, clickedNpc) <= 185) interactWithNpc(clickedNpc);
      event.preventDefault();
      return true;
    }
    if (game.pillars.every((pillar) => pillar.placed) && distance(world, game.altar) < 72) {
      event.preventDefault();
      interact();
      return true;
    }
    const pillar = [...game.pillars].reverse().find((item) =>
      Math.abs(world.x - item.x) < 64 && world.y > item.y - 178 && world.y < item.y + 45
    );
    if (!pillar) return false;
    event.preventDefault();
    interact(pillar);
    return true;
  }

  function updateJoystick(x, y) {
    const stick = game.joystick;
    const dx = x - stick.originX;
    const dy = y - stick.originY;
    const length = Math.hypot(dx, dy);
    const strength = Math.min(1, length / 52);
    stick.dx = length > 5 ? dx / length * strength : 0;
    stick.dy = length > 5 ? dy / length * strength : 0;
    stick.knobX = stick.originX + dx / Math.max(1, length) * Math.min(48, length);
    stick.knobY = stick.originY + dy / Math.max(1, length) * Math.min(48, length);
  }

  function frame(timestamp) {
    if (!game) return;
    const dt = Math.min((timestamp - (previousFrame || timestamp)) / 1000, 1 / 30);
    previousFrame = timestamp;
    update(dt);
    draw();
    animationFrame = requestAnimationFrame(frame);
  }

  function update(dt) {
    const s = game;
    const p = s.player;
    s.clock += dt;
    if (s.randomSpawnEnabled && dangerZoneAt(p) && !isSafePoint(p)) s.spawnTimer -= dt;
    else if (!dangerZoneAt(p) || isSafePoint(p)) s.spawnTimer = 1.25;
    p.invulnerable = Math.max(0, p.invulnerable - dt);
    p.attackTimer -= dt;
    p.muzzle = Math.max(0, p.muzzle - dt);

    let dx = s.dialogueOpen ? 0 : Number(heldKeys.has("d") || heldKeys.has("arrowright")) - Number(heldKeys.has("a") || heldKeys.has("arrowleft"));
    let dy = s.dialogueOpen ? 0 : Number(heldKeys.has("s") || heldKeys.has("arrowdown")) - Number(heldKeys.has("w") || heldKeys.has("arrowup"));
    if (!s.dialogueOpen && !dx && !dy && s.joystick) { dx = s.joystick.dx; dy = s.joystick.dy; }
    if (dx || dy) {
      const length = Math.hypot(dx, dy);
      p.x += dx / length * p.speed * dt;
      p.y += dy / length * p.speed * dt;
      if (Math.abs(dx) > 0.08) p.facing = Math.sign(dx);
      p.walk += dt * 9;
    }
    p.x = clamp(p.x, 35, MAP.width - 35);
    p.y = clamp(p.y, 35, MAP.height - 35);

    if (!s.dialogueOpen) {
      fireAtNearestEnemy(s);
      moveBullets(s, dt);
      moveEnemies(s, dt);
      spawnRegularEnemy(s);
      collectWorldItems(s);
    }
    updateParticles(s, dt);
    updateCamera(s, dt);
  }

  function fireAtNearestEnemy(s) {
    const p = s.player;
    if (p.attackTimer > 0 || !s.enemies.length) return;
    let target = null;
    let nearestDistance = 900;
    for (const enemy of s.enemies) {
      const d = distance(p, enemy);
      if (d < nearestDistance) { target = enemy; nearestDistance = d; }
    }
    if (!target) return;
    if (target.x !== p.x) p.facing = Math.sign(target.x - p.x);
    s.bullets.push({ x: p.x, y: p.y - 15, target, speed: 620, damage: 1, life: 2.2 });
    p.attackTimer = 0.32;
    p.muzzle = 0.14;
  }

  function moveBullets(s, dt) {
    const active = [];
    for (const bolt of s.bullets) {
      if (!s.enemies.includes(bolt.target)) continue;
      const dx = bolt.target.x - bolt.x;
      const dy = bolt.target.y - bolt.y;
      const distanceToTarget = Math.hypot(dx, dy) || 1;
      const step = bolt.speed * dt;
      if (distanceToTarget <= step + bolt.target.radius) {
        bolt.target.hp -= bolt.damage;
        addBurst(s, bolt.target.x, bolt.target.y, "#d3a1ff", 5);
        if (bolt.target.hp <= 0) defeatEnemy(s, bolt.target);
        continue;
      }
      bolt.x += dx / distanceToTarget * step;
      bolt.y += dy / distanceToTarget * step;
      bolt.life -= dt;
      if (bolt.life > 0) active.push(bolt);
    }
    s.bullets = active;
  }

  function moveEnemies(s, dt) {
    const p = s.player;
    for (const enemy of [...s.enemies]) {
      enemy.anim += dt;
      if (enemy.guard) {
        enemy.angle += dt * 0.72;
        enemy.x = enemy.guard.x + Math.cos(enemy.angle) * 88;
        enemy.y = enemy.guard.y + Math.sin(enemy.angle) * 54;
      } else {
        const dx = p.x - enemy.x;
        const dy = p.y - enemy.y;
        const length = Math.hypot(dx, dy) || 1;
        if (length > p.radius + enemy.radius + 4) {
          enemy.x += dx / length * enemy.speed * dt;
          enemy.y += dy / length * enemy.speed * dt;
        }
      }
      if (isSafePoint(enemy)) {
        const index = s.enemies.indexOf(enemy);
        if (index >= 0) s.enemies.splice(index, 1);
        addBurst(s, enemy.x, enemy.y, "#ecffd8", 7);
        continue;
      }
      if (distance(enemy, p) < p.radius + enemy.radius - 2 && p.invulnerable <= 0) {
        p.hp -= 1;
        p.invulnerable = 0.85;
        addBurst(s, p.x, p.y, "#ff9bbd", 11);
        if (p.hp <= 0) {
          p.hp = p.maxHp;
          p.invulnerable = 2.2;
          addBurst(s, p.x, p.y, "#c898ff", 30);
        }
      }
    }
  }

  function spawnRegularEnemy(s) {
    const zone = dangerZoneAt(s.player);
    if (!s.randomSpawnEnabled || !zone || isSafePoint(s.player) || s.spawnTimer > 0 || s.won || s.dialogueOpen) return;
    s.spawnTimer += 1.25;
    if (s.enemies.filter((enemy) => enemy.kind === "enemy1").length >= 6) return;
    const scale = worldScale(s);
    const left = s.camera.x;
    const top = s.camera.y;
    const right = left + s.view.width / scale;
    const bottom = top + s.view.height / scale;
    const margin = 72;
    for (let attempt = 0; attempt < 18; attempt++) {
      const side = Math.floor(Math.random() * 4);
      let position;
      if (side === 0) position = { x: left - margin, y: top + Math.random() * (bottom - top) };
      else if (side === 1) position = { x: right + margin, y: top + Math.random() * (bottom - top) };
      else if (side === 2) position = { x: left + Math.random() * (right - left), y: top - margin };
      else position = { x: left + Math.random() * (right - left), y: bottom + margin };
      if (position.x < 45 || position.x > MAP.width - 45 || position.y < 45 || position.y > MAP.height - 45) continue;
      if (position.x >= left && position.x <= right && position.y >= top && position.y <= bottom) continue;
      if (!zoneContains(zone, position)) continue;
      if (isSafePoint(position)) continue;
      spawnEnemy(s, "enemy1", position.x, position.y);
      return;
    }
  }

  function spawnEnemy(s, kind, x, y, options = {}) {
    const stats = {
      enemy1: { hp: 4, speed: 88, radius: 20, reward: 1 },
      enemy2: { hp: 18, speed: 46, radius: 27, reward: 3 },
      enemy3: { hp: 3, speed: 108, radius: 17, reward: 2 },
    }[kind];
    s.enemies.push({ kind, x, y, ...stats, maxHp: stats.hp, anim: Math.random() * TAU, ...options });
  }

  function defeatEnemy(s, enemy) {
    const index = s.enemies.indexOf(enemy);
    if (index < 0) return;
    s.enemies.splice(index, 1);
    if (isSafePoint(enemy)) {
      addBurst(s, enemy.x, enemy.y, "#ecffd8", 7);
      return;
    }
    const amount = enemy.reward;
    s.dustDrops.push({ x: enemy.x + (Math.random() - 0.5) * 28, y: enemy.y + 8, amount });
    if (s.dustDrops.length > 70) s.dustDrops.shift();
    addBurst(s, enemy.x, enemy.y, "#ff526e", 17);
  }

  function collectWorldItems(s) {
    for (const item of s.pickups) {
      if (item.collected || distance(s.player, item) > s.player.radius + 21) continue;
      item.collected = true;
      s.inventory[item.kind] = true;
      addBurst(s, item.x, item.y, item.tint, 25);
      if (item.kind === "frog" && !s.spawnedGuardians) {
        s.spawnedGuardians = true;
        for (let i = 0; i < 5; i++) {
          const angle = i * TAU / 5;
          spawnEnemy(s, "enemy2", item.x + Math.cos(angle) * 88, item.y + Math.sin(angle) * 54, { guard: { x: item.x, y: item.y }, angle });
        }
      } else if (item.kind === "rainbow") {
        s.spawnedRainbowWave = true;
        for (let i = 0; i < 12; i++) {
          const angle = i * TAU / 12;
          spawnEnemy(s, "enemy3", s.player.x + Math.cos(angle) * 330, s.player.y + Math.sin(angle) * 230);
        }
      } else if (item.kind === "unicorn") {
        for (let i = 0; i < 8; i++) {
          const angle = i * TAU / 8;
          const x = clamp(s.player.x + Math.cos(angle) * 250, 45, MAP.width - 45);
          const y = clamp(s.player.y + Math.sin(angle) * 175, 45, MAP.height - 45);
          spawnEnemy(s, "enemy1", x, y);
        }
        addBurst(s, s.player.x, s.player.y, "#d8b4ff", 36);
      }
    }
    s.dustDrops = s.dustDrops.filter((drop) => {
      if (distance(s.player, drop) > s.player.radius + 25) return true;
      s.dust += drop.amount;
      addBurst(s, drop.x, drop.y, "#ff687c", 10);
      return false;
    });
  }

  function interact(targetPillar = null) {
    if (!game || game.won) return false;
    const s = game;
    if (s.pillars.every((item) => item.placed)) {
      if (distance(s.player, s.altar) > 195 || s.dust < 25) return false;
      s.dust -= 25;
      s.won = true;
      addBurst(s, s.altar.x, s.altar.y, "#ffe79a", 100);
      return true;
    }
    const pillar = targetPillar || s.pillars.find((item) => !item.placed && distance(s.player, item) < 105);
    if (!pillar || pillar.placed || !s.inventory[pillar.item]) return false;
    s.inventory[pillar.item] = false;
    pillar.placed = true;
    addBurst(s, pillar.x, pillar.y - 42, pillar.color, 30);
    return true;
  }

  function interactWithNpc(targetNpc = null) {
    if (!game) return false;
    const s = game;
    if (s.dialogueOpen) return true;
    const cats = [
      { character: s.npc, kind: "oracle" },
      { character: s.questCat, kind: "guardian" },
    ];
    const target = targetNpc
      ? cats.find((entry) => entry.character === targetNpc)
      : cats.filter((entry) => distance(s.player, entry.character) <= 185).sort((a, b) => distance(s.player, a.character) - distance(s.player, b.character))[0];
    if (!target || distance(s.player, target.character) > 185) return false;

    if (target.kind === "oracle") {
      if (!s.storySeen) {
        s.storySeen = true;
        openDialogue(INTRO_DIALOGUE);
      } else {
        const text = s.npcQuestAccepted
          ? "Найди Хранителя в северо-западной роще, а три дара принеси к этому алтарю."
          : "Найди Хранителя в северо-западной роще: он примет 50 мер красной пыли и отдаст Лунный жетон.";
        openDialogue([{ speaker: "КОТ-ПРОРИЦАТЕЛЬ", text }]);
      }
    } else if (!s.npcQuestAccepted) {
      s.npcQuestAccepted = true;
      openDialogue([{ speaker: "КОТ-ХРАНИТЕЛЬ", text: "Я укрыл этот островок от тьмы. Принеси мне 50 мер красной пыли — и я отдам тебе Лунный жетон." }]);
    } else if (!s.npcRewarded && s.dust >= 50) {
      s.dust -= 50;
      s.npcRewarded = true;
      s.moonTokens += 1;
      openDialogue([{ speaker: "КОТ-ХРАНИТЕЛЬ", text: "Пепел сложился в Лунный жетон. Он твой — береги его, ведь он задаёт зеркалу один вопрос о будущем." }]);
    } else if (!s.npcRewarded) {
      const missing = 50 - s.dust;
      openDialogue([{ speaker: "КОТ-ХРАНИТЕЛЬ", text: `Мне нужно 50 мер красной пыли. Сейчас у тебя ${s.dust}; осталось собрать ${missing}.` }]);
    } else {
      openDialogue([{ speaker: "КОТ-ХРАНИТЕЛЬ", text: "Лунный жетон уже твой. На этом островке ты можешь передохнуть." }]);
    }
    return true;
  }

  function openDialogue(lines) {
    const s = game;
    s.dialogueLines = lines;
    s.dialogueIndex = 0;
    s.dialogueOpen = true;
    s.joystick = null;
    renderDialogueLine();
  }

  function renderDialogueLine() {
    const s = game;
    const line = s.dialogueLines[s.dialogueIndex];
    if (!line || !s.dialogue) return;
    s.dialogue.hidden = false;
    s.dialogue.classList.toggle("is-player-line", line.speaker === "ТЫ");
    s.dialogueSpeaker.textContent = line.speaker;
    s.dialogueText.textContent = line.text;
    s.dialogueNext.textContent = s.dialogueIndex === s.dialogueLines.length - 1 ? "Закрыть" : "Дальше";
  }

  function advanceDialogue() {
    if (!game?.dialogueOpen) return;
    if (game.dialogueIndex + 1 < game.dialogueLines.length) {
      game.dialogueIndex += 1;
      renderDialogueLine();
      return;
    }
    game.dialogueOpen = false;
    game.dialogue.hidden = true;
  }

  function dangerZoneAt(point) {
    return DANGER_ZONES.find((zone) => zoneContains(zone, point)) || null;
  }

  function zoneContains(zone, point) {
    return distance(zone, point) <= zone.radius;
  }

  function isSafePoint(point) {
    return SAFE_ZONES.some((zone) => zoneContains(zone, point));
  }

  function toggleRandomSpawn() {
    if (!game) return;
    game.randomSpawnEnabled = !game.randomSpawnEnabled;
    game.spawnTimer = 1.25;
    syncDemoControls();
  }
  function addBurst(s, x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * TAU;
      const speed = 30 + Math.random() * 150;
      const life = 0.45 + Math.random() * 0.6;
      s.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 25, color, size: 2 + Math.random() * 4, life, maxLife: life });
    }
  }

  function updateParticles(s, dt) {
    s.particles = s.particles.filter((particle) => {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= 0.975;
      particle.vy *= 0.975;
      particle.life -= dt;
      return particle.life > 0;
    });
  }

  function updateCamera(s, dt) {
    const worldWidth = s.view.width / worldScale(s);
    const worldHeight = s.view.height / worldScale(s);
    const targetX = clamp(s.player.x - worldWidth / 2, 0, MAP.width - worldWidth);
    const targetY = clamp(s.player.y - worldHeight * (s.landscape ? 0.5 : 0.66), 0, MAP.height - worldHeight);
    const ease = Math.min(1, dt * 8);
    s.camera.x += (targetX - s.camera.x) * ease;
    s.camera.y += (targetY - s.camera.y) * ease;
  }

  function placeCameraAtPlayer(s) {
    const worldWidth = s.view.width / worldScale(s);
    const worldHeight = s.view.height / worldScale(s);
    s.camera.x = clamp(s.player.x - worldWidth / 2, 0, MAP.width - worldWidth);
    s.camera.y = clamp(s.player.y - worldHeight * (s.landscape ? 0.5 : 0.66), 0, MAP.height - worldHeight);
  }

  function seedScenery(s) {
    let seed = 8253;
    const random = () => { seed = seed * 16807 % 2147483647; return (seed - 1) / 2147483646; };
    for (let i = 0; i < 310; i++) {
      s.scenery.push({ x: 32 + random() * (MAP.width - 64), y: 32 + random() * (MAP.height - 64), size: 3 + random() * 7, hue: Math.floor(random() * 5), kind: random() < 0.76 ? "flower" : "mushroom" });
    }
    s.scenery.push({ x: 2240, y: 3080, kind: "pond" }, { x: 700, y: 2730, kind: "tree" }, { x: 2150, y: 1420, kind: "tree" }, { x: 2050, y: 3870, kind: "tree" });
  }

  function draw() {
    const s = game;
    resizeCanvas();
    const { width, height, dpr } = s.view;
    const ctx = s.ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.scale(worldScale(s), worldScale(s));
    ctx.translate(-s.camera.x, -s.camera.y);
    drawGround(ctx, s);
    drawGuides(ctx, s);
    drawAltarFloor(ctx, s);
    const actors = [
      ...s.pillars.map((pillar, index) => ({ type: "pillar", y: pillar.y, pillar, index })),
      ...s.enemies.map((enemy) => ({ type: "enemy", y: enemy.y, enemy })),
      { type: "npc", y: s.npc.y, npc: s.npc, label: "КОТ-ПРОРИЦАТЕЛЬ" },
      { type: "npc", y: s.questCat.y, npc: s.questCat, label: "КОТ-ХРАНИТЕЛЬ" },
      { type: "cat", y: s.player.y, player: s.player },
    ].sort((a, b) => a.y - b.y);
    for (const actor of actors) {
      if (actor.type === "pillar") drawPillar(ctx, actor.pillar, actor.index, s.clock);
      else if (actor.type === "enemy") drawEnemy(ctx, actor.enemy);
      else if (actor.type === "npc") drawOracleCat(ctx, s, actor.npc, actor.label);
      else drawCat(ctx, actor.player, s.clock);
    }
    for (const item of s.pickups) if (!item.collected) drawPickup(ctx, item, s.clock);
    for (const drop of s.dustDrops) drawDustDrop(ctx, drop, s.clock);
    drawBullets(ctx, s.bullets);
    drawParticles(ctx, s.particles);
    ctx.restore();
    drawHud(ctx, s, width, height);
    if (s.won) drawVictory(ctx, width, height);
  }

  function drawGround(ctx, s) {
    ctx.fillStyle = "#a9dfa9";
    const worldWidth = s.view.width / worldScale(s);
    const worldHeight = s.view.height / worldScale(s);
    ctx.fillRect(s.camera.x, s.camera.y, worldWidth, worldHeight);
    ctx.save();
    const left = Math.floor(s.camera.x / 180) * 180;
    const top = Math.floor(s.camera.y / 180) * 180;
    for (let x = left; x < s.camera.x + worldWidth + 180; x += 180) {
      for (let y = top; y < s.camera.y + worldHeight + 180; y += 180) {
        const n = Math.sin(x * 0.013 + y * 0.027);
        ctx.fillStyle = n > 0.55 ? "rgba(226,255,205,.12)" : "rgba(72,151,105,.035)";
        ctx.beginPath(); ctx.ellipse(x + 61, y + 71, 72, 28, n * 0.3, 0, TAU); ctx.fill();
      }
    }
    drawGroundZones(ctx, s);
    for (const detail of s.scenery) {
      if (detail.x < s.camera.x - 60 || detail.x > s.camera.x + worldWidth + 60 || detail.y < s.camera.y - 70 || detail.y > s.camera.y + worldHeight + 70) continue;
      if (detail.kind === "pond") drawPond(ctx, detail.x, detail.y);
      else if (detail.kind === "tree") drawTree(ctx, detail.x, detail.y);
      else if (detail.kind === "flower") drawFlower(ctx, detail.x, detail.y, detail.size, detail.hue);
      else drawMushroom(ctx, detail.x, detail.y, detail.size);
    }
    ctx.restore();
  }

  function drawGroundZones(ctx, s) {
    for (const zone of DANGER_ZONES) {
      ctx.save();
      ctx.fillStyle = zone.color;
      ctx.beginPath(); ctx.arc(zone.x, zone.y, zone.radius, 0, TAU); ctx.fill();
      ctx.lineWidth = 8;
      ctx.strokeStyle = `${zone.edge}88`;
      ctx.setLineDash([22, 15]);
      ctx.beginPath(); ctx.arc(zone.x, zone.y, zone.radius - 4, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(54,43,69,.76)";
      ctx.font = "900 18px system-ui";
      ctx.textAlign = "center";
      const labelWidth = ctx.measureText(zone.label).width + 30;
      roundedRect(ctx, zone.x - labelWidth / 2, zone.y - zone.radius + 240, labelWidth, 32, 14);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.fillText(zone.label, zone.x, zone.y - zone.radius + 261);
      ctx.restore();
    }

    const center = SAFE_ZONES[0];
    ctx.save();
    ctx.fillStyle = center.color;
    ctx.beginPath(); ctx.arc(center.x, center.y, center.radius, 0, TAU); ctx.fill();
    ctx.strokeStyle = `${center.edge}bb`;
    ctx.lineWidth = 9;
    ctx.setLineDash([26, 15]);
    ctx.beginPath(); ctx.arc(center.x, center.y, center.radius - 5, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(50,81,60,.77)";
    ctx.font = "900 18px system-ui";
    ctx.textAlign = "center";
    const centerLabel = "МИРНЫЙ ЦЕНТР";
    const centerWidth = ctx.measureText(centerLabel).width + 32;
    roundedRect(ctx, center.x - centerWidth / 2, center.y + 340, centerWidth, 32, 14);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.fillText(centerLabel, center.x, center.y + 361);
    ctx.restore();

    const island = SAFE_ZONES[1];
    ctx.save();
    ctx.fillStyle = island.color;
    ctx.beginPath(); ctx.arc(island.x, island.y, island.radius, 0, TAU); ctx.fill();
    ctx.strokeStyle = island.edge;
    ctx.lineWidth = 5;
    ctx.setLineDash([12, 8]);
    ctx.beginPath(); ctx.arc(island.x, island.y, island.radius - 3, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(57,44,72,.8)";
    ctx.font = "900 12px system-ui";
    ctx.textAlign = "center";
    const islandWidth = ctx.measureText(island.label).width + 24;
    roundedRect(ctx, island.x - islandWidth / 2, island.y - island.radius + 19, islandWidth, 26, 12);
    ctx.fill();
    ctx.fillStyle = "#fff4d0";
    ctx.fillText(island.label, island.x, island.y - island.radius + 37);
    ctx.restore();
  }

  function drawGuides(ctx, s) {
    drawGuidePath(ctx, s.pillars[1], s.pickups[0], "#f1a8cf", s.clock);
    drawGuidePath(ctx, s.pillars[2], s.pickups[1], "#9be0e5", s.clock + 1.4);
    drawGuidePath(ctx, s.pillars[0], s.pickups[2], "#d4b2ff", s.clock + 2.7);
  }

  function drawGuidePath(ctx, from, to, color, time) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy) || 1;
    const bend = Math.min(150, length * 0.08) * (to.kind === "frog" ? 1 : -1);
    const cx = (from.x + to.x) / 2 - dy / length * bend;
    const cy = (from.y + to.y) / 2 + dx / length * bend;
    ctx.save();
    ctx.lineCap = "round";
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.13;
    ctx.lineWidth = 18;
    ctx.shadowColor = color;
    ctx.shadowBlur = 14;
    ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.quadraticCurveTo(cx, cy, to.x, to.y); ctx.stroke();
    ctx.globalAlpha = 0.37;
    ctx.shadowBlur = 0;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([2, 13]);
    ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.quadraticCurveTo(cx, cy, to.x, to.y); ctx.stroke();
    ctx.setLineDash([]);
    for (let t = 0.08, i = 0; t < 0.98; t += 0.045, i++) {
      const u = 1 - t;
      const x = u * u * from.x + 2 * u * t * cx + t * t * to.x;
      const y = u * u * from.y + 2 * u * t * cy + t * t * to.y;
      ctx.globalAlpha = 0.18 + (Math.sin(time * 2 + i * 0.7) + 1) * 0.07;
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(x, y, i % 3 ? 2 : 3, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  function drawAltarFloor(ctx, s) {
    const { x, y } = s.altar;
    const placed = s.pillars.filter((pillar) => pillar.placed).length;
    const charge = placed / s.pillars.length;
    const centerY = y + 12;
    const sigilY = y + 38;
    const pulse = 0.7 + (Math.sin(s.clock * 2.3) + 1) * 0.15;
    ctx.save();

    ctx.fillStyle = "rgba(162,106,210," + (0.1 + charge * 0.16) + ")";
    ctx.beginPath(); ctx.ellipse(x, centerY, 180, 145, 0, 0, TAU); ctx.fill();

    // Low stone paths tie the three pillars into one altar.
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.shadowColor = "#c496f4";
    ctx.shadowBlur = 5 + charge * 13;
    ctx.strokeStyle = "rgba(174,129,220," + (0.36 + charge * 0.34) + ")";
    ctx.lineWidth = 4;
    for (let i = 0; i < s.pillars.length; i++) {
      const a = s.pillars[i];
      const b = s.pillars[(i + 1) % s.pillars.length];
      ctx.beginPath(); ctx.moveTo(a.x, a.y + 4); ctx.lineTo(b.x, b.y + 4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, centerY); ctx.lineTo(a.x, a.y + 4); ctx.stroke();
    }

    // A raised double ring frames a compact five-point altar sigil.
    ctx.shadowColor = "#d8a7ff";
    ctx.shadowBlur = 7 + charge * 12;
    ctx.strokeStyle = "rgba(223,190,255," + (0.35 + charge * 0.32) + ")";
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(x, centerY, 165, 132, 0, 0, TAU); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(242,220,255," + (0.22 + charge * 0.42) + ")";
    ctx.lineWidth = 1.7;
    ctx.beginPath(); ctx.ellipse(x, centerY, 105, 83, 0, 0, TAU); ctx.stroke();

    for (let i = 0; i < 20; i++) {
      const angle = i * TAU / 20;
      const outerX = x + Math.cos(angle) * 151;
      const outerY = centerY + Math.sin(angle) * 119;
      ctx.save();
      ctx.globalAlpha = 0.3 + charge * 0.45 + (i % 4 === 0 ? pulse * 0.2 : 0);
      ctx.fillStyle = i % 4 === 0 ? "#ffe6ff" : "#c797e7";
      ctx.beginPath(); ctx.arc(outerX, outerY, i % 4 === 0 ? 3 : 1.7, 0, TAU); ctx.fill();
      ctx.restore();
    }

    const points = [];
    for (let i = 0; i < 5; i++) {
      const angle = -Math.PI / 2 + i * TAU / 5;
      points.push({ x: x + Math.cos(angle) * 72, y: sigilY + Math.sin(angle) * 72 });
    }

    // Draw the pentagon underneath, then light the star's five strokes with each offering.
    ctx.strokeStyle = "rgba(207,164,237,.28)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const point = points[i];
      if (i === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    }
    ctx.closePath();
    ctx.stroke();

    const order = [0, 2, 4, 1, 3, 0];
    const litSegments = [0, 2, 4, 5][placed];
    for (let i = 0; i < order.length - 1; i++) {
      const a = points[order[i]];
      const b = points[order[i + 1]];
      ctx.strokeStyle = "rgba(180,132,211,.48)";
      ctx.lineWidth = 3;
      ctx.shadowBlur = 0;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();

      if (i < litSegments) {
        ctx.save();
        ctx.globalAlpha = 0.72 + pulse * 0.28;
        ctx.strokeStyle = "#ffe3ff";
        ctx.shadowColor = "#e9aaff";
        ctx.shadowBlur = 9 + charge * 12;
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        ctx.restore();
      }
    }

    for (let i = 0; i < points.length; i++) {
      ctx.save();
      ctx.fillStyle = i < placed ? "#fff1c4" : "#cda7e7";
      ctx.shadowColor = i < placed ? "#ffe78b" : "#c798f4";
      ctx.shadowBlur = i < placed ? 11 : 3;
      ctx.beginPath(); ctx.arc(points[i].x, points[i].y, i < placed ? 4 : 2.5, 0, TAU); ctx.fill();
      ctx.restore();
    }

    ctx.fillStyle = "rgba(255,231,255," + (0.2 + charge * 0.72) + ")";
    ctx.shadowColor = "#f3baff";
    ctx.shadowBlur = charge ? 9 + charge * 18 : 0;
    ctx.beginPath(); ctx.arc(x, sigilY, 5 + charge * 5, 0, TAU); ctx.fill();
    ctx.restore();
  }
  function drawPillar(ctx, pillar, index, time) {
    const { x, y } = pillar;
    const image = sprites.pillar;
    ctx.save();
    const glow = 9 + (Math.sin(time * 2.2 + index) + 1) * 3;
    ctx.shadowColor = pillar.color;
    ctx.shadowBlur = pillar.placed ? 24 : glow;
    ctx.fillStyle = "rgba(63,42,80,.15)";
    ctx.beginPath(); ctx.ellipse(x, y + 4, 48, 16, 0, 0, TAU); ctx.fill();
    if (image.complete && image.naturalWidth) {
      ctx.drawImage(image, 350, 185, 570, 955, x - 43, y - 130, 86, 136);
    } else {
      ctx.fillStyle = "#8e6ba7";
      roundedRect(ctx, x - 26, y - 58, 52, 62, 12); ctx.fill();
      ctx.fillStyle = "#ddc1ed";
      roundedRect(ctx, x - 34, y - 65, 68, 15, 7); ctx.fill();
    }
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(52,42,68,.82)";
    roundedRect(ctx, x - 75, y + 16, 150, 25, 10); ctx.fill();
    ctx.fillStyle = pillar.placed ? "#ffe6a1" : "#fff";
    ctx.font = "800 10px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(pillar.placed ? "✦ ГОТОВО ✦" : pillar.label, x, y + 33);
    ctx.restore();
    if (pillar.placed) drawFloatingOffering(ctx, pillar, time);
  }

  function drawPickup(ctx, item, time) {
    const bob = Math.sin(time * 3 + item.x) * 5;
    ctx.save();
    ctx.translate(item.x, item.y + bob);
    ctx.shadowColor = item.tint;
    ctx.shadowBlur = 24;
    ctx.fillStyle = `${item.tint}44`;
    ctx.beginPath(); ctx.arc(0, 0, 34, 0, TAU); ctx.fill();
    ctx.shadowBlur = 0;
    drawIngredient(ctx, item.kind);
    ctx.fillStyle = "rgba(52,42,68,.74)";
    roundedRect(ctx, -72, 38, 144, 23, 9); ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "800 10px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(item.label.toUpperCase(), 0, 53);
    ctx.restore();
  }

  function drawDustDrop(ctx, drop, time) {
    const bob = Math.sin(time * 4 + drop.x * 0.03) * 4;
    ctx.save();
    ctx.translate(drop.x, drop.y + bob);
    ctx.shadowColor = "#ff475f";
    ctx.shadowBlur = 21;
    ctx.fillStyle = "rgba(255,68,91,.2)";
    ctx.beginPath(); ctx.arc(0, 0, 20, 0, TAU); ctx.fill();
    ctx.fillStyle = "#ff5368";
    ctx.strokeStyle = "#ffe4e7";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -12); ctx.lineTo(8, -3); ctx.lineTo(5, 10); ctx.lineTo(0, 14); ctx.lineTo(-6, 8); ctx.lineTo(-8, -3); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0;
    if (drop.amount > 1) {
      ctx.fillStyle = "#fff"; ctx.font = "bold 10px system-ui"; ctx.textAlign = "center"; ctx.fillText(`×${drop.amount}`, 0, 27);
    }
    ctx.restore();
  }

  function drawFloatingOffering(ctx, pillar, time) {
    const bob = Math.sin(time * 2.8 + pillar.x) * 5;
    ctx.save();
    ctx.translate(pillar.x, pillar.y - 154 + bob);
    ctx.shadowColor = pillar.color;
    ctx.shadowBlur = 18;
    ctx.fillStyle = `${pillar.color}38`;
    ctx.beginPath(); ctx.arc(0, 0, 25, 0, TAU); ctx.fill();
    ctx.shadowBlur = 0;
    drawIngredient(ctx, pillar.item);
    ctx.restore();
  }

  function drawEnemy(ctx, enemy) {
    const bob = Math.sin(enemy.anim * 4) * 4;
    const size = enemy.kind === "enemy2" ? 66 : enemy.kind === "enemy3" ? 48 : 56;
    const image = sprites[enemy.kind];
    ctx.save();
    ctx.globalAlpha = 0.96;
    ctx.shadowColor = enemy.kind === "enemy2" ? "#83d3f7" : "#bf8bff";
    ctx.shadowBlur = enemy.kind === "enemy2" ? 16 : 12;
    if (image.complete && image.naturalWidth) {
      ctx.drawImage(image, enemy.x - size / 2, enemy.y - size / 2 + bob, size, size);
    } else {
      ctx.fillStyle = enemy.kind === "enemy2" ? "#71bfdc" : "#b18bd6";
      ctx.beginPath(); ctx.arc(enemy.x, enemy.y + bob, enemy.radius, 0, TAU); ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.arc(enemy.x - 6, enemy.y - 3 + bob, 3, 0, TAU); ctx.arc(enemy.x + 6, enemy.y - 3 + bob, 3, 0, TAU); ctx.fill();
    }
    ctx.restore();
    if (enemy.hp < enemy.maxHp) {
      const width = enemy.kind === "enemy2" ? 42 : 32;
      ctx.fillStyle = "rgba(58,42,69,.62)";
      roundedRect(ctx, enemy.x - width / 2, enemy.y - enemy.radius - 11 + bob, width, 6, 3); ctx.fill();
      ctx.fillStyle = enemy.kind === "enemy2" ? "#83d8f4" : "#ff9dcc";
      roundedRect(ctx, enemy.x - width / 2, enemy.y - enemy.radius - 11 + bob, width * Math.max(0, enemy.hp / enemy.maxHp), 6, 3); ctx.fill();
    }
  }

  function drawCat(ctx, player, time) {
    const flicker = player.invulnerable > 0 && Math.floor(time * 15) % 2 === 0;
    const image = sprites.cat;
    const bob = Math.sin(player.walk) * 3;
    ctx.save();
    ctx.globalAlpha = flicker ? 0.5 : 1;
    ctx.shadowColor = "#b17cff";
    ctx.shadowBlur = 22;
    ctx.fillStyle = "rgba(183,128,255,.19)";
    ctx.beginPath(); ctx.ellipse(player.x, player.y + 9, 35, 24, 0, 0, TAU); ctx.fill();
    ctx.shadowBlur = 0;
    if (image.complete && image.naturalWidth) {
      ctx.save();
      if (player.facing < 0) { ctx.translate(player.x * 2, 0); ctx.scale(-1, 1); }
      ctx.drawImage(image, player.x - 39, player.y - 43 + bob, 78, 78);
      ctx.restore();
    } else {
      ctx.fillStyle = "#fbf0e4";
      ctx.beginPath(); ctx.ellipse(player.x, player.y, 27, 23, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.moveTo(player.x - 22, player.y - 13); ctx.lineTo(player.x - 20, player.y - 35); ctx.lineTo(player.x - 5, player.y - 23); ctx.fill();
      ctx.beginPath(); ctx.moveTo(player.x + 7, player.y - 23); ctx.lineTo(player.x + 22, player.y - 36); ctx.lineTo(player.x + 23, player.y - 10); ctx.fill();
      ctx.fillStyle = "#4c375d";
      ctx.beginPath(); ctx.arc(player.x - 8, player.y - 4, 3, 0, TAU); ctx.arc(player.x + 8, player.y - 4, 3, 0, TAU); ctx.fill();
    }
    if (player.muzzle > 0) {
      const alpha = player.muzzle / 0.14;
      const mx = player.x + player.facing * 31;
      ctx.globalAlpha = alpha;
      ctx.shadowColor = "#d397ff";
      ctx.shadowBlur = 26;
      ctx.fillStyle = "#fff1ff";
      ctx.beginPath(); ctx.arc(mx, player.y - 11 + bob, 8 + (1 - alpha) * 7, 0, TAU); ctx.fill();
      ctx.strokeStyle = "#cb8cff";
      ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(mx - player.facing * 9, player.y - 11 + bob); ctx.lineTo(mx + player.facing * 18, player.y - 11 + bob); ctx.stroke();
    }
    ctx.restore();
  }

  function drawOracleCat(ctx, s, npc, label) {
    const image = sprites.cat2;
    const bob = Math.sin(s.clock * 2.2) * 3;
    ctx.save();
    ctx.shadowColor = "#ffe09a";
    ctx.shadowBlur = 20;
    ctx.fillStyle = "rgba(255,224,154,.28)";
    ctx.beginPath(); ctx.ellipse(npc.x, npc.y + 9, 39, 25, 0, 0, TAU); ctx.fill();
    ctx.shadowBlur = 0;
    if (image.complete && image.naturalWidth) {
      ctx.drawImage(image, npc.x - 41, npc.y - 48 + bob, 82, 82);
    } else {
      ctx.fillStyle = "#bda7d9";
      ctx.beginPath(); ctx.ellipse(npc.x, npc.y - 2 + bob, 27, 23, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = "#fff2bd";
      ctx.beginPath(); ctx.arc(npc.x - 8, npc.y - 6 + bob, 3, 0, TAU); ctx.arc(npc.x + 8, npc.y - 6 + bob, 3, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = "rgba(57,44,72,.82)";
    roundedRect(ctx, npc.x - 67, npc.y + 23, 134, 24, 10); ctx.fill();
    ctx.fillStyle = "#fff4d0";
    ctx.font = "800 10px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(label, npc.x, npc.y + 39);
    if (!s.dialogueOpen && distance(s.player, npc) <= 185) {
      ctx.fillStyle = "rgba(57,44,72,.84)";
      roundedRect(ctx, npc.x - 54, npc.y - 78 + bob, 108, 23, 10); ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = "800 10px system-ui";
      ctx.fillText("E · ПОГОВОРИТЬ", npc.x, npc.y - 63 + bob);
    }
    ctx.restore();
  }

  function drawBullets(ctx, bullets) {
    for (const bolt of bullets) {
      const angle = Math.atan2(bolt.target.y - bolt.y, bolt.target.x - bolt.x);
      ctx.save();
      ctx.lineCap = "round";
      ctx.shadowColor = "#bd72ff";
      ctx.shadowBlur = 18;
      ctx.strokeStyle = "rgba(187,119,255,.9)";
      ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(bolt.x - Math.cos(angle) * 20, bolt.y - Math.sin(angle) * 20); ctx.lineTo(bolt.x, bolt.y); ctx.stroke();
      ctx.fillStyle = "#f5e6ff";
      ctx.beginPath(); ctx.arc(bolt.x, bolt.y, 6, 0, TAU); ctx.fill();
      ctx.restore();
    }
  }

  function drawParticles(ctx, particles) {
    for (const particle of particles) {
      ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
      ctx.fillStyle = particle.color;
      ctx.beginPath(); ctx.arc(particle.x, particle.y, particle.size, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawHud(ctx, s, width, height) {
    const scale = clamp(Math.min(width / 390, height / 844), s.landscape ? 0.4 : 0.68, 1.4);
    const pad = 11 * scale;
    const top = 11 * scale;
    const hpWidth = Math.min(174 * scale, width * 0.47);
    const dustWidth = Math.min(160 * scale, width * 0.44);
    const panelHeight = 57 * scale;
    ctx.save();
    drawHudBox(ctx, pad, top, hpWidth, panelHeight);
    drawHudBox(ctx, width - dustWidth - pad, top, dustWidth, panelHeight);
    ctx.font = "800 " + (9 * scale) + "px system-ui";
    ctx.textAlign = "left";
    ctx.fillStyle = "#fff";
    ctx.fillText("ЗДОРОВЬЕ КОТИКА", pad + 10 * scale, top + 16 * scale);
    for (let i = 0; i < s.player.maxHp; i++) {
      ctx.font = (16 * scale) + "px system-ui";
      ctx.fillStyle = i < s.player.hp ? "#ff93b3" : "#705d7a";
      ctx.fillText("♥", pad + 10 * scale + i * 18 * scale, top + 43 * scale);
    }
    const rightX = width - dustWidth - pad + 10 * scale;
    ctx.font = "800 " + (9 * scale) + "px system-ui";
    ctx.fillStyle = "#fff";
    ctx.fillText("КРАСНАЯ ПЫЛЬ", rightX, top + 16 * scale);
    ctx.font = "800 " + (18 * scale) + "px system-ui";
    ctx.fillStyle = "#ffe1ec";
    ctx.fillText("✦ " + String(s.dust).padStart(2, "0") + " / 25", rightX, top + 43 * scale);

    const inventory = [];
    if (s.inventory.frog) inventory.push("лапка жабы");
    if (s.inventory.rainbow) inventory.push("радуга в банке");
    if (s.inventory.unicorn) inventory.push("волос единорога");
    const offered = s.pillars.filter((pillar) => pillar.placed).length;
    const status = s.won ? "РИТУАЛ ЗАВЕРШЁН ✨" : "ДАРЫ " + offered + "/3" + (inventory.length ? " · С СОБОЙ: " + inventory.join(", ") : "");
    ctx.font = "800 " + (9 * scale) + "px system-ui";
    const statusWidth = Math.min(width - 2 * pad, Math.max(180 * scale, ctx.measureText(status).width + 24 * scale));
    const statusY = top + panelHeight + 7 * scale;
    if (!s.landscape || height >= 300) {
      drawHudBox(ctx, width / 2 - statusWidth / 2, statusY, statusWidth, 29 * scale);
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.fillText(status, width / 2, statusY + 19 * scale, statusWidth - 16 * scale);
      const questStatus = s.npcRewarded
        ? `ЛУННЫЕ ЖЕТОНЫ: ${s.moonTokens}`
        : s.npcQuestAccepted ? `ХРАНИТЕЛЮ: ${Math.min(s.dust, 50)}/50` : s.storySeen ? "НАЙДИ ХРАНИТЕЛЯ В РОЩЕ" : "ПОГОВОРИ С КОТОМ У АЛТАРЯ";
      const questWidth = Math.min(width - 2 * pad, Math.max(190 * scale, ctx.measureText(questStatus).width + 24 * scale));
      drawHudBox(ctx, width / 2 - questWidth / 2, statusY + 34 * scale, questWidth, 25 * scale);
      ctx.font = "800 " + (8 * scale) + "px system-ui";
      ctx.fillStyle = "#fff4d0";
      ctx.fillText(questStatus, width / 2, statusY + 50 * scale, questWidth - 16 * scale);
    }

    if (s.touch) drawJoystick(ctx, s, scale);
    ctx.restore();
  }

  function drawJoystick(ctx, s, scale) {
    const x = s.joystick ? s.joystick.originX : 68 * scale;
    const y = s.joystick ? s.joystick.originY : s.view.height - 83 * scale;
    const knobX = s.joystick?.knobX ?? x;
    const knobY = s.joystick?.knobY ?? y;
    const radius = 46 * scale;
    ctx.save();
    ctx.globalAlpha = s.joystick ? 0.82 : 0.5;
    ctx.fillStyle = "rgba(53,40,72,.55)";
    ctx.beginPath(); ctx.arc(x, y, radius, 0, TAU); ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.78)";
    ctx.lineWidth = 2 * scale;
    ctx.beginPath(); ctx.arc(x, y, radius, 0, TAU); ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,.92)";
    ctx.beginPath(); ctx.arc(knobX, knobY, 22 * scale, 0, TAU); ctx.fill();
    ctx.fillStyle = "#9374be";
    ctx.beginPath(); ctx.arc(knobX, knobY, 9 * scale, 0, TAU); ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "800 " + (9 * scale) + "px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("ДВИЖЕНИЕ", x, y - radius - 9 * scale);
    ctx.restore();
  }
  function drawPond(ctx, x, y) {
    ctx.save();
    ctx.fillStyle = "#85d0d5";
    ctx.beginPath(); ctx.ellipse(x, y, 100, 54, -0.1, 0, TAU); ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.68)";
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(x - 6, y - 3, 56, 21, -0.1, 0.3, 2.65); ctx.stroke();
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i % 2 ? "#78ad82" : "#f3d9a6";
      ctx.beginPath(); ctx.arc(x + (i - 2) * 23, y + 42, 6, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  function drawTree(ctx, x, y) {
    ctx.save();
    ctx.fillStyle = "rgba(69,118,82,.16)";
    ctx.beginPath(); ctx.ellipse(x, y + 24, 48, 20, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = "#a77771";
    roundedRect(ctx, x - 7, y - 5, 14, 33, 6); ctx.fill();
    ctx.fillStyle = "#91c78d";
    ctx.beginPath(); ctx.arc(x - 18, y - 8, 24, 0, TAU); ctx.arc(x + 16, y - 13, 27, 0, TAU); ctx.arc(x, y - 28, 26, 0, TAU); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.42)";
    ctx.beginPath(); ctx.arc(x - 7, y - 32, 5, 0, TAU); ctx.fill();
    ctx.restore();
  }

  function drawFlower(ctx, x, y, size, hue) {
    const colors = ["#f5e89f", "#f2b2d0", "#d8c0ff", "#fff3ed", "#f8c5a9"];
    ctx.save();
    ctx.globalAlpha = 0.78;
    ctx.fillStyle = "#5c9a70";
    ctx.fillRect(x - 1, y, 2, size * 1.8);
    ctx.fillStyle = colors[hue];
    for (let i = 0; i < 5; i++) {
      const a = i * TAU / 5;
      ctx.beginPath(); ctx.arc(x + Math.cos(a) * size * 0.52, y + Math.sin(a) * size * 0.52, size * 0.45, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = "#ffe8a0";
    ctx.beginPath(); ctx.arc(x, y, size * 0.29, 0, TAU); ctx.fill();
    ctx.restore();
  }

  function drawMushroom(ctx, x, y, size) {
    ctx.save();
    ctx.fillStyle = "#fff0de";
    roundedRect(ctx, x - size * 0.27, y - 1, size * 0.54, size, 3); ctx.fill();
    ctx.fillStyle = "#c783a2";
    ctx.beginPath(); ctx.ellipse(x, y, size * 0.82, size * 0.48, 0, Math.PI, TAU); ctx.fill();
    ctx.restore();
  }

  function drawIngredient(ctx, kind) {
    if (kind === "frog") drawFrogCharm(ctx);
    else if (kind === "rainbow") drawRainbowJar(ctx);
    else drawUnicornHair(ctx);
  }

  function drawUnicornHair(ctx) {
    ctx.save();
    ctx.rotate(-0.22);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.shadowColor = "#e7c5ff";
    ctx.shadowBlur = 12;
    ctx.strokeStyle = "#ffe7a6";
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.moveTo(-27, 9);
    ctx.bezierCurveTo(-8, -24, 10, 25, 29, -10);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#d9b3ff";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-27, 9);
    ctx.bezierCurveTo(-8, -24, 10, 25, 29, -10);
    ctx.stroke();
    ctx.fillStyle = "#fff6c8";
    for (const [x, y, radius] of [[-30, -20, 3], [24, 19, 3.5], [35, -25, 2.5]]) {
      ctx.beginPath(); ctx.arc(x, y, radius, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  function drawFrogCharm(ctx) {
    ctx.save();
    ctx.rotate(-0.38);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#83bd77";
    ctx.lineWidth = 11;
    ctx.beginPath(); ctx.moveTo(-15, 12); ctx.lineTo(-2, -4); ctx.lineTo(12, -14); ctx.stroke();
    ctx.lineWidth = 7;
    ctx.strokeStyle = "#a3d793";
    ctx.beginPath(); ctx.moveTo(-2, -4); ctx.lineTo(13, 8); ctx.moveTo(12, -14); ctx.lineTo(27, -24); ctx.moveTo(12, -14); ctx.lineTo(29, -8); ctx.stroke();
    ctx.fillStyle = "#f4d8aa";
    for (const [x, y] of [[-16, 12], [14, 8], [27, -24], [29, -8]]) { ctx.beginPath(); ctx.arc(x, y, 4, 0, TAU); ctx.fill(); }
    ctx.restore();
  }

  function drawRainbowJar(ctx) {
    ctx.save();
    ctx.shadowColor = "#9bdcf5";
    ctx.shadowBlur = 10;
    ctx.fillStyle = "rgba(211,239,255,.86)";
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 3;
    roundedRect(ctx, -18, -19, 36, 42, 9); ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#e4b1ff"; ctx.fillRect(-14, 4, 28, 14);
    ctx.fillStyle = "#ffadcb"; ctx.fillRect(-14, 10, 28, 8);
    ctx.fillStyle = "#90d9ec"; ctx.beginPath(); ctx.arc(0, 7, 8, Math.PI, TAU); ctx.fill();
    ctx.fillStyle = "#f1dca9"; roundedRect(ctx, -11, -25, 22, 7, 3); ctx.fill();
    ctx.restore();
  }

  function drawHudBox(ctx, x, y, width, height) {
    ctx.save();
    ctx.fillStyle = "rgba(57,44,72,.78)";
    roundedRect(ctx, x, y, width, height, 14);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.25)";
    ctx.lineWidth = 1;
    roundedRect(ctx, x, y, width, height, 14);
    ctx.stroke();
    ctx.restore();
  }

  function drawVictory(ctx, width, height) {
    ctx.save();
    ctx.fillStyle = "rgba(42,31,61,.42)";
    ctx.fillRect(0, 0, width, height);
    ctx.textAlign = "center";
    ctx.fillStyle = "#fff6e6";
    ctx.font = "800 32px system-ui";
    ctx.fillText("Ритуал удался! ✨", width / 2, height / 2);
    ctx.font = "16px system-ui";
    ctx.fillText("Магия любви разлилась по полянке", width / 2, height / 2 + 31);
    ctx.restore();
  }

  function roundedRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

  function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function worldScale(s) { return s.view.scale * s.zoom; }
  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
})();
