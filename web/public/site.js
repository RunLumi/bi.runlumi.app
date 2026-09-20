/* Progressive enhancement only. No analytics, storage, API requests, or customer data. */
(() => {
  const header = document.querySelector('.header-inner');
  const toggle = document.querySelector('.menu-toggle');
  const navigation = document.querySelector('#site-nav');
  if (header && toggle instanceof HTMLButtonElement && navigation) {
    header.setAttribute('data-nav-enhanced', '');
    toggle.hidden = false;
    const setOpen = (open, returnFocus = false) => {
      header.toggleAttribute('data-nav-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      if (returnFocus) toggle.focus();
    };
    toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
    navigation.addEventListener('click', event => {
      if (event.target instanceof Element && event.target.closest('a')) setOpen(false);
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') setOpen(false, true);
    });
    document.addEventListener('click', event => {
      if (event.target instanceof Node && !header.contains(event.target)) setOpen(false);
    });
    matchMedia('(max-width: 760px)').addEventListener('change', () => setOpen(false));
  }

  document.querySelectorAll('[data-preview]').forEach(preview => {
    const tablist = preview.querySelector('[data-tabs]');
    const content = preview.querySelector('.preview-content');
    const tabs = Array.from(preview.querySelectorAll('[data-tab]'));
    const panels = Array.from(preview.querySelectorAll('[data-panel]'));
    if (!tablist || !content || !tabs.length || tabs.length !== panels.length) return;
    const orientation = matchMedia('(max-width: 900px)');
    const updateOrientation = () => tablist.setAttribute('aria-orientation', orientation.matches ? 'horizontal' : 'vertical');
    tablist.setAttribute('role', 'tablist');
    updateOrientation();
    orientation.addEventListener('change', updateOrientation);
    content.setAttribute('data-enhanced', '');
    const activate = (key, focus = false) => {
      if (!tabs.some(tab => tab.getAttribute('data-tab') === key)) return;
      tabs.forEach(tab => {
        const selected = tab.getAttribute('data-tab') === key;
        tab.setAttribute('role', 'tab');
        tab.setAttribute('aria-selected', String(selected));
        tab.setAttribute('aria-controls', `demo-${tab.getAttribute('data-tab')}`);
        tab.setAttribute('tabindex', selected ? '0' : '-1');
        if (selected && focus && tab instanceof HTMLElement) tab.focus();
      });
      panels.forEach(panel => {
        const id = panel.getAttribute('data-panel');
        panel.setAttribute('role', 'tabpanel');
        panel.setAttribute('aria-labelledby', `tab-${id}`);
        panel.setAttribute('tabindex', '0');
        if (panel instanceof HTMLElement) panel.hidden = id !== key;
      });
    };
    tabs.forEach((tab, index) => {
      tab.addEventListener('click', event => {
        event.preventDefault();
        activate(tab.getAttribute('data-tab'));
      });
      tab.addEventListener('keydown', event => {
        const nextKeys = orientation.matches ? ['ArrowRight'] : ['ArrowDown'];
        const previousKeys = orientation.matches ? ['ArrowLeft'] : ['ArrowUp'];
        let next = index;
        if (nextKeys.includes(event.key)) next = (index + 1) % tabs.length;
        else if (previousKeys.includes(event.key)) next = (index - 1 + tabs.length) % tabs.length;
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = tabs.length - 1;
        else return;
        event.preventDefault();
        activate(tabs[next].getAttribute('data-tab'), true);
      });
    });
    const activateHash = () => {
      const key = location.hash.replace('#demo-', '');
      if (tabs.some(tab => tab.getAttribute('data-tab') === key)) activate(key);
    };
    activate('money');
    activateHash();
    window.addEventListener('hashchange', activateHash);
  });

  document.querySelectorAll('[data-copy-email]').forEach(button => {
    if (!(button instanceof HTMLButtonElement)) return;
    button.hidden = false;
    button.addEventListener('click', async () => {
      const status = button.parentElement?.querySelector('.copy-status');
      const email = button.getAttribute('data-copy-email');
      if (!status || !email) return;
      try {
        if (!navigator.clipboard) throw new Error('Clipboard unavailable');
        await navigator.clipboard.writeText(email);
        status.textContent = 'Đã sao chép email.';
      } catch {
        status.textContent = 'Chưa sao chép được. Hãy chọn địa chỉ email bên cạnh.';
      }
    });
  });
})();
