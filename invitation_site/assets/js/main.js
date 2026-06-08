const weddingDate = new Date('2026-07-23T15:00:00');
const ids = ['days', 'hours', 'minutes', 'seconds'];
const timerRoot = document.getElementById('timer');
const timerNodes = ids.reduce((acc, id) => {
  const node = document.getElementById(id);
  if (node) acc[id] = node;
  return acc;
}, {});
const companionsList = document.getElementById('guestCompanionsList');
const addCompanionBtn = document.getElementById('addCompanionBtn');

function pad2(n) {
  const x = Number(n) || 0;
  return x < 10 ? `0${x}` : `${x}`;
}

function updateTimer() {
  const diff = weddingDate - new Date();
  if (diff <= 0) {
	ids.forEach((id) => {
	  if (timerNodes[id]) timerNodes[id].textContent = '0';
	});
	timerRoot?.setAttribute?.('data-label', 'До свадьбы');
	timerRoot?.setAttribute?.('data-compact', '00:00:00:00');
	return;
  }
  const seconds = Math.floor(diff / 1000) % 60;
  const minutes = Math.floor(diff / (1000 * 60)) % 60;
  const hours = Math.floor(diff / (1000 * 60 * 60)) % 24;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
	if (timerNodes.days) timerNodes.days.textContent = days;
  if (timerNodes.hours) timerNodes.hours.textContent = hours;
  if (timerNodes.minutes) timerNodes.minutes.textContent = minutes;
  if (timerNodes.seconds) timerNodes.seconds.textContent = seconds;

  // compact view for mobile: DD:HH:MM:SS
  if (timerRoot) {
	const dd = pad2(days % 100);
	const hh = pad2(hours);
	const mm = pad2(minutes);
	const ss = pad2(seconds);
	timerRoot.setAttribute('data-label', 'До свадьбы');
	timerRoot.setAttribute('data-compact', `${dd}:${hh}:${mm}:${ss}`);
  }
}

updateTimer();
setInterval(updateTimer, 1000);

const rsvpForm = document.getElementById('rsvpForm');
const rsvpToast = document.getElementById('rsvpToast');
const rsvpCodeWord = document.getElementById('rsvpCodeWord');
const guestbookSubmitUrl = window.siteConfig?.guestbookSubmitUrl?.trim() || '';

function showToast(message, isError = false) {
  if (!rsvpToast) return;
  rsvpToast.textContent = message;
  rsvpToast.classList.toggle('error', isError);
  rsvpToast.style.display = 'block';
}

function setRsvpSubmitting(isSubmitting) {
  if (!rsvpForm) return;
  const submitButton = rsvpForm.querySelector('button[type="submit"]');
  if (!submitButton) return;

  submitButton.disabled = isSubmitting;
  submitButton.setAttribute('aria-busy', isSubmitting ? 'true' : 'false');
}

async function submitGuestScroll(payload) {
  if (!guestbookSubmitUrl) {
	throw new Error('Не настроен адрес отправки гостевого свитка.');
  }

	for (const row of payload) {
	const body = new URLSearchParams();

	Object.entries(row).forEach(([key, value]) => {
	  body.append(key, value ?? '');
	});

	const response = await fetch(guestbookSubmitUrl, {
	  method: 'POST',
	  mode: 'no-cors',
	  body
	});
	  }
}

function buildGuestRows(formData) {
  const submittedAt = new Date().toISOString();
  const companions = formData
	.getAll('companions')
	.map((value) => value.trim())
	.filter(Boolean);

  const primaryGuest = {
	name: (formData.get('name') || '').toString().trim(),
	contact: (formData.get('contact') || '').toString().trim(),
	attendance: (formData.get('attendance') || '').toString().trim(),
	allergies: (formData.get('allergies') || '').toString().trim(),
	comment: (formData.get('comment') || '').toString().trim(),
	submittedAt,
	guestType: 'primary'
  };

  const companionGuests = companions.map((name) => ({
	name,
	guestType: 'companion',
	submittedAt
  }));

  return [primaryGuest, ...companionGuests];
}

