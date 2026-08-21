
(function () {
  const MAX_TOOLS = 3;
  const catSelect = document.getElementById('compareCategory');
  const toolsField = document.getElementById('compareToolsField');
  const toolsGrid = document.getElementById('compareToolsGrid');
  const countLabel = document.getElementById('compareCount');
  const emptyState = document.getElementById('compareEmpty');
  const resultsEl = document.getElementById('compareResults');

  COMPARE_CATEGORIES.forEach(function (c) {
    const opt = document.createElement('option');
    opt.value = c.slug;
    opt.textContent = c.name;
    catSelect.appendChild(opt);
  });

  function selectedSlugs() {
    return Array.from(toolsGrid.querySelectorAll('input[type="checkbox"]:checked')).map(function (cb) { return cb.value; });
  }

  function updateCheckboxState() {
    const chosen = selectedSlugs();
    countLabel.textContent = chosen.length + ' / ' + MAX_TOOLS + ' selected';
    toolsGrid.querySelectorAll('input[type="checkbox"]').forEach(function (cb) {
      if (!cb.checked) cb.disabled = chosen.length >= MAX_TOOLS;
    });
    renderResults(chosen);
    updateUrl();
  }

  function updateUrl() {
    const chosen = selectedSlugs();
    const params = new URLSearchParams();
    if (catSelect.value) params.set('category', catSelect.value);
    if (chosen.length) params.set('tools', chosen.join(','));
    const qs = params.toString();
    history.replaceState(null, '', qs ? ('?' + qs) : location.pathname);
  }

  function renderToolsGrid(catSlug, preselect) {
    toolsGrid.innerHTML = '';
    const tools = COMPARE_TOOLS_BY_CATEGORY[catSlug] || [];
    tools.forEach(function (t) {
      const label = document.createElement('label');
      label.className = 'compare-chip';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = t.slug;
      if (preselect && preselect.indexOf(t.slug) !== -1) cb.checked = true;
      cb.addEventListener('change', updateCheckboxState);
      const span = document.createElement('span');
      span.textContent = t.name;
      label.appendChild(cb);
      label.appendChild(span);
      toolsGrid.appendChild(label);
    });
    toolsField.style.display = tools.length ? '' : 'none';
    updateCheckboxState();
  }

  function cheapestIndex(tools) {
    // best-effort: find first tool whose pricing text contains "Free" as a hint, else -1
    let idx = tools.findIndex(function (t) { return /free/i.test(t.pricing); });
    return idx;
  }

  function mostFeaturesIndex(tools) {
    let best = 0;
    tools.forEach(function (t, i) { if ((t.features || []).length > (tools[best].features || []).length) best = i; });
    return best;
  }

  function renderResults(slugs) {
    if (slugs.length < 2) {
      resultsEl.style.display = 'none';
      emptyState.style.display = '';
      emptyState.textContent = slugs.length === 1
        ? 'Pick at least one more tool (up to 3 total) to see a comparison.'
        : (catSelect.value ? 'Pick 2 or 3 tools above to compare.' : 'Select a category to get started.');
      return;
    }
    emptyState.style.display = 'none';
    resultsEl.style.display = '';
    const tools = COMPARE_TOOLS_BY_CATEGORY[catSelect.value].filter(function (t) { return slugs.indexOf(t.slug) !== -1; });
    const freeIdx = cheapestIndex(tools);
    const featIdx = mostFeaturesIndex(tools);

    const headerCells = tools.map(function (t) { return '<th>' + t.name + (t === tools[freeIdx] ? ' <span class="hl-badge">Has free tier</span>' : '') + '</th>'; }).join('');

    function row(label, getter) {
      return '<tr><td>' + label + '</td>' + tools.map(function (t) { return '<td>' + (getter(t) || '&mdash;') + '</td>'; }).join('') + '</tr>';
    }
    function listRow(label, key) {
      return '<tr><td>' + label + '</td>' + tools.map(function (t) {
        const items = t[key] || [];
        return '<td>' + (items.length ? ('<ul class="compare-list">' + items.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul>') : '&mdash;') + '</td>';
      }).join('') + '</tr>';
    }

    const tableHtml = '<div class="table-wrap"><table class="compare-table">' +
      '<thead><tr><th>Tool</th>' + headerCells + '</tr></thead><tbody>' +
      row('Tagline', function (t) { return t.tagline; }) +
      row('Pricing', function (t) { return t.pricing; }) +
      row('Rating', function (t) { return t.rating; }) +
      listRow('Key features', 'features') +
      listRow('Pros', 'pros') +
      listRow('Cons', 'cons') +
      row('Best for', function (t) { return t.best_for; }) +
      '<tr><td>Links</td>' + tools.map(function (t) {
        return '<td><a class="text-link" href="tools/' + t.slug + '.html">Full review &rarr;</a><br><a class="text-link" href="' + t.url + '" target="_blank" rel="noopener sponsored">Visit website &rarr;</a></td>';
      }).join('') + '</tr>' +
      '</tbody></table></div>';

    const note = tools[featIdx] ? ('<p class="muted small compare-hint">Based on the info listed here, <strong>' + tools[featIdx].name + '</strong> lists the most features among your selection' + (freeIdx !== -1 ? (', and <strong>' + tools[freeIdx].name + '</strong> is the one with a free tier') : '') + ' &mdash; but the right pick depends on your specific use case.</p>') : '';

    resultsEl.innerHTML = '<h2 class="reveal">Your comparison</h2>' + tableHtml + note;
  }

  catSelect.addEventListener('change', function () {
    renderToolsGrid(catSelect.value, null);
  });

  // Pre-fill from URL query params for shareable links
  const params = new URLSearchParams(location.search);
  const initialCat = params.get('category');
  const initialTools = (params.get('tools') || '').split(',').filter(Boolean);
  if (initialCat && COMPARE_TOOLS_BY_CATEGORY[initialCat]) {
    catSelect.value = initialCat;
    renderToolsGrid(initialCat, initialTools);
  }
})();
