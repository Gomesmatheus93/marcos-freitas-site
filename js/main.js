document.addEventListener("DOMContentLoaded", function () {
  /* Mobile navigation toggle */
  var toggle = document.querySelector(".nav-toggle");
  var mobileMenu = document.querySelector(".nav-mobile");

  if (toggle && mobileMenu) {
    toggle.addEventListener("click", function () {
      var isOpen = mobileMenu.classList.toggle("open");
      toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
      toggle.innerHTML = isOpen
        ? '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>'
        : '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>';
    });

    mobileMenu.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        mobileMenu.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  /* Hero arrow navigation: scroll to the previous/next section */
  var heroArrows = document.querySelectorAll("[data-scroll]");
  heroArrows.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var direction = btn.getAttribute("data-scroll");
      var sections = Array.prototype.slice.call(document.querySelectorAll("main > section"));
      var current = sections.findIndex(function (s) {
        var rect = s.getBoundingClientRect();
        return rect.top <= 100 && rect.bottom > 100;
      });
      var targetIndex = direction === "next" ? current + 1 : current - 1;
      var target = sections[targetIndex];
      if (target) {
        target.scrollIntoView({ behavior: "smooth" });
      }
    });
  });

  /* Contact form: static demo submit feedback (no backend) */
  var form = document.querySelector(".contact-form form");
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var note = form.querySelector(".form-note");
      if (note) {
        note.textContent = "Mensagem enviada! Retornaremos em breve.";
        note.classList.add("visible");
      }
      form.reset();
    });
  }

  /* Highlight active nav link based on current page/hash */
  var links = document.querySelectorAll(".nav-links a, .nav-mobile a");
  var path = window.location.pathname.split("/").pop() || "index.html";
  links.forEach(function (link) {
    var href = link.getAttribute("href");
    if (!href) return;
    var hrefPage = href.split("#")[0].split("/").pop();
    if (hrefPage === path || (hrefPage === "" && path === "index.html")) {
      link.classList.add("active");
    }
  });
});
