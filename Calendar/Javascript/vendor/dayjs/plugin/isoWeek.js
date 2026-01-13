// Minimal isoWeek plugin stub for vendored dayjs
(function(){
  // plugin is a noop in our trimmed dayjs implementation but present to avoid errors
  if (typeof dayjs === 'undefined') return;
  window.dayjs_plugin_isoWeek = function(option) { /* noop */ };
})();
