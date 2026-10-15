import re
import urllib.parse

import requests
from django.core.cache import cache

URL_RE = re.compile(r'https?://[^\s<>"\']+', re.I)

PROVIDERS = [
    ("tiktok", re.compile(r'tiktok\.com/@[^/]+/video/(\d+)', re.I),
     lambda m, url: f"https://www.tiktok.com/embed/v2/{m.group(1)}"),
    ("youtube", re.compile(r'(?:youtube\.com/shorts/|youtu\.be/|youtube\.com/watch\?v=)([\w-]{11})', re.I),
     lambda m, url: f"https://www.youtube.com/embed/{m.group(1)}"),
    ("instagram", re.compile(r'instagram\.com/(?:reel|reels)/([\w-]+)', re.I),
     lambda m, url: f"https://www.instagram.com/reel/{m.group(1)}/embed/"),
    ("facebook", re.compile(r'(?:facebook\.com/(?:watch|reel|videos|share)|fb\.watch/)', re.I),
     lambda m, url: "https://www.facebook.com/plugins/video.php?"
                    + urllib.parse.urlencode({"href": url, "show_text": "false"})),
]

SHORT_TIKTOK_HOSTS = ("vm.tiktok.com", "vt.tiktok.com")


def _resolve_short_link(url):
    key = f"asterix-video-resolve:{url}"
    cached = cache.get(key)
    if cached:
        return cached
    try:
        final = requests.head(url, allow_redirects=True, timeout=3).url
    except requests.RequestException:
        final = url
    cache.set(key, final, 60 * 60 * 24)
    return final


def extract_video_embeds(text):
    results = []
    for raw in URL_RE.findall(text or ""):
        url = raw.rstrip(".,)!?")
        host = urllib.parse.urlparse(url).netloc.lower()
        if host in SHORT_TIKTOK_HOSTS:
            url = _resolve_short_link(url)
        for name, pattern, build in PROVIDERS:
            m = pattern.search(url)
            if m:
                results.append({
                    "provider": name,
                    "source_url": url,
                    "embed_url": build(m, url),
                })
                break
    return results