function createCompanionField(value = '') {
  if (!companionsList) return;

  const item = document.createElement('div');
  item.className = 'guest-companions__item';

  const input = document.createElement('input');
  input.name = 'companions';
  input.autocomplete = 'name';
  input.placeholder = 'ФИО гостя';
  input.value = value;

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'guest-companions__remove';
  removeBtn.textContent = 'Удалить';
  removeBtn.addEventListener('click', () => item.remove());

  item.append(input, removeBtn);
  companionsList.appendChild(item);
}

addCompanionBtn?.addEventListener('click', () => createCompanionField());

rsvpForm?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const name = (rsvpForm.querySelector('[name="name"]')?.value || '').trim();
  const attendance = (rsvpForm.querySelector('[name="attendance"]')?.value || '').trim();

  if (!name) {
	showToast('Пожалуйста, укажите имя и фамилию.', true);
	return;
  }

  if (!attendance) {
	showToast('Пожалуйста, выберите вариант присутствия.', true);
	return;
  }

  const fd = new FormData(rsvpForm);
	const payload = buildGuestRows(fd);

  setRsvpSubmitting(true);

  try {
	await submitGuestScroll(payload);

	const list = JSON.parse(localStorage.getItem('rsvpResponses') || '[]');
	list.push(payload);
	localStorage.setItem('rsvpResponses', JSON.stringify(list));
	rsvpForm.reset();
	companionsList && (companionsList.innerHTML = '');
	if (rsvpCodeWord) rsvpCodeWord.style.display = 'block';
	showToast('Спасибо! Свиток отправлен. Если адрес настроен верно, запись появится в таблице.');
  } catch (error) {
	showToast(error instanceof Error ? error.message : 'Не удалось отправить свиток.', true);
  } finally {
	setRsvpSubmitting(false);
  }
});

const exportBtn = document.getElementById('rsvpExport');
exportBtn?.addEventListener('click', async () => {
  try {
	const json = localStorage.getItem('rsvpResponses') || '[]';
	await navigator.clipboard.writeText(json);
	showToast('Ответы скопированы в буфер обмена (JSON).');
  } catch {
	showToast('Не удалось скопировать ответы. Откройте консоль и скопируйте localStorage.rsvpResponses', true);
  }
});

const bird = document.getElementById('bird');
const birdTrail = document.getElementById('birdTrail');
const sideTrail = document.getElementById('sideTrail');
const sideTrailPath = document.getElementById('sideTrailPath');

const navLinks = Array.from(document.querySelectorAll('.navlinks a'));
let navToggle = document.getElementById('navToggle');
let navDrawer = document.getElementById('navDrawer');
let navDrawerLinks = document.getElementById('navDrawerLinks');

function setDrawerOpen(open) {
  if (!navDrawer || !navToggle) return;
	if (!open) {
	// ensure focus is not trapped inside an element that becomes aria-hidden
	const focused = document.activeElement;
	if (focused && navDrawer.contains(focused) && typeof focused.blur === 'function') focused.blur();
	navToggle.focus();
  }
  navDrawer.classList.toggle('open', open);
  navDrawer.setAttribute('aria-hidden', open ? 'false' : 'true');
  navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  navToggle.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
  document.body.classList.toggle('nav-open', open);
}

function initBurgerMenu() {
	if (initBurgerMenu._inited) return;

  navToggle = document.getElementById('navToggle');
  navDrawer = document.getElementById('navDrawer');
  navDrawerLinks = document.getElementById('navDrawerLinks');

  if (!navDrawer || !navToggle || !navDrawerLinks) return;
  if (!navLinks.length) return;

  navDrawerLinks.innerHTML = '';
  for (const a of navLinks) {
	const clone = a.cloneNode(true);
	clone.addEventListener('click', () => setDrawerOpen(false));
	navDrawerLinks.appendChild(clone);
  }

  navToggle.addEventListener('click', () => {
	const isOpen = navDrawer.classList.contains('open');
	setDrawerOpen(!isOpen);
  });

  navDrawer.addEventListener('click', (e) => {
	const t = e.target;
	if (t?.dataset?.close === 'true') setDrawerOpen(false);
  });

  window.addEventListener('keydown', (e) => {
	if (e.key === 'Escape' && navDrawer.classList.contains('open')) setDrawerOpen(false);
  });

  initBurgerMenu._inited = true;
}

