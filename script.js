document.getElementById('year').textContent = new Date().getFullYear();

// Keeps --nav-height in sync with the fixed header's real rendered height,
// so the hero's top padding always clears it exactly (no overlap/crop),
// even as the header's own content changes (e.g. the AFSI line).
(function syncNavHeight() {
  const navEl = document.getElementById('nav');
  if (!navEl) return;
  function update() {
    document.documentElement.style.setProperty('--nav-height', navEl.offsetHeight + 'px');
  }
  update();
  window.addEventListener('resize', update);
})();

// Hides the header as soon as the visitor scrolls down — a soft fade +
// slight lift rather than a hard slide-off. It only comes back once they've
// scrolled all the way back to the very top, not on every upward scroll.
(function autoHideNav() {
  const navEl = document.getElementById('nav');
  if (!navEl) return;
  let lastY = window.scrollY;
  let ticking = false;

  function update() {
    const currentY = window.scrollY;
    const delta = currentY - lastY;
    if (currentY <= 40) {
      navEl.classList.remove('nav--hidden');
    } else if (delta > 4) {
      // Ignore tiny frame-to-frame jitter (trackpad momentum,
      // rubber-banding) so it only reacts to an intentional scroll.
      navEl.classList.add('nav--hidden');
    }
    lastY = currentY;
    ticking = false;
  }

  window.addEventListener('scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(update);
      ticking = true;
    }
  }, { passive: true });
})();

const FADE_MS = 260;

// Crossfade helper: fades `fromEl` out, swaps `hidden` on both, fades `toEl` in.
function crossfade(fromEl, toEl) {
  if (fromEl === toEl || !fromEl || !toEl) return;

  fromEl.classList.add('is-fading');

  window.setTimeout(() => {
    fromEl.hidden = true;
    fromEl.classList.remove('is-fading');

    toEl.hidden = false;
    toEl.classList.add('is-fading');
    // force a reflow so the browser registers the starting (faded) state
    // before we remove the class, otherwise it just skips straight to opacity:1
    void toEl.offsetWidth;
    toEl.classList.remove('is-fading');
  }, FADE_MS);
}

// Plays a quick "gather" effect on a poster-wall's images: each one flies in
// from a random direction and scale, staggered slightly, so the whole grid
// looks like it's converging into place.
//
// Tracks the pending "remove is-grouping" cleanup per wall so that replaying
// the effect twice in quick succession (e.g. clicking the same category
// button back-to-back) doesn't leave the *previous* call's cleanup timeout
// running — that stale timeout would fire mid-animation and cut the new
// replay short, making it look abruptly faster than the first play.
const groupEffectTimeouts = new WeakMap();

function playGroupEffect(wallEl) {
  if (!wallEl) return;
  const imgs = wallEl.querySelectorAll('img');

  const pendingCleanup = groupEffectTimeouts.get(wallEl);
  if (pendingCleanup) window.clearTimeout(pendingCleanup);

  wallEl.classList.remove('is-grouping');
  void wallEl.offsetWidth; // force reflow so the animation can replay

  imgs.forEach((img, i) => {
    const angle = Math.random() * Math.PI * 2;
    const distance = 30 + Math.random() * 30;
    img.style.setProperty('--group-tx', `${Math.cos(angle) * distance}px`);
    img.style.setProperty('--group-ty', `${Math.sin(angle) * distance}px`);
    img.style.animationDelay = `${(i % 6) * 40}ms`;
  });

  wallEl.classList.add('is-grouping');

  const cleanupId = window.setTimeout(() => {
    wallEl.classList.remove('is-grouping');
    groupEffectTimeouts.delete(wallEl);
  }, 900);
  groupEffectTimeouts.set(wallEl, cleanupId);
}

// Plays a soft, discreet "landing" reveal on a poster-wall's images — a
// gentle blurred drift-down-and-clear, like a cloud settling into place.
// A light, capped stagger keeps it from looking either perfectly flat or
// like a slow top-to-bottom cascade. Used once for the very first mosaic
// the visitor sees on page load.
function playLandingEffect(wallEl) {
  if (!wallEl) return;
  const imgs = wallEl.querySelectorAll('img');

  wallEl.classList.remove('is-landing');
  void wallEl.offsetWidth; // force reflow so the animation can replay

  imgs.forEach((img, i) => {
    img.style.animationDelay = `${(i % 5) * 18}ms`;
  });

  wallEl.classList.add('is-landing');

  window.setTimeout(() => {
    wallEl.classList.remove('is-landing');
  }, 1300);
}

// --- Hero categories: Cinéma / Documentaires ---
const categoryButtons = document.querySelectorAll('.hero__category');
const panels = document.querySelectorAll('.hero__panel');

// Switches the visible top-level panel (Cinéma / Documentaires / Séries).
// Each panel is now a single merged mosaic (no more Longs/Courts or
// Séries/Unitaires sub-tabs), so this just swaps panels and replays that
// panel's gather effect.
function setCategory(target, { animate = true } = {}) {
  const currentPanel = Array.from(panels).find((p) => !p.hidden);
  const nextPanel = Array.from(panels).find((p) => p.dataset.panel === target);

  categoryButtons.forEach((b) => {
    const active = b.dataset.category === target;
    b.classList.toggle('is-active', active);
    b.setAttribute('aria-selected', active ? 'true' : 'false');
  });

  if (target === 'docs') {
    window.setTimeout(() => playGroupEffect(document.getElementById('wall-docs-all')), FADE_MS);
  }
  if (target === 'series') {
    window.setTimeout(() => playGroupEffect(document.getElementById('wall-series')), FADE_MS);
  }
  if (target === 'cinema') {
    window.setTimeout(() => playGroupEffect(document.getElementById('wall-longs')), FADE_MS);
  }

  if (!currentPanel || currentPanel === nextPanel || !nextPanel) {
    if (nextPanel) nextPanel.hidden = false;
    return;
  }

  if (animate) {
    crossfade(currentPanel, nextPanel);
  } else {
    currentPanel.hidden = true;
    nextPanel.hidden = false;
  }
}

categoryButtons.forEach((btn) => {
  btn.addEventListener('click', () => setCategory(btn.dataset.category));
});

// --- Page views: Films (mosaic + Dernièrement) is the default, scrollable
// home page. À propos, Contact and CV are dedicated views only reachable by
// clicking their nav link — never by scrolling — so they're hidden by
// default and swapped in/out here instead of living in the normal flow.
const homeSections = [document.getElementById('top'), document.getElementById('films')].filter(Boolean);
const aproposSections = Array.from(document.querySelectorAll('.apropos'));
const contactSection = document.getElementById('contact');
const filmoSection = document.getElementById('filmo');

function showView(view) {
  homeSections.forEach((el) => { el.hidden = view !== 'home'; });
  aproposSections.forEach((el) => { el.hidden = view !== 'apropos'; });
  if (contactSection) contactSection.hidden = view !== 'contact';
  if (filmoSection) filmoSection.hidden = view !== 'filmo';
  window.scrollTo(0, 0);
}

const initialView = ['apropos', 'contact', 'filmo'].includes(window.location.hash.slice(1))
  ? window.location.hash.slice(1)
  : 'home';
showView(initialView);

const navAproposLink = document.getElementById('navAproposLink');
if (navAproposLink) {
  navAproposLink.addEventListener('click', (e) => {
    e.preventDefault();
    showView('apropos');
  });
}

const navContactLink = document.getElementById('navContactLink');
if (navContactLink) {
  navContactLink.addEventListener('click', (e) => {
    e.preventDefault();
    showView('contact');
  });
}

const navCvLink = document.getElementById('navCvLink');
if (navCvLink) {
  navCvLink.addEventListener('click', (e) => {
    e.preventDefault();
    showView('filmo');
  });
}

// The "Films" nav link should always land the visitor back on the Fiction
// mosaic specifically — not just scroll to the top while leaving whatever
// category was last active (Documentaires, Séries...) on screen.
function resetToHome() {
  showView('home');
  setCategory('cinema', { animate: true });
}

const navFilmsLink = document.getElementById('navFilmsLink');
if (navFilmsLink) {
  navFilmsLink.addEventListener('click', resetToHome);
}

const navNameLink = document.getElementById('navNameLink');
if (navNameLink) {
  navNameLink.addEventListener('click', (e) => {
    e.preventDefault();
    const isHome = homeSections.length > 0 && !homeSections[0].hidden;
    if (isHome) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      showView('home');
    }
  });
}

// --- Language toggle: FR / EN ---
const langButtons = document.querySelectorAll('.nav__lang-btn');
const translatable = document.querySelectorAll('[data-en]');

