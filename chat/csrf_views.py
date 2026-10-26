"""
csrf_views.py: friendly response when a form submission fails the CSRF check.
"""
from django.http import HttpResponse, JsonResponse

LOGIN_PATHS = ("/auth/login", "/auth/signup")

PAGE = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Please try again · Fizzme</title>
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0b141a;color:#e9edef;font-family:Segoe UI,system-ui,Arial,sans-serif;padding:20px;box-sizing:border-box;}
  .card{max-width:420px;width:100%;background:#1a1f1f;border:1px solid rgba(255,255,255,.08);border-radius:18px;padding:26px 22px;}
  h1{font-size:20px;margin:0 0 10px;text-align:center;}
  p{font-size:14px;line-height:1.6;color:#aebac1;margin:0 0 12px;}
  ul{font-size:14px;line-height:1.7;color:#aebac1;padding-left:20px;margin:0 0 18px;}
  a.btn{display:block;text-align:center;padding:13px;border-radius:22px;background:linear-gradient(135deg,#25d366,#128c7e);color:#fff;font-weight:700;text-decoration:none;font-size:15px;}
</style>
</head>
<body>
<div class="card">
  <h1>We could not keep you signed in</h1>
  <p>Your browser did not keep the security code it needs to log in. This happens on some phone browsers. Try this:</p>
  <ul>
    <li>Open Fizzme in Chrome or Safari.</li>
    <li>Turn on cookies for this site.</li>
    <li>Close other Fizzme tabs, then try again.</li>
  </ul>
  <a class="btn" href="__RETRY__">Try again</a>
</div>
</body>
</html>
"""


def csrf_failure(request, reason=""):
    wants_json = (
        request.path.startswith("/api/")
        or "application/json" in request.headers.get("Accept", "")
        or request.headers.get("X-Requested-With") == "XMLHttpRequest"
    )
    if wants_json:
        return JsonResponse(
            {"error": "Your session expired. Refresh the page and try again."},
            status=403,
        )
    retry = request.path if request.path.rstrip("/") in LOGIN_PATHS else "/"
    return HttpResponse(PAGE.replace("__RETRY__", retry), status=403,
                        content_type="text/html; charset=utf-8")
