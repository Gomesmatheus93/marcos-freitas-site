/**
 * Widget de notícias jurídicas "ao vivo".
 * Busca manchetes direto no navegador (sem backend/agente) a partir de feeds
 * RSS de portais jurídicos, via proxy público, e atualiza periodicamente.
 */
(function () {
  var FEEDS = [
    { name: "ConJur", url: "https://www.conjur.com.br/rss.xml" },
    { name: "JOTA", url: "https://www.jota.info/feed" },
    {
      name: "Google Notícias",
      url:
        "https://news.google.com/rss/search?q=direito+justiça+STF+STJ+advocacia+when:2d&hl=pt-BR&gl=BR&ceid=BR:pt-419",
    },
  ];

  var CACHE_KEY = "mf_legal_news_cache_v1";
  var REFRESH_MS = 10 * 60 * 1000; // 10 minutos
  var FETCH_TIMEOUT_MS = 9000;
  var MAX_ITEMS = 8;

  var listEl = document.getElementById("news-list");
  var statusEl = document.getElementById("news-status");
  var refreshBtn = document.getElementById("news-refresh");

  if (!listEl) return;

  function withTimeout(promise, ms) {
    var controllerTimeout = new Promise(function (_, reject) {
      setTimeout(function () {
        reject(new Error("timeout"));
      }, ms);
    });
    return Promise.race([promise, controllerTimeout]);
  }

  function stripHtml(html) {
    var tmp = document.createElement("div");
    tmp.innerHTML = html || "";
    return (tmp.textContent || tmp.innerText || "").trim();
  }

  function viaRss2Json(feed) {
    var endpoint =
      "https://api.rss2json.com/v1/api.json?rss_url=" +
      encodeURIComponent(feed.url);
    return withTimeout(fetch(endpoint), FETCH_TIMEOUT_MS)
      .then(function (res) {
        if (!res.ok) throw new Error("rss2json http " + res.status);
        return res.json();
      })
      .then(function (data) {
        if (data.status !== "ok" || !Array.isArray(data.items)) {
          throw new Error("rss2json status");
        }
        return data.items.map(function (item) {
          return {
            title: stripHtml(item.title),
            link: item.link,
            date: item.pubDate,
            source: feed.name,
          };
        });
      });
  }

  function viaAllOrigins(feed) {
    var endpoint =
      "https://api.allorigins.win/raw?url=" + encodeURIComponent(feed.url);
    return withTimeout(fetch(endpoint), FETCH_TIMEOUT_MS)
      .then(function (res) {
        if (!res.ok) throw new Error("allorigins http " + res.status);
        return res.text();
      })
      .then(function (xmlText) {
        var doc = new DOMParser().parseFromString(xmlText, "text/xml");
        if (doc.querySelector("parsererror")) throw new Error("xml parse error");
        var nodes = Array.prototype.slice.call(doc.querySelectorAll("item"));
        return nodes.map(function (node) {
          var titleNode = node.querySelector("title");
          var linkNode = node.querySelector("link");
          var dateNode = node.querySelector("pubDate");
          return {
            title: stripHtml(titleNode ? titleNode.textContent : ""),
            link: linkNode ? linkNode.textContent : "#",
            date: dateNode ? dateNode.textContent : "",
            source: feed.name,
          };
        });
      });
  }

  function fetchFeed(feed) {
    return viaRss2Json(feed).catch(function () {
      return viaAllOrigins(feed);
    });
  }

  function relativeTime(dateStr) {
    var date = new Date(dateStr);
    if (isNaN(date.getTime())) return "";
    var diffMs = Date.now() - date.getTime();
    var minutes = Math.round(diffMs / 60000);
    if (minutes < 1) return "agora mesmo";
    if (minutes < 60) return "há " + minutes + " min";
    var hours = Math.round(minutes / 60);
    if (hours < 24) return "há " + hours + "h";
    var days = Math.round(hours / 24);
    if (days < 7) return "há " + days + "d";
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  }

  function dedupe(items) {
    var seen = {};
    return items.filter(function (item) {
      var key = (item.title || "").toLowerCase().slice(0, 60);
      if (!key || seen[key]) return false;
      seen[key] = true;
      return true;
    });
  }

  function render(items) {
    if (!items.length) {
      listEl.innerHTML =
        '<li class="news-empty">Não foi possível carregar as notícias agora. ' +
        '<a href="https://www.conjur.com.br" target="_blank" rel="noopener">Visite o ConJur</a> diretamente.</li>';
      return;
    }

    listEl.innerHTML = items
      .slice(0, MAX_ITEMS)
      .map(function (item) {
        return (
          '<li class="news-item">' +
          '<a href="' + item.link + '" target="_blank" rel="noopener">' +
          '<span class="news-source">' + item.source + "</span>" +
          '<span class="news-title">' + item.title + "</span>" +
          '<span class="news-time">' + relativeTime(item.date) + "</span>" +
          "</a>" +
          "</li>"
        );
      })
      .join("");
  }

  function renderSkeleton() {
    listEl.innerHTML = new Array(6)
      .fill(0)
      .map(function () {
        return '<li class="news-item news-skeleton"><span></span></li>';
      })
      .join("");
  }

  function setStatus(text) {
    if (statusEl) statusEl.textContent = text;
  }

  function loadFromCache() {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function saveToCache(items) {
    try {
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ items: items, savedAt: Date.now() })
      );
    } catch (e) {
      /* localStorage indisponível, seguimos sem cache */
    }
  }

  function refresh(isManual) {
    if (isManual) renderSkeleton();
    setStatus("Buscando notícias...");

    Promise.allSettled(FEEDS.map(fetchFeed))
      .then(function (results) {
        var items = [];
        results.forEach(function (result) {
          if (result.status === "fulfilled") {
            items = items.concat(result.value);
          }
        });

        items = dedupe(items).sort(function (a, b) {
          return new Date(b.date) - new Date(a.date);
        });

        if (items.length) {
          render(items);
          saveToCache(items);
          setStatus(
            "Ao vivo · atualizado às " +
              new Date().toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })
          );
        } else {
          var cached = loadFromCache();
          if (cached && cached.items && cached.items.length) {
            render(cached.items);
            setStatus("Exibindo última versão salva (sem conexão com os feeds agora)");
          } else {
            render([]);
            setStatus("Não foi possível conectar aos feeds de notícias");
          }
        }
      })
      .catch(function () {
        render([]);
        setStatus("Não foi possível conectar aos feeds de notícias");
      });
  }

  var cached = loadFromCache();
  if (cached && cached.items && cached.items.length) {
    render(cached.items);
    setStatus(
      "Carregado do cache · atualizando em segundo plano..."
    );
  } else {
    renderSkeleton();
  }

  refresh(false);
  setInterval(function () {
    refresh(false);
  }, REFRESH_MS);

  if (refreshBtn) {
    refreshBtn.addEventListener("click", function () {
      refresh(true);
    });
  }
})();
