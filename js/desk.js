(function () {
  var STORAGE = "ace-desk-v3";
  var SESSION = "ace-desk-session";
  var PASS = "ace-desk-pass";
  var TRACKED = "ace-desk-run";
  var CODES = ["ACE1908", "ACE2214", "ACE3340", "ACE4512", "ACE5607"];
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

  function motionOk() {
    return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function depart(url, replace) {
    if (!url) return;
    function go() {
      if (replace) window.location.replace(url);
      else window.location.href = url;
    }
    if (!motionOk() || document.body.classList.contains("is-leaving")) {
      go();
      return;
    }
    document.body.classList.add("is-leaving");
    var left = false;
    function leave(event) {
      if (event && event.animationName && event.animationName !== "page-out") return;
      if (left) return;
      left = true;
      go();
    }
    var main = document.querySelector("main");
    if (main) main.addEventListener("animationend", leave);
    setTimeout(leave, 360);
  }

  function linkFrom(node) {
    while (node && node !== document) {
      if (node.tagName === "A") return node;
      node = node.parentNode;
    }
    return null;
  }

  function sameSite(link) {
    if (!link || link.target === "_blank" || link.hasAttribute("download")) return false;
    var href = link.getAttribute("href") || "";
    if (!href || href.charAt(0) === "#" || href.indexOf("mailto:") === 0 || href.indexOf("tel:") === 0) return false;
    var url;
    try {
      url = new URL(link.href, window.location.href);
    } catch (err) {
      return false;
    }
    return url.origin === window.location.origin;
  }

  function bindMotion() {
    function arrive() {
      document.body.classList.remove("is-leaving");
      document.body.classList.remove("is-ready");
      if (!motionOk()) return;
      void document.body.offsetWidth;
      document.body.classList.add("is-ready");
      setTimeout(function () {
        document.body.classList.remove("is-ready");
      }, 500);
    }

    window.addEventListener("pageshow", function (event) {
      if (event.persisted) arrive();
      else document.body.classList.remove("is-leaving");
    });

    document.addEventListener("click", function (event) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      var link = linkFrom(event.target);
      if (!sameSite(link)) return;
      var url;
      try {
        url = new URL(link.href, window.location.href);
      } catch (err) {
        return;
      }
      if (url.pathname === window.location.pathname && url.search === window.location.search && url.hash) return;
      event.preventDefault();
      depart(link.href, false);
    });

    if (!document.body.classList.contains("is-leaving")) arrive();
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

  function codeKey(value) {
    return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  }

  function codeOk(value) {
    var key = codeKey(value);
    for (var i = 0; i < CODES.length; i += 1) {
      if (CODES[i] === key) return true;
    }
    return false;
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

  function factRows(run) {
    if (run.details && run.details.length) return run.details;
    return [
      ["Window", run.window],
      ["Ready", run.ready],
      ["From", run.from],
      ["To", run.to],
      ["Load", run.load]
    ];
  }

  function factsMarkup(rows) {
    return rows.map(function (row) {
      return "<div><dt>" + esc(row[0]) + "</dt><dd>" + esc(row[1]) + "</dd></div>";
    }).join("");
  }

  function runMarkup(run) {
    return (
      '<p class="run-id">' + esc(run.id) + "</p>" +
      '<ol class="status">' + statusList(run.status) + "</ol>" +
      "<dl>" + factsMarkup(factRows(run)) + "</dl>"
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
      var raw = form.elements.run.value;
      if (codeOk(raw)) {
        sessionStorage.setItem(PASS, "open");
        sessionStorage.setItem(TRACKED, normalizeId(raw));
        depart("dashboard.html");
        return;
      }
      var key = normalizeId(raw);
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
    var sending = false;

    function fillEmail() {
      if (currentEmail() && form.elements.email && !form.elements.email.value) {
        form.elements.email.value = currentEmail();
      }
    }
    fillEmail();

    function showBox(html, sent) {
      box.hidden = false;
      box.className = sent ? "ticket sent" : "ticket";
      box.innerHTML = html;
      box.scrollIntoView({ block: "center" });
    }

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (sending) return;
      var email = (form.elements.email.value || currentEmail() || "").trim().toLowerCase();
      if (!email) return;
      sending = true;
      var button = form.querySelector("button[type='submit']");
      var label = button ? button.textContent : "";
      if (button) {
        button.disabled = true;
        button.textContent = "Sending";
      }
      showBox("<p>Sending this booking.</p>", false);

      var data = load();
      var name = form.elements.Name.value.trim();
      var phone = form.elements.Phone.value.trim();
      var company = form.elements.Company.value.trim();
      var notes = form.elements.Notes.value.trim();
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
      var copy = [
        "Your American Courier Express booking is " + run.id + ".",
        "",
        "Name: " + name,
        "Phone: " + phone,
        "Email: " + email,
        company ? "Company: " + company : "",
        "Window: " + run.window,
        "Ready: " + run.ready,
        "Pickup: " + run.from,
        "Delivery: " + run.to,
        "Load: " + run.load,
        notes ? "Notes: " + notes : "",
        "",
        "Track this run with " + run.id + ".",
        "Desk phone: +1 612-649-9537"
      ].filter(Boolean).join("\n");

      function release() {
        sending = false;
        if (button) {
          button.disabled = false;
          button.textContent = label;
        }
      }

      fetch("https://formsubmit.co/ajax/americancourierexpress@my.com", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({
          _subject: "Booking " + run.id + " — " + name,
          _template: "table",
          _captcha: "false",
          _replyto: email,
          _cc: email,
          Kind: "Booking",
          Run: run.id,
          Name: name,
          Phone: phone,
          email: email,
          Company: company,
          Pickup: run.from,
          Delivery: run.to,
          Window: run.window,
          "Ready at": run.ready,
          Load: run.load,
          Notes: notes,
          message: copy
        })
      }).then(function (response) {
        return response.json().then(function (body) {
          return { ok: response.ok, body: body };
        });
      }).then(function (result) {
        var accepted = result.ok && result.body && (result.body.success === true || result.body.success === "true");
        if (!accepted) {
          var reason = result.body && result.body.message ? result.body.message : "The desk did not accept the email.";
          showBox("<p class=\"form-error\">Not sent.</p><p>" + esc(reason) + "</p>", false);
          release();
          return;
        }
        data.runs.push(run);
        save(data);
        showBox(
          "<p class=\"sent-kicker\">Sent</p>" +
          "<p class=\"run-id\">" + esc(run.id) + "</p>" +
          "<p>This booking was emailed to americancourierexpress@my.com and to " + esc(email) + ".</p>" +
          "<p><a href=\"track.html?run=" + encodeURIComponent(run.id) + "\">Track " + esc(run.id) + "</a></p>",
          true
        );
        form.reset();
        fillEmail();
        release();
      }).catch(function () {
        showBox("<p class=\"form-error\">Not sent.</p><p>The booking email did not go out. Try again.</p>", false);
        release();
      });
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
      depart("account.html");
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
      depart("account.html");
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
      depart("account.html");
    });
  }

  function bindAccount() {
    var root = document.getElementById("account-root");
    if (!root) return;
    var email = currentEmail();
    if (!email) {
      depart("login.html");
      return;
    }
    var data = load();
    var user = null;
    for (var i = 0; i < data.users.length; i += 1) {
      if (data.users[i].email === email) user = data.users[i];
    }
    if (!user) {
      sessionStorage.removeItem(SESSION);
      depart("login.html");
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
      depart("login.html");
    });
  }

  function bindLive() {
    var board = document.getElementById("live-board");
    var intro = document.getElementById("desk-intro");
    var status = document.getElementById("live-status");
    var note = document.getElementById("live-line");
    var replay = document.getElementById("replay");
    var fill = document.getElementById("route-fill");
    var pkg = document.getElementById("route-pkg");
    if (!board || !intro || !status || !note || !replay || !fill || !pkg) return;
    var tracked = sessionStorage.getItem(TRACKED) || "";
    if (sessionStorage.getItem(PASS) !== "open" || !codeOk(tracked)) {
      depart("track.html", true);
      return;
    }

    var timers = [];
    var started = false;
    var profile = shipmentFor(tracked);
    var run = {
      id: normalizeId(tracked),
      window: profile.window,
      ready: profile.ready,
      from: profile.from,
      to: profile.to,
      load: profile.load,
      details: profile.details || null,
      owner: "desk"
    };

    function shipmentFor(id) {
      if (codeKey(id) === "ACE5607") {
        return {
          title: "The parcel is on the way.",
          dek: "Expedited international shipment from Illinois to Toronto. It is still in transit and has not arrived.",
          marker: "Parcel",
          fromLabel: "From",
          toLabel: "To",
          fromPlace: "Jonathan McCaw, 6 Johnson Street, Illinois, USA",
          toPlace: "Elizabeth Ion, 145 King Street West, Toronto, Ontario, Canada, M5H 1J8",
          window: "5–7 business days",
          ready: "Expedited International Shipping",
          from: "Jonathan McCaw, 6 Johnson Street, Illinois, USA",
          to: "Elizabeth Ion, 145 King Street West, Toronto, Ontario, Canada, M5H 1J8",
          load: "1 medium-sized parcel containing clothing, personal documents, and small household items",
          detail: true,
          details: [
            ["Package", "1 medium-sized parcel containing clothing, personal documents, and small household items"],
            ["From", "Jonathan McCaw, 6 Johnson Street, Illinois, USA"],
            ["To", "Elizabeth Ion, 145 King Street West, Toronto, Ontario, Canada, M5H 1J8"],
            ["Duration", "5–7 business days"],
            ["Service", "Expedited International Shipping"],
            ["Purpose", "Personal shipment/gift"],
            ["Weight", "4.5 kg"],
            ["Dimensions", "45 × 30 × 20 cm"],
            ["Payment", "Shipping and delivery charges paid by recipient"]
          ],
          notes: {
            booked: "Booked. The parcel is still with Jonathan McCaw in Illinois.",
            picked: "Picked up at 6 Johnson Street, Illinois. Leaving for Toronto.",
            road: "On the road. The parcel is on the way to Elizabeth Ion in Toronto and has not arrived."
          }
        };
      }
      return {
        title: "The envelope is on the way.",
        dek: "Rush run from the South Tampa desk to downtown. It stays short of the drop and has not arrived.",
        marker: "Envelope",
        fromLabel: "Pickup",
        toLabel: "Drop",
        fromPlace: "3902 Henderson Blvd, Tampa",
        toPlace: "601 N Ashley Dr, Tampa",
        window: "Rush — about 90 minutes",
        ready: "Now",
        from: "3902 Henderson Blvd, Tampa",
        to: "601 N Ashley Dr, Tampa",
        load: "One sealed envelope",
        detail: false,
        notes: {
          booked: "Booked. The envelope is still at the pickup.",
          picked: "Picked up at 3902 Henderson Blvd. Leaving for downtown.",
          road: "On the road. The envelope is on the way to 601 N Ashley Dr and has not arrived."
        }
      };
    }

    function openDesk() {
      var idNode = document.getElementById("live-run");
      var lookup = document.getElementById("live-lookup");
      var title = document.getElementById("desk-title");
      var dek = document.getElementById("desk-dek");
      var facts = document.getElementById("live-facts");
      var fromLabel = document.getElementById("route-from-label");
      var toLabel = document.getElementById("route-to-label");
      var fromPlace = document.getElementById("route-from");
      var toPlace = document.getElementById("route-to");
      if (title) title.textContent = profile.title;
      if (dek) dek.textContent = profile.dek;
      if (idNode) idNode.textContent = run.id;
      pkg.textContent = profile.marker;
      if (fromLabel) fromLabel.textContent = profile.fromLabel;
      if (toLabel) toLabel.textContent = profile.toLabel;
      if (fromPlace) fromPlace.textContent = profile.fromPlace;
      if (toPlace) toPlace.textContent = profile.toPlace;
      if (facts) facts.innerHTML = factsMarkup(factRows(run));
      board.classList.toggle("is-detail", profile.detail);
      if (lookup) {
        lookup.textContent = "Look up " + run.id;
        lookup.setAttribute("href", "track.html?run=" + encodeURIComponent(run.id));
      }
      intro.hidden = false;
      board.hidden = false;
      if (!started) {
        started = true;
        play();
      }
    }

    function remember(name) {
      var data = load();
      var found = null;
      for (var i = 0; i < data.runs.length; i += 1) {
        if (data.runs[i].id === run.id) found = data.runs[i];
      }
      if (!found) {
        found = {
          id: run.id,
          owner: run.owner
        };
        data.runs.push(found);
      }
      found.window = run.window;
      found.ready = run.ready;
      found.from = run.from;
      found.to = run.to;
      found.load = run.load;
      found.details = run.details;
      found.status = name;
      save(data);
    }

    function place(pct) {
      pkg.style.left = pct + "%";
      fill.style.width = pct + "%";
    }

    function clearTimers() {
      timers.forEach(function (timer) { clearTimeout(timer); });
      timers = [];
    }

    function onRoad() {
      board.classList.add("is-moving");
      status.innerHTML = statusList("On the road");
      note.textContent = profile.notes.road;
      place(68);
      remember("On the road");
    }

    function play() {
      clearTimers();
      board.classList.remove("is-moving");
      place(0);
      status.innerHTML = statusList("Booked");
      note.textContent = profile.notes.booked;
      remember("Booked");
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        onRoad();
        return;
      }
      void board.offsetWidth;
      timers.push(setTimeout(function () {
        status.innerHTML = statusList("Picked up");
        note.textContent = profile.notes.picked;
        place(8);
        remember("Picked up");
        void board.offsetWidth;
        board.classList.add("is-moving");
      }, 700));
      timers.push(setTimeout(function () {
        status.innerHTML = statusList("On the road");
        note.textContent = profile.notes.road;
        place(68);
        remember("On the road");
      }, 1600));
    }

    replay.addEventListener("click", play);
    openDesk();
  }

  paintHeader();
  bindMotion();
  bindTrack();
  bindQuote();
  bindLogin();
  bindRegister();
  bindAccount();
  bindLive();
})();
