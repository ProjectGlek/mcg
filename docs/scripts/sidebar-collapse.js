(() => {
  const collapsedGroups = new Set();
  const initializedGroups = new Set();
  let sidebarObserver;

  function renderGroup(item, button) {
    const collapsed = collapsedGroups.has(button.dataset.groupKey);
    item.classList.toggle('is-collapsed', collapsed);
    button.setAttribute('aria-expanded', String(!collapsed));
    button.setAttribute('aria-label', collapsed ? 'Развернуть раздел' : 'Свернуть раздел');
  }

  function updateSidebar() {
    const nav = document.querySelector('.sidebar-nav');
    if (!nav) {
      if (!sidebarObserver) {
        sidebarObserver = new MutationObserver(() => {
          if (document.querySelector('.sidebar-nav')) {
            sidebarObserver.disconnect();
            sidebarObserver = undefined;
            updateSidebar();
          }
        });
        sidebarObserver.observe(document.body, { childList: true, subtree: true });
      }
      return;
    }

    nav.querySelectorAll('li').forEach((item) => {
      const link = item.querySelector(':scope > a');
      const children = item.querySelector(':scope > ul');
      if (!link || !children) return;

      let button = item.querySelector(':scope > .sidebar-collapse-toggle');
      if (!button) {
        const groupKey = link.getAttribute('href') || link.textContent.trim();
        if (!initializedGroups.has(groupKey)) {
          collapsedGroups.add(groupKey);
          initializedGroups.add(groupKey);
        }
        button = document.createElement('button');
        button.type = 'button';
        button.className = 'sidebar-collapse-toggle';
        button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 9.5 12 14.5 17 9.5"></path></svg>';
        button.dataset.groupKey = groupKey;
        item.insertBefore(button, children);
      }
      renderGroup(item, button);
    });
  }

  document.addEventListener('click', (event) => {
    const button = event.target.closest('.sidebar-collapse-toggle');
    if (!button) return;

    event.preventDefault();
    event.stopPropagation();
    const item = button.parentElement;
    const key = button.dataset.groupKey;
    if (collapsedGroups.has(key)) collapsedGroups.delete(key);
    else collapsedGroups.add(key);
    renderGroup(item, button);
  });

  function sidebarCollapsePlugin(hook) {
    hook.mounted(updateSidebar);
    hook.doneEach(updateSidebar);
  }

  window.$docsify = window.$docsify || {};
  window.$docsify.plugins = [sidebarCollapsePlugin, ...(window.$docsify.plugins || [])];
})();
