/* Copié depuis src/ui/social.js par scripts/sync-site.js : ne pas modifier ici. */
// Votes (j'aime / je n'aime pas) et commentaires d'un build ou d'une route, pour l'app et le site (bêta).
// Même fichier des deux côtés (copié sur le site par scripts/sync-site.js) ; chacun fournit tli.vote,
// tli.comments, tli.commentPost / commentEdit / commentDelete. Les textes sont toujours affichés échappés.
const Social = (() => {
  const SVG_UP = '<svg viewBox="0 0 24 24"><path d="M7 11v9H4v-9zM7 11l4-8c1.5 0 2.5 1 2.5 2.5V9h5.2a2 2 0 0 1 2 2.3l-1.2 7A2 2 0 0 1 17.5 20H7"/></svg>';
  const SVG_DOWN = '<svg viewBox="0 0 24 24"><path d="M17 13V4h3v9zM17 13l-4 8c-1.5 0-2.5-1-2.5-2.5V15H5.3a2 2 0 0 1-2-2.3l1.2-7A2 2 0 0 1 6.5 4H17"/></svg>';
  const when = (ts) => new Date(ts).toLocaleDateString(typeof LOCALE !== 'undefined' ? LOCALE : undefined, { day: 'numeric', month: 'short', year: 'numeric' });

  // Barre de vote. init = { likes, dislikes, myVote }. opts.signIn() : appelé si le visiteur n'est pas connecté.
  function mountVotes(box, kind, id, init, opts = {}) {
    let st = { likes: init.likes || 0, dislikes: init.dislikes || 0, mine: init.myVote || 0 };
    const render = (msg) => {
      box.innerHTML = `<div class="soc-votes">
        <button class="soc-v up${st.mine === 1 ? ' on' : ''}" data-v="1" title="${esc(t('soc.like'))}">${SVG_UP}<b>${st.likes}</b></button>
        <button class="soc-v down${st.mine === -1 ? ' on' : ''}" data-v="-1" title="${esc(t('soc.dislike'))}">${SVG_DOWN}<b>${st.dislikes}</b></button>
        ${msg ? `<span class="soc-msg">${msg}</span>` : ''}</div>`;
      box.querySelectorAll('[data-v]').forEach((b) => (b.onclick = async () => {
        const v = +b.dataset.v;
        try {
          const r = await tli.vote(kind, id, st.mine === v ? 0 : v);
          st = { likes: r.likes, dislikes: r.dislikes, mine: r.mine };
          render();
        } catch (e) {
          const m = String((e && e.message) || e);
          if (/login required|unknown token|no username/i.test(m)) render(`${esc(t('soc.signInToVote'))} <a href="#" data-in>${esc(t('soc.signIn'))}</a>`);
          else if (/own content/.test(m)) render(esc(t('soc.ownContent')));
          else render(esc(m));
          const a = box.querySelector('[data-in]');
          if (a) a.onclick = (ev) => { ev.preventDefault(); if (opts.signIn) opts.signIn(); };
        }
      }));
    };
    render();
  }

  // Fil de commentaires. opts.avatar(key) -> html du portrait ; opts.signIn() ; opts.ownerLabel.
  function mountComments(box, kind, id, opts = {}) {
    let data = { comments: [], signedIn: false };
    let replyTo = null;
    let editing = null;
    const load = async () => {
      try { data = await tli.comments(kind, id); } catch (e) { box.innerHTML = `<p class="muted">${esc(String(e.message || e))}</p>`; return; }
      render();
    };
    const form = (parentId) => (data.signedIn
      ? `<div class="soc-form" data-form="${parentId || ''}"><textarea maxlength="1000" placeholder="${esc(t(parentId ? 'soc.replyPh' : 'soc.commentPh'))}"></textarea>
          <div class="soc-fbar"><span class="muted small" data-count>0 / 1000</span>${parentId ? `<button class="btn" data-cancel>${esc(t('b.cancel'))}</button>` : ''}<button class="btn primary" data-send>${esc(t(parentId ? 'soc.reply' : 'soc.send'))}</button></div>
          <p class="neg small" data-err></p></div>`
      : (parentId ? '' : `<p class="muted soc-signin">${esc(t('soc.signInToComment'))} <a href="#" data-in>${esc(t('soc.signIn'))}</a></p>`));
    const one = (c, reply) => {
      if (c.deleted) return `<div class="soc-c deleted${reply ? ' reply' : ''}"><p class="muted">${esc(t('soc.deleted'))}</p></div>`;
      const isEdit = editing === c.id;
      return `<div class="soc-c${reply ? ' reply' : ''}" data-c="${esc(c.id)}">
        <div class="soc-h">${opts.avatar ? opts.avatar(c.author.avatar) : ''}<b>${esc(c.author.name)}</b>${c.author.isOwner ? ` <span class="tag">${esc(t('soc.author'))}</span>` : ''}
          <span class="muted small">${esc(when(c.createdAt))}${c.editedAt ? ' · ' + esc(t('soc.edited')) : ''}</span></div>
        ${isEdit ? `<div class="soc-form" data-edit="${esc(c.id)}"><textarea maxlength="1000">${esc(c.body)}</textarea>
            <div class="soc-fbar"><button class="btn" data-cancel>${esc(t('b.cancel'))}</button><button class="btn primary" data-save>${esc(t('btn.save'))}</button></div><p class="neg small" data-err></p></div>`
          : `<div class="soc-b">${esc(c.body)}</div>`}
        <div class="soc-act">${data.signedIn && !reply ? `<a href="#" data-reply="${esc(c.id)}">${esc(t('soc.reply'))}</a>` : ''}
          ${c.mine && !isEdit ? `<a href="#" data-editc="${esc(c.id)}">${esc(t('soc.edit'))}</a>` : ''}
          ${c.canDelete ? `<a href="#" data-del="${esc(c.id)}">${esc(t('soc.delete'))}</a>` : ''}</div>
      </div>`;
    };
    const render = () => {
      const top = data.comments.filter((c) => !c.parentId || !data.comments.some((p) => p.id === c.parentId));
      const replies = (pid) => data.comments.filter((c) => c.parentId === pid);
      const n = data.comments.filter((c) => !c.deleted).length;
      box.innerHTML = `<h2>${esc(t('soc.title'))} <span class="muted">(${n})</span> <span class="tag beta">BETA</span></h2>
        ${form(null)}
        <div class="soc-list">${top.map((c) => one(c, false) + replies(c.id).map((r) => one(r, true)).join('') + (replyTo === c.id ? `<div class="soc-c reply">${form(c.id)}</div>` : '')).join('')
          || `<p class="muted">${esc(t('soc.none'))}</p>`}</div>`;
      bind();
    };
    const bind = () => {
      const a = box.querySelector('[data-in]');
      if (a) a.onclick = (ev) => { ev.preventDefault(); if (opts.signIn) opts.signIn(); };
      box.querySelectorAll('[data-form]').forEach((f) => {
        const ta = f.querySelector('textarea');
        ta.oninput = () => { f.querySelector('[data-count]').textContent = `${ta.value.length} / 1000`; };
        const c = f.querySelector('[data-cancel]');
        if (c) c.onclick = () => { replyTo = null; render(); };
        f.querySelector('[data-send]').onclick = async () => {
          const btn = f.querySelector('[data-send]');
          btn.disabled = true;
          try { await tli.commentPost(kind, id, ta.value, f.dataset.form || null); replyTo = null; await load(); }
          catch (e) { f.querySelector('[data-err]').textContent = String(e.message || e); btn.disabled = false; }
        };
        if (f.dataset.form) ta.focus();
      });
      box.querySelectorAll('[data-reply]').forEach((x) => (x.onclick = (ev) => { ev.preventDefault(); replyTo = x.dataset.reply; render(); }));
      box.querySelectorAll('[data-editc]').forEach((x) => (x.onclick = (ev) => { ev.preventDefault(); editing = x.dataset.editc; render(); }));
      box.querySelectorAll('[data-edit]').forEach((f) => {
        f.querySelector('[data-cancel]').onclick = () => { editing = null; render(); };
        f.querySelector('[data-save]').onclick = async () => {
          try { await tli.commentEdit(f.dataset.edit, f.querySelector('textarea').value); editing = null; await load(); }
          catch (e) { f.querySelector('[data-err]').textContent = String(e.message || e); }
        };
      });
      box.querySelectorAll('[data-del]').forEach((x) => (x.onclick = async (ev) => {
        ev.preventDefault();
        if (!(await (typeof askConfirm === 'function' ? askConfirm : (m) => Promise.resolve(confirm(m)))(t('soc.confirmDelete')))) return;
        try { await tli.commentDelete(x.dataset.del); await load(); } catch (e) { alert(String(e.message || e)); }
      }));
    };
    box.innerHTML = `<p class="muted">${esc(t('b.loading'))}</p>`;
    load();
  }

  return { mountVotes, mountComments };
})();