function setActiveNav(hash) {
  if (!navLinks.length) return;
  navLinks.forEach((a) => a.classList.toggle('active', a.getAttribute('href') === hash));
  const drawerAnchors = Array.from(document.querySelectorAll('#navDrawerLinks a'));
  drawerAnchors.forEach((a) => a.classList.toggle('active', a.getAttribute('href') === hash));
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initBurgerMenu);
} else {
  initBurgerMenu();
}

if (navLinks.length) {
  const sections = navLinks
	.map((a) => document.querySelector(a.getAttribute('href')))
	.filter(Boolean);

  const io = new IntersectionObserver(
	(entries) => {
	  const visible = entries
		.filter((e) => e.isIntersecting)
		.sort((a, b) => (b.intersectionRatio || 0) - (a.intersectionRatio || 0))[0];
	  if (visible?.target?.id) setActiveNav(`#${visible.target.id}`);
	},
	{ root: null, threshold: [0.25, 0.4, 0.6] },
  );

  sections.forEach((s) => io.observe(s));
}

let lastScrollY = window.scrollY;
let scrollStopTimer;
let birdFramePending = false;

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function updateBird() {
  if (!bird || !sideTrail || !sideTrailPath) return;

  const doc = document.documentElement;
  const scrollTop = window.scrollY || doc.scrollTop || 0;
  const maxScroll = Math.max(1, doc.scrollHeight - window.innerHeight);
  const progress = clamp(scrollTop / maxScroll, 0, 1);

  const len = sideTrailPath.getTotalLength();
  const eased = 0.02 + progress * 0.96;
  const p = sideTrailPath.getPointAtLength(eased * len);
  const p2 = sideTrailPath.getPointAtLength(clamp(eased + 0.002, 0, 1) * len);

  const rect = sideTrail.getBoundingClientRect();
  const x = rect.left + (p.x / 220) * rect.width;
  const y = rect.top + (p.y / 1000) * rect.height;

  const dx = p2.x - p.x;
  const dir = dx >= 0 ? 1 : -1;

  const cx = clamp(x, 0, window.innerWidth);
  const cy = clamp(y, 0, window.innerHeight);

  bird.style.left = `${cx}px`;
  bird.style.top = `${cy}px`;
  bird.style.transform = `translate(-50%, -50%) scaleX(${dir})`;
}

function setBirdMoving(isMoving) {
  bird?.classList.toggle('paused', !isMoving);
}

const reduceMotion =
  window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (!reduceMotion) {
  setBirdMoving(false);
  updateBird();

  window.addEventListener(
	'scroll',
	() => {
	  const y = window.scrollY;
	  const isMoving = Math.abs(y - lastScrollY) > 0;
	  lastScrollY = y;

	  if (isMoving) {
		setBirdMoving(true);
		clearTimeout(scrollStopTimer);
		scrollStopTimer = setTimeout(() => setBirdMoving(false), 120);
	  }

	  if (!birdFramePending) {
		birdFramePending = true;
		requestAnimationFrame(() => {
		  birdFramePending = false;
		  updateBird();
		});
	  }
	},
	{ passive: true },
  );

  window.addEventListener('resize', () => requestAnimationFrame(updateBird));
}

function initCarousel(rootId) {
  const root = document.getElementById(rootId);
  if (!root) return;

  const slides = Array.from(root.querySelectorAll('.carousel-slide'));
  const prev = root.querySelector('.carousel-btn.prev');
  const next = root.querySelector('.carousel-btn.next');
  if (!slides.length || !prev || !next) return;

  let index = Math.max(0, slides.findIndex((s) => s.classList.contains('active')));

  function render() {
	slides.forEach((s, i) => s.classList.toggle('active', i === index));
  }

  function step(dir) {
	index = (index + dir + slides.length) % slides.length;
	render();
  }

  prev.addEventListener('click', () => step(-1));
  next.addEventListener('click', () => step(1));

  root.addEventListener('keydown', (e) => {
	if (e.key === 'ArrowLeft') step(-1);
	if (e.key === 'ArrowRight') step(1);
  });

  root.tabIndex = 0;
  render();
}

initCarousel('whereCarousel');
initCarousel('dresscodeMenCarousel');
initCarousel('dresscodeLadyCarousel');

const lightboxElements = {
  lb: document.getElementById('lightbox'),
  lbImg: document.getElementById('lightboxImg'),
  lbClose: document.getElementById('lightboxClose'),
};

