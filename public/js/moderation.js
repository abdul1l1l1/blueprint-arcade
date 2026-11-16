(function () {
  'use strict';
  const state = document.getElementById('moderation-state');
  const list = document.getElementById('moderation-list');
  const node = BuildsUI.node;

  async function load() {
    BuildsUI.statePanel(state, 'Loading reports', 'Checking administrator access and fetching reported content.');
    list.hidden = true;
    try {
      const result = await api('/api/reports/moderation');
      const reports = Array.isArray(result.reports) ? result.reports : [];
      list.replaceChildren();
      if (!reports.length) {
        BuildsUI.statePanel(state, 'No reports to review', 'New reports from community members will appear here.');
        list.hidden = false;
        return;
      }
      for (const report of reports) {
        const card = node('article', 'card moderation-card');
        const heading = node('div', 'moderation-heading');
        heading.append(node('strong', 'report-flag', 'Flagged'));
        heading.append(node('span', '', report.target_type === 'comment' ? 'Comment report' : 'Build report'));
        const target = node('p', 'moderation-target');
        target.textContent = report.target_type === 'comment'
          ? `${report.comment_body || 'Comment'} — on ${report.build_title || 'a build'}`
          : report.build_title || 'Build';
        const reason = node('p', 'moderation-reason');
        reason.textContent = report.reason || '';
        const details = node('p', 'moderation-meta');
        const date = report.created_at ? new Date(report.created_at).toLocaleString() : 'Date unavailable';
        details.textContent = `Reported by ${report.reporter_username || 'a member'} · ${date}`;
        const owner = node('p', 'moderation-meta');
        owner.textContent = `Content creator: ${report.content_owner_username || 'unknown'}`;
        const link = node('a', 'btn', 'Open build');
        link.href = `/build.html?id=${encodeURIComponent(report.build_id)}`;
        card.append(heading, target, reason, details, owner, link);
        list.append(card);
      }
      state.replaceChildren();
      list.hidden = false;
    } catch (error) {
      const message = error.status === 403 ? 'Administrator access is required to view reports.'
        : error.status === 401 ? 'Log in with an administrator account to view reports.'
          : BuildsUI.apiMessage(error, 'Reports could not be loaded.');
      BuildsUI.statePanel(state, 'Moderation is unavailable', message, { error: true, retry: load });
    }
  }

  document.addEventListener('DOMContentLoaded', load);
})();
