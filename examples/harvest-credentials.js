// harvest-credentials.js
//
// Paste this into the DevTools console of a logged-in kick.com tab.
// It prints (and copies to your clipboard) a "bag" of auth artifacts in the
// exact shape @retconned/kick-js expects for client.login({ bag }).
//
//   1. Open https://kick.com and make sure you are logged in.
//   2. Open DevTools → Console, paste this file's contents, press Enter.
//   3. The bag JSON is copied to your clipboard — paste it into your bot.
//
// Note: JS cannot read HttpOnly cookies, and Kick marks its session cookie
// HttpOnly — so it will NOT appear below. That is fine: the library promotes
// a token from the bag's storage entries / cookies, and Kick's API is
// Bearer-authenticated, so no XSRF token is needed. If promotion fails, copy
// the full `Cookie:` request header + `Authorization: Bearer ...` value from
// any /api/v2 request in the Network tab instead and use:
//   client.login({ accessToken, cookies });
(() => {
  const bag = {};

  // document.cookie (non-HttpOnly cookies) — values stay URI-encoded, the
  // library decodes only where needed (e.g. the XSRF token header).
  for (const part of document.cookie.split(";")) {
    const i = part.indexOf("=");
    if (i > 0) {
      const name = part.slice(0, i).trim();
      const value = part.slice(i + 1).trim();
      if (name && value) bag[name] = value;
    }
  }

  // localStorage entries with meaningful values
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    const value = localStorage.getItem(key);
    if (key && value && value.length > 10) {
      bag[`__ls_${key}`] = value;
    }
  }

  // sessionStorage entries with meaningful values
  for (let i = 0; i < sessionStorage.length; i += 1) {
    const key = sessionStorage.key(i);
    const value = sessionStorage.getItem(key);
    if (key && value && value.length > 10) {
      bag[`__ss_${key}`] = value;
    }
  }

  const json = JSON.stringify(bag, null, 2);
  console.log(json);

  if (typeof copy === "function") {
    copy(json);
    console.info(
      "%c Bag copied to clipboard! Use it as:\n" +
        'client.login({ bag: <paste here> });',
      "color:#53fc18;font-weight:bold",
    );
  } else {
    console.warn("copy() unavailable outside devtools — copy manually.");
  }
})();
