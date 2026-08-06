
document.addEventListener('DOMContentLoaded', function () {
  /* mobile nav */
  var toggle = document.getElementById('navToggle');
  var nav = document.getElementById('mainNav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () { nav.classList.toggle('open'); });
  }

  /* header shrink on scroll */
  var header = document.getElementById('siteHeader');
  if (header) {
    window.addEventListener('scroll', function () {
      header.classList.toggle('scrolled', window.scrollY > 12);
    }, { passive: true });
  }

  /* trailing cursor ring (desktop only) */
  var ring = document.getElementById('cursorRing');
  if (ring && window.matchMedia('(pointer: fine)').matches) {
    var rx = 0, ry = 0, mx = 0, my = 0;
    document.addEventListener('mousemove', function (e) { mx = e.clientX; my = e.clientY; });
    function loop() {
      rx += (mx - rx) * 0.18;
      ry += (my - ry) * 0.18;
      ring.style.left = rx + 'px';
      ring.style.top = ry + 'px';
      requestAnimationFrame(loop);
    }
    loop();
    var hoverables = document.querySelectorAll('a, button, .tool-card, .category-card');
    hoverables.forEach(function (el) {
      el.addEventListener('mouseenter', function () { ring.classList.add('hover'); });
      el.addEventListener('mouseleave', function () { ring.classList.remove('hover'); });
    });
  }

  /* magnetic buttons */
  document.querySelectorAll('.magnetic').forEach(function (el) {
    el.addEventListener('mousemove', function (e) {
      var r = el.getBoundingClientRect();
      var x = e.clientX - r.left - r.width / 2;
      var y = e.clientY - r.top - r.height / 2;
      el.style.transform = 'translate(' + (x * 0.25) + 'px,' + (y * 0.35) + 'px)';
    });
    el.addEventListener('mouseleave', function () { el.style.transform = 'translate(0,0)'; });
  });

  /* card tilt */
  document.querySelectorAll('.tilt').forEach(function (el) {
    el.addEventListener('mousemove', function (e) {
      var r = el.getBoundingClientRect();
      var px = (e.clientX - r.left) / r.width - 0.5;
      var py = (e.clientY - r.top) / r.height - 0.5;
      el.style.transform = 'perspective(800px) rotateX(' + (py * -6) + 'deg) rotateY(' + (px * 6) + 'deg) translateY(-4px)';
    });
    el.addEventListener('mouseleave', function () { el.style.transform = ''; });
  });

  /* scroll reveal */
  var revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('in-view'); });
  }

  /* animated counters */
  var counters = document.querySelectorAll('.counter');
  if (counters.length && 'IntersectionObserver' in window) {
    var counted = new WeakSet();
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting && !counted.has(entry.target)) {
          counted.add(entry.target);
          var el = entry.target;
          var target = parseInt(el.dataset.target, 10) || 0;
          var start = performance.now();
          var duration = 1100;
          function tick(now) {
            var p = Math.min((now - start) / duration, 1);
            var eased = 1 - Math.pow(1 - p, 3);
            el.textContent = Math.round(eased * target);
            if (p < 1) requestAnimationFrame(tick);
          }
          requestAnimationFrame(tick);
          cio.unobserve(el);
        }
      });
    }, { threshold: 0.4 });
    counters.forEach(function (el) { cio.observe(el); });
  }

  /* tool search + category filter (all-tools page) */
  var grid = document.getElementById('toolGrid');
  if (grid) {
    var cards = Array.prototype.slice.call(grid.querySelectorAll('.tool-card'));
    var searchInput = document.getElementById('toolSearch');
    var filterBtns = Array.prototype.slice.call(document.querySelectorAll('.filter-btn'));
    var noResults = document.getElementById('noResults');
    var activeFilter = 'all';

    var params = new URLSearchParams(window.location.search);
    if (params.get('q') && searchInput) { searchInput.value = params.get('q'); }

    function applyFilters() {
      var q = (searchInput ? searchInput.value : '').toLowerCase().trim();
      var visible = 0;
      cards.forEach(function (card) {
        var matchesCategory = activeFilter === 'all' || card.dataset.category === activeFilter;
        var matchesSearch = !q || card.dataset.name.indexOf(q) !== -1;
        var show = matchesCategory && matchesSearch;
        card.style.display = show ? '' : 'none';
        if (show) visible++;
      });
      if (noResults) { noResults.style.display = visible === 0 ? 'block' : 'none'; }
    }

    filterBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        filterBtns.forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        activeFilter = btn.dataset.filter;
        applyFilters();
      });
    });

    if (searchInput) { searchInput.addEventListener('input', applyFilters); }
    applyFilters();
  }
});