function initLightbox(root) {
	const lb = lightboxElements.lb;
  const lbImg = lightboxElements.lbImg;
  const lbClose = lightboxElements.lbClose;
	if (!root || !lb || !lbImg || !lbClose) return;

  let isOpen = false;

	function open(src, alt) {
	if (!src) return;
	isOpen = true;

	lbImg.alt = alt || '';
	lbImg.decoding = 'async';
	lbImg.loading = 'eager';

	// Сбрасываем старые сообщения/обработчики
	const content = lb.querySelector('.lightbox-content');
	const prevErr = content.querySelector('.lightbox-error');
	if (prevErr) prevErr.remove();
	lbImg.onload = () => {
		// картинка успешно загружена — убрать возможный текст ошибки
		const errEl = content.querySelector('.lightbox-error');
		if (errEl) errEl.remove();
	};
	lbImg.onerror = () => {
		console.error('lightbox: failed to load', src);
		// показать сообщение об ошибке в контенте
		if (!content.querySelector('.lightbox-error')) {
			const e = document.createElement('div');
			e.className = 'lightbox-error';
			e.textContent = 'Не удалось загрузить изображение.';
			e.style.color = 'white';
			e.style.padding = '12px';
			content.appendChild(e);
		}
		lbImg.src = '';
	};

	// Открываем оверлей (покажем состояние загрузки)
	lb.classList.add('open');
	lb.setAttribute('aria-hidden', 'false');

	// Устанавливаем src (предварительно очищаем)
	lbImg.src = '';
	lbImg.src = src;
	}

  function close() {
	if (!isOpen) return;
	isOpen = false;
	lb.classList.remove('open');
	lb.setAttribute('aria-hidden', 'true');
	lbImg.src = '';
  }

  lbClose.addEventListener('click', close);
	lb.addEventListener('click', (e) => {
	  // Закрываем при клике по затемнению, но НЕ по содержимому.
	  if (e.target === lb) close();
	});

  window.addEventListener('keydown', (e) => {
	if (e.key === 'Escape' && lb.classList.contains('open')) close();
  });

	root.addEventListener('click', (e) => {
	  // Игнорируем клики по кнопкам управления каруселью
	  if (e.target?.closest?.('.carousel-btn')) return;
	  // Важно: открывать нужно именно кликнутую картинку, а не .active слайда.
	  // closest('.carousel-slide img') может вернуть не тот img (например, при клике по контейнеру).
	  const slideEl = e.target?.closest?.('.carousel-slide');
	  const imgEl = slideEl?.querySelector?.('img');
	  if (!imgEl) return;
	  e.preventDefault();

	  // Если клик произошёл по НЕактивному слайду (наслоение/верстка),
	  // используем видимый (active) как источник истины.
	  // Это гарантирует, что откроется текущее фото, даже если событие пришло от общего контейнера.
	  const activeImgEl = root.querySelector('.carousel-slide.active img');
	  const chosenImgEl = activeImgEl || imgEl;
		const rawSrc = chosenImgEl.getAttribute('src');
	  const fallbackSrc = chosenImgEl.src || '';
	  const source = rawSrc || fallbackSrc;
	  try {
		open(new URL(source, document.baseURI).href, chosenImgEl.alt || '');
	  } catch (err) {
		console.warn('lightbox: URL resolution failed for', source, err);
		open(source, chosenImgEl.alt || '');
	  }
	});

	// Закрытие по клику на изображение (удобно на мобилках)
	lbImg.addEventListener('click', close);
}

// Инициализируем лайтбокс только для карусели секции "Где и когда"
initLightbox(document.getElementById('whereCarousel'));

