/* Progressive enhancement only: no data fetching, tracking, LLM calls or storage. */
(() => {
  const root = document.querySelector('[data-demo]');
  const tabs = Array.from(root?.querySelectorAll('[data-demo-tab]') || []);
  const panels = Array.from(root?.querySelectorAll('[data-demo-panel]') || []);
  let selectScenario = null;

  if (root && tabs.length === panels.length && tabs.length > 0 && tabs.every(tab => panels.some(panel => panel.dataset.demoPanel === tab.dataset.demoTab))) {
    const nav = root.querySelector('[data-demo-tabs]');
    nav.setAttribute('role', 'tablist');
    nav.setAttribute('aria-label', 'Chọn tình huống minh họa');
    tabs.forEach(tab => {
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-controls', `demo-${tab.dataset.demoTab}`);
    });
    panels.forEach(panel => {
      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-labelledby', `tab-${panel.dataset.demoPanel}`);
      panel.tabIndex = 0;
    });
    // CSS stacks tabs on phone and desktop; only the tablet row is horizontal.
    const horizontalTabs = matchMedia('(min-width: 760px) and (max-width: 999px)');
    const syncOrientation = () => nav.setAttribute('aria-orientation', horizontalTabs.matches ? 'horizontal' : 'vertical');
    syncOrientation();
    horizontalTabs.addEventListener('change', syncOrientation);
    selectScenario = (id, focus = false) => {
      const selected = tabs.find(tab => tab.dataset.demoTab === id);
      if (!selected) return;
      tabs.forEach(tab => {
        const active = tab === selected;
        tab.setAttribute('aria-selected', String(active));
        tab.tabIndex = active ? 0 : -1;
      });
      panels.forEach(panel => { panel.hidden = panel.dataset.demoPanel !== id; });
      if (focus) selected.focus({ preventScroll: true });
    };
    tabs.forEach((tab, index) => {
      tab.addEventListener('click', event => {
        event.preventDefault();
        selectScenario(tab.dataset.demoTab);
        // A selected scenario is linkable; replacing state avoids trapping Back.
        history.replaceState(null, '', `#demo-${tab.dataset.demoTab}`);
      });
      tab.addEventListener('keydown', event => {
        const vertical = nav.getAttribute('aria-orientation') === 'vertical';
        const nextKey = vertical ? 'ArrowDown' : 'ArrowRight';
        const previousKey = vertical ? 'ArrowUp' : 'ArrowLeft';
        let next;
        if (event.key === nextKey) next = (index + 1) % tabs.length;
        else if (event.key === previousKey) next = (index - 1 + tabs.length) % tabs.length;
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = tabs.length - 1;
        else if (event.key === ' ') { event.preventDefault(); selectScenario(tab.dataset.demoTab); return; }
        else return;
        event.preventDefault();
        selectScenario(tabs[next].dataset.demoTab, true);
      });
    });
    const fromHash = () => {
      const id = location.hash.replace('#demo-', '');
      if (tabs.some(tab => tab.dataset.demoTab === id)) selectScenario(id);
    };
    selectScenario(tabs[0].dataset.demoTab);
    fromHash();
    window.addEventListener('hashchange', fromHash);
    document.querySelectorAll('[data-select-scenario]').forEach(link => link.addEventListener('click', () => {
      selectScenario(link.dataset.selectScenario);
      document.getElementById(`demo-${link.dataset.selectScenario}`)?.focus({ preventScroll: true });
    }));
  }

  document.querySelectorAll('[data-mobile-nav]').forEach(menu => {
    menu.querySelectorAll('a').forEach(link => link.addEventListener('click', () => { menu.open = false; }));
    menu.addEventListener('keydown', event => {
      if (event.key === 'Escape' && menu.open) { menu.open = false; menu.querySelector('summary').focus(); }
    });
    document.addEventListener('click', event => { if (menu.open && !menu.contains(event.target)) menu.open = false; });
  });

  const copy = document.querySelector('[data-copy-email]');
  const status = document.querySelector('[data-copy-status]');
  if (copy && status && window.isSecureContext && navigator.clipboard?.writeText) {
    copy.hidden = false;
    copy.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(copy.dataset.copyEmail); status.textContent = 'Đã sao chép địa chỉ email.'; }
      catch { status.textContent = 'Chưa sao chép được. Bạn có thể chọn địa chỉ email ở trên.'; }
    });
  }
})();
