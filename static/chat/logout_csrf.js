(function () {
  "use strict";
  var form = document.getElementById("logout-form");
  if (!form) return;

  function cookie(name) {
    var m = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
    return m ? decodeURIComponent(m[1]) : "";
  }

  // Copy the browser's current CSRF cookie into the form just before it
  // submits. A hidden token from before a login is stale and Django rejects it.
  form.addEventListener("submit", function () {
    var token = cookie("csrftoken");
    var input = form.querySelector("input[name=csrfmiddlewaretoken]");
    if (token && input) input.value = token;
  });
})();