function initFxButtons() {
  const btnGorko = document.getElementById('btnGorko');
  const btnGoyda = document.getElementById('btnGoyda');
  const overlay = document.getElementById('fxOverlay');
  const stage = document.getElementById('fxStage');
  const title = document.getElementById('fxTitle');
  const text = document.getElementById('fxText');
  const closeBtn = overlay?.querySelector?.('.fx-close');

  if (!btnGorko || !btnGoyda || !overlay || !stage || !title || !text) return;

	let activeAudio = null;
  let autoCloseTimer;
  let lastInvoker = null;

  function stopAudio() {
	if (!activeAudio) return;
	try {
	  activeAudio.pause();
	  activeAudio.currentTime = 0;
	} catch {
	  // ignore
	}
	activeAudio = null;
  }

  function close() {
	// avoid aria-hidden on ancestors of focused elements
	const focused = document.activeElement;
	if (focused && overlay.contains(focused) && typeof focused.blur === 'function') focused.blur();

	overlay.classList.remove('open');
	overlay.setAttribute('aria-hidden', 'true');
	stage.innerHTML = '';
	title.textContent = '';
	text.textContent = '';
	clearTimeout(autoCloseTimer);
	stopAudio();

	if (lastInvoker && typeof lastInvoker.focus === 'function') lastInvoker.focus();
	lastInvoker = null;
  }

	function open({ fxTitle, fxText, stageEl, soundSrc, autoCloseMs = 3500, invoker = null }) {
	lastInvoker = invoker || document.activeElement;

	stage.innerHTML = '';
	title.textContent = fxTitle || '';
	text.textContent = fxText || '';
	if (stageEl) stage.appendChild(stageEl);

	overlay.classList.add('open');
	overlay.setAttribute('aria-hidden', 'false');
	closeBtn?.focus?.();

	clearTimeout(autoCloseTimer);
	autoCloseTimer = setTimeout(close, autoCloseMs);

	stopAudio();
	if (soundSrc) {
	  const a = new Audio(soundSrc);
	  activeAudio = a;
	  a.volume = 0.9;
	  a.play().catch(() => {
		// autoplay может быть заблокирован — ок
	  });
	}
  }

  function makeConfetti() {
	const wrap = document.createElement('div');
	wrap.className = 'fx-confetti';
	const colors = ['#c8a45d', '#d17b2d', '#2f5d50', '#4f7f8c', '#ffffff'];
	const pieces = 70;
	for (let i = 0; i < pieces; i++) {
	  const p = document.createElement('i');
	  const left = Math.random() * 100;
	  const delay = Math.random() * 260;
	  const dur = 1200 + Math.random() * 1200;
	  const w = 6 + Math.random() * 8;
	  const h = 10 + Math.random() * 14;
	  p.style.left = `${left}%`;
	  p.style.animationDelay = `${delay}ms`;
	  p.style.setProperty('--dur', `${dur}ms`);
	  p.style.width = `${w}px`;
	  p.style.height = `${h}px`;
	  p.style.background = colors[i % colors.length];
	  wrap.appendChild(p);
	}
	return wrap;
  }

  function showGorko() {
	const root = document.createElement('div');
	root.style.position = 'absolute';
	root.style.inset = '0';

	root.appendChild(makeConfetti());

	const kissVideo = document.createElement('video');
	kissVideo.className = 'fx-kiss';
	kissVideo.src = 'assets/audio/kiss.mp4';
	kissVideo.autoplay = true;
	kissVideo.muted = false;
	kissVideo.playsInline = true;
	kissVideo.controls = false;
	kissVideo.preload = 'auto';
	root.appendChild(kissVideo);

	open({
	  fxTitle: 'Горько!',
	  fxText: 'Я тебя поцелую, потом... если захочешь',
	  stageEl: root,
	  invoker: btnGorko,
	  autoCloseMs: 9800,
	});
  }

  function showGoyda() {
	const root = document.createElement('div');
	root.className = 'fx-goyda';

	const ring = document.createElement('div');
	ring.className = 'ring';
	root.appendChild(ring);

	const word = document.createElement('div');
	word.className = 'word';
	word.textContent = 'ГОЙДА!!!';
	root.appendChild(word);

	open({
	  fxTitle: 'Гойда!',
	  fxText: 'Легендарный боевой клич активирован.',
	  stageEl: root,
	  invoker: btnGoyda,
		soundSrc: 'assets/audio/goida.mp3',
	  autoCloseMs: 2800,
	});
  }

  overlay.addEventListener('click', (e) => {
	if (e.target?.matches?.('[data-close="true"]')) close();
  });
  overlay.addEventListener('keydown', (e) => {
	if (e.key === 'Escape') close();
  });
  document.addEventListener('keydown', (e) => {
	if (e.key === 'Escape' && overlay.classList.contains('open')) close();
  });

  btnGorko.addEventListener('click', showGorko);
  btnGoyda.addEventListener('click', showGoyda);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initFxButtons);
} else {
  initFxButtons();
}
