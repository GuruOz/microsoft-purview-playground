// Shared header: brand mark + primary navigation.
// Rendered from one source so all pages stay visually consistent.
// Pages provide two placeholders:
//   <div id="appBrand" data-page="Rule Builder"></div>
//   <nav id="appNav" data-active="builder" class="..."></nav>
// All strings here are static (no user input), so innerHTML is safe.

(function () {
    const ICONS = {
        builder: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>',
        simulator: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>',
        summary: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>',
        regex: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"></path>',
        settings: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>'
    };

    const BRAND_ICON = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>';

    const NAV = [
        { key: 'builder', href: 'index.html', label: 'Rule Builder' },
        { key: 'simulator', href: 'simulator.html', label: 'Simulator Tab' },
        { key: 'summary', href: 'summary.html', label: 'Rule Summary' },
        { key: 'regex', href: 'regex.html', label: 'Regex Builder' },
        { key: 'settings', href: 'settings.html', label: 'Settings' }
    ];

    function icon(paths) {
        return `<svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">${paths}</svg>`;
    }

    function renderBrand() {
        const brand = document.getElementById('appBrand');
        if (!brand) return;
        const page = brand.dataset.page || '';
        brand.className = 'flex items-center gap-3';
        brand.innerHTML =
            `<svg class="w-7 h-7 text-indigo-600 dark:text-indigo-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">${BRAND_ICON}</svg>` +
            '<div class="leading-tight">' +
                '<h1 class="text-lg font-bold dark:text-white">Purview Playground</h1>' +
                (page ? `<span class="text-xs text-gray-500 dark:text-gray-400 font-semibold">${page}</span>` : '') +
            '</div>';
    }

    function renderNav() {
        const nav = document.getElementById('appNav');
        if (!nav) return;
        const active = nav.dataset.active;
        const parts = [];
        NAV.forEach((item, i) => {
            if (i > 0) parts.push('<span class="text-gray-300 dark:text-gray-600">|</span>');
            const inner = icon(ICONS[item.key]) + item.label;
            if (item.key === active) {
                parts.push(`<span class="text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5 cursor-default">${inner}</span>`);
            } else {
                parts.push(`<a href="${item.href}" class="text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center gap-1.5">${inner}</a>`);
            }
        });
        nav.innerHTML = parts.join('');
    }

    document.addEventListener('DOMContentLoaded', () => {
        renderBrand();
        renderNav();
    });
})();
