(function () {
  var STORAGE = "ace-desk-v3";
  var SESSION = "ace-desk-session";
  var STEPS = ["Booked", "Picked up", "On the road", "Delivered"];

  var seed = {
    users: [],
    runs: []
  };

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE);
      if (!raw) {
        localStorage.setItem(STORAGE, JSON.stringify(seed));
        return JSON.parse(JSON.stringify(seed));
      }
      return JSON.parse(raw);
    } catch (err) {
      return JSON.parse(JSON.stringify(seed));
    }
  }

  function save(data) {
    localStorage.setItem(STORAGE, JSON.stringify(data));
  }

  function currentEmail() {
    return sessionStorage.getItem(SESSION) || "";
  }

  function paintHeader() {
    var link = document.querySelector(".mast-call .login");
    if (!link) return;
    if (currentEmail()) {
      link.textContent = "Account";
      link.setAttribute("href", "account.html");
    } else {
      link.textContent = "Login";
      link.setAttribute("href", "login.html");
    }
  }

  function normalizeId(id) {
    var key = String(id || "").trim().toUpperCase().replace(/\s+/g, "");
    if (/^\d+$/.test(key)) key = "ACE-" + key;
    if (/^ACE\d+$/.test(key)) key = "ACE-" + key.slice(3);
    return key;
  }

  function findRun(data, id) {
    var key = normalizeId(id);
    for (var i = 0; i < data.runs.length; i += 1) {
      if (data.runs[i].id.toUpperCase() === key) return data.runs[i];
    }
    return null;
  }

  function nextId(data) {
    var max = 4400;
    data.runs.forEach(function (run) {
      var n = parseInt(String(run.id).split("-")[1], 10);
      if (n > max) max = n;
    });
    return "ACE-" + (max + 1);
  }

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function statusList(status) {
    var at = STEPS.indexOf(status);
    return STEPS.map(function (step, i) {
      var cls = i < at ? "done" : i === at ? "now" : "";
      return "<li" + (cls ? ' class="' + cls + '"' : "") + ">" + step + "</li>";
    }).join("");
  }

  function runMarkup(run) {
    return (
      '<p class="run-id">' + esc(run.id) + "</p>" +
      '<ol class="status">' + statusList(run.status) + "</ol>" +
      "<dl>" +
      "<div><dt>Window</dt><dd>" + esc(run.window) + "</dd></div>" +
      "<div><dt>Ready</dt><dd>" + esc(run.ready) + "</dd></div>" +
      "<div><dt>From</dt><dd>" + esc(run.from) + "</dd></div>" +
      "<div><dt>To</dt><dd>" + esc(run.to) + "</dd></div>" +
      "<div><dt>Load</dt><dd>" + esc(run.load) + "</dd></div>" +
      "</dl>"
    );
  }

  function showRun(box, run, missingId) {
    box.hidden = false;
    if (!run) {
      box.className = "ticket";
      box.innerHTML = "<p>No run " + esc(missingId) + " on this desk.</p>";
      return;
    }
    box.className = "ticket";
    box.innerHTML = runMarkup(run);
  }

  function bindTrack() {
    var form = document.getElementById("track-form");
    var box = document.getElementById("track-result");
    if (!form || !box) return;

    function lookup(id) {
      var key = normalizeId(id);
      form.elements.run.value = key;
      var data = load();
      showRun(box, findRun(data, key), key);
    }

    var params = new URLSearchParams(window.location.search);
    var preset = params.get("run");
    if (preset) lookup(preset);

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var key = normalizeId(form.elements.run.value);
      var url = "track.html?run=" + encodeURIComponent(key);
      if (window.location.pathname.endsWith("track.html") || window.location.pathname.endsWith("/")) {
        history.replaceState(null, "", url);
      }
      lookup(key);
    });
  }

  function bindQuote() {
    var form = document.getElementById("quote-form");
    var box = document.getElementById("quote-result");
    if (!form || !box) return;

    function fillEmail() {
      if (currentEmail()) form.elements.Email.value = currentEmail();
    }
    fillEmail();

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var data = load();
      var email = (form.elements.Email.value || currentEmail() || "").trim().toLowerCase();
      if (!email) return;
      var run = {
        id: nextId(data),
        window: form.elements.Window.value,
        status: "Booked",
        ready: form.elements["Ready at"].value,
        from: form.elements.Pickup.value,
        to: form.elements.Delivery.value,
        load: form.elements.Load.value,
        owner: email
      };
      data.runs.push(run);
      save(data);
      box.hidden = false;
      box.innerHTML =
        "<p>Booked as <strong>" + esc(run.id) + "</strong>. Status is Booked.</p>" +
        '<p><a href="track.html?run=' + encodeURIComponent(run.id) + '">Track ' + esc(run.id) + "</a></p>";
      form.reset();
      fillEmail();
    });
  }

  function setMessage(id, text) {
    var el = document.getElementById(id);
    if (!el) return;
    el.hidden = !text;
    el.textContent = text || "";
  }

  function bindLogin() {
    var form = document.getElementById("login-form");
    if (!form) return;
    if (currentEmail()) {
      window.location.href = "account.html";
      return;
    }
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var data = load();
      var email = form.elements.email.value.trim().toLowerCase();
      var password = form.elements.password.value;
      var user = null;
      for (var i = 0; i < data.users.length; i += 1) {
        if (data.users[i].email === email) user = data.users[i];
      }
      if (!user || user.password !== password) {
        setMessage("login-error", "That email and password do not match an account on this desk.");
        return;
      }
      sessionStorage.setItem(SESSION, email);
      window.location.href = "account.html";
    });
  }

  function bindRegister() {
    var form = document.getElementById("register-form");
    if (!form) return;
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      setMessage("register-error", "");
      var data = load();
      var email = form.elements.email.value.trim().toLowerCase();
      var password = form.elements.password.value;
      var confirm = form.elements.confirm.value;
      if (password.length < 6) {
        setMessage("register-error", "Use at least 6 characters for the password.");
        return;
      }
      if (password !== confirm) {
        setMessage("register-error", "Those passwords do not match.");
        return;
      }
      for (var i = 0; i < data.users.length; i += 1) {
        if (data.users[i].email === email) {
          setMessage("register-error", "That email already has an account. Sign in instead.");
          return;
        }
      }
      data.users.push({
        name: form.elements.name.value.trim(),
        email: email,
        password: password,
        company: form.elements.company.value.trim()
      });
      save(data);
      sessionStorage.setItem(SESSION, email);
      window.location.href = "account.html";
    });
  }

  function bindAccount() {
    var root = document.getElementById("account-root");
    if (!root) return;
    var email = currentEmail();
    if (!email) {
      window.location.href = "login.html";
      return;
    }
    var data = load();
    var user = null;
    for (var i = 0; i < data.users.length; i += 1) {
      if (data.users[i].email === email) user = data.users[i];
    }
    if (!user) {
      sessionStorage.removeItem(SESSION);
      window.location.href = "login.html";
      return;
    }
    var mine = data.runs.filter(function (run) { return run.owner === email; });
    var list = mine.length
      ? mine.map(function (run) {
          return '<li><a href="track.html?run=' + encodeURIComponent(run.id) + '">' +
            esc(run.id) + "</a> · " + esc(run.status) + " · " + esc(run.window) + "</li>";
        }).join("")
      : "<li>No runs on this account yet. <a href=\"quote.html\">Book one</a>.</li>";
    root.innerHTML =
      "<h1>" + esc(user.name) + "</h1>" +
      "<p class=\"dek\">" + (user.company ? esc(user.company) + " · " : "") + esc(user.email) + "</p>" +
      "<h2>Runs</h2>" +
      "<ul class=\"run-list\">" + list + "</ul>" +
      '<button class="button" id="sign-out" type="button">Sign out</button>';
    document.getElementById("sign-out").addEventListener("click", function () {
      sessionStorage.removeItem(SESSION);
      window.location.href = "login.html";
    });
  }

  paintHeader();
  bindTrack();
  bindQuote();
  bindLogin();
  bindRegister();
  bindAccount();
})();
