/* blog.js — small helpers for blog posts.
   Drag-to-compare: <div class="ba"> with an <input type="range"> moves the divider. */
(function () {
  document.querySelectorAll('.ba').forEach(function (ba) {
    var r = ba.querySelector('input[type=range]');
    if (!r) return;
    var set = function () { ba.style.setProperty('--pos', r.value + '%'); };
    r.addEventListener('input', set); set();
  });
})();

/* ---------- Prompt builder (used in the "How to use Claude" post) ----------
   Everything runs in the browser. Nothing is sent or stored anywhere. */
(function () {
  var host = document.querySelector('[data-prompt-builder]');
  if (!host) return;

  var FIELDS = [
    { id: 'task',    tag: 'task',        label: 'What do you want?',            hint: 'One clear sentence. The specific thing, not the topic.', rows: 2,
      tip: 'Be clear and direct' },
    { id: 'context', tag: 'context',     label: 'Why, and for whom?',          hint: 'The purpose, the audience, what it will be used for.', rows: 2,
      tip: 'Give context and the why' },
    { id: 'input',   tag: 'material',    label: 'Material you are giving',      hint: 'Files, links, screenshots, data. Real things beat descriptions.', rows: 2,
      tip: 'Provide the real material' },
    { id: 'rules',   tag: 'constraints', label: 'Rules and limits',             hint: 'What must not change. Length, style, tools to use or avoid.', rows: 2,
      tip: 'State constraints' },
    { id: 'example', tag: 'example',     label: 'An example of good output',    hint: 'Optional, but one good example is worth a paragraph of description.', rows: 2,
      tip: 'Show an example' },
    { id: 'format',  tag: 'output',      label: 'What should the answer look like?', hint: 'A list, a table, code, a draft, a plan…', rows: 1,
      tip: 'Specify the output format' }
  ];
  var HABITS = [
    { id: 'plan',  text: 'First, read the material and make a plan. Wait for my OK before changing anything.', label: 'Plan first, then act', tip: 'Ask for a plan first' },
    { id: 'think', text: 'Before you answer, say what is unclear or missing in what I gave you.', label: 'Ask what is unclear', tip: 'Invite questions first' },
    { id: 'check', text: 'When you are done, check your work against the rules above and tell me what you could not verify.', label: 'Check and report', tip: 'Ask it to verify' },
    { id: 'xml',   text: null, label: 'Wrap parts in XML tags', tip: 'Use XML tags for structure' }
  ];
  var PRESETS = {
    vague: { task: 'make my website better', context: '', input: '', rules: '', example: '', format: '', habits: [] },
    good: {
      task: 'Make my academic homepage load faster on phones.',
      context: 'Most visitors are other researchers opening my site from a conference link on a phone. Right now it feels slow.',
      input: 'The site repository in this folder (plain HTML/CSS). The homepage is index.html.',
      rules: 'Do not change any of my text. Keep the same design. Keep image file names so links do not break.',
      example: '',
      format: 'A short list of what is slow, with numbers, then the changes you propose.',
      habits: ['plan', 'check', 'xml']
    }
  };

  var esc = function (s) { return s.replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var h = '<div class="pb-presets"><span>Try:</span><button type="button" data-preset="vague">a vague request</button><button type="button" data-preset="good">a good request</button><button type="button" data-preset="clear">clear all</button></div>';
  h += '<div class="pb-grid"><form class="pb-form" onsubmit="return false">';
  FIELDS.forEach(function (f) {
    h += '<label class="pb-field"><span class="pb-label">' + f.label + '</span><span class="pb-hint">' + f.hint + '</span>' +
         '<textarea rows="' + f.rows + '" data-field="' + f.id + '"></textarea></label>';
  });
  h += '<fieldset class="pb-habits"><legend>Good habits</legend>';
  HABITS.forEach(function (x) { h += '<label><input type="checkbox" data-habit="' + x.id + '"> ' + x.label + '</label>'; });
  h += '</fieldset></form>';
  h += '<div class="pb-out"><div class="pb-score"><div class="pb-bar"><span></span></div><p class="pb-score-text"></p><ul class="pb-tips"></ul></div>' +
       '<div class="pb-card"><div class="pb-card-bar"><span></span><span></span><span></span> your prompt<button type="button" class="pb-copy">copy</button></div><pre class="pb-prompt" aria-live="polite"></pre></div></div></div>';
  host.innerHTML = h;

  var $ = function (s) { return host.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(host.querySelectorAll(s)); };

  function build() {
    var v = {}; $$('[data-field]').forEach(function (t) { v[t.dataset.field] = t.value.trim(); });
    var on = {}; $$('[data-habit]').forEach(function (c) { on[c.dataset.habit] = c.checked; });
    var xml = on.xml, parts = [];
    FIELDS.forEach(function (f) {
      if (!v[f.id]) return;
      parts.push(xml ? '<' + f.tag + '>\n' + v[f.id] + '\n</' + f.tag + '>' : (f.id === 'task' ? v[f.id] : f.label.replace(/\?$/, '') + ': ' + v[f.id]));
    });
    var steps = HABITS.filter(function (x) { return x.text && on[x.id]; }).map(function (x) { return x.text; });
    if (steps.length) parts.push(xml ? '<instructions>\n' + steps.join('\n') + '\n</instructions>' : steps.join('\n'));
    var text = parts.join('\n\n');
    $('.pb-prompt').innerHTML = text ? esc(text) : '<span class="pb-empty">Start typing on the left, or try an example above.</span>';

    var tips = FIELDS.map(function (f) { return { ok: !!v[f.id], t: f.tip }; })
      .concat(HABITS.map(function (x) { return { ok: !!on[x.id], t: x.tip }; }));
    var got = tips.filter(function (t) { return t.ok; }).length;
    $('.pb-bar span').style.width = Math.round(100 * got / tips.length) + '%';
    $('.pb-score-text').textContent = got === 0 ? 'Nothing yet.' : got < 4 ? got + ' of ' + tips.length + ': Claude will have to guess a lot.' :
      got < 7 ? got + ' of ' + tips.length + ': getting clear.' : got + ' of ' + tips.length + ': clear, grounded and checkable.';
    $('.pb-tips').innerHTML = tips.map(function (t) { return '<li class="' + (t.ok ? 'ok' : '') + '">' + t.t + '</li>'; }).join('');
  }

  host.addEventListener('input', build);
  host.addEventListener('change', build);
  host.addEventListener('click', function (e) {
    var b = e.target.closest('[data-preset]');
    if (b) {
      var p = PRESETS[b.dataset.preset] || { habits: [] };
      $$('[data-field]').forEach(function (t) { t.value = p[t.dataset.field] || ''; });
      $$('[data-habit]').forEach(function (c) { c.checked = (p.habits || []).indexOf(c.dataset.habit) > -1; });
      build(); return;
    }
    if (e.target.closest('.pb-copy')) {
      var txt = $('.pb-prompt').textContent, btn = $('.pb-copy');
      var done = function () { btn.textContent = 'copied'; setTimeout(function () { btn.textContent = 'copy'; }, 1400); };
      if (navigator.clipboard) navigator.clipboard.writeText(txt).then(done, function () {}); else done();
    }
  });
  build();
})();
