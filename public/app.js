const API = '/api';
let token = localStorage.getItem('socially_token') || '';
let me = null;
let view = 'home';
let modalMode = 'login';
let toastTimer;

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const userId = u => u?._id || u?.id || '';
function avatar(user, extra = '') {
  const name = user?.name || user?.username || '?';
  const inner = user?.avatar ? `<img src="${escapeHTML(user.avatar)}" alt="" onerror="this.remove()">` : escapeHTML(name.trim().charAt(0).toUpperCase());
  return `<span class="avatar ${extra}">${inner}</span>`;
}
function notify(message) {
  const el = $('#toast'); el.textContent = message; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}
async function api(path, options = {}) {
  const response = await fetch(API + path, { ...options, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) { if (response.status === 401 && token) signOut(false); throw new Error(data.error || 'Something went wrong.'); }
  return data;
}
function setIdentity(user) {
  me = user;
  $('#top-name').textContent = user?.name || 'Guest';
  $('#top-avatar').innerHTML = user?.avatar ? `<img src="${escapeHTML(user.avatar)}" alt="">` : escapeHTML((user?.name || '?').trim().charAt(0).toUpperCase());
  $('#composer-avatar').innerHTML = $('#top-avatar').innerHTML;
  $('#composer').classList.toggle('hidden', !user);
  $('#auth-panel').classList.toggle('hidden', !!user);
}
function timeAgo(date) {
  const seconds = Math.max(0, (Date.now() - new Date(date)) / 1000);
  if (seconds < 60) return 'just now'; if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`; if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
function renderPost(post) {
  const author = post.author || {};
  const comments = (post.comments || []).map(c => `<div class="comment">${avatar(c.author)}<div><strong>${escapeHTML(c.author?.name || 'Someone')}</strong>${escapeHTML(c.text)}</div></div>`).join('');
  return `<article class="post-card" data-post="${post._id}"><div class="post-top">${avatar(author)}<div class="post-author"><strong>${escapeHTML(author.name || 'A neighbor')}</strong><span>@${escapeHTML(author.username || 'friend')}</span></div><span class="post-time">${timeAgo(post.createdAt)}</span></div><p class="post-text">${escapeHTML(post.text)}</p>${post.image ? `<img class="post-image" src="${escapeHTML(post.image)}" alt="Post attachment" loading="lazy" onerror="this.remove()">` : ''}<div class="post-actions"><button class="action-btn like-button ${post.liked ? 'liked' : ''}" data-action="like"><span class="action-symbol">${post.liked ? '♥' : '♡'}</span><span>${post.likes?.length || 0} ${post.likes?.length === 1 ? 'like' : 'likes'}</span></button><button class="action-btn" data-action="focus-comment"><span class="action-symbol">◯</span><span>${post.comments?.length || 0} ${post.comments?.length === 1 ? 'comment' : 'comments'}</span></button></div>${comments ? `<div class="comment-list">${comments}</div>` : ''}${me ? `<form class="comment-form"><input name="comment" maxlength="500" placeholder="Add a kind comment…"><button>Send</button></form>` : ''}</article>`;
}
function empty(message, detail = '') { return `<div class="empty-state"><div class="empty-icon">✳</div><h3>${escapeHTML(message)}</h3><p>${escapeHTML(detail)}</p></div>`; }
async function loadFeed() {
  const { posts } = await api('/posts');
  $('#feed').innerHTML = posts.length ? posts.map(renderPost).join('') : empty(me ? 'Your feed is a fresh page.' : 'The feed is taking a little nap.', me ? 'Share a thought to get things started.' : 'Sign in or create an account to join the conversation.');
}
function renderMini(user) {
  if (!user) { $('#mini-profile').innerHTML = `<p class="mini-bio">Sign in to make this corner yours.</p>`; return; }
  $('#mini-profile').innerHTML = `<div class="mini-profile-head">${avatar(user)}<div><strong>${escapeHTML(user.name)}</strong><span>@${escapeHTML(user.username)}</span></div></div><p class="mini-bio">${escapeHTML(user.bio || 'A little mystery makes a good introduction.')}</p><div class="profile-stats"><div><strong>${user.followersCount || 0}</strong><span>followers</span></div><div><strong>${user.followingCount || 0}</strong><span>following</span></div></div>`;
}
async function loadSuggestions() {
  if (!me) { $('#suggestions').innerHTML = `<p class="mini-bio">Meet the community after you join.</p>`; return; }
  const { users } = await api('/users');
  $('#suggestions').innerHTML = users.slice(0, 4).map(u => `<div class="suggestion">${avatar(u)}<div class="suggestion-info"><strong>${escapeHTML(u.name)}</strong><span>@${escapeHTML(u.username)}</span></div><button class="follow-mini" data-follow="${u._id}">${u.isFollowing ? 'Following' : 'Follow'}</button></div>`).join('') || `<p class="mini-bio">You’re one of the first here. Say hello!</p>`;
}
function openAuth(mode) {
  modalMode = mode; const registering = mode === 'register';
  $('#modal-title').textContent = registering ? 'Come on in.' : 'Welcome back.';
  $('#modal-subtitle').textContent = registering ? 'A few details and you’re home.' : 'Your people saved you a seat.';
  $('#name-field').classList.toggle('hidden', !registering); $('#username-field').classList.toggle('hidden', !registering);
  $('#auth-name').required = registering; $('#auth-username').required = registering;
  $('#auth-password').autocomplete = registering ? 'new-password' : 'current-password';
  $('#auth-submit').innerHTML = registering ? 'Create my account <span>↗</span>' : 'Log in <span>↗</span>';
  $('#auth-switch').innerHTML = registering ? `Already have a home here? <button type="button" data-mode="login">Log in</button>` : `New around here? <button type="button" data-mode="register">Join the community</button>`;
  $('#auth-error').textContent = ''; $('#auth-modal').classList.remove('hidden');
}
function closeModals() { $$('.modal').forEach(m => m.classList.add('hidden')); }
async function submitAuth(event) {
  event.preventDefault(); $('#auth-error').textContent = '';
  const body = { email: $('#auth-email').value.trim(), password: $('#auth-password').value };
  let endpoint = '/auth/login';
  if (modalMode === 'register') { endpoint = '/auth/register'; body.name = $('#auth-name').value.trim(); body.username = $('#auth-username').value.trim(); }
  try {
    const data = await api(endpoint, { method: 'POST', body: JSON.stringify(body) });
    token = data.token; localStorage.setItem('socially_token', token); setIdentity(data.user); closeModals();
    await refresh(); notify(`Welcome ${modalMode === 'register' ? 'to the neighborhood' : 'back'}, ${data.user.name.split(' ')[0]}!`);
  } catch (error) { $('#auth-error').textContent = error.message; }
}
function signOut(showToast = true) {
  token = ''; localStorage.removeItem('socially_token'); setIdentity(null); closeModals();
  if (showToast) notify('You’ve been signed out. See you soon.'); refresh();
}
async function refresh() { renderMini(me); await Promise.allSettled([loadFeed(), loadSuggestions()]); if (view === 'profile' && me) showProfile(me.username); }
async function showProfile(username) {
  try {
    const { user, isFollowing, posts } = await api(`/users/${encodeURIComponent(username)}`);
    $('#page-title').textContent = user.username === me?.username ? 'My profile' : `${user.name}’s profile`;
    $('#feed-title').textContent = user.username === me?.username ? 'Your little moments' : `${user.name}’s posts`;
    $('#feed').innerHTML = `<section class="profile-page"><div class="profile-cover"></div><div class="profile-detail"><div class="profile-main-row"><div>${avatar(user, 'profile-main-avatar')}<h2 class="profile-name">${escapeHTML(user.name)}</h2><div class="profile-handle">@${escapeHTML(user.username)}</div></div>${me && userId(me) !== userId(user) ? `<button class="button button-dark profile-follow" data-follow="${user.id}">${isFollowing ? 'Following' : 'Follow'} <span>${isFollowing ? '✓' : '+'}</span></button>` : ''}</div><p class="profile-bio">${escapeHTML(user.bio || 'This person is letting their posts do the talking.')}</p><div class="profile-numbers"><span><strong>${user.followersCount}</strong> followers</span><span><strong>${user.followingCount}</strong> following</span><span><strong>${posts.length}</strong> posts</span></div></div></section><h3 class="profile-post-title">Posts</h3>${posts.length ? posts.map(renderPost).join('') : empty('No posts just yet.', 'There’s plenty of room for a first one.')}`;
  } catch (error) { $('#feed').innerHTML = empty('We couldn’t find that profile.', error.message); }
}
async function showDiscover() {
  $('#page-title').textContent = 'Discover'; $('#feed-title').textContent = 'Find your people';
  if (!me) { $('#feed').innerHTML = empty('Come meet the community.', 'Create an account to discover and follow people.'); return; }
  const { users } = await api('/users');
  $('#feed').innerHTML = `<div class="discover-heading"><span class="eyebrow">A FEW FRIENDLY FACES</span><h2>People to know</h2></div>${users.length ? `<div class="discover-grid">${users.map(u => `<article class="person-card">${avatar(u)}<h3>${escapeHTML(u.name)}</h3><div class="handle">@${escapeHTML(u.username)}</div><p>${escapeHTML(u.bio || 'New here and ready to connect.')}</p><button class="follow-mini" data-follow="${u._id}">${u.isFollowing ? 'Following ✓' : 'Follow +'}</button></article>`).join('')}</div>` : empty('You found everyone!', 'Invite someone new to join your corner.')}`;
}
function navigate(next) {
  view = next;
  $$('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.view === next));
  if (next === 'home') { $('#page-title').textContent = 'Your feed'; $('#feed-title').textContent = 'Fresh from your feed'; loadFeed(); }
  if (next === 'profile') { if (me) showProfile(me.username); else openAuth('login'); }
  if (next === 'discover') showDiscover();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
document.addEventListener('click', async event => {
  const close = event.target.closest('[data-close]'); if (close) return closeModals();
  const mode = event.target.closest('[data-mode]'); if (mode) return openAuth(mode.dataset.mode);
  const nav = event.target.closest('[data-view]'); if (nav) return navigate(nav.dataset.view);
  if (event.target.closest('#open-register')) return openAuth('register');
  if (event.target.closest('#open-login')) return openAuth('login');
  if (event.target.closest('#account-button')) return me ? signOut() : openAuth('login');
  const follow = event.target.closest('[data-follow]');
  if (follow) { if (!me) return openAuth('login'); const profileUsername = view === 'profile' ? $('.profile-handle')?.textContent.replace('@', '') : ''; try { await api(`/users/${follow.dataset.follow}/follow`, { method: 'POST' }); await refresh(); if (view === 'profile' && profileUsername) await showProfile(profileUsername); if (view === 'discover') await showDiscover(); } catch (e) { notify(e.message); } return; }
  const action = event.target.closest('[data-action]');
  if (action) { const card = action.closest('[data-post]'); if (action.dataset.action === 'focus-comment') { const input = $('.comment-form input', card); if (input) input.focus(); else openAuth('login'); } if (action.dataset.action === 'like') { if (!me) return openAuth('login'); try { await api(`/posts/${card.dataset.post}/like`, { method: 'POST' }); await loadFeed(); if (view === 'profile') await showProfile(me.username); } catch (e) { notify(e.message); } } }
});
$('#auth-form').addEventListener('submit', submitAuth);
$('#share-post').addEventListener('click', async () => {
  const button = $('#share-post'); button.disabled = true;
  try { await api('/posts', { method: 'POST', body: JSON.stringify({ text: $('#post-text').value, image: $('#post-image').value }) }); $('#post-text').value = ''; $('#post-image').value = ''; navigate('home'); await refresh(); notify('Your little moment is out in the world.'); }
  catch (e) { notify(e.message); } finally { button.disabled = false; }
});
$('#feed').addEventListener('submit', async event => {
  if (!event.target.matches('.comment-form')) return; event.preventDefault();
  const card = event.target.closest('[data-post]'); const input = $('input[name="comment"]', event.target); const text = input.value.trim(); if (!text) return;
  try { await api(`/posts/${card.dataset.post}/comments`, { method: 'POST', body: JSON.stringify({ text }) }); if (view === 'profile') await showProfile(me.username); else await loadFeed(); } catch (e) { notify(e.message); }
});
$('#feed').addEventListener('click', event => { const postAuthor = event.target.closest('.post-author'); if (postAuthor) { const username = postAuthor.querySelector('span')?.textContent.replace('@', ''); if (username) { view = 'profile'; $$('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.view === 'profile')); showProfile(username); window.scrollTo({ top: 0, behavior: 'smooth' }); } } });
$('#profile-form').addEventListener('submit', async event => { event.preventDefault(); try { const data = await api('/profile', { method: 'PATCH', body: JSON.stringify({ name: $('#profile-name').value, bio: $('#profile-bio').value, avatar: $('#profile-avatar').value }) }); setIdentity(data.user); closeModals(); await refresh(); notify('Your profile has been updated.'); } catch (e) { notify(e.message); } });
$('#edit-profile').addEventListener('click', () => {
  if (!me) return openAuth('login');
  $('#profile-name').value = me.name || ''; $('#profile-bio').value = me.bio || ''; $('#profile-avatar').value = me.avatar || '';
  $('#profile-modal').classList.remove('hidden');
});
$$('[data-view]').forEach(button => button.addEventListener('keydown', event => { if (event.key === 'Enter') navigate(button.dataset.view); }));
$$('.modal').forEach(modal => modal.addEventListener('keydown', event => { if (event.key === 'Escape') closeModals(); }));
document.addEventListener('keydown', event => { if (event.key === 'Escape') closeModals(); });

async function init() {
  if (token) { try { const data = await api('/auth/me'); setIdentity(data.user); } catch { setIdentity(null); } }
  else setIdentity(null);
  renderMini(me); await Promise.allSettled([loadFeed(), loadSuggestions()]);
}
init();
