const CONFIG = {
  devtoTags: ['tech', 'programming', 'webdev', 'javascript', 'python', 'ai', 'opensource', 'react', 'devops', 'security', 'cloud', 'database'],
  hnTopUrl: 'https://hacker-news.firebaseio.com/v0/topstories.json',
  hnItemUrl: 'https://hacker-news.firebaseio.com/v0/item',
  hnAlgoliaUrl: 'https://hn.algolia.com/api/v1/search?query=technology&tags=story&hitsPerPage=20',
  fetchTimeout: 10000,
  hnCount: 40,
  skeletonCount: 12,
};

let allArticles = [];
let currentSource = 'all';
let searchQuery = '';
let isLoading = false;

const $ = (id) => document.getElementById(id);
const grid = $('newsGrid');
const toast = $('toast');
const refreshBtn = $('refreshBtn');
const searchInput = $('searchInput');
const searchBtn = $('searchBtn');
const sourceTabs = $('sourceTabs');
const articleCountEl = $('articleCount');
const lastUpdatedEl = $('lastUpdated');

function showToast(msg, type = '') {
  toast.querySelector('.toast-msg').textContent = msg;
  toast.className = 'toast ' + type + ' show';
  clearTimeout(toast._hide);
  toast._hide = setTimeout(() => toast.classList.remove('show'), 3000);
}

function showSkeletons(count = CONFIG.skeletonCount) {
  grid.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const s = document.createElement('div');
    s.className = 'skeleton';
    s.innerHTML = '<div class="skeleton-img"></div><div class="skeleton-body"><div class="skeleton-line skeleton-line-sm"></div><div class="skeleton-line"></div><div class="skeleton-line"></div><div class="skeleton-line" style="width:80%"></div></div>';
    grid.appendChild(s);
  }
}

const timeAgo = (() => {
  const units = [
    { max: 60, div: 1, suffix: ' just now', fn: () => 'just now' },
    { max: 3600, div: 60, suffix: 'm ago' },
    { max: 86400, div: 3600, suffix: 'h ago' },
    { max: 2592000, div: 86400, suffix: 'd ago' },
  ];
  return (date) => {
    const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    for (const u of units) {
      if (diff < u.max) return u.fn ? u.fn() : Math.floor(diff / u.div) + u.suffix;
    }
    return new Date(date).toLocaleDateString();
  };
})();

function truncate(text, len = 120) {
  if (!text) return '';
  return text.length > len ? text.slice(0, len).replace(/\s+\S*$/, '') + '...' : text;
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function setLoading(loading) {
  isLoading = loading;
  refreshBtn.disabled = loading;
  if (loading) {
    refreshBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="animation:spin 1s linear infinite"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21h5v-5"/></svg> Loading...';
  } else {
    refreshBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21h5v-5"/></svg> Refresh';
  }
}

function renderArticles(articles) {
  if (!articles.length) {
    grid.innerHTML = '<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg><h3>No articles found</h3><p>Try a different search or source filter.</p></div>';
    return;
  }
  grid.innerHTML = '';
  for (const a of articles) {
    const src = a.source;
    const badgeClass = src === 'devto' ? 'devto' : 'hn';
    const badgeLabel = src === 'devto' ? 'Dev.to' : 'HN';
    const sourceName = src === 'devto' ? 'Dev.to' : 'Hacker News';

    const imgHtml = a.image
      ? `<div class="news-card-img-wrap"><img class="news-card-img" src="${escapeHtml(a.image)}" alt="" loading="lazy" onerror="this.parentElement.classList.add('fallback');this.remove()"><div class="news-card-img-overlay"><span class="news-card-badge ${badgeClass}">${badgeLabel}</span></div></div>`
      : `<div class="news-card-img-wrap"><div class="news-card-img-placeholder"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-4 0v-9a2 2 0 0 1 2-2h2"/><path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8Z"/></svg></div><div class="news-card-img-overlay"><span class="news-card-badge ${badgeClass}">${badgeLabel}</span></div></div>`;

    const card = document.createElement('a');
    card.className = 'news-card';
    card.href = a.url;
    card.target = '_blank';
    card.rel = 'noopener noreferrer';
    card.innerHTML = imgHtml +
      '<div class="news-card-body">' +
      `<div class="news-card-source ${badgeClass}">${escapeHtml(sourceName)}</div>` +
      `<div class="news-card-title">${escapeHtml(a.title)}</div>` +
      (a.description ? `<div class="news-card-desc">${escapeHtml(truncate(a.description, 140))}</div>` : '') +
      '<div class="news-card-meta">' +
      (a.author ? `<span class="author"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> ${escapeHtml(a.author.length > 20 ? a.author.slice(0, 20) + '...' : a.author)}</span>` : '<span></span>') +
      `<time>${a.time ? timeAgo(a.time) : ''}</time>` +
      '</div></div>';

    grid.appendChild(card);
  }
}

async function fetchWithTimeout(url, timeout = CONFIG.fetchTimeout) {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeout) });
  if (!res.ok) throw new Error(`${url} returned ${res.status}`);
  return res.json();
}

