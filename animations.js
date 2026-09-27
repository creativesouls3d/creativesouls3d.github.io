/* ==========================================================================
   CREATIVE SOULS 3D - ANIMATION ENGINE
   Scroll reveals, hero entrance, floating particles, micro-interactions
   ========================================================================== */

(function () {
  'use strict';

  /* ── 1. SCROLL REVEAL (IntersectionObserver) ─────────────────────────── */
  function initScrollReveal() {
    const revealEls = document.querySelectorAll(
      '.reveal, .hero-content, .section-heading, .app-promo, footer'
    );

    if (!revealEls.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );

    revealEls.forEach((el) => observer.observe(el));
  }

  /* ── 2. STAGGERED PRODUCT CARD ENTRANCE ─────────────────────────────── */
  function initProductCardAnimations() {
    const grid = document.getElementById('product-list');
    if (!grid) return;

    const cardObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('card-visible');
            cardObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: '0px 0px -20px 0px' }
    );

    // Observe existing cards
    function observeCards() {
      const cards = grid.querySelectorAll('.product-card:not(.card-observed)');
      cards.forEach((card, i) => {
        card.classList.add('card-observed', 'card-hidden');
        card.style.setProperty('--card-delay', `${i * 60}ms`);
        cardObserver.observe(card);
      });
    }

    observeCards();

    // Re-observe when new cards are added (infinite scroll / filter)
    const mutationObserver = new MutationObserver(() => observeCards());
    mutationObserver.observe(grid, { childList: true });
  }

  /* ── 3. HERO SECTION ENTRANCE ────────────────────────────────────────── */
  function initHeroEntrance() {
    const hero = document.querySelector('.hero');
    if (!hero) return;
    hero.classList.add('hero-animate');

    const eyebrow = hero.querySelector('.eyebrow');
    const h1 = hero.querySelector('h1');
    const p = hero.querySelector('p');
    const actions = hero.querySelector('.hero-actions');
    const badges = hero.querySelector('.hero-badges');

    [eyebrow, h1, p, badges, actions].forEach((el, i) => {
      if (!el) return;
      el.style.setProperty('--hero-child-delay', `${i * 100 + 80}ms`);
      el.classList.add('hero-child-fade');
    });
  }

  /* ── 4. FLOATING PARTICLES IN HERO ──────────────────────────────────── */
  function initHeroParticles() {
    const hero = document.querySelector('.hero');
    if (!hero) return;

    const canvas = document.createElement('canvas');
    canvas.className = 'hero-particles';
    canvas.setAttribute('aria-hidden', 'true');
    hero.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    let W, H, particles, raf;

    function resize() {
      W = canvas.width = hero.offsetWidth;
      H = canvas.height = hero.offsetHeight;
    }

    function createParticles() {
      particles = Array.from({ length: 28 }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        r: Math.random() * 2.2 + 0.5,
        dx: (Math.random() - 0.5) * 0.4,
        dy: -(Math.random() * 0.5 + 0.15),
        alpha: Math.random() * 0.5 + 0.15,
        hue: Math.random() > 0.5 ? 38 : 220, // amber or blue
      }));
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      particles.forEach((p) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 100%, 65%, ${p.alpha})`;
        ctx.fill();

        p.x += p.dx;
        p.y += p.dy;
        if (p.y < -4) { p.y = H + 4; p.x = Math.random() * W; }
        if (p.x < -4) p.x = W + 4;
        if (p.x > W + 4) p.x = -4;
      });
      raf = requestAnimationFrame(draw);
    }

    resize();
    createParticles();
    draw();

    window.addEventListener('resize', () => {
      resize();
      createParticles();
    });

    // Pause when hero is not visible
    const visObs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { if (!raf) raf = requestAnimationFrame(draw); }
      else { cancelAnimationFrame(raf); raf = null; }
    });
    visObs.observe(hero);
  }

  /* ── 5. FILTER BUTTON ACTIVE RIPPLE ─────────────────────────────────── */
  function initFilterRipple() {
    const filters = document.querySelector('.filters');
    if (!filters) return;

    filters.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;

      const ripple = document.createElement('span');
      ripple.className = 'filter-ripple';
      const rect = btn.getBoundingClientRect();
      ripple.style.width = ripple.style.height = Math.max(rect.width, rect.height) + 'px';
      ripple.style.left = (e.clientX - rect.left - rect.width / 2) + 'px';
      ripple.style.top = (e.clientY - rect.top - rect.height / 2) + 'px';
      btn.appendChild(ripple);
      ripple.addEventListener('animationend', () => ripple.remove());
    });
  }

  /* ── 6. ADD-TO-CART BOUNCE ───────────────────────────────────────────── */
  function initCartBounce() {
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.add-card-btn');
      if (!btn) return;
      btn.classList.remove('cart-bounce');
      void btn.offsetWidth; // reflow
      btn.classList.add('cart-bounce');
      btn.addEventListener('animationend', () => btn.classList.remove('cart-bounce'), { once: true });
    });
  }

  /* ── 7. HEADER SCROLL SHADOW ─────────────────────────────────────────── */
  function initHeaderScroll() {
    const header = document.querySelector('.site-header');
    if (!header) return;
    let ticking = false;

    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          header.classList.toggle('header-scrolled', window.scrollY > 20);
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });
  }

  /* ── 8. CATEGORY FILTER SLIDE-IN ─────────────────────────────────────── */
  function initFilterSlide() {
    const filterBtns = document.querySelectorAll('.filters button');
    filterBtns.forEach((btn, i) => {
      btn.style.setProperty('--filter-delay', `${i * 40}ms`);
      btn.classList.add('filter-slide-in');
    });
  }

  /* ── 9. SMOOTH PAGE TRANSITION OUT ──────────────────────────────────── */
  function initPageTransitions() {
    // When browser restores page from bfcache (back/forward), strip page-exit immediately
    window.addEventListener('pageshow', (e) => {
      document.body.classList.remove('page-exit');
      // Force opacity reset in case bfcache restored a mid-exit state
      document.body.style.opacity = '';
      document.body.style.transform = '';
    });

    // Also handle popstate (history back/forward via JS)
    window.addEventListener('popstate', () => {
      document.body.classList.remove('page-exit');
      document.body.style.opacity = '';
    });

    document.addEventListener('click', (e) => {
      const anchor = e.target.closest('a[href]');
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('http') ||
          href.startsWith('mailto') || anchor.hasAttribute('download')) return;

      e.preventDefault();
      document.body.classList.add('page-exit');
      setTimeout(() => { window.location.href = href; }, 220);
    });
  }

  /* ── 10. LOGO PULSE ON LOAD ──────────────────────────────────────────── */
  function initLogoPulse() {
    const logo = document.querySelector('.logo-section img');
    if (!logo) return;
    logo.classList.add('logo-pulse');
  }

  /* ── 11. APP PROMO FLOAT ─────────────────────────────────────────────── */
  function initAppPromoFloat() {
    const promo = document.querySelector('.app-promo');
    if (!promo) return;
    promo.classList.add('promo-float');
  }

  /* ── 12. TOP BANNER SHIMMER ──────────────────────────────────────────── */
  function initBannerShimmer() {
    const banner = document.querySelector('.top-download-banner');
    if (!banner) return;
    banner.classList.add('banner-shimmer');
  }

  /* ── INIT ALL ─────────────────────────────────────────────────────────── */
  function init() {
    initHeroEntrance();
    initHeroParticles();
    initScrollReveal();
    initProductCardAnimations();
    initFilterRipple();
    initCartBounce();
    initHeaderScroll();
    initFilterSlide();
    initPageTransitions();
    initLogoPulse();
    initAppPromoFloat();
    initBannerShimmer();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