const pageMeta = {
  title: {
    el: document.getElementById('pageTitle'),
    fr: document.getElementById('pageTitle') ? document.getElementById('pageTitle').textContent : '',
    en: 'Thomas Van Pottelberge — Sound Recordist · Sound Editor',
  },
  description: {
    el: document.getElementById('pageDescription'),
    fr: document.getElementById('pageDescription') ? document.getElementById('pageDescription').getAttribute('content') : '',
    en: 'Thomas Van Pottelberge, sound recordist and sound editor for narrative film and documentary. Little Jaffna, Les Meutes, Freda.',
  },
};

// Cache the original French markup once so we can always switch back to it,
// even after the English version has overwritten an element's innerHTML.
translatable.forEach((el) => {
  el.dataset.fr = el.innerHTML;
});

function setLanguage(lang) {
  document.documentElement.lang = lang;

  translatable.forEach((el) => {
    el.innerHTML = lang === 'en' ? el.dataset.en : el.dataset.fr;
  });

  langButtons.forEach((b) => {
    b.classList.toggle('is-active', b.dataset.lang === lang);
  });

  if (pageMeta.title.el) pageMeta.title.el.textContent = lang === 'en' ? pageMeta.title.en : pageMeta.title.fr;
  if (pageMeta.description.el) pageMeta.description.el.setAttribute('content', lang === 'en' ? pageMeta.description.en : pageMeta.description.fr);

  try {
    localStorage.setItem('site-lang', lang);
  } catch (e) {
    // localStorage unavailable (private browsing, etc.) — language just won't persist
  }
}

langButtons.forEach((btn) => {
  btn.addEventListener('click', () => setLanguage(btn.dataset.lang));
});

let initialLang = 'fr';
try {
  initialLang = localStorage.getItem('site-lang') || 'fr';
} catch (e) {
  initialLang = 'fr';
}
if (initialLang === 'en') setLanguage('en');

// --- Landing effect: softly reveal the whole hero on page load ---
function playTextLandingEffect(elements, { baseDelay = 0, stagger = 55 } = {}) {
  elements.forEach((el, i) => {
    if (!el) return;
    el.classList.remove('landing-el');
    void el.offsetWidth; // force reflow so the animation can replay
    el.style.animationDelay = `${baseDelay + i * stagger}ms`;
    el.classList.add('landing-el');
  });
}

// Run the landing effect as soon as this script executes (the DOM already
// exists by then, since this file is loaded at the end of <body>) rather
// than waiting on window's "load" event. Waiting for full page load (all
// images, fonts, etc. — which can take a while on a slow/uncached first
// visit) meant the hero sat fully visible and static for that whole time,
// then suddenly snapped invisible/blurred before replaying the reveal —
// a visible flicker. Running immediately means the reveal is effectively
// the very first thing the visitor sees, with no static flash beforehand.
requestAnimationFrame(() => {
  playTextLandingEffect(categoryButtons, { baseDelay: 0 });
  playLandingEffect(document.getElementById('wall-longs'));
});

// --- Lightbox: click a "Photos de tournage" thumbnail to see it full-size,
// with prev/next navigation to browse the rest of the gallery ---
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightboxImg');
const lightboxClose = document.getElementById('lightboxClose');
const lightboxPrev = document.getElementById('lightboxPrev');
const lightboxNext = document.getElementById('lightboxNext');
const lightboxCaption = document.getElementById('lightboxCaption');
const galleryImgs = Array.from(document.querySelectorAll('.apropos__gallery img'));

let lightboxIndex = -1;

function showLightboxImage(index) {
  const img = galleryImgs[index];
  if (!img || !lightboxImg) return;
  lightboxIndex = index;
  // Prefer the full-resolution original (data-full) over the cropped
  // thumbnail shown in the grid, so browsing really shows each photo in
  // its original format rather than just a bigger version of the crop.
  lightboxImg.src = img.dataset.full || img.src;
  lightboxImg.alt = img.alt || '';

  // The caption lives in the thumbnail's own <figcaption> (shown on hover
  // in the grid) — reuse that same text below the enlarged photo.
  if (lightboxCaption) {
    const figcaption = img.closest('figure') && img.closest('figure').querySelector('figcaption');
    lightboxCaption.textContent = figcaption ? figcaption.textContent.trim() : '';
  }
}

// Any open lightbox/overlay locks page scroll behind it — otherwise, on
// mobile, the page keeps scrolling/rubber-banding under the fixed overlay
// while a trailer or gallery image is open. Ref-counted so nested/overlapping
// opens (rare, but e.g. a fast tap sequence) don't unlock too early.
let openOverlayCount = 0;
function lockBodyScroll() {
  openOverlayCount += 1;
  document.body.classList.add('no-scroll');
}
function unlockBodyScroll() {
  openOverlayCount = Math.max(0, openOverlayCount - 1);
  if (openOverlayCount === 0) document.body.classList.remove('no-scroll');
}

function openLightbox(index) {
  if (!lightbox || !lightboxImg || galleryImgs.length === 0) return;
  showLightboxImage(index);
  lightbox.hidden = false;
  void lightbox.offsetWidth; // force reflow so the fade-in actually plays
  lightbox.classList.add('is-visible');
  lockBodyScroll();
}

function closeLightbox() {
  if (!lightbox) return;
  lightbox.classList.remove('is-visible');
  unlockBodyScroll();
  window.setTimeout(() => {
    lightbox.hidden = true;
  }, 300);
}

function showNext() {
  if (lightboxIndex < 0) return;
  showLightboxImage((lightboxIndex + 1) % galleryImgs.length);
}

function showPrev() {
  if (lightboxIndex < 0) return;
  showLightboxImage((lightboxIndex - 1 + galleryImgs.length) % galleryImgs.length);
}

galleryImgs.forEach((img, i) => {
  img.addEventListener('click', () => openLightbox(i));
});

if (lightboxClose) lightboxClose.addEventListener('click', closeLightbox);
if (lightboxNext) lightboxNext.addEventListener('click', showNext);
if (lightboxPrev) lightboxPrev.addEventListener('click', showPrev);
if (lightbox) {
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) closeLightbox();
  });
}
document.addEventListener('keydown', (e) => {
  if (lightbox && lightbox.hidden) return;
  if (e.key === 'Escape') closeLightbox();
  if (e.key === 'ArrowRight') showNext();
  if (e.key === 'ArrowLeft') showPrev();
});

// --- Video lightbox: click a poster in the mosaic to watch the trailer
// directly on the site (YouTube embed) instead of leaving to youtube.com.
const videoLightbox = document.getElementById('videoLightbox');
const videoLightboxIframe = document.getElementById('videoLightboxIframe');
const videoLightboxClose = document.getElementById('videoLightboxClose');

