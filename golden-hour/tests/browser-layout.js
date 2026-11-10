/* Browser-console expression; run once per emulated color theme at 240 x 282.
   Returns one row per screen state. A row with pageFits false is an overflow. */
(() => {
  const $ = id => document.getElementById(id), C = window.GoldenHourCore, rows = [];
  const pageFits = () => document.documentElement.scrollWidth <= 240 && document.documentElement.scrollHeight <= 282;
  const box = el => el.getBoundingClientRect();
  const inside = (el, x, y, w, h) => { const r = box(el); return r.left >= x - 0.5 && r.right <= x + w + 0.5 && r.top >= y - 0.5 && r.bottom <= y + h + 0.5; };
  const controlsInside = root => [...root.querySelectorAll('button')].every(button => inside(button, 0, 0, 240, 282));
  const noHorizontalScroll = el => el.scrollWidth <= el.clientWidth + 1;
  const visibleRowsInside = () => {
    const list = $('day-list'), lr = box(list);
    // Rows scroll inside the list, so only horizontal containment and text fit are checked.
    return [...list.querySelectorAll('.day-row')].every(row => {
      const r = box(row);
      return r.left >= lr.left - 0.5 && r.right <= lr.right + 0.5 && row.scrollWidth <= row.clientWidth + 1;
    });
  };
  const selectPlace = id => { $('places-open').click(); $('place-' + id).click(); };

  for (const location of C.LOCATIONS) {
    selectPlace(location.id);
    for (let index = 0; index < C.DAY_COUNT; index++) {
      $('day-list').scrollTop = 0;
      const row = $('day-' + index);
      row.click();
      row.scrollIntoView({ block: 'center' });
      rows.push({
        location: location.id, day: index,
        pageFits: pageFits(),
        headerFits: inside($('app').querySelector('header'), 0, 0, 240, 282),
        listFits: inside($('day-list'), 0, 0, 240, 282) && noHorizontalScroll($('day-list')),
        detailFits: inside($('detail'), 0, 0, 240, 282) && noHorizontalScroll($('detail')),
        footerFits: inside($('app').querySelector('footer'), 0, 0, 240, 282),
        controlsInside: controlsInside($('app')),
        rowsInside: visibleRowsInside()
      });
    }
    // Day card overlay for the first and last day of this location.
    for (const index of [0, C.DAY_COUNT - 1]) {
      $('day-' + index).click();
      $('day-' + index).dispatchEvent(new Event('sideClick'));
      rows.push({
        location: location.id, day: index, overlay: 'day-card',
        pageFits: pageFits(),
        cardFits: inside($('card-title'), 0, 0, 240, 282) && inside($('card-blue-pm'), 0, 0, 240, 282),
        controlsInside: controlsInside($('day-card')),
        noHorizontalScroll: noHorizontalScroll($('day-card'))
      });
      $('card-close').click();
    }
  }
  // Location picker overlay.
  $('places-open').click();
  rows.push({
    overlay: 'places',
    pageFits: pageFits(),
    listFits: inside($('place-list'), 0, 0, 240, 282) && noHorizontalScroll($('place-list')),
    lastButtonFits: inside($('exit'), 0, 0, 240, 282),
    controlsInside: controlsInside($('places')),
    noHorizontalScroll: noHorizontalScroll($('places'))
  });
  $('places-close').click();
  return rows;
})();
