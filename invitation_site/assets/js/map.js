(() => {
  const DEFAULTS = {
	viewportId: 'mapViewport',
	canvasId: 'territoryCanvas',
	frameImgId: 'mapFrame',
	badgeImgId: 'timeOfDayBadge',
	modalId: 'poiModal',
	modalTitleId: 'poiModalTitle',
	modalContentId: 'poiModalContent',
	modalImagesId: 'poiModalImages',
	dataUrl: 'assets/data/mapContent.json',
  };

  function initVenueMapFullscreen() {
	const container = document.getElementById('venueMapContainer');
	const toggle = document.getElementById('venueMapFullscreenToggle');
	if (!container || !toggle) return;

	function isActive() {
	  return document.fullscreenElement === container || container.classList.contains('where-map--fullscreen-fallback');
	}

	function syncState() {
	  const expanded = isActive();
	  toggle.setAttribute('aria-pressed', expanded ? 'true' : 'false');
	  toggle.setAttribute('aria-label', expanded ? 'Свернуть карту' : 'Развернуть карту на весь экран');
	  toggle.innerHTML = expanded ? '⤡ <span>Свернуть</span>' : '⤢ <span>На весь экран</span>';
	}

	function enterFallback() {
	  container.classList.add('where-map--fullscreen-fallback');
	  document.body.classList.add('map-fullscreen-fallback');
	  syncState();
	}

	function exitFallback() {
	  container.classList.remove('where-map--fullscreen-fallback');
	  document.body.classList.remove('map-fullscreen-fallback');
	  syncState();
	}

	async function toggleFullscreen() {
	  if (document.fullscreenEnabled && typeof container.requestFullscreen === 'function') {
		if (document.fullscreenElement === container) {
		  await document.exitFullscreen();
		} else {
		  await container.requestFullscreen();
		}
		return;
	  }

	  if (container.classList.contains('where-map--fullscreen-fallback')) {
		exitFallback();
	  } else {
		enterFallback();
	  }
	}

	toggle.addEventListener('click', () => {
	  toggleFullscreen().catch(() => {
		if (container.classList.contains('where-map--fullscreen-fallback')) {
		  exitFallback();
		} else {
		  enterFallback();
		}
	  });
	});

	document.addEventListener('fullscreenchange', syncState);
	window.addEventListener('keydown', (e) => {
	  if (e.key === 'Escape' && container.classList.contains('where-map--fullscreen-fallback')) {
		exitFallback();
	  }
	});

	syncState();
  }

  function clamp(n, min, max) {
	return Math.max(min, Math.min(max, n));
  }

	// applyTimeOfDayOnCanvas больше не используется: логику времени суток применяем
	// напрямую в render() при отрисовке базовой карты.

  function getLightingForTimeOfDay(key) {
	switch (key) {
	  case 'sunrize':
		return {
		  filter: 'brightness(1.02) contrast(1.03) saturate(1.08)',
		  overlay: 'rgba(255, 196, 120, 0.10)',
		};
	  case 'day':
		return {
		  filter: 'brightness(1.25) contrast(1.03) saturate(1.06)',
		  overlay: 'rgba(255, 255, 255, 0.16)',
		};
	  case 'evening':
		return {
		  filter: 'brightness(1.00) contrast(1.06) saturate(1.1)',
		  overlay: 'rgba(255, 150, 90, 0.13)',
		};
	  case 'night':
	  default:
		return {
		  filter: 'brightness(1) contrast(1.00) saturate(1.0)',
		  overlay: 'rgba(20, 40, 150, 0.0)',
		};
	}
  }

  function createPatternSafe(ctx, img) {
	try {
	  return ctx.createPattern(img, 'repeat');
	} catch {
	  return null;
	}
  }

  function parseRevealMs(revealAt) {
	const t = Date.parse(revealAt);
	return Number.isFinite(t) ? t : Number.POSITIVE_INFINITY;
  }

  function isRevealed(item, nowMs) {
	return nowMs >= parseRevealMs(item?.revealAt);
  }

	function isPoiVisible(poi, nowMs) {
	  if (!isRevealed(poi, nowMs)) return false;
	  const hideAt = poi?.hideAt;
	  if (!hideAt) return true;
	  return nowMs < parseRevealMs(hideAt);
	}

  function setCanvasSize(canvas, viewport) {
	const dpr = window.devicePixelRatio || 1;
	const rect = viewport.getBoundingClientRect();
	const w = Math.max(1, Math.floor(rect.width * dpr));
	const h = Math.max(1, Math.floor(rect.height * dpr));

	if (canvas.width !== w || canvas.height !== h) {
	  canvas.width = w;
	  canvas.height = h;
	}

	return { width: w, height: h, dpr };
  }

  function drawMask(ctx, mask, w, h) {
	if (!mask || !mask.type) return;

	if (mask.type === 'circle') {
	  const x = (mask.x || 0) * w;
	  const y = (mask.y || 0) * h;
	  const r = (mask.r || 0) * Math.min(w, h);
	  ctx.beginPath();
	  ctx.arc(x, y, r, 0, Math.PI * 2);
	  ctx.closePath();
	  ctx.fill();
	  return;
	}

	if (mask.type === 'poly' && Array.isArray(mask.points) && mask.points.length) {
	  ctx.beginPath();
	  const [x0, y0] = mask.points[0];
	  ctx.moveTo((x0 || 0) * w, (y0 || 0) * h);
	  for (let i = 1; i < mask.points.length; i++) {
		const [x, y] = mask.points[i];
		ctx.lineTo((x || 0) * w, (y || 0) * h);
	  }
	  ctx.closePath();
	  ctx.fill();
	}
  }

  function initModal(cfg) {
	const modal = document.getElementById(cfg.modalId);
	const titleEl = document.getElementById(cfg.modalTitleId);
	const contentEl = document.getElementById(cfg.modalContentId);
	const imagesEl = document.getElementById(cfg.modalImagesId);

	if (!modal || !titleEl || !contentEl || !imagesEl) {
	  return {
		open: () => {},
		close: () => {},
	  };
	}

	let isOpen = false;

	function close() {
	  if (!isOpen) return;
	  isOpen = false;
	  modal.classList.remove('open');
	  modal.setAttribute('aria-hidden', 'true');
	  titleEl.textContent = '';
	  contentEl.textContent = '';
	  imagesEl.innerHTML = '';
	}

	function open(poi) {
	  isOpen = true;
	  modal.classList.add('open');
	  modal.setAttribute('aria-hidden', 'false');

	  titleEl.textContent = poi?.title || '';
	  contentEl.textContent = poi?.description || '';

	  const imgs = Array.isArray(poi?.images) ? poi.images : [];
	  for (const src of imgs) {
		const img = document.createElement('img');
		img.loading = 'lazy';
		img.decoding = 'async';
		img.alt = poi?.title || '';
		img.src = src;
		imagesEl.appendChild(img);
	  }
	}

	modal.addEventListener('click', (e) => {
	  const target = e.target;
	  if (target?.dataset?.close === 'true') close();
	});

	window.addEventListener('keydown', (e) => {
	  if (e.key === 'Escape' && isOpen) close();
	});

	return { open, close };
  }

  async function loadJson(url) {
	const res = await fetch(url, { cache: 'no-store' });
	if (!res.ok) throw new Error(`mapContent: failed to load ${url} (${res.status})`);
	return await res.json();
  }

  function loadImage(src) {
	return new Promise((resolve, reject) => {
	  const img = new Image();
	  img.decoding = 'async';
	  img.onload = () => resolve(img);
	  img.onerror = () => reject(new Error(`image: failed to load ${src}`));
	  img.src = src;
	});
  }

  function getMskHour() {
	try {
	  const s = new Intl.DateTimeFormat('ru-RU', {
		timeZone: 'Europe/Moscow',
		hour: '2-digit',
		hour12: false,
	  }).format(new Date());
	  const h = Number.parseInt(s, 10);
	  return Number.isFinite(h) ? h : new Date().getHours();
	} catch {
	  return new Date().getHours();
	}
  }

  function getTimeOfDayKey(mskHour) {
	const h = ((mskHour % 24) + 24) % 24;
	if (h >= 5 && h < 10) return 'sunrize';
	if (h >= 10 && h < 18) return 'day';
	if (h >= 18 && h < 20) return 'evening';
	return 'night';
  }

	const __flickerState = new Map();

  function getFlickerAlpha(nowMs, frequencyMultiplier = 1.0, id = 'default') {
	const key = `${id}:${frequencyMultiplier}`;
	let s = __flickerState.get(key);
	if (!s) {
	  s = {
		value: 0.85,
		target: 0.85,
		nextChangeMs: nowMs,
		lastMs: nowMs,
	  };
	  __flickerState.set(key, s);
	}

	// Обновляем target случайно каждые ~80-250мс (масштабируется frequencyMultiplier)
	if (nowMs >= s.nextChangeMs) {
	  const minDt = 80;
	  const maxDt = 250;
	  const span = maxDt - minDt;
	  const dt = minDt + Math.random() * span;
	  const scaledDt = Math.max(20, dt / Math.max(0.05, frequencyMultiplier));
	  s.nextChangeMs = nowMs + scaledDt;

	  // Новая цель: 0.55..1.15
	  s.target = 0.55 + Math.random() * 0.60;
	}

	// Плавно двигаемся к target с характерным временем ~120мс (тоже масштабируется)
	const dtMs = Math.max(0, nowMs - (s.lastMs || nowMs));
	s.lastMs = nowMs;
	const tauMs = Math.max(30, 120 / Math.max(0.05, frequencyMultiplier));
	const k = 1 - Math.exp(-dtMs / tauMs);
	s.value = s.value + (s.target - s.value) * k;

	// Итоговая альфа (зажимаем)
	return clamp(s.value, 0.45, 1.35);
  }


  function setBadgePositionFromConfig(badgeEl, badgeCfg) {
	if (!badgeEl || !badgeCfg) return;
	const x = badgeCfg.x;
	const y = badgeCfg.y;
	const size = badgeCfg.size;
	if (typeof x === 'number') badgeEl.style.left = `${x * 100}%`;
	if (typeof y === 'number') badgeEl.style.top = `${y * 100}%`;
	if (typeof size === 'number') badgeEl.style.width = `${size * 100}%`;
  }

  function setImgWithFallback(imgEl, primarySrc, fallbackSrc) {
	if (!imgEl) return;
	let triedFallback = false;
	imgEl.onerror = () => {
	  if (triedFallback || !fallbackSrc) return;
	  triedFallback = true;
	  imgEl.src = fallbackSrc;
	};
	imgEl.src = primarySrc;
  }

  async function initTerritoryMap(options = {}) {
	const cfg = { ...DEFAULTS, ...options };

	const viewport = document.getElementById(cfg.viewportId);
	const canvas = document.getElementById(cfg.canvasId);
	const frameEl = document.getElementById(cfg.frameImgId);
	const badgeEl = document.getElementById(cfg.badgeImgId);
	const clockEl = document.getElementById('timeOfDayClock');
	const poiDirectoryListEl = document.getElementById('poiDirectoryList');
	const questBoardListEl = document.getElementById('questBoardList');

	if (!viewport || !canvas) return;

	const modal = initModal(cfg);

	let data;
	try {
	  data = await loadJson(cfg.dataUrl);
	} catch (err) {
	  console.warn(err);
	  return;
	}

	const mapSrc = data?.map?.imageUrl;
	if (!mapSrc) return;

	const mapNightSrc = data?.map?.imageNightUrl;
	if (!mapNightSrc) return;

	const frameSrc = data?.map?.frameUrl || 'Map/Frame.png';
	if (frameEl) {
	  frameEl.loading = 'eager';
	  frameEl.decoding = 'async';
	  frameEl.src = frameSrc;
	}

	if (badgeEl) {
	  badgeEl.loading = 'eager';
	  badgeEl.decoding = 'async';
	  setBadgePositionFromConfig(badgeEl, data?.map?.badge);
	}
	if (clockEl) {
	  setBadgePositionFromConfig(clockEl, data?.map?.badge);
	}

	let mapImg;
	try {
	  mapImg = await loadImage(mapSrc);
	} catch (err) {
	  console.warn(err);
	  return;
	}
	let mapNightImg;
	try {
	  mapNightImg = await loadImage(mapNightSrc);
	} catch (err) {
	  console.warn(err);
	  return;
	}

	const fogCfg = data?.map?.fog || {};
	const fogTextureUrl = fogCfg.textureUrl || 'Map/fog_noise.png';
	let fogImg = null;
	try {
	  fogImg = await loadImage(fogTextureUrl);
	} catch (err) {
	  console.warn(err);
	  fogImg = null;
	}

	const ctx = canvas.getContext('2d', { alpha: true });
	if (!ctx) return;

	const areasFog = Array.isArray(data?.areas) ? data.areas : [];
	const questStages = Array.isArray(data?.quests) ? data.quests : [];
	const pois = Array.isArray(data?.pois) ? data.pois : [];
	const lightSources = Array.isArray(data?.lightSources) ? data.lightSources : [];
	const bonfires = lightSources.filter((ls) => ls.type === 'bonfire');
	const buildings = lightSources.filter((ls) => ls.type === 'building');
	window.__mapDebug = {
	  getState: () => ({
		areas: areasFog.length,
		fogImgLoaded: !!fogImg,
		fogTextureUrl,
		fogCfg,
	  }),
	};

	function pointInPoly(nx, ny, points) {
	  // ray casting algorithm; nx/ny and points are normalized (0..1)
	  let inside = false;
	  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
		const xi = points[i][0];
		const yi = points[i][1];
		const xj = points[j][0];
		const yj = points[j][1];
		const intersect = yi > ny !== yj > ny && nx < ((xj - xi) * (ny - yi)) / ((yj - yi) || 1e-12) + xi;
		if (intersect) inside = !inside;
	  }
	  return inside;
	}

	function getActiveFogArea(nowMs) {
	  let activeArea = null;
	  let activeRevealMs = Number.POSITIVE_INFINITY;

	  for (const area of areasFog) {
		const revealMs = parseRevealMs(area?.revealAt);
		if (nowMs >= revealMs) continue;
		if (revealMs < activeRevealMs) {
		  activeArea = area;
		  activeRevealMs = revealMs;
		}
	  }

	  return activeArea;
	}

	function isPoiFogged(poi, nowMs) {
	  const nx = clamp(poi?.x ?? 0, 0, 1);
	  const ny = clamp(poi?.y ?? 0, 0, 1);
	  const area = getActiveFogArea(nowMs);
	  const mask = area?.mask;
	  if (!mask) return false;
	  if (mask.type === 'circle') {
		const cx = mask.x || 0;
		const cy = mask.y || 0;
		const r = mask.r || 0;
		const dx = nx - cx;
		const dy = ny - cy;
		if (dx * dx + dy * dy <= r * r) return true;
	  }
	  if (mask.type === 'poly' && Array.isArray(mask.points) && mask.points.length >= 3) {
		if (pointInPoly(nx, ny, mask.points)) return true;
	  }
	  return false;
	}

	const tooltip = document.createElement('div');
	tooltip.className = 'map-tooltip';
	tooltip.style.display = 'none';
	viewport.appendChild(tooltip);

	function hideTooltip() {
	  tooltip.style.display = 'none';
	  tooltip.textContent = '';
	}

	function showTooltip(text, clientX, clientY) {
	  if (!text) return;
	  const rect = viewport.getBoundingClientRect();
	  const x = clientX - rect.left;
	  const y = clientY - rect.top;

	  tooltip.textContent = text;
	  tooltip.style.left = `${x}px`;
	  tooltip.style.top = `${y}px`;
	  tooltip.style.display = 'block';
	}

	const contentPadding = data?.map?.contentPadding || { x: 0, y: 0 };
	const padXRatio = typeof contentPadding.x === 'number' ? contentPadding.x : 0;
	const padYRatio = typeof contentPadding.y === 'number' ? contentPadding.y : 0;

	function renderPoiDirectory(items) {
	  if (!poiDirectoryListEl) return;
	  poiDirectoryListEl.innerHTML = '';

	  for (const poi of items) {
		const button = document.createElement('button');
		button.type = 'button';
		button.className = 'poi-directory__item';
		button.setAttribute('aria-label', `Открыть описание места ${poi?.title || ''}`);

		const title = document.createElement('span');
		title.className = 'poi-directory__item-title';
		title.textContent = poi?.title || 'Без названия';

		const short = document.createElement('span');
		short.className = 'poi-directory__item-short';
		short.textContent = poi?.short || poi?.description || '';

		button.append(title, short);
		button.addEventListener('click', () => modal.open(poi));
		poiDirectoryListEl.appendChild(button);
	  }
	}

	function getCurrentQuestItems(nowMs) {
	  let activeStage = null;
	  for (const stage of questStages) {
		if (!isRevealed(stage, nowMs)) continue;
		if (!activeStage || parseRevealMs(stage?.revealAt) > parseRevealMs(activeStage?.revealAt)) {
		  activeStage = stage;
		}
	  }
	  const items = Array.isArray(activeStage?.items) ? activeStage.items : [];
	  return items.slice(0, 4);
	}

	function renderQuestBoard(items) {
	  if (!questBoardListEl) return;
	  questBoardListEl.innerHTML = '';

	  for (const item of items) {
		const article = document.createElement('article');
		article.className = 'quest-board__item';

		const title = document.createElement('h4');
		title.className = 'quest-board__item-title';
		title.textContent = item?.title || 'Без задания';

		const description = document.createElement('p');
		description.className = 'quest-board__item-description';
		description.textContent = item?.description || '';

		article.append(title, description);
		questBoardListEl.appendChild(article);
	  }
	}

	function getVisiblePois(nowMs) {
	  return pois.filter((poi) => isPoiVisible(poi, nowMs) && !isPoiFogged(poi, nowMs));
	}

	renderQuestBoard(getCurrentQuestItems(Date.now()));
	renderPoiDirectory(getVisiblePois(Date.now()));

	function getMskTimeHHMM() {
	  try {
		return new Intl.DateTimeFormat('ru-RU', {
		  timeZone: 'Europe/Moscow',
		  hour: '2-digit',
		  minute: '2-digit',
		  hour12: false,
		}).format(new Date());
	  } catch {
		const d = new Date();
		const hh = String(d.getHours()).padStart(2, '0');
		const mm = String(d.getMinutes()).padStart(2, '0');
		return `${hh}:${mm}`;
	  }
	}

	function updateTimeBadge() {
	  if (!badgeEl) return;
	  const mskHour = getMskHour();
	  const key = getTimeOfDayKey(mskHour);
	  const badgeSourcesByKey = {
		day: { primary: 'Map/day.jpg', fallback: null },
		sunrize: { primary: 'Map/sunrize.jpg', fallback: null },
		evening: { primary: 'Map/evening.jpg', fallback: null },
		night: { primary: 'Map/Night.jpg', fallback: 'Map/map_night.png' },
	  };
	  const badgeSources = badgeSourcesByKey[key] || { primary: `Map/${key}.jpg`, fallback: `Map/${key}.png` };
	  setImgWithFallback(badgeEl, badgeSources.primary, badgeSources.fallback);
	  if (clockEl) clockEl.textContent = getMskTimeHHMM();
	}

	updateTimeBadge();
	setInterval(updateTimeBadge, 60_000);

	function renderPois(nowMs, x0, y0, w, h) {
	  const r = Math.max(10, Math.min(w, h) * 0.012);

	  for (const poi of pois) {
		if (!isPoiVisible(poi, nowMs)) continue;
		if (isPoiFogged(poi, nowMs)) continue;

		const x = x0 + clamp(poi?.x ?? 0, 0, 1) * w;
		const y = y0 + clamp(poi?.y ?? 0, 0, 1) * h;
		const headRadius = r * 1.15;
		const innerRadius = headRadius * 0.48;
		const tailHeight = headRadius * 1.95;
		const baseY = y + headRadius * 0.38;
		const tipY = baseY + tailHeight;

		ctx.save();
		const glow = ctx.createRadialGradient(x, y, headRadius * 0.2, x, y + headRadius * 0.2, headRadius * 2.4);
		glow.addColorStop(0, 'rgba(255, 226, 160, 0.42)');
		glow.addColorStop(0.55, 'rgba(200, 164, 93, 0.20)');
		glow.addColorStop(1, 'rgba(200, 164, 93, 0)');
		ctx.fillStyle = glow;
		ctx.beginPath();
		ctx.arc(x, y + headRadius * 0.24, headRadius * 2.1, 0, Math.PI * 2);
		ctx.closePath();
		ctx.fill();

		ctx.beginPath();
		ctx.arc(x, y, headRadius, Math.PI, 0, false);
		ctx.quadraticCurveTo(x + headRadius * 0.98, baseY + headRadius * 0.34, x, tipY);
		ctx.quadraticCurveTo(x - headRadius * 0.98, baseY + headRadius * 0.34, x - headRadius, baseY);
		ctx.closePath();
		const grad = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, 1, x, y, r);
		grad.addColorStop(0, 'rgba(255, 244, 220, 0.88)');
		grad.addColorStop(0.38, 'rgba(236, 196, 110, 0.86)');
		grad.addColorStop(1, 'rgba(120, 41, 28, 0.88)');
		ctx.fillStyle = grad;
		ctx.fill();
		ctx.strokeStyle = 'rgba(53, 20, 12, 0.55)';
		ctx.lineWidth = Math.max(1.5, r * 0.16);
		ctx.stroke();

		ctx.beginPath();
		ctx.arc(x, y, innerRadius, 0, Math.PI * 2);
		ctx.fillStyle = 'rgba(255, 248, 236, 0.86)';
		ctx.fill();
		ctx.strokeStyle = 'rgba(120, 41, 28, 0.28)';
		ctx.lineWidth = Math.max(1, r * 0.08);
		ctx.stroke();
		ctx.restore();
	  }
	}

	function renderLightBonfires(nowMs, x0, y0, w, h, timeOfDay) {
	  if (bonfires.length === 0) return;

	  if (timeOfDay !== 'evening' && timeOfDay !== 'night') return;

	  // Ночной режим требует более яркого свечения, чтобы пробиться через фильтр
	  const isNight = timeOfDay === 'night';
	  const brightnessBoost = isNight ? 1.5 : 1.0;

	  for (const bonfire of bonfires) {
		const px = x0 + clamp(bonfire?.x ?? 0, 0, 1) * w;
		const py = y0 + clamp(bonfire?.y ?? 0, 0, 1) * h;
		const radius = clamp(bonfire?.radius ?? 0.025, 0.01, 0.1) * Math.min(w, h);
		const flickerAlpha = getFlickerAlpha(nowMs, bonfire?.frequencyMultiplier ?? 1.0, bonfire?.name || bonfire?.id || 'bonfire');

		// Создаём временный canvas для применения фильтра контраста
		const tempCanvas = document.createElement('canvas');
		const tempCtx = tempCanvas.getContext('2d');
		if (!tempCtx) continue;

		const outerRadius = radius * 2.0;
		const areaSize = Math.ceil(outerRadius * 2.5);
		const startX = Math.max(0, Math.floor(px - areaSize / 2));
		const startY = Math.max(0, Math.floor(py - areaSize / 2));
		const endX = Math.min(w, Math.ceil(px + areaSize / 2));
		const endY = Math.min(h, Math.ceil(py + areaSize / 2));
		const areaW = endX - startX;
		const areaH = endY - startY;

		if (areaW <= 0 || areaH <= 0) continue;

		tempCanvas.width = areaW;
		tempCanvas.height = areaH;

		// Копируем область из основного canvas во временный
		const imageData = ctx.getImageData(startX, startY, areaW, areaH);
		tempCtx.putImageData(imageData, 0, 0);

		// Применяем фильтр контраста к временному canvas
		// В ночном режиме увеличиваем контраст и яркость больше
		const contrastAmount = 1.0 + flickerAlpha * (isNight ? 1.2 : 0.8);
		const brightnessAmount = 1.1 + (isNight ? 0.3 : 0);
		tempCtx.filter = `contrast(${contrastAmount}) brightness(${brightnessAmount})`;
		tempCtx.drawImage(tempCanvas, 0, 0);
		tempCtx.filter = 'none';

		// Создаём маску с радиальным градиентом
		const localPx = px - startX;
		const localPy = py - startY;
		const maskGrad = tempCtx.createRadialGradient(localPx, localPy, 0, localPx, localPy, outerRadius);
		maskGrad.addColorStop(0, `rgba(255, 255, 255, ${Math.min(1, flickerAlpha * 1.5)})`);
		maskGrad.addColorStop(0.3, `rgba(255, 255, 255, ${flickerAlpha * 1.0})`);
		maskGrad.addColorStop(0.6, `rgba(255, 255, 255, ${flickerAlpha * 0.5})`);
		maskGrad.addColorStop(1, `rgba(255, 255, 255, 0)`);

		tempCtx.save();
		tempCtx.globalCompositeOperation = 'destination-in';
		tempCtx.fillStyle = maskGrad;
		tempCtx.beginPath();
		tempCtx.arc(localPx, localPy, outerRadius, 0, Math.PI * 2);
		tempCtx.fill();
		tempCtx.restore();

		// Копируем результат обратно на основной canvas с режимом смешивания
		ctx.save();
		ctx.globalCompositeOperation = 'lighten';
		ctx.drawImage(tempCanvas, startX, startY);
		ctx.restore();

		// Добавляем интенсивное свечение сверху - усиленное для ночи
		ctx.save();
		ctx.globalCompositeOperation = 'screen';
		const grad = ctx.createRadialGradient(px, py, 0, px, py, outerRadius);

		// Более яркие цвета для ночного режима
		const centerBrightness = Math.min(1, flickerAlpha * brightnessBoost);
		const midBrightness = Math.min(1, flickerAlpha * 0.7 * brightnessBoost);
		const edgeBrightness = Math.min(1, flickerAlpha * 0.3 * brightnessBoost);

		grad.addColorStop(0, `rgba(255, 230, 180, ${centerBrightness})`);
		grad.addColorStop(0.3, `rgba(255, 210, 120, ${midBrightness})`);
		grad.addColorStop(0.6, `rgba(255, 160, 80, ${edgeBrightness})`);
		grad.addColorStop(1, `rgba(255, 100, 20, 0)`);

		ctx.fillStyle = grad;
		ctx.beginPath();
		ctx.arc(px, py, outerRadius, 0, Math.PI * 2);
		ctx.fill();
		ctx.restore();
	  }
	}


	function renderLightBuildings(nowMs, x0, y0, w, h, timeOfDay) {
	  if (buildings.length === 0) return;

	  if (timeOfDay !== 'evening' && timeOfDay !== 'night') return;

	  for (const building of buildings) {
		if (!Array.isArray(building?.points) || building.points.length < 3) continue;

		const flickerAlpha = getFlickerAlpha(nowMs, building?.frequencyMultiplier ?? 1.0, building?.name || building?.id || 'building');
		const featherSteps = Math.max(15, Math.min(50, building?.featherSteps ?? 25));

		const centerX = (building.points.reduce((sum, p) => sum + (p[0] || 0), 0) / building.points.length) * w + x0;
		const centerY = (building.points.reduce((sum, p) => sum + (p[1] || 0), 0) / building.points.length) * h + y0;

		for (let step = featherSteps + 1; step >= 0; step--) {
		  ctx.save();

		  // Используем "screen" режим для увеличения яркости, как у костра
		  ctx.globalCompositeOperation = 'screen';

		  const expandRatio = step / (featherSteps + 1);

		  ctx.beginPath();
		  const firstPoint = building.points[0];
		  let firstX = centerX + ((x0 + (firstPoint[0] || 0) * w) - centerX) * (1 + expandRatio * 0.3);
		  let firstY = centerY + ((y0 + (firstPoint[1] || 0) * h) - centerY) * (1 + expandRatio * 0.3);
		  ctx.moveTo(firstX, firstY);

		  for (let i = 1; i < building.points.length; i++) {
			const p = building.points[i];
			const px = centerX + ((x0 + (p[0] || 0) * w) - centerX) * (1 + expandRatio * 0.3);
			const py = centerY + ((y0 + (p[1] || 0) * h) - centerY) * (1 + expandRatio * 0.3);
			ctx.lineTo(px, py);
		  }
		  ctx.closePath();

		  // Жёлтый свет с постепенным затуханием к краям
		  const stepAlpha = flickerAlpha * (step / Math.max(1, featherSteps + 1));
		  // В центре светлее (более белый оттенок), к краям темнеет
		  const centerOpacity = Math.min(1, stepAlpha * 1.2);
		  ctx.fillStyle = `rgba(255, 240, 180, ${centerOpacity})`;
		  ctx.fill();

		  ctx.restore();
		}
	  }
	}

	function renderFog(nowMs, x0, y0, w, h) {
	  const alpha = typeof fogCfg.alpha === 'number' ? clamp(fogCfg.alpha, 0, 1) : 0.6;
	  const speed = typeof fogCfg.speed === 'number' ? fogCfg.speed : 6;
	  const t = (nowMs / 1000) * speed;
	  const tileSize = typeof fogCfg.tileSize === 'number' ? clamp(fogCfg.tileSize, 0.05, 0.6) : 0.18;
	  const edgeFeather = typeof fogCfg.edgeFeather === 'number' ? clamp(fogCfg.edgeFeather, 0, 1) : 0.035;
	  const cornerRadius = typeof fogCfg.cornerRadius === 'number' ? fogCfg.cornerRadius : 0.05;

	  if (!fogImg) return;

	  // Функция для рисования скруглённого полигона
	  function drawRoundedPoly(ctx, points, x0, y0, w, h, radius, centerX, centerY, shrinkRatio) {
		const scaledPoints = points.map(([px, py]) => {
		  const sx = centerX + (x0 + (px || 0) * w - centerX) * shrinkRatio;
		  const sy = centerY + (y0 + (py || 0) * h - centerY) * shrinkRatio;
		  return [sx, sy];
		});

		if (scaledPoints.length < 2) return;

		const radiusPixels = radius * Math.min(w, h);

		ctx.beginPath();

		for (let i = 0; i < scaledPoints.length; i++) {
		  const prev = scaledPoints[(i - 1 + scaledPoints.length) % scaledPoints.length];
		  const curr = scaledPoints[i];
		  const next = scaledPoints[(i + 1) % scaledPoints.length];

		  const [px, py] = prev;
		  const [cx, cy] = curr;
		  const [nx, ny] = next;

		  // Вектор от предыдущей к текущей точке
		  const dx1 = cx - px;
		  const dy1 = cy - py;
		  const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);

		  // Вектор от текущей к следующей точке
		  const dx2 = nx - cx;
		  const dy2 = ny - cy;
		  const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

		  if (len1 === 0 || len2 === 0) continue;

		  // Нормализованные направления
		  const dir1x = dx1 / len1;
		  const dir1y = dy1 / len1;
		  const dir2x = dx2 / len2;
		  const dir2y = dy2 / len2;

		  // Начальная точка скругления на предыдущем ребре
		  const startX = cx - dir1x * radiusPixels;
		  const startY = cy - dir1y * radiusPixels;

		  // Конечная точка скругления на следующем ребре
		  const endX = cx + dir2x * radiusPixels;
		  const endY = cy + dir2y * radiusPixels;

		  if (i === 0) {
			ctx.moveTo(startX, startY);
		  }

		  // Скруглённый угол используя quadraticCurveTo
		  ctx.quadraticCurveTo(cx, cy, endX, endY);
		}

		ctx.closePath();
	  }

	  const area = getActiveFogArea(nowMs);
	  if (!area) return;
	  if (area.mask?.type !== 'poly' || !Array.isArray(area.mask.points) || !area.mask.points.length) return;

	  const featherSteps = edgeFeather > 0 ? Math.max(30, Math.ceil(edgeFeather * 10)) : 0;
	  const centerX = (area.mask.points.reduce((sum, p) => sum + (p[0] || 0), 0) / area.mask.points.length) * w + x0;
	  const centerY = (area.mask.points.reduce((sum, p) => sum + (p[1] || 0), 0) / area.mask.points.length) * h + y0;

	  // Рисуем туман несколько раз с уменьшающейся альфой для эффекта размытия
	  for (let step = featherSteps + 1; step >= 0; step--) {
		ctx.save();
		ctx.globalCompositeOperation = 'source-over';

		// Рассчитываем масштаб усадки полигона для размытия
		const shrinkRatio = featherSteps > 0 ? step / (featherSteps + 1) : 1;

		// Создаём маску со скруглёнными углами
		drawRoundedPoly(ctx, area.mask.points, x0, y0, w, h, cornerRadius, centerX, centerY, shrinkRatio);
		ctx.clip();

		// Заполняем область текстурой.
		// Рисуем в screen-space без ctx.scale: задаём размер тайла напрямую в drawImage.
		if (fogImg) {
		  // Альфа линейно уменьшается от полной к полной прозрачности на границе
		  const stepAlpha = alpha * (step / Math.max(1, featherSteps + 1));
		  ctx.globalAlpha = stepAlpha;

		  // Размер тайла в пикселях (в space канвы)
		  const tileW = Math.max(1, Math.floor(w * tileSize));
		  const imgW = Math.max(1, fogImg.width);
		  const imgH = Math.max(1, fogImg.height);
		  // Сохраняем соотношение сторон текстуры
		  const tileH = Math.max(1, Math.floor(tileW * (imgH / imgW)));

		  for (let yy = -h * 2; yy < h * 3; yy += tileH) {
			for (let xx = -w * 2; xx < w * 3; xx += tileW) {
			  ctx.drawImage(fogImg, xx, yy, tileW, tileH);
			}
		  }
		}

		ctx.restore();
	  }
	}

	function render(nowMs) {
	  const { width: w, height: h } = setCanvasSize(canvas, viewport);

	  ctx.clearRect(0, 0, w, h);

	  const padX = Math.floor(w * clamp(padXRatio, 0, 0.2));
	  const padY = Math.floor(h * clamp(padYRatio, 0, 0.2));
	  const innerW = Math.max(1, w - padX * 2);
	  const innerH = Math.max(1, h - padY * 2);

	  // 1. Базовая карта с фильтром времени суток 
	  const mskHour = getMskHour();
	  const key = getTimeOfDayKey(mskHour);
	  const lighting = getLightingForTimeOfDay(key);
	  ctx.save();
	  ctx.filter = lighting?.filter || 'none';
	  if(key== 'night') ctx.drawImage(mapNightImg, padX, padY, innerW, innerH);
	  if(key== 'day') ctx.drawImage(mapImg, padX, padY, innerW, innerH);
	  if(key== 'evening') ctx.drawImage(mapImg, padX, padY, innerW, innerH);
	  if(key== 'sunrize') ctx.drawImage(mapImg, padX, padY, innerW, innerH);
	  ctx.filter = 'none';
	  ctx.restore();

	  // 2. Оверлей времени суток
	  if (lighting?.overlay) {
		ctx.save();
		ctx.globalCompositeOperation = 'multiply';
		ctx.fillStyle = lighting.overlay;
		ctx.fillRect(padX, padY, innerW, innerH);
		ctx.restore();
	  }
	  // 3. Маркеры POI (сверху)
	  renderPois(nowMs, padX, padY, innerW, innerH);
	  renderLightBuildings(nowMs, padX, padY, innerW, innerH, key);
	  renderLightBonfires(nowMs, padX, padY, innerW, innerH, key);

	  // 4. Туман (скрытие локаций)
	  renderFog(nowMs, padX, padY, innerW, innerH);
	  renderQuestBoard(getCurrentQuestItems(nowMs));
	  renderPoiDirectory(getVisiblePois(nowMs));
	  
	}

	function canvasPointFromEvent(e) {
	  const rect = canvas.getBoundingClientRect();
	  const dpr = window.devicePixelRatio || 1;
	  const x = (e.clientX - rect.left) * dpr;
	  const y = (e.clientY - rect.top) * dpr;
	  return { x, y };
	}

	function findPoiHit(nowMs, px, py, x0, y0, w, h) {
	  const r = Math.max(14, Math.min(w, h) * 0.018);
	  let best = null;
	  let bestD2 = Infinity;

	  for (const poi of pois) {
		if (!isPoiVisible(poi, nowMs)) continue;
		if (isPoiFogged(poi, nowMs)) continue;

		const x = x0 + clamp(poi?.x ?? 0, 0, 1) * w;
		const y = y0 + clamp(poi?.y ?? 0, 0, 1) * h;
		const dx = px - x;
		const dy = py - y;
		const d2 = dx * dx + dy * dy;
		if (d2 <= r * r && d2 < bestD2) {
		  bestD2 = d2;
		  best = poi;
		}
	  }

	  return best;
	}

	canvas.addEventListener('click', (e) => {
	  const nowMs = Date.now();
		const { width: w, height: h } = setCanvasSize(canvas, viewport);
	  const padX = Math.floor(w * clamp(padXRatio, 0, 0.2));
	  const padY = Math.floor(h * clamp(padYRatio, 0, 0.2));
	  const innerW = Math.max(1, w - padX * 2);
	  const innerH = Math.max(1, h - padY * 2);
	  const p = canvasPointFromEvent(e);
		const hit = findPoiHit(nowMs, p.x, p.y, padX, padY, innerW, innerH);
	  if (hit) modal.open(hit);
	});

	let hoverFramePending = false;
	let lastHoverEvent = null;

	function handleCanvasHover(e) {
	  const nowMs = Date.now();
	  const { width: w, height: h } = setCanvasSize(canvas, viewport);
	  const padX = Math.floor(w * clamp(padXRatio, 0, 0.2));
	  const padY = Math.floor(h * clamp(padYRatio, 0, 0.2));
	  const innerW = Math.max(1, w - padX * 2);
	  const innerH = Math.max(1, h - padY * 2);
	  const p = canvasPointFromEvent(e);
	  const hit = findPoiHit(nowMs, p.x, p.y, padX, padY, innerW, innerH);
	  if (!hit) {
		hideTooltip();
		canvas.style.cursor = 'default';
		return;
	  }

	  canvas.style.cursor = 'pointer';
	  showTooltip(hit.title || '', e.clientX, e.clientY);
	}

	canvas.addEventListener('mousemove', (e) => {
	  lastHoverEvent = e;
	  if (hoverFramePending) return;
	  hoverFramePending = true;
	  requestAnimationFrame(() => {
		hoverFramePending = false;
		if (lastHoverEvent) handleCanvasHover(lastHoverEvent);
	  });
	});

	canvas.addEventListener('mouseleave', () => {
	  hideTooltip();
	  canvas.style.cursor = 'default';
	});

	let resizeTimer;
	function onResize() {
	  clearTimeout(resizeTimer);
	  resizeTimer = setTimeout(() => render(Date.now()), 80);
	}

	window.addEventListener('resize', onResize);

	render(Date.now());
	setInterval(() => render(Date.now()), 15_000);
  }

  window.initTerritoryMap = initTerritoryMap;
  initVenueMapFullscreen();

  if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', () => initTerritoryMap());
  } else {
	initTerritoryMap();
  }
})();