async function fetchDevTo() {
  const results = await Promise.allSettled(
    CONFIG.devtoTags.map(tag =>
      fetchWithTimeout(`https://dev.to/api/articles?tag=${tag}&per_page=6`)
        .catch(() => null)
    )
  );
  const seen = new Set();
  const articles = [];
  for (const r of results) {
    if (r.status === 'fulfilled' && Array.isArray(r.value)) {
      for (const item of r.value) {
        if (!seen.has(item.id)) {
          seen.add(item.id);
          articles.push({
            source: 'devto',
            id: item.id,
            title: item.title,
            description: item.description,
            url: item.url,
            image: item.cover_image || item.social_image,
            author: item.user?.name,
            time: item.published_at,
          });
        }
      }
    }
  }
  if (!articles.length) throw new Error('No Dev.to articles');
  return articles;
}

async function fetchHackerNews() {
  const ids = await fetchWithTimeout(CONFIG.hnTopUrl);
  const topIds = ids.slice(0, CONFIG.hnCount);
  const items = await Promise.allSettled(
    topIds.map(id => fetchWithTimeout(`${CONFIG.hnItemUrl}/${id}.json`, 8000))
  );
  return items
    .filter(r => r.status === 'fulfilled' && r.value)
    .map(r => r.value)
    .map(item => ({
      source: 'hackernews',
      id: item.id,
      title: item.title,
      description: item.text || item.title,
      url: item.url || `https://news.ycombinator.com/item?id=${item.id}`,
      image: null,
      author: item.by,
      time: new Date((item.time || 0) * 1000).toISOString(),
    }));
}

async function fetchHnAlgolia() {
  const data = await fetchWithTimeout(CONFIG.hnAlgoliaUrl);
  return data.hits.map(item => ({
    source: 'hackernews',
    id: item.objectID,
    title: item.title,
    description: `${item.points} points | ${(item._tags || []).join(', ')}`,
    url: item.url || `https://news.ycombinator.com/item?id=${item.objectID}`,
    image: null,
    author: item.author,
    time: item.created_at,
  }));
}

async function fetchAll() {
  if (isLoading) return;
  setLoading(true);
  showSkeletons();
  allArticles = [];

  const sources = [
    { name: 'Dev.to', fetcher: fetchDevTo },
    { name: 'Hacker News', fetcher: fetchHackerNews },
    { name: 'HN Trending', fetcher: fetchHnAlgolia },
  ];

  const results = await Promise.allSettled(sources.map(s => s.fetcher()));
  const errors = [];
  for (let i = 0; i < results.length; i++) {
    if (results[i].status === 'fulfilled') {
      allArticles.push(...results[i].value);
    } else {
      errors.push(`${sources[i].name}: ${results[i].reason?.message || 'Unknown'}`);
    }
  }

  allArticles.sort((a, b) => new Date(b.time || 0) - new Date(a.time || 0));

  articleCountEl.textContent = allArticles.length;
  lastUpdatedEl.textContent = new Date().toLocaleTimeString();
  applyFilters();

  if (errors.length === sources.length) {
    grid.innerHTML = '<div class="error-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg><h3>Failed to load news</h3><p>Could not reach any news sources. Check your connection.</p></div>';
    showToast('All sources failed. Check your connection.', 'error');
  } else if (errors.length) {
    showToast('Some sources failed: ' + errors.join('; '), 'error');
  } else {
    showToast(`News updated from ${sources.length} sources!`, 'success');
  }

  setLoading(false);
}

function applyFilters() {
  let articles = allArticles;
  if (currentSource !== 'all') {
    articles = articles.filter(a => a.source === currentSource);
  }
  const q = searchQuery.trim();
  if (q) {
    const lower = q.toLowerCase();
    articles = articles.filter(a =>
      (a.title && a.title.toLowerCase().includes(lower)) ||
      (a.description && a.description.toLowerCase().includes(lower)) ||
      (a.author && a.author.toLowerCase().includes(lower))
    );
  }
  renderArticles(articles);
}

function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

refreshBtn.addEventListener('click', fetchAll);

searchBtn.addEventListener('click', () => {
  searchQuery = searchInput.value;
  applyFilters();
});

searchInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    searchQuery = searchInput.value;
    applyFilters();
  }
});

searchInput.addEventListener('input', debounce(() => {
  searchQuery = searchInput.value;
  applyFilters();
}, 300));

sourceTabs.addEventListener('click', e => {
  const tab = e.target.closest('.source-tab');
  if (!tab) return;
  sourceTabs.querySelectorAll('.source-tab').forEach(t => t.classList.remove('active'));
  tab.classList.add('active');
  currentSource = tab.dataset.source;
  applyFilters();
});

fetchAll();
