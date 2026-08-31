(() => {
  const header = document.querySelector('[data-header]');
  const menuToggle = document.querySelector('[data-menu-toggle]');
  const nav = document.querySelector('[data-nav]');
  const navLinks = nav ? nav.querySelectorAll('a') : [];
  const root = document.querySelector('[data-hero-root]');
  const hero = document.querySelector('.v3-hero');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const updateHeader = () => header?.classList.toggle('scrolled', window.scrollY > 18);
  updateHeader();
  window.addEventListener('scroll', updateHeader, { passive: true });

  const closeMenu = () => {
    if (!menuToggle || !nav) return;
    nav.classList.remove('open');
    menuToggle.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('menu-open');
  };

  if (menuToggle && nav) {
    menuToggle.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      menuToggle.setAttribute('aria-expanded', String(open));
      document.body.classList.toggle('menu-open', open);
    });
    navLinks.forEach(a => a.addEventListener('click', closeMenu));
    window.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
  }

  const reveals = document.querySelectorAll('.reveal');
  if (reduceMotion || !('IntersectionObserver' in window)) {
    reveals.forEach(el => el.classList.add('is-visible'));
  } else {
    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        obs.unobserve(entry.target);
      });
    }, { threshold: .12, rootMargin: '0px 0px -45px 0px' });
    reveals.forEach(el => observer.observe(el));
  }

  if (!reduceMotion && hero && root) {
    const applyScrollDepth = () => {
      const y = Math.min(window.scrollY, 900);
      root.style.setProperty('--scroll-depth', `${y * 0.035}px`);
    };
    applyScrollDepth();
    window.addEventListener('scroll', applyScrollDepth, { passive: true });
    hero.addEventListener('pointermove', e => {
      const r = hero.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * 100;
      const y = ((e.clientY - r.top) / r.height) * 100;
      root.style.setProperty('--mx', `${x}%`);
      root.style.setProperty('--my', `${y}%`);
      const px = ((x - 50) / 50) * 6;
      const py = ((y - 50) / 50) * 4;
      root.style.setProperty('--px', `${px}px`);
      root.style.setProperty('--py', `${py}px`);
    });
    hero.addEventListener('pointerleave', () => {
      root.style.setProperty('--mx', '50%');
      root.style.setProperty('--my', '30%');
      root.style.setProperty('--px', '0px');
      root.style.setProperty('--py', '0px');
    });
  }
})();
