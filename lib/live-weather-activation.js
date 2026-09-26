const ENDPOINT = 'https://commercialroofingadvisors.com/api/weather-activations';
const cleanPath = (value = '/') => String(value).split('?')[0].replace(/\/index\.html$/i, '/').replace(/\.html$/i, '').replace(/\/+$/, '') || '/';
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char]);

export function isValidActivation(activation, pathname = '/', now = Date.now()) {
  if (activation?.version !== 3 || activation.status !== 'live' || !activation.routes?.includes(cleanPath(pathname))) return false;
  const deadline = Date.parse(activation.validUntil);
  const expiry = Date.parse(activation.expiresAt);
  const checked = Date.parse(activation.checkedAt);
  return Number.isFinite(deadline) && deadline > now && Number.isFinite(expiry) && expiry > now && Number.isFinite(checked) && checked <= now + 60000 && now - checked < 5 * 60000;
}

export async function getLiveWeatherActivation(siteId, pathname = '/') {
  const route = cleanPath(pathname);
  if (route !== '/' && !/^\/service-areas\//.test(route) && !/^\/(services|damage-repair)\/.*(storm|leak|emergency|hail|hurricane|tornado|wind|flood|snow|ice|inspection)/.test(route)) return null;
  try {
    const url = new URL(process.env.CRA_WEATHER_ACTIVATION_URL || ENDPOINT);
    url.searchParams.set('site', siteId);
    url.searchParams.set('path', cleanPath(pathname));
    const response = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store', signal: AbortSignal.timeout(12000) });
    if (!response.ok) return null;
    const activation = await response.json();
    return activation.siteId === siteId && isValidActivation(activation, pathname) ? activation : null;
  } catch { return null; }
}

// Established titles and canonical URLs remain stable throughout storm cycles.
export function liveWeatherMetadata(metadata) { return metadata; }

export function renderLiveWeatherActivation(activation) {
  if (!activation?.validUntil) return '';
  const deadline = escapeHtml(activation.validUntil);
  const source = activation.sources?.[0];
  const sourceUrl = source?.url?.startsWith('https://api.weather.gov/') ? source.url : 'https://www.weather.gov/';
  const updated = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(activation.updatedAt)) + ' UTC';
  const urgent = activation.prominence === 'urgent';
  return `
<style data-rh-live-weather-style>
.rh-live-weather{position:relative;isolation:isolate;background:#17232c;color:#fff;padding:calc(26px + var(--rh-weather-offset,0px)) 24px 26px;border-top:4px solid ${urgent ? '#dc5748' : '#bca35e'};font-family:inherit;text-align:left;clear:both}
.rh-live-weather *{box-sizing:border-box}.rh-live-weather__inner{width:min(1180px,100%);margin:auto;display:grid;grid-template-columns:minmax(0,1fr) minmax(220px,300px);gap:24px;align-items:center}
.rh-live-weather__status{font-size:12px;font-weight:700;letter-spacing:.06em;margin:0 0 12px!important;color:#f2d89b!important;text-transform:uppercase;line-height:1.5}
.rh-live-weather h2{font:inherit;font-size:clamp(23px,3vw,34px);font-weight:750;line-height:1.15;letter-spacing:-.02em;margin:0 0 14px!important;color:#fff!important}
.rh-live-weather__summary,.rh-live-weather__action{font-size:15px;line-height:1.65;margin:0 0 10px!important;color:#eef2f5!important;max-width:850px}
.rh-live-weather__action{font-size:13px;color:#cfd9df!important}.rh-live-weather__actions{display:grid;gap:10px}
.rh-live-weather__button,.rh-live-weather__phone{display:block;padding:14px 18px;border-radius:5px;text-align:center;text-decoration:none!important;font-size:14px;font-weight:750;line-height:1.5;white-space:normal;background:#fff;color:#17232c!important}
.rh-live-weather__phone{background:transparent;border:1px solid #9aaab6;color:#fff!important}.rh-live-weather__source{font-size:12px;line-height:1.6;margin:8px 0 0!important;color:#cfd9df!important}.rh-live-weather__source a{color:inherit;text-decoration:underline}
@media(max-width:700px){.rh-live-weather{padding:calc(22px + var(--rh-weather-offset,0px)) 18px 22px}.rh-live-weather__inner{grid-template-columns:1fr;gap:16px}.rh-live-weather__actions{max-width:420px}}
</style>
<section class="rh-live-weather" aria-labelledby="rh-live-weather-heading" data-weather-event="${escapeHtml(activation.storm?.id)}" data-weather-phase="${escapeHtml(activation.phase)}" data-weather-valid-until="${deadline}">
 <div class="rh-live-weather__inner"><div>
  <p class="rh-live-weather__status">${escapeHtml(activation.statusLabel)}</p>
  <h2 id="rh-live-weather-heading">${escapeHtml(activation.heading)}</h2>
  <p class="rh-live-weather__summary">${escapeHtml(activation.summary)}</p>
  <p class="rh-live-weather__action">${escapeHtml(activation.action)}</p>
  <p class="rh-live-weather__source"><a href="${escapeHtml(sourceUrl)}" rel="noopener noreferrer">${escapeHtml(source?.name || 'National Weather Service')}</a> · Updated ${escapeHtml(updated)}</p>
 </div><div class="rh-live-weather__actions">
  <a class="rh-live-weather__button" data-rh-storm-action="${escapeHtml(activation.phase)}" href="${escapeHtml(activation.ctaHref)}">${escapeHtml(activation.ctaLabel)}</a>
  <a class="rh-live-weather__phone" data-rh-storm-action="${escapeHtml(activation.phase)}" href="tel:+1${String(activation.phone || '').replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '')}">Call ${escapeHtml(activation.phone)}</a>
 </div></div>
</section>
<script data-rh-live-weather-expiry>(function(){function offset(){document.querySelectorAll('.rh-live-weather').forEach(function(el){var bottom=0;document.querySelectorAll('header,nav,[class*=header],[class*=navbar]').forEach(function(h){if(getComputedStyle(h).position==='fixed'){var r=h.getBoundingClientRect();if(r.top>=-1&&r.top<160&&r.width>innerWidth/2)bottom=Math.max(bottom,r.bottom)}});el.style.setProperty('--rh-weather-offset',Math.max(0,bottom-(el.getBoundingClientRect().top+scrollY))+'px')})}offset();addEventListener('resize',offset);addEventListener('DOMContentLoaded',offset);addEventListener('load',offset);requestAnimationFrame(offset);function expire(){document.querySelectorAll('[data-weather-valid-until]').forEach(function(el){if(Date.parse(el.dataset.weatherValidUntil)<=Date.now())el.remove()})}expire();setInterval(expire,15000);document.addEventListener('visibilitychange',expire)})();</script>`;
}