function getYouTubeId(url) {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

function openVideoLightbox(videoId) {
  if (!videoLightbox || !videoLightboxIframe) return;
  videoLightboxIframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`;
  videoLightbox.hidden = false;
  void videoLightbox.offsetWidth;
  videoLightbox.classList.add('is-visible');
  lockBodyScroll();
}

function closeVideoLightbox() {
  if (!videoLightbox || !videoLightboxIframe) return;
  videoLightbox.classList.remove('is-visible');
  unlockBodyScroll();
  window.setTimeout(() => {
    videoLightbox.hidden = true;
    videoLightboxIframe.src = '';
  }, 300);
}

// --- Project lightbox: click a poster with a filled-in fiche (data-film)
// opens a richer panel — trailer on one side, director/synopsis/awards on
// the other — instead of just the bare video popup. Posters whose film
// isn't in `filmsData` yet keep the old plain trailer-only behaviour.
//
// Each entry's fields are all optional except `title` — sections with no
// content (e.g. no awards yet) are simply left out of the panel rather than
// showing an empty heading. As Thomas sends over the text for the rest of
// the ~30 films, new entries just get added here.
const filmsData = {
  'little-jaffna': {
    title: 'Little Jaffna',
    director: 'Lawrence Valin',
    production: 'Ex Nihilo · Mean Streets',
    youtubeId: 'crsx7_2vrn0',
    awards: [
      'Venise 2024 — film de clôture de la Semaine Internationale de la Critique',
      'Toronto International Film Festival 2024',
    ],
    soundTeam: [
      { role: 'Chef opérateur du son', name: 'Thomas Van Pottelberge', self: true },
      { role: 'Monteurs son', name: 'Aude Baudassé, Ange Hubert, Sébastien Jeannot, Clément Gallice' },
      { role: 'Mixeur', name: 'Clément Laforce' },
    ],
    synopsis: {
      fr: "Le quartier de « Little Jaffna » à Paris est le cœur d'une communauté tamoule vibrante, où Michael, un jeune policier, est chargé d'infiltrer un groupe criminel connu pour extorsion et blanchiment d'argent au profit des rebelles séparatistes au Sri Lanka. Mais à mesure qu'il s'enfonce au cœur de l'organisation, sa loyauté sera mise à l'épreuve, dans une poursuite implacable contre l'un des gangs les plus cachés et puissants de Paris.",
      en: "The Little Jaffna neighbourhood in Paris is the heart of a vibrant Tamil community, where Michael, a young police officer, is tasked with infiltrating a criminal group known for extortion and money laundering on behalf of separatist rebels in Sri Lanka. But as he sinks deeper into the organization, his loyalty is put to the test, in a relentless pursuit against one of Paris's most hidden and powerful gangs.",
    },
  },
  'marie-madeleine': {
    title: 'Marie Madeleine',
    director: 'Gessica Généus',
    production: 'Ayizan Production · SaNoSi Productions · Stenola Productions',
    youtubeId: 'TNeDdjlk9EU',
    awards: ['Cannes 2026 — sélection Cannes Première'],
    soundTeam: [
      { role: 'Chef opérateur du son', name: 'Thomas Van Pottelberge', self: true },
      { role: 'Monteur son', name: 'Thomas Van Pottelberge', self: true },
      { role: 'Mixeur', name: 'Jean-François Levillain' },
    ],
    synopsis: {
      fr: "À Jacmel, sur la côte sud d'Haïti, Marie Madeleine vit libre, de nuit, sans se soumettre à ceux qui prétendent sauver les âmes. Sa rencontre avec Joseph, jeune croyant engagé dans une communauté évangélique, fait vaciller les certitudes des deux êtres et ouvre un espace où désir, foi et quête de liberté se mêlent.",
      en: "In Jacmel, on Haiti's southern coast, Marie Madeleine lives freely by night, answering to no one who claims to save souls. Her encounter with Joseph, a young man deeply involved in an evangelical community, shakes both their certainties and opens a space where desire, faith and the search for freedom intertwine.",
    },
  },
  'les-meutes': {
    title: 'Les Meutes',
    director: 'Kamal Lazraq',
    production: 'Ad Vitam · Saïd Hamich Benlarbi',
    youtubeId: 'aMZj--wF9ko',
    awards: ["Cannes 2023 — Prix du Jury, Un Certain Regard"],
    soundTeam: [
      { role: 'Chef opérateur du son', name: 'Thomas Van Pottelberge', self: true },
      { role: 'Monteurs son', name: 'Thomas Van Pottelberge, Thibaud Rie', self: true },
      { role: 'Mixeur', name: 'Philippe Charbonnel' },
    ],
    synopsis: {
      fr: "Hassan et Issam, père et fils, survivent au jour le jour en enchaînant les petits trafics pour la pègre locale de Casablanca. Un soir, un homme qu'ils devaient enlever meurt accidentellement dans leur voiture. Commence alors une longue nuit à travers les bas-fonds de la ville pour faire disparaître le corps.",
      en: "Hassan and Issam, father and son, scrape by running small errands for Casablanca's local underworld. One night, a man they were meant to kidnap dies accidentally in their car — and a long night through the city's underbelly begins as they try to make the body disappear.",
    },
  },
  freda: {
    title: 'Freda',
    director: 'Gessica Généus',
    production: 'SaNoSi Productions · Ayizan Production · Merveilles Production',
    youtubeId: 'SK2BaJHtT9s',
    awards: ["Cannes 2021 — Un Certain Regard, nommé à la Caméra d'Or"],
    soundTeam: [
      { role: 'Chef opérateur du son', name: 'Thomas Van Pottelberge', self: true },
      { role: 'Monteur son', name: 'Thomas Van Pottelberge', self: true },
      { role: 'Mixeur', name: 'Joel Rangon' },
    ],
    synopsis: {
      fr: "À Port-au-Prince, Freda, mère célibataire, vit avec les siens dans un quartier populaire où ils survivent grâce à leur petite échoppe. Entre précarité et violence grandissante, chacun se demande s'il faut partir ou rester, tandis que Freda veut croire en l'avenir de son pays.",
      en: "In Port-au-Prince, Freda, a single mother, lives with her family in a working-class neighbourhood, getting by on their small street shop. Amid hardship and rising violence, everyone around her wonders whether to leave or stay, while Freda holds on to her belief in her country's future.",
    },
  },
  'le-barrage': {
    title: 'Le Barrage',
    director: 'Ali Cherri',
    production: 'KinoElektron',
    youtubeId: 'mextUdIDi_E',
    awards: ['Cannes 2022 — Quinzaine des Réalisateurs'],
    soundTeam: [
      { role: 'Chef opérateur du son', name: 'Thomas Van Pottelberge', self: true },
      { role: 'Monteur son', name: 'Jakov Munizaba' },
      { role: 'Mixeur', name: 'Simon Apostolou' },
    ],
    synopsis: {
      fr: "Au Soudan, près du barrage de Merowe, Maher travaille le jour dans une briqueterie traditionnelle alimentée par les eaux du Nil. Chaque soir, il s'aventure en secret dans le désert pour bâtir une mystérieuse construction de boue, en écho lointain à la révolution qui gronde dans le pays.",
      en: "In Sudan, near the Merowe dam, Maher works by day in a traditional brickyard fed by the waters of the Nile. Each evening he secretly ventures into the desert to build a mysterious structure out of mud — a distant echo of the revolution stirring across the country.",
    },
  },
  manodrome: {
    title: 'Manodrome',
    director: 'John Trengove',
    production: 'Felix Culpa · Liminal Content',
    youtubeId: 'GjHIUBplrUw',
    awards: ['Berlinale 2023 — sélection officielle'],
    soundTeam: [
      { role: 'Chef opérateur du son', name: 'Michael Gassert' },
    ],
    synopsis: {
      fr: "Chauffeur VTC, Ralphie peine à faire face à la grossesse de sa compagne. Rongé par des forces qui le dépassent et par ses propres démons, il rencontre une mystérieuse communauté d'hommes qui l'accueille comme un des leurs — jusqu'à ce que la pression fasse tout basculer.",
      en: "Rideshare driver Ralphie is struggling to face his girlfriend's pregnancy. Wrestling with outside pressures and his own inner demons, he falls in with a mysterious brotherhood of men who welcome him as one of their own — until the pressure builds toward a breaking point.",
    },
  },
  diamantino: {
    title: 'Diamantino',
    director: 'Gabriel Abrantes, Daniel Schmidt',
    production: 'Maria & Mayer · Les Films du Bélier · Syndrome Films',
    youtubeId: 'PXBm0GYV4Zo',
    awards: ['Cannes 2018 — Grand Prix de la Semaine de la Critique'],
    soundTeam: [
      { role: 'Chef opérateur du son', name: 'Olivier Blanc' },
      { role: 'Ingénieur du son post-synchros', name: 'Thomas Van Pottelberge', self: true },
      { role: 'Monteur son', name: 'Daniel Turini' },
      { role: 'Mixeur', name: 'Benjamin Viau' },
    ],
    synopsis: {
      fr: "Diamantino, icône planétaire du football, voit son génie s'envoler en pleine Coupe du Monde et sa carrière s'arrêter net. Devenu la risée du pays, l'ancienne star découvre le monde et se retrouve embarqué, malgré lui, dans une odyssée mêlant conspiration familiale et crise des réfugiés.",
      en: "Diamantino, football's biggest global icon, loses his magic touch mid-World Cup and sees his career collapse overnight. Turned into a national laughing stock, the fallen star discovers the world around him and gets swept, almost against his will, into an odyssey of family conspiracy and the refugee crisis.",
    },
  },
  'you-resemble-me': {
    title: 'You Resemble Me',
    director: 'Dina Amer',
    production: 'Willa · The Othrs',
    youtubeId: 'hY4QaI8wxOk',
    awards: ['Venise 2021 — sélection officielle'],
    soundTeam: [
      { role: 'Chef opérateur du son', name: 'Thomas Van Pottelberge', self: true },
      { role: 'Sound designer', name: 'Nicolas Becker' },
      { role: 'Mixeuse', name: 'Maria Carolina Santana' },
    ],
    synopsis: {
      fr: "Deux sœurs grandissent en banlieue parisienne avant d'être séparées. L'aînée, Hasna, peine à trouver sa place et son identité, jusqu'à un choix qui va choquer le monde entier — une histoire intime sur la famille, l'amour et l'appartenance, librement inspirée d'un fait réel.",
      en: "Two sisters grow up on the outskirts of Paris before being torn apart. The eldest, Hasna, struggles to find her identity, leading to a choice that shocks the world — an intimate story about family, love and belonging, loosely inspired by true events.",
    },
  },
  'merveilles-a-montfermeil': {
    title: 'Merveilles à Montfermeil',
    director: 'Jeanne Balibar',
    production: 'Rectangle Productions',
    youtubeId: 'mUG3RV-eQ2w',
    soundTeam: [
      { role: 'Chef opérateur du son', name: 'Mathieu Villien' },
      { role: 'Monteurs son', name: 'David Amsalem, Thomas Van Pottelberge', self: true },
      { role: 'Mixeur', name: 'Stéphane Thiébaut' },
    ],
    synopsis: {
      fr: "Joëlle et Kamel font tous deux partie de l'équipe municipale de la nouvelle maire de Montfermeil, tout en traversant un divorce. Pendant que la ville change et prospère grâce à une politique aussi ambitieuse qu'inattendue, leur histoire pourrait bien renaître au détour d'une fête de quartier.",
      en: "Joëlle and Kamel both work on the staff of Montfermeil's newly elected mayor, while going through a divorce. As the town changes and thrives under an ambitious, unexpected new policy, their own story might just find a second chance amid a neighbourhood festival.",
    },
  },
  'en-mille-morceaux': {
    title: 'En mille morceaux',
    director: 'Véronique Mériadec',
    production: 'Acacia Films',
    youtubeId: 'mHFTXh-Lor0',
    soundTeam: [
      { role: 'Chef opérateur du son', name: 'Pierre Battelier' },
      { role: 'Monteur son', name: 'Thomas Van Pottelberge', self: true },
      { role: 'Mixeur', name: 'Antonin Dalmasso' },
    ],
    synopsis: {
      fr: "En 1977, Éric Gaubert assassine le fils de Nicole Parmentier. Vingt-cinq ans plus tard, cette mère à la vie brisée décide de rencontrer le meurtrier tout juste sorti de prison — simple vengeance, ou besoin de comprendre ce qui l'a poussé à commettre l'irréparable ?",
      en: "In 1977, Éric Gaubert murders Nicole Parmentier's son. Twenty-five years later, this mother, whose life was shattered by the loss, arranges to meet her son's killer, freshly released from prison — driven by revenge, or by the need to understand what pushed him to commit the irreparable.",
    },
  },
  'back-to-the-family': {
    title: 'Back to the Family',
    director: 'Šarūnas Bartas',
    production: 'KinoElektron · Cineline eDelivery · Message Film',
    youtubeId: 'JS1adp131oE',
    awards: ['Festival de Rotterdam (IFFR) 2025 — Big Screen Competition'],
    soundTeam: [
      { role: 'Chefs opérateurs du son', name: 'Tiphaine Depret, Thomas Van Pottelberge', self: true },
    ],
    synopsis: {
      fr: "En apprenant que sa grand-mère adorée est en train de mourir, une jeune femme retourne dans la campagne lituanienne, où elle doit affronter un passé qu'elle a essayé d'oublier.",
      en: "Upon learning that her beloved grandmother is dying, a young woman returns to the Lithuanian countryside, where she must confront a past she has tried to forget.",
    },
  },
  'dernier-soleil': {
    title: 'Dernier Soleil',
    director: 'Étienne Constantinesco',
    production: 'Pleine Image',
    youtubeId: 'ZFsSZcy_NBA',
    soundTeam: [
      { role: 'Chef opérateur du son', name: 'Cyril Carbonne' },
      { role: 'Monteurs son', name: 'Thomas Van Pottelberge, Lucas Rollin', self: true },
      { role: 'Mixeur', name: 'Thomas Van Pottelberge', self: true },
    ],
    synopsis: {
      fr: "Quelque part dans le nord-est de la France, Éric, un homme sans le sou vivant dans sa voiture, est rejeté par son fils Esteban, dix ans, autiste. Lorsqu'Esteban est enlevé par deux malfrats, Éric, dévasté, plonge dans les bas-fonds de la ville pour réunir la rançon et sauver son fils.",
      en: "Somewhere in north-eastern France, Éric, a penniless man living out of his car, is rejected by his ten-year-old autistic son, Esteban. When Esteban is kidnapped by two gangsters, a devastated Éric plunges into the city's underworld to raise the ransom and save him.",
    },
  },
  'gold-songs': {
    title: 'Gold Songs',
    director: 'Ico Costa',
    production: 'Oublaum Filmes · La Belle Affaire Productions',
    youtubeId: 'i4zapAP6cAY',
    soundTeam: [
      { role: 'Chef opérateur du son', name: 'Luis Duzenta' },
      { role: 'Monteur son', name: 'Thomas Van Pottelberge', self: true },
      { role: 'Mixeur', name: 'Simon Apostolou' },
    ],
    synopsis: {
      fr: "Domingos et Neusia sont un jeune couple originaire d'une petite ville du Mozambique. Elle va à l'école, il a un travail sous-payé dans un lave-auto. Désirant une vie meilleure, Domingos entreprend un voyage à travers le Mozambique, en direction des mines d'or du nord du pays. En attendant, Neusia attend chez elle.",
      en: "Domingos and Neusia are a young couple from a small town in Mozambique. She goes to school, he has an underpaid job at a car wash. Wanting a better life, Domingos sets off on a journey across Mozambique toward the gold mines in the north of the country. Back home, Neusia waits.",
    },
  },
  blockbuster: {
    title: 'Blockbuster',
    director: 'July Hygreck',
    production: 'Virginie Films · Rosebud Entertainment Pictures',
    youtubeId: 'uUKdBCuouqg',
    awards: ['Netflix France'],
    synopsis: {
      fr: "À cause d'une vidéo qu'il avait faite pour amuser son père malade, Jérémy, malade du cœur, élabore un plan élaboré pour reconquérir Lola, sa petite amie adoratrice de superhéros.",
      en: "Because of a video he made to cheer up his sick father, heartsick Jérémy comes up with an elaborate plan to win back Lola, his superhero-obsessed girlfriend.",
    },
    soundTeam: [
      { role: 'Chef opérateur du son', name: 'Régis Boussin' },
      { role: 'Chef opérateur du son (renfort)', name: 'Thomas Van Pottelberge', self: true },
      { role: 'Monteur son', name: 'Adrien Arnaud' },
      { role: 'Mixeur', name: 'Damien Lazzerini' },
    ],
  },
  bizarre: {
    title: 'Bizarre',
    director: 'Étienne Faure',
    production: 'Bizarre Production · Eivissa Productions',
    youtubeId: 'msIwHYFMOes',
    soundTeam: [
      { role: 'Chef opérateur du son', name: 'Axel Guenoun' },
      { role: 'Monteur son', name: 'Thomas Van Pottelberge', self: true },
      { role: 'Mixeur', name: 'David Amsalem' },
    ],
    synopsis: {
      fr: "Bizarre est un drame romantique franco-américain. Il suit Maurice, un jeune Français de 18 ans débarquant à New York, qui trouve refuge et affection auprès de deux jeunes femmes vivant au-dessus d'un club underground branché de Brooklyn nommé le Bizarre.",
      en: "Bizarre is a French-American romantic drama. It follows Maurice, an 18-year-old Frenchman arriving in New York, who finds refuge and affection with two young women living above a trendy underground Brooklyn club named the Bizarre.",
    },
  },
  'la-ligne-de-vie': {
    title: 'La ligne de vie',
    director: 'Hugo Becker',
    pressUrl: 'https://www.canalplus.com/cinema/la-ligne-de-vie/h/32098653_50615/streaming/',
    pressLabel: 'Voir le film sur Canal+ ↗',
    awards: ['Mostra de Venise 2025 — sélection officielle (12 courts métrages retenus sur 2350)'],
    soundTeam: [
      { role: 'Chef opérateur du son', name: 'Dominique Weigner' },
      { role: 'Monteur son', name: 'Thomas Van Pottelberge', self: true },
      { role: 'Mixeur', name: 'Damien Lazzerini' },
    ],
    synopsis: {
      fr: "24 décembre 1916. De l'autre côté d'un poste de contrôle allemand, un camion transportant du courrier est arrêté et criblé de balles. Un homme est tué. Un autre homme et une femme, en mission postale, clament leur innocence et tentent d'expliquer leur présence en territoire ennemi, après que la radio qui les guidait s'est tue en plein no man's land.",
      en: "December 24, 1916. On the other side of a German checkpoint, a truck carrying mail is stopped and riddled with bullets. One man is killed. Another man and a woman, on a postal mission, claim their innocence and try to explain their presence in enemy territory, after the radio guiding them cut out in the middle of no man's land.",
    },
  },
  'pauvres-diables': {
    title: 'Pauvres Diables',
    director: 'Olivier Sagne',
    production: 'Artisans du Film · Cinq de Trèfle Productions',
    cast: 'Luna Carpiaux, Cécile Chatignoux, Julie Brochen, Mathieu Genet',
    soundTeam: [
      { role: 'Chef opérateur du son', name: 'Tanguy Lailler' },
      { role: 'Monteur son', name: 'Hugo Cohen' },
      { role: 'Mixeur', name: 'Thomas Van Pottelberge', self: true },
    ],
    synopsis: {
      fr: "Guyane, bagne des femmes, 1885. Louise purge une peine dans un couvent à des milliers de kilomètres de la France. Lorsque l'administration pénitentiaire improvise des mariages arrangés avec d'anciens bagnards pour peupler la colonie, Louise tombe sous le charme d'Eugène, un ancien faussaire. Leur union permettrait à Louise de retrouver sa liberté et démarrer une nouvelle vie mais à quel prix... ?",
      en: "French Guiana, women's penal colony, 1885. Louise is serving her sentence in a convent thousands of miles from France. When the prison administration improvises arranged marriages with former convicts to populate the colony, Louise falls for Eugène, a former forger. Their union could give her back her freedom and a new life — but at what cost...?",
    },
  },
  mardochi: {
    title: 'Mardochi',
    director: 'Lucas Gloppe',
    pressUrl: 'https://www.france.tv/france-3/libre-court/8734965-mardochi.html',
    pressLabel: 'Voir le film sur france.tv ↗',
    awards: ['Prix des Passeurs de Courts — Festival européen du film court de Brest'],
    soundTeam: [
      { role: 'Chef opérateur du son', name: 'Thomas Van Pottelberge', self: true },
      { role: 'Monteur son', name: 'Titouan Martin' },
      { role: 'Mixeur', name: 'Gilles Benardeau' },
    ],
    synopsis: {
      fr: "Vincent rentre de Rabat, où il n'a pas réussi à retrouver la maison d'enfance de son père, parti du Maroc à l'indépendance. Sur le chemin de l'hôpital où son père est en train de mourir, Vincent croise la route d'Ahmed, un étudiant marocain.",
      en: "Vincent returns from Rabat, where he failed to find his father's childhood home — his father having left Morocco at independence. On the way to the hospital where his father is dying, Vincent crosses paths with Ahmed, a Moroccan student.",
    },
  },
  'na-marei': {
    title: 'Na Marei, l\'invisible',
    director: 'Léa-Jade Horlier',
    youtubeId: 'AWiRa7KZY4U',
    awards: [
      'Présélectionné aux César 2025 du meilleur court métrage de fiction',
      'Éligible aux Oscars (Live Action Short Film)',
      'Grand Prix — Paris Courts Devant 2024',
      'Prix de la compétition internationale — Brussels Short Film Festival',
      'Prix d\'interprétation féminine (Sadaf Asgari) — Festival de Cabourg',
      'Sélection officielle — Festival de Clermont-Ferrand',
    ],
    soundTeam: [
      { role: 'Chef opérateur du son', name: 'Thomas Van Pottelberge', self: true },
      { role: 'Monteurs son', name: 'Dimitri Kharitonov, Thomas Van Pottelberge', self: true },
      { role: 'Mixeur', name: 'Matthieu Fraticelli' },
    ],
    synopsis: {
      fr: "Zaid, quinze ans, vit près de Kaboul avec sa mère et sa sœur. Entre l'école, ses amis et ses passions, il semble s'épanouir dans une ville en ruines après la guerre. Mais quand sa mère annonce qu'il est temps pour lui de se marier, ses ambitions s'effondrent et le lourd secret de sa liberté doit prendre fin.",
      en: "Zaid, fifteen, lives near Kabul with his mother and sister. Between school, friends and his passions, he seems to thrive in a city left in ruins by war. But when his mother announces it's time for him to marry, his ambitions collapse, and the heavy secret of his freedom must come to an end.",
    },
  },
  'la-grande-ourse': {
    title: 'La Grande Ourse',
    director: 'Anthony Bajon',
    pressUrl: 'https://www.canalplus.com/cinema/la-grande-ourse/h/29470653_50002',
    pressImage: 'assets/wall/la-grande-ourse-still.jpg',
    pressLabel: 'Voir le film sur Canal+ ↗',
    soundTeam: [
      { role: 'Chef opérateur du son', name: 'Rémi Chanaud' },
      { role: 'Monteur son', name: 'Thomas Van Pottelberge', self: true },
      { role: 'Mixeur', name: 'Matthieu Fraticelli' },
    ],
    synopsis: {
      fr: "Tous les étés, Chloé se rend dans le même camping. Mais cette année, elle y va sans sa famille, plus que jamais pour échapper à son quotidien. Elle y retrouve Alexia, son amie d'enfance, qui vit sur place et s'entraîne pour son prochain combat de boxe.",
      en: "Every summer, Chloé goes to the same campsite. But this year she's going without her family, more than ever to escape her everyday life. There she reunites with Alexia, her childhood friend, who lives there and is training for her next boxing match.",
    },
  },
  'the-loyal-man': {
    title: 'The Loyal Man',
    director: 'Lawrence Valin',
    youtubeId: 'PViFOeiwcew',
    awards: ['Prix Adami de la meilleure interprétation masculine — Festival de Clermont-Ferrand'],
    soundTeam: [
      { role: 'Chef opérateur du son', name: 'Thomas Van Pottelberge', self: true },
      { role: 'Monteur son', name: 'Clément Gallice' },
      { role: 'Mixeur', name: 'Clément Laforce' },
    ],
    synopsis: {
      fr: "Homme de main solitaire et dévoué, Aathi travaille le jour dans une épicerie et conduit la nuit des sans-papiers pour le compte d'un parrain de la mafia tamoule à Paris surnommé « Monsieur ». Aathi n'a jamais pensé qu'au devoir, jusqu'à ce que sa route croise celle de Minnale, une sans-papiers livrée à elle-même.",
      en: "A solitary, devoted henchman, Aathi works days in a grocery store and drives undocumented migrants by night for a Tamil mafia boss in Paris known as \"Monsieur.\" Aathi has only ever thought of duty, until his path crosses that of Minnale, an undocumented migrant left to fend for herself.",
    },
  },
  coqueluche: {
    title: 'Coqueluche',
    director: 'Aurélien Peyre',
    pressUrl: 'https://boutique.arte.tv/detail/coqueluche',
    pressLabel: 'Voir la bande-annonce sur arte.tv ↗',
    soundTeam: [
      { role: 'Chef opérateur du son', name: 'Hugo Zeitoun' },
      { role: 'Monteur son', name: 'Thomas Van Pottelberge', self: true },
      { role: 'Mixeur', name: 'Thomas Van Pottelberge', self: true },
    ],
    synopsis: {
      fr: "Laurine, 19 ans, vient rejoindre son amoureux Olivier, qui passe ses vacances en famille, comme chaque été, avec ses cousins, sur la petite île de Bréhat. Derrière les enfantillages et les railleries se cachent de véritables questionnements sur l'image de la femme, sa place dans le monde et le sexisme ordinaire.",
      en: "Laurine, 19, comes to join her boyfriend Olivier, who is spending his family holiday, as every summer, with his cousins on the small island of Bréhat. Behind the childishness and teasing lie real questions about the image of women, their place in the world, and everyday sexism.",
    },
  },
  'homme-sage': {
    title: 'Homme sage',
    director: 'Juliette Denis',
    youtubeId: 'h2mZTliVqaw',
    awards: ['Prix Unifrance du court métrage 2021'],
    soundTeam: [
      { role: 'Chef opérateur du son', name: 'Thomas Van Pottelberge', self: true },
      { role: 'Monteuse son', name: 'Caroline Reynaud' },
      { role: 'Mixeuse', name: 'Caroline Reynaud' },
    ],
    synopsis: {
      fr: "Julien prend ses fonctions dans un centre de protection maternelle et infantile d'un quartier difficile. Il est très vite confronté aux difficultés qui font le quotidien de l'équipe du centre. Lors de sa première consultation, il se retrouve face à Léa, tombée enceinte à la suite d'un viol.",
      en: "Julien starts a new job at a maternal and child health centre in a tough neighbourhood. He is quickly confronted with the daily difficulties faced by the centre's team. During his first consultation, he meets Léa, who became pregnant after being raped.",
    },
  },
  mamina: {
    title: 'Mamina',
    director: 'Massimo Riggi',
    youtubeId: 'RYC6htmfX3k',
    soundTeam: [
      { role: 'Chef opérateur du son', name: 'Thomas Gastinel' },
      { role: 'Monteur son', name: 'Thomas Van Pottelberge', self: true },
      { role: 'Mixeur', name: 'Matthieu Fraticelli' },
    ],
    synopsis: {
      fr: "Rosa, mère de cinq enfants mariée à un Sicilien acariâtre, régit son foyer dans un quotidien frénétique. Pour subvenir aux besoins de sa famille, elle souscrit en cachette des crédits — mais le poids de la dette finit par la plonger dans le déni et la solitude, jusqu'à ce que son fils Nino découvre un avis d'expulsion.",
      en: "Rosa, mother of five and married to a bad-tempered Sicilian, runs her household in a frantic daily grind. To provide for her family, she secretly takes out loans — but the weight of the debt drags her into denial and isolation, until her son Nino discovers an eviction notice.",
    },
  },
  apnees: {
    title: 'Apnées',
    director: 'Nicolas Panay',
    embedUrl: 'https://player.vimeo.com/video/912894747',
    soundTeam: [
      { role: 'Chef opérateur du son', name: 'Thomas Van Pottelberge', self: true },
      { role: 'Monteur son', name: 'Timothée Bost' },
      { role: 'Mixeur', name: 'Benjamin Lecuyer' },
    ],
    synopsis: {
      fr: "Pierre fait de son mieux pour gérer un chantier chaotique dont il a la responsabilité. Les corps s'épuisent sous des délais impossibles. Pourtant le chantier doit continuer, sans répit, et sans accident.",
      en: "Pierre does his best to manage a chaotic construction site he's responsible for. Bodies wear thin under impossible deadlines. Yet the site must keep going, without respite — and without accidents.",
    },
  },
  lovena: {
    title: 'Lovena',
    director: 'Olivier Sagne',
    youtubeId: 'sOaj4n1TYeE',
    soundTeam: [
      { role: 'Chef opérateur du son', name: 'Tanguy Lailler' },
      { role: 'Monteur son', name: 'Benoît Déchaut' },
      { role: 'Mixeur', name: 'Thomas Van Pottelberge', self: true },
    ],
    synopsis: {
      fr: "Lovena, treize ans, sans-papiers d'origine haïtienne, vient d'être sacrée championne d'échecs en Guyane. Son prochain rival fera le déplacement depuis le Brésil. La préparation de ce duel et une série d'événements inattendus vont la pousser dans ses derniers retranchements.",
      en: "Lovena, thirteen, an undocumented girl of Haitian origin, has just been crowned chess champion of French Guiana. Her next rival is coming all the way from Brazil. Preparing for this duel, and a series of unexpected events, will push her to her limits.",
    },
  },
  'les-eveillees': {
    title: 'Les Éveillées',
    director: 'Nina Bouchaud Cheval',
    youtubeId: 'LzOPrMA-ER4',
    awards: ['Talents en Court — FIFIB et Festival du film de Poitiers'],
    soundTeam: [
      { role: 'Chefs opérateurs du son', name: 'Benjamin Jaussaud, Alexandre Beullier' },
      { role: 'Monteur son', name: 'Thomas Van Pottelberge', self: true },
      { role: 'Mixeur', name: 'Matthieu Fraticelli' },
    ],
    synopsis: {
      fr: "Zoé, adolescente solitaire, échappe à une vie de famille difficile en passant du temps avec des gens du voyage qu'elle connaît depuis l'enfance. Quand son père meurt subitement, France, une jeune Gitane rebelle, l'entraîne sur la route pour veiller le corps ensemble selon les traditions roms.",
      en: "Zoé, a lonely teenager, escapes a difficult family life by spending time with travellers she has known since childhood. When her father suddenly dies, France, a young rebellious Romani girl, takes her on the road to keep vigil over the body together, according to Romani tradition.",
    },
  },
  'particules-fines': {
    title: 'Particules Fines',
    director: 'Anne-Claire Jaulin',
    pressUrl: 'https://www.apachesfilms.fr/films/particules-fines/',
    pressLabel: 'Voir la bande-annonce sur apachesfilms.fr ↗',
    soundTeam: [
      { role: 'Chef opérateur du son', name: 'Delphine Malaussena' },
      { role: 'Monteur son', name: 'Geoffrey Perrier' },
      { role: 'Mixeur', name: 'Thomas Van Pottelberge', self: true },
    ],
    synopsis: {
      fr: "Un pic de pollution aux particules fines a envahi Paris. Quand Louise, 8 ans, fait une crise d'asthme en jouant dans la cour de son école, Delphine se précipite pour la ramener à la maison. Inquiète pour la santé de sa fille, elle n'est pas prête à la laisser ressortir.",
      en: "A spike of fine-particle pollution has swept over Paris. When eight-year-old Louise has an asthma attack while playing in her school yard, Delphine rushes to bring her home. Worried about her daughter's health, she isn't ready to let her go back outside.",
    },
  },
  'jeune-fille-de-pierre': {
    title: 'Les extraordinaires mésaventures de la jeune fille de pierre',
    director: 'Gabriel Abrantes',
    youtubeId: 'w2sdQRVrPps',
    awards: ['Quinzaine des Réalisateurs — Festival de Cannes 2019'],
    soundTeam: [
      { role: 'Chefs opérateurs du son', name: 'Thomas Van Pottelberge, Philippe Deschamps', self: true },
      { role: 'Monteur son', name: 'Jules Jasko' },
      { role: 'Mixeur', name: 'Matthieu Deniau' },
    ],
    synopsis: {
      fr: "Une sculpture s'échappe du Louvre pour affronter la vraie vie dans les rues de Paris.",
      en: "A sculpture runs away from the Louvre to confront real life on the streets of Paris.",
    },
  },
  tigre: {
    title: 'Tigre',
    director: 'Delphine Deloget',
    embedUrl: 'https://player.vimeo.com/video/376883778',
    awards: ['Berlinale 2019 — sélection compétition', 'Prix Canal+ — Festival de Clermont-Ferrand', 'Meilleur court métrage — Festival de Moscou'],
    soundTeam: [
      { role: 'Chef opérateur du son', name: 'Pablo Salaün' },
      { role: 'Monteur son', name: 'Pablo Salaün' },
      { role: 'Mixeur', name: 'Thomas Van Pottelberge', self: true },
    ],
    synopsis: {
      fr: "Sabine et Natacha, 22 ans toutes les deux, vivent l'une en face de l'autre dans un coin isolé. Un jour, une occasion de partir se présente à Natacha, et sa trahison va se révéler fatale pour Sabine.",
      en: "Sabine and Natacha, both 22, live across from each other in a remote area. One day, Natacha gets a chance to leave — and her betrayal proves fatal for Sabine.",
    },
  },
  'dans-la-legende': {
    title: 'Dans la légende',
    director: 'Alexandre Pierrin',
    production: 'Nolita · Paramount+',
    format: '6×30 min',
    youtubeId: 'adUBqIjHyfs',
    soundTeam: [
      { role: 'Chef opérateur du son', name: 'Martin Lanot, Thomas Van Pottelberge', self: true },
      { role: 'Montage son et mixage', name: 'Thomas Van Pottelberge, Benjamin Lecuyer', self: true },
    ],
    synopsis: {
      fr: "Docusérie qui plonge dans le monde de l'esport professionnel, au plus près de joueurs et d'équipes lancés dans la course aux plus grands titres.",
      en: "A docuseries diving into the world of professional esports, following players and teams chasing the biggest titles.",
    },
  },
  'maintenant-ou-jamais': {
    title: 'Maintenant ou Jamais',
    director: 'Ousmane Ly',
    production: 'Fédérations · HBO',
    format: '5×35 min',
    youtubeId: 'MWEJwTdkI-k',
    soundTeam: [
      { role: 'Chef opérateur du son', name: 'Thomas Van Pottelberge, Nassim El Mounnabih, Jean Christophe Lion', self: true },
    ],
    synopsis: {
      fr: "Docusérie qui suit de jeunes footballeurs du club FC Montfermeil dans leur ascension vers le monde professionnel.",
      en: "A docuseries following young footballers from FC Montfermeil on their path toward professional football.",
    },
  },
  'napoleon-metternich': {
    title: "Napoléon Metternich, le commencement de la fin",
    director: 'Mathieu Schwartz, Christian Twente',
    production: 'ARTE · ZDF',
    format: '90 min',
    embedUrl: 'https://www.dailymotion.com/embed/video/x86rehv',
    soundTeam: [
      { role: 'Chef opérateur du son', name: 'Thomas Van Pottelberge', self: true },
      { role: 'Mixage', name: 'Mathieu Langlet' },
    ],
    synopsis: {
      fr: "Docu-fiction qui retrace l'affrontement entre Napoléon et le chancelier autrichien Metternich, dont l'issue scella le sort de l'Empire.",
      en: "A docu-drama retracing the confrontation between Napoleon and Austrian chancellor Metternich, whose outcome sealed the fate of the Empire.",
    },
  },
  'infrarouge-kourtrajme': {
    title: "Infrarouge - 365 jours à l'école Kourtrajme",
    director: 'Karima Hamzaoui, Ladj Ly',
    production: 'Lily Films · France Télévisions',
    format: '90 min',
    pressUrl: 'https://www.francetvpro.fr/contenu-de-presse/9190732',
    soundTeam: [
      { role: 'Montage son et mixage', name: 'Thomas Van Pottelberge', self: true },
    ],
    synopsis: {
      fr: "Une année dans l'école de cinéma gratuite fondée par Ladj Ly à Montfermeil, aux côtés d'élèves venus de tous horizons.",
      en: "A year inside the free film school founded by Ladj Ly in Montfermeil, alongside students from all walks of life.",
    },
  },
  'grands-mythes': {
    title: 'Les Grands Mythes — L\'Iliade et l\'Odyssée',
    director: 'Gaetan Chabanol, Nathalie Amsellem, Sylvain Bergère',
    production: 'ARTE · Les Monstres',
    format: 'Saison 1, 20×30 min',
    pressUrl: 'https://www.arte.tv/fr/videos/080116-011-A/les-grands-mythes-l-odyssee/',
    pressLabel: 'Voir la bande-annonce sur arte.tv ↗',
    pressImage: 'assets/wall/grands-mythes-still.jpg',
    soundTeam: [
      { role: 'Sound design', name: 'Thomas Van Pottelberge', self: true },
      { role: 'Mixage', name: 'Vincent Huré, Christophe Millet' },
    ],
    synopsis: {
      fr: "Série documentaire qui explore les grands mythes fondateurs, ici l'Iliade et l'Odyssée d'Homère, éclairée par des historiens et spécialistes.",
      en: "A documentary series exploring foundational myths — here, Homer's Iliad and Odyssey — with insight from historians and specialists.",
    },
  },
  gadjo: {
    title: 'Gadjo, un prince chez les Manouches',
    director: 'Flora Desprats',
    production: 'Silex Films · ARTE France',
    format: '90 min',
    youtubeId: 'AgmxKPY5Vak',
    awards: ['Étoile de la Scam 2015'],
    soundTeam: [
      { role: 'Chef opérateur du son', name: 'David Amsalem, Thomas Van Pottelberge, Jean Christophe Lion', self: true },
      { role: 'Montage son et mixage', name: 'Julie Tribout' },
    ],
    synopsis: {
      fr: "Immersion dans une famille manouche du sud de la France, entre transmission, traditions et vie quotidienne.",
      en: "An immersion into a Manouche family in the south of France, exploring tradition, transmission and everyday life.",
    },
  },
  'retour-nature-sauvage': {
    title: 'Le retour de la nature sauvage',
    production: 'ARTE France · Bonne Pioche',
    format: '3×52 min',
    youtubeId: 'hxPihLKXYfQ',
    soundTeam: [
      { role: 'Monteur son', name: 'Thomas Van Pottelberge', self: true },
    ],
    synopsis: {
      fr: "Documentaire consacré au retour de la nature sauvage, entre reconquête des espaces et cohabitation avec la faune.",
      en: "A documentary about the return of wilderness, exploring reclaimed landscapes and coexistence with wildlife.",
    },
  },
  'rhino-dollars': {
    title: 'Rhino Dollars',
    director: 'Olivia Mokiejewski',
    production: 'ARTE France',
    format: '90 min',
    youtubeId: 'iu-W09mkpkg',
    soundTeam: [
      { role: 'Chef opérateur du son et montage son', name: 'Thomas Van Pottelberge', self: true },
    ],
    synopsis: {
      fr: "Enquête sur le trafic international de cornes de rhinocéros, de l'Afrique du Sud jusqu'en Asie.",
      en: "An investigation into the international trafficking of rhino horns, from South Africa to Asia.",
    },
  },
  'demain-le-feu': {
    title: 'Demain le feu',
    director: 'Mehdi Meklat, Badroudine Saïd Abdallah',
    production: 'Autoproduit par les réalisateurs',
    youtubeId: 'yEEgO-9iTn4',
    soundTeam: [
      { role: 'Chef opérateur du son', name: 'Nassim El Mounabbih' },
      { role: 'Montage son et mixage', name: 'Thomas Van Pottelberge', self: true },
    ],
    synopsis: {
      fr: "Road-movie documentaire de Calais à Marseille, à la rencontre d'une jeunesse française en quête d'avenir.",
      en: "A documentary road movie from Calais to Marseille, meeting a French youth in search of a future.",
    },
  },
  'mensonges-histoire': {
    title: "Les Mensonges de l'Histoire — Le naufrage du Lusitania",
    production: 'Compagnie des Phares et Balises · RMC Découverte',
    youtubeId: 'mChWLIxhAko',
    soundTeam: [
      { role: 'Chef opérateur du son', name: 'Thomas Van Pottelberge', self: true },
    ],
    synopsis: {
      fr: "Cet épisode revient sur le naufrage du Lusitania en 1915 et les mensonges d'État qui ont entouré le drame.",
      en: "This episode revisits the 1915 sinking of the Lusitania and the state lies that surrounded the tragedy.",
    },
  },
  'chaleur-annees-froides': {
    title: 'À la chaleur des années froides',
    director: 'Darius Kaufmann, Eytan Jan',
    production: 'Amok Films · Temps Noir, avec la participation de Canal+',
    pressUrl: 'https://www.amokfilms.fr/in-the-heat-of-the-cold-years?lang=fr',
    pressLabel: 'Voir la bande-annonce sur amokfilms.fr ↗',
    pressImage: 'assets/wall/chaleur-annees-froides-still.jpg',
    soundTeam: [
      { role: 'Chef opérateur du son', name: 'Thomas Van Pottelberge', self: true },
      { role: 'Montage son et mixage', name: 'Mathieu Langlet' },
    ],
    synopsis: {
      fr: "Documentaire sur le cinéma cubain, ses artistes et la manière dont ils créent malgré les pénuries et la censure.",
      en: "A documentary about Cuban cinema, its artists, and how they create despite shortages and censorship.",
    },
  },
  yafrica: {
    title: "Y'Africa",
    director: 'Dan Assayag',
    youtubeId: 't4LKSFBX9h0',
    soundTeam: [
      { role: 'Chef opérateur du son (saison 1)', name: 'Thomas Van Pottelberge, Axel Guenoun', self: true },
      { role: 'Mixage (saison 1)', name: 'Thomas Van Pottelberge', self: true },
    ],
    synopsis: {
      fr: "Série documentaire qui explore les scènes musicales urbaines à travers le continent africain, ville par ville.",
      en: "A documentary series exploring urban music scenes across the African continent, city by city.",
    },
  },
  irmas: {
    title: 'Irmas',
    director: 'Caroline Duclert, Charles Guillemin',
    youtubeId: 'odEy0VfVAmo',
    soundTeam: [
      { role: 'Chef opérateur du son et montage son', name: 'Thomas Van Pottelberge', self: true },
    ],
    synopsis: {
      fr: "Portrait de jeunes religieuses au sein d'une congrégation, entre vie spirituelle et vie quotidienne, à travers le Brésil, la Tanzanie et les Philippines.",
      en: "A portrait of young nuns within a religious congregation, between spiritual life and everyday routine, across Brazil, Tanzania and the Philippines.",
    },
  },
  'odyssee-borgey': {
    title: "L'Odyssée des Borgey",
    director: 'Charles Guillemin',
    youtubeId: '9itSqVnkWjI',
    soundTeam: [
      { role: 'Chef opérateur du son et montage son', name: 'Thomas Van Pottelberge', self: true },
    ],
    synopsis: {
      fr: "Elsa et Frédéric Borgey quittent tout pour s'installer en Laponie et se consacrer à l'élevage et à la conduite de chiens de traîneau.",
      en: "Elsa and Frédéric Borgey leave everything behind to settle in Lapland and devote themselves to raising and driving sled dogs.",
    },
  },
};

const projectLightbox = document.getElementById('projectLightbox');
const projectLightboxIframe = document.getElementById('projectLightboxIframe');
const projectLightboxPress = document.getElementById('projectLightboxPress');
const projectLightboxClose = document.getElementById('projectLightboxClose');
const projectTitle = document.getElementById('projectTitle');
const projectMeta = document.getElementById('projectMeta');
const projectAwards = document.getElementById('projectAwards');
const projectAwardsList = document.getElementById('projectAwardsList');
const projectSynopsis = document.getElementById('projectSynopsis');
const projectSynopsisText = document.getElementById('projectSynopsisText');
const projectSoundTeam = document.getElementById('projectSoundTeam');
const projectSoundTeamList = document.getElementById('projectSoundTeamList');

function currentLang() {
  return document.documentElement.lang === 'en' ? 'en' : 'fr';
}

// Guards against a race between closing one fiche and opening the next:
// closeProjectLightbox() clears the iframe after its fade-out delay, and if
// a new fiche is opened while that delay is still pending, the stale
// cleanup used to fire afterwards and blank the freshly-set trailer (an
// empty iframe.src reloads the current page, which looked like "every
// trailer is broken"). Cancelling any pending close on open fixes it.
let projectLightboxCloseTimer = null;

function openProjectLightbox(slug) {
  const film = filmsData[slug];
  if (!film || !projectLightbox) return;

  if (projectLightboxCloseTimer) {
    window.clearTimeout(projectLightboxCloseTimer);
    projectLightboxCloseTimer = null;
  }

  const lang = currentLang();

  if (projectTitle) projectTitle.textContent = film.title || '';

  if (projectMeta) {
    projectMeta.innerHTML = '';
    const metaFields = [
      ['director', lang === 'en' ? 'Director' : 'Réalisateur·rice'],
      ['production', lang === 'en' ? 'Production' : 'Production'],
      ['format', lang === 'en' ? 'Format' : 'Format'],
      ['cast', lang === 'en' ? 'Cast' : 'Avec'],
    ];
    metaFields.forEach(([key, label]) => {
      if (!film[key]) return;
      const line = document.createElement('div');
      line.innerHTML = `<strong>${label} :</strong> ${film[key]}`;
      projectMeta.appendChild(line);
    });
  }

  if (film.awards && film.awards.length) {
    if (projectAwardsList) {
      projectAwardsList.innerHTML = '';
      film.awards.forEach((a) => {
        const li = document.createElement('li');
        li.textContent = a;
        projectAwardsList.appendChild(li);
      });
    }
    if (projectAwards) projectAwards.hidden = false;
  } else if (projectAwards) {
    projectAwards.hidden = true;
  }

  const synopsisText = film.synopsis ? film.synopsis[lang] || film.synopsis.fr : '';
  if (synopsisText) {
    if (projectSynopsisText) projectSynopsisText.textContent = synopsisText;
    if (projectSynopsis) projectSynopsis.hidden = false;
  } else if (projectSynopsis) {
    projectSynopsis.hidden = true;
  }

  if (film.soundTeam && film.soundTeam.length) {
    if (projectSoundTeamList) {
      projectSoundTeamList.innerHTML = '';
      film.soundTeam.forEach((member) => {
        const li = document.createElement('li');
        li.appendChild(document.createTextNode(`${member.role} : `));
        // Highlights Thomas's own name in gold within the name list (which
        // may also include collaborators) instead of just brightening the
        // whole line, so it reads the same way as the awards/production
        // credits elsewhere on the fiche.
        if (member.self && member.name.includes('Thomas Van Pottelberge')) {
          const parts = member.name.split('Thomas Van Pottelberge');
          parts.forEach((part, i) => {
            if (i > 0) {
              const self = document.createElement('span');
              self.className = 'project-lightbox__self';
              self.textContent = 'Thomas Van Pottelberge';
              li.appendChild(self);
            }
            li.appendChild(document.createTextNode(part));
          });
        } else {
          li.appendChild(document.createTextNode(member.name));
        }
        if (member.self) li.classList.add('is-self');
        projectSoundTeamList.appendChild(li);
      });
    }
    if (projectSoundTeam) projectSoundTeam.hidden = false;
  } else if (projectSoundTeam) {
    projectSoundTeam.hidden = true;
  }

  if (projectLightboxIframe) {
    // Most trailers are hosted on YouTube (youtubeId), but a handful live
    // elsewhere (e.g. Dailymotion) — those set embedUrl directly instead.
    const videoSrc = film.embedUrl
      ? film.embedUrl
      : film.youtubeId
      ? `https://www.youtube.com/embed/${film.youtubeId}?rel=0`
      : '';
    projectLightboxIframe.src = videoSrc;
    // No trailer to embed, but an external link exists (a press release, or
    // a site that blocks framing / doesn't host a shareable video) — show a
    // link to it instead of leaving the frame blank. (The CSS bug that used
    // to make this panel cover the iframe even when hidden is fixed now.)
    if (!videoSrc && film.pressUrl) {
      projectLightboxIframe.hidden = true;
      if (projectLightboxPress) {
        projectLightboxPress.href = film.pressUrl;
        // Use a dedicated still (film.pressImage) when set, otherwise fall
        // back to the film's own poster already on the page — so it reads
        // like a video thumbnail rather than a plain text box.
        const posterEl = document.querySelector(`img[data-film="${slug}"]`);
        const bgSrc = film.pressImage || (posterEl ? posterEl.src : '');
        projectLightboxPress.style.backgroundImage = bgSrc ? `url("${bgSrc}")` : '';
        const label = film.pressLabel || 'Voir le communiqué de presse ↗';
        projectLightboxPress.innerHTML = '';
        const labelSpan = document.createElement('span');
        labelSpan.className = 'project-lightbox__press__label';
        labelSpan.textContent = label;
        projectLightboxPress.appendChild(labelSpan);
        projectLightboxPress.hidden = false;
      }
    } else {
      projectLightboxIframe.hidden = false;
      if (projectLightboxPress) projectLightboxPress.hidden = true;
    }
  }

  projectLightbox.hidden = false;
  void projectLightbox.offsetWidth;
  projectLightbox.classList.add('is-visible');
  lockBodyScroll();
}

