// ============================================================
// utils.js — Pure helpers: no DOM queries, no API calls
// ============================================================

/** Read CSRF token from cookie. */
function csrf() {
  var cookie = document.cookie.split('; ').find(function(r) { return r.startsWith('csrftoken='); });
  return cookie ? cookie.split('=')[1] : (window.ASTERIX && window.ASTERIX.CSRF) || '';
}

/** Format a timestamp string/Date into a human-readable relative time. */
function fmtTime(ts) {
  var d = new Date(ts);
  if (isNaN(d)) return '';
  var now  = new Date();
  var diff = Math.round((now - d) / 60000);
  if (diff < 1)  return 'Just now';
  if (diff < 60) return diff + 'm ago';
  var h  = d.getHours(), m = d.getMinutes().toString().padStart(2, '0');
  var ap = h >= 12 ? 'PM' : 'AM', fh = h % 12 || 12;
  var today = new Date(); today.setHours(0, 0, 0, 0);
  var dm    = new Date(d); dm.setHours(0, 0, 0, 0);
  if (dm.getTime() === today.getTime()) return fh + ':' + m + ' ' + ap;
  var yest = new Date(today); yest.setDate(yest.getDate() - 1);
  if (dm.getTime() === yest.getTime()) return 'Yesterday ' + fh + ':' + m + ' ' + ap;
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return months[d.getMonth()] + ' ' + d.getDate() + ' ' + fh + ':' + m + ' ' + ap;
}

/**
 * Sanitise an external link from PythonAnywhere dev/localhost origins
 * and ensure it has a protocol prefix.
 */
function externalLink(link) {
  if (!link) return null;
  link = link.trim();

  // If it's already a full URL, return it exactly as is
  if (/^https?:\/\//i.test(link)) return link;

  // If it starts with a slash, it's a relative path on our own domain
  if (link.startsWith('/')) return window.location.origin + link;

  // Otherwise, assume it's missing the protocol (e.g., google.com)
  return 'https://' + link;
}

/** Return the emoji set for a status category. */
function getEmojisForCategory(cat) {
  return CATEGORY_EMOJIS[cat] || DEFAULT_EMOJIS;
}

/** Determine the media type label from a URL's extension. */
function mediaTypeFromUrl(url) {
  if (!url) return { label: 'Text', icon: '📝' };
  var ext = url.split('.').pop().toLowerCase().split('?')[0];
  if (['mp4','webm','ogg','mov','3gp'].indexOf(ext) !== -1) return { label: 'Video', icon: '🎬' };
  if (['jpg','jpeg','png','gif','webp','bmp','svg'].indexOf(ext) !== -1) return { label: 'Photo', icon: '📸' };
  return { label: 'Media', icon: '📎' };
}