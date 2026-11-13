(function () {
  'use strict';

  const state = document.getElementById('profile-state');
  const content = document.getElementById('profile-content');
  const buildsState = document.getElementById('profile-builds-state');
  const buildsGrid = document.getElementById('my-builds');
  const repostsState = document.getElementById('profile-reposts-state');
  const repostsGrid = document.getElementById('my-reposts');
  const buildsSection = document.getElementById('profile-build-section');
  const repostsSection = document.getElementById('profile-reposts-section');
  const buildsTab = document.getElementById('profile-builds-tab');
  const repostsTab = document.getElementById('profile-reposts-tab');
  const savedNotice = document.getElementById('saved-notice');
  const params = new URLSearchParams(location.search);
  const requestedUsername = params.get('username');
  const savedId = params.get('saved');
  let profileData = null;
  let me = null;
  let authChecked = false;
  let requestNumber = 0;

  function selectTab(name) {
    const showReposts = name === 'reposts';
    buildsSection.hidden = showReposts;
    repostsSection.hidden = !showReposts;
    buildsTab.setAttribute('aria-selected', String(!showReposts));
    repostsTab.setAttribute('aria-selected', String(showReposts));
    buildsTab.tabIndex = showReposts ? -1 : 0;
    repostsTab.tabIndex = showReposts ? 0 : -1;
    buildsTab.classList.toggle('is-active', !showReposts);
    repostsTab.classList.toggle('is-active', showReposts);
  }

  function profilePanel(title, message, options = {}) {
    content.hidden = true;
    BuildsUI.statePanel(state, title, message, options);
  }

  function showLoginNeeded() {
    state.replaceChildren();
    const panel = BuildsUI.node('div', 'build-state-panel');
    panel.append(BuildsUI.node('h2', '', 'Your profile lives here'));
    panel.append(BuildsUI.node('p', '', 'Log in to open your own builder profile, or explore another builder from the showcase.'));
    const link = BuildsUI.node('a', 'btn btn-primary', 'Log in');
    link.href = '/login.html';
    panel.append(link);
    state.append(panel);
  }

  function initials(name) {
    const words = String(name || 'Builder').trim().split(/\s+/).filter(Boolean);
    return words.slice(0, 2).map((word) => word.charAt(0).toUpperCase()).join('') || 'B';
  }

  function renderProfile(data) {
    const profile = data.profile;
    const isOwner = authChecked && me && String(me.id) === String(profile.id);
    profileData = data;
    const displayName = profile.display_name || profile.username || 'Builder';
    document.title = `${displayName} — Blueprint Arcade`;
    document.querySelector('meta[name="description"]').setAttribute('content', `Explore ${displayName}'s builds on Blueprint Arcade.`);
    document.getElementById('profile-name').textContent = displayName;
    document.getElementById('profile-handle').textContent = `@${profile.username || ''}`;
    document.getElementById('profile-bio').textContent = profile.bio || '';
    document.getElementById('profile-bio').hidden = !profile.bio;
    document.getElementById('profile-build-count').textContent = String(profile.build_count ?? (data.builds || []).length);
    document.getElementById('profile-pinned-count').textContent = String(profile.pinned_count ?? (data.builds || []).filter((build) => build.is_pinned).length);
    const avatar = document.getElementById('profile-avatar');
    avatar.replaceChildren();
    const avatarUrl = BuildsUI.safeImageUrl(profile.avatar_url || '');
    if (avatarUrl) {
      const image = document.createElement('img');
      image.src = avatarUrl;
      image.alt = '';
      image.addEventListener('error', () => {
        avatar.replaceChildren();
        avatar.textContent = initials(displayName);
      }, { once: true });
      avatar.append(image);
    } else {
      avatar.textContent = initials(displayName);
    }

    const builds = Array.isArray(data.builds) ? data.builds : [];
    document.getElementById('profile-build-label').textContent = `${builds.length} ${builds.length === 1 ? 'build' : 'builds'} shared`;
    buildsGrid.replaceChildren();
    if (!builds.length) {
      BuildsUI.statePanel(buildsState, 'No builds posted yet', 'When this builder shares a creation, it will appear here.');
    } else {
      buildsState.replaceChildren();
      BuildsUI.renderCards(buildsGrid, builds, {
        me: authChecked ? me : null,
        onRefresh: () => loadProfile()
      });
    }
    const reposts = Array.isArray(data.reposts) ? data.reposts : [];
    document.getElementById('profile-reposts-label').textContent = `${reposts.length} ${reposts.length === 1 ? 'repost' : 'reposts'}`;
    repostsGrid.replaceChildren();
    if (!reposts.length) {
      BuildsUI.statePanel(repostsState, 'No reposts yet', 'Builds this creator reposts will appear here.');
    } else {
      repostsState.replaceChildren();
      BuildsUI.renderCards(repostsGrid, reposts, {
        me: authChecked ? me : null,
        onRefresh: () => loadProfile()
      });
    }
    selectTab('builds');
    content.hidden = false;
    state.replaceChildren();
    if (!authChecked) {
      const notice = BuildsUI.node('p', 'error', 'Account status could not be checked. Owner controls are hidden; retry the page to manage your builds.');
      notice.setAttribute('role', 'status');
      state.append(notice);
    } else if (isOwner) {
      const note = BuildsUI.node('p', 'field-hint', 'This is your public profile. You can edit, delete, and pin your builds below.');
      note.setAttribute('role', 'status');
      state.append(note);
    }

    savedNotice.hidden = true;
    savedNotice.textContent = '';
    if (savedId) {
      const savedBuild = builds.find((build) => String(build.id) === String(savedId));
      savedNotice.hidden = !savedBuild;
      savedNotice.textContent = savedBuild
        ? `Build saved: “${savedBuild.title}”. It is now visible on your profile.`
        : '';
      if (savedBuild) {
        requestAnimationFrame(() => {
          const card = buildsGrid.querySelector(`[data-build-id="${CSS.escape(String(savedId))}"]`);
          if (card) {
            card.setAttribute('tabindex', '-1');
            card.focus({ preventScroll: true });
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        });
      }
    }
  }

  async function loadProfile() {
    const requestId = ++requestNumber;
    const username = requestedUsername || (me && me.username);
    if (!username) {
      showLoginNeeded();
      return;
    }
    savedNotice.hidden = true;
    BuildsUI.statePanel(state, 'Loading builder profile', 'Fetching this builder’s profile and builds.');
    try {
      const result = await api(`/api/stats/profile/${encodeURIComponent(username)}`);
      if (requestId !== requestNumber) return;
      if (!result.profile || !Array.isArray(result.builds)) throw new Error('The profile response was incomplete.');
      renderProfile(result);
    } catch (error) {
      if (requestId !== requestNumber) return;
      profilePanel('Profile could not be loaded', BuildsUI.apiMessage(error, 'Check the username or your connection, then try again.'), {
        error: true,
        retry: () => loadProfile()
      });
    }
  }

  async function start() {
    BuildsUI.statePanel(state, 'Loading builder profile', 'Checking account and profile details.');
    try {
      const result = await getMe();
      me = result.user || null;
      authChecked = true;
    } catch {
      authChecked = false;
      me = null;
      if (!requestedUsername) {
        profilePanel('Account status could not be checked', 'Your profile cannot be resolved until your session is confirmed. Please retry.', {
          error: true,
          retry: () => start()
        });
        return;
      }
    }
    if (!requestedUsername && !me) {
      showLoginNeeded();
      return;
    }
    await loadProfile();
  }

  document.addEventListener('DOMContentLoaded', start);
  buildsTab.addEventListener('click', () => selectTab('builds'));
  repostsTab.addEventListener('click', () => selectTab('reposts'));
  [buildsTab, repostsTab].forEach((tab) => tab.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const next = tab === buildsTab ? repostsTab : buildsTab;
    selectTab(next === repostsTab ? 'reposts' : 'builds');
    next.focus();
  }));
})();