function closeProjectLightbox() {
  if (!projectLightbox) return;
  if (projectLightbox.classList.contains('is-visible')) unlockBodyScroll();
  projectLightbox.classList.remove('is-visible');
  if (projectLightboxCloseTimer) window.clearTimeout(projectLightboxCloseTimer);
  projectLightboxCloseTimer = window.setTimeout(() => {
    projectLightbox.hidden = true;
    if (projectLightboxIframe) projectLightboxIframe.src = '';
    projectLightboxCloseTimer = null;
  }, 300);
}

document.querySelectorAll('.poster-link').forEach((link) => {
  const slug = link.dataset.film;
  if (slug && filmsData[slug]) {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      openProjectLightbox(slug);
    });
    return;
  }
  const videoId = getYouTubeId(link.getAttribute('href') || '');
  if (!videoId) return; // non-YouTube links (Facebook, Arte...) keep their normal behaviour
  link.addEventListener('click', (e) => {
    e.preventDefault();
    openVideoLightbox(videoId);
  });
});

// Posters with no trailer link are bare <img> tags, not wrapped in a
// .poster-link — but they can still open a project fiche if they carry a
// data-film that's present in filmsData.
document.querySelectorAll('.poster-wall img[data-film]').forEach((img) => {
  if (img.closest('.poster-link')) return; // already handled above
  const slug = img.dataset.film;
  if (!slug || !filmsData[slug]) return;
  img.addEventListener('click', () => openProjectLightbox(slug));
});

if (videoLightboxClose) videoLightboxClose.addEventListener('click', closeVideoLightbox);
if (videoLightbox) {
  videoLightbox.addEventListener('click', (e) => {
    if (e.target === videoLightbox) closeVideoLightbox();
  });
}
if (projectLightboxClose) projectLightboxClose.addEventListener('click', closeProjectLightbox);
if (projectLightbox) {
  projectLightbox.addEventListener('click', (e) => {
    if (e.target === projectLightbox) closeProjectLightbox();
  });
}
document.addEventListener('keydown', (e) => {
  if (videoLightbox && !videoLightbox.hidden && e.key === 'Escape') closeVideoLightbox();
  if (projectLightbox && !projectLightbox.hidden && e.key === 'Escape') closeProjectLightbox();
});