export function decorateLiveWeatherHtml(html, activation, pathname = '/') {
  if (!html || !isValidActivation(activation, pathname)) return html;
  // Existing adapters are replaced, so no metadata override or duplicate section.
  if (html.includes('data-weather-valid-until=')) return html;
  const block = renderLiveWeatherActivation(activation);
  // Keep navigation and the original hero in place; insert at the start of main.
  if (/<main\b[^>]*>/i.test(html)) return html.replace(/<main\b[^>]*>/i, (opening) => opening + block);
  if (/<\/header>/i.test(html)) return html.replace(/<\/header>/i, '</header>' + block);
  if (/<body\b[^>]*>/i.test(html)) return html.replace(/<body\b[^>]*>/i, (opening) => opening + block);
  return block + html;
}

export async function withLiveWeatherResponse(response, siteId, request) {
  if (!response || response.status !== 200 || !response.headers.get('content-type')?.includes('text/html')) return response;
  const pathname = new URL(request.url).pathname;
  const activation = await getLiveWeatherActivation(siteId, pathname);
  const headers = new Headers(response.headers);
  // Shared caches must not preserve an active warning beyond a phase deadline.
  headers.set('cache-control', 'private, no-store, max-age=0');
  headers.delete('content-length'); headers.delete('etag'); headers.delete('last-modified');
  headers.set('x-rh-weather-version', '3');
  headers.set('x-rh-weather-status', activation?.phase || 'normal');
  return new Response(decorateLiveWeatherHtml(await response.text(), activation, pathname), { status: response.status, headers });
}
