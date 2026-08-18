/**
 * Landingpage-Komponente: Projekt-Karten für CharcuLogicOS und HofSync.
 * Visuals liegen unter /landing/projects/ (public/landing/projects/).
 */

export const PROJECT_CARDS = [
  {
    id: 'charculogic',
    name: 'CharcuLogicOS',
    kicker: 'Metzgerei & Produktion',
    description:
      'Betriebs-Leitstand mit MHD-Monitor, Wareneingang und der Zone Laden-Alltag im Desktop-Dashboard.',
    href: 'http://127.0.0.1:5173/',
    image: '/landing/projects/charculogic.png',
    imageAlt: 'CharcuLogicOS Dashboard mit MHD-Karten und Operational Zone',
  },
  {
    id: 'hofsync',
    name: 'HofSync',
    kicker: 'Hofladen-Alltag',
    description:
      'Die Hofladen-App für MHD-Check, Thekenbuch und Team — live unter hofsync-production.web.app.',
    href: 'https://hofsync-production.web.app/',
    image: '/landing/projects/hofsync.png',
    imageAlt: 'HofSync Dashboard mit MHD-Karten und Operational Zone',
  },
];

/**
 * Rendert die Projekt-Karten in den angegebenen Container.
 * @param {ParentNode | null} root
 * @param {{ projects?: typeof PROJECT_CARDS }} [options]
 */
export function renderProjectCards(root, options = {}) {
  if (!root) return;
  const projects = options.projects || PROJECT_CARDS;
  root.innerHTML = projects
    .map(
      (project) => `
      <article class="project-card" data-project="${project.id}">
        <a class="project-card-media" href="${project.href}" target="_blank" rel="noopener noreferrer">
          <img
            src="${project.image}"
            alt="${project.imageAlt}"
            width="1440"
            height="900"
            loading="lazy"
            decoding="async"
          >
        </a>
        <div class="project-card-body">
          <p class="project-card-kicker">${project.kicker}</p>
          <h3 class="project-card-title">${project.name}</h3>
          <p class="project-card-copy">${project.description}</p>
        </div>
      </article>`,
    )
    .join('');
}

if (typeof document !== 'undefined') {
  const mount = document.querySelector('[data-project-cards]');
  if (mount) renderProjectCards(mount);
}
