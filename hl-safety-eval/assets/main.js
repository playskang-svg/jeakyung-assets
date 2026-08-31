// Client-side search + category filter for the main document grid.
// No framework, no build step — this ships as-is.
(function () {
  var search = document.getElementById('doc-search');
  var chips = document.querySelectorAll('.filter-chip');
  var categoryBlocks = document.querySelectorAll('.doc-category');

  var activeFilter = 'all';
  var query = '';

  function apply() {
    categoryBlocks.forEach(function (block) {
      var heading = block.querySelector('h3');
      var isMaster = heading && heading.textContent.indexOf('마스터') !== -1;
      var matchesFilter = activeFilter === 'all' || isMaster ||
        (heading && heading.textContent.indexOf(activeFilter) === 0);

      var cards = block.querySelectorAll('.doc-card');
      var visibleCount = 0;
      cards.forEach(function (card) {
        var text = card.textContent.toLowerCase();
        var matchesQuery = !query || text.indexOf(query) !== -1;
        var show = matchesFilter && matchesQuery;
        card.style.display = show ? '' : 'none';
        if (show) visibleCount++;
      });
      block.style.display = matchesFilter && visibleCount > 0 ? '' : 'none';
    });
  }

  if (search) {
    search.addEventListener('input', function () {
      query = search.value.trim().toLowerCase();
      apply();
    });
  }

  chips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      chips.forEach(function (c) { c.classList.remove('active'); });
      chip.classList.add('active');
      activeFilter = chip.getAttribute('data-filter');
      apply();
    });
  });
})();
