// SKILLTOOLS - Cloudflare Worker
// Configure these Worker Secrets/Variables in Cloudflare:
// FOUNDER_EMAIL = your founder email
// FOUNDER_CODE = your private founder code

export default {
async fetch(request, env) {
const runtimeEnv = {
FOUNDER_EMAIL: String(env.FOUNDER_EMAIL || "").trim().toLowerCase(),
FOUNDER_CODE: String(env.FOUNDER_CODE || "")
};
return cloudflareStyleFetch(request, runtimeEnv);
}
};

async function cloudflareStyleFetch(request, env) {
const url = new URL(request.url);

if (url.pathname === "/api/founder/login" && request.method === "POST") {
return founderLogin(request, env);
}

if (url.pathname === "/api/founder/check") {
return founderCheck(request, env);
}

if (url.pathname === "/api/founder/logout" && request.method === "POST") {
return new Response(JSON.stringify({ ok: true }), {
headers: {
"content-type": "application/json",
"set-cookie":
"st_founder=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0"
}
});
}

return new Response(page(), {
headers: {
"content-type": "text/html;charset=UTF-8"
}
});
}

async function founderLogin(request, env) {
try {
const data = await request.json();
const email = String(data.email || "").trim().toLowerCase();
const code = String(data.code || "");

if (!env.FOUNDER_CODE) {  
  return json({  
    ok: false,  
    error: "Le Secret FOUNDER_CODE n’est pas configuré dans Cloudflare."  
  }, 500);  
}  

if (email !== FOUNDER_EMAIL || !constantTimeEqual(code, env.FOUNDER_CODE)) {  
  return json({ ok: false, error: "Accès refusé." }, 401);  
}  

const token = await makeToken(email, env.FOUNDER_CODE);  

return new Response(JSON.stringify({ ok: true }), {  
  headers: {  
    "content-type": "application/json",  
    "cache-control": "no-store",  
    "set-cookie":  
      `st_founder=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=3600`  
  }  
});

} catch {
return json({ ok: false, error: "Requête invalide." }, 400);
}
}

async function founderCheck(request, env) {
const token = getCookie(request, "st_founder");

if (!token || !env.FOUNDER_CODE) {
return json({ ok: false }, 401);
}

const valid = await verifyToken(
token,
FOUNDER_EMAIL,
env.FOUNDER_CODE
);

return json({ ok: valid }, valid ? 200 : 401);
}

async function makeToken(email, secret) {
const timestamp = Math.floor(Date.now() / 1000);
const signature = await hmac(email + "|" + timestamp, secret);
return b64(email + "|" + timestamp + "|" + signature);
}

async function verifyToken(token, email, secret) {
try {
const raw = atob(
token.replace(/-/g, "+").replace(/_/g, "/")
);

const parts = raw.split("|");  

if (parts.length !== 3 || parts[0] !== email) {  
  return false;  
}  

const timestamp = Number(parts[1]);  

if (!Number.isFinite(timestamp)) {  
  return false;  
}  

const age = Math.floor(Date.now() / 1000) - timestamp;  

if (age < 0 || age > 3600) {  
  return false;  
}  

const expected = await hmac(  
  email + "|" + timestamp,  
  secret  
);  

return constantTimeEqual(parts[2], expected);

} catch {
return false;
}
}

async function hmac(text, secret) {
const key = await crypto.subtle.importKey(
"raw",
new TextEncoder().encode(secret),
{ name: "HMAC", hash: "SHA-256" },
false,
["sign"]
);
const signature = await crypto.subtle.sign(
"HMAC",
key,
new TextEncoder().encode(text)
);
return base64url(new Uint8Array(signature));
}

function base64url(bytes) {
let binary = "";
for (const byte of bytes) binary += String.fromCharCode(byte);
return btoa(binary).replace(/+/g, "-").replace(///g, "_").replace(/=+$/g, "");
}

function constantTimeEqual(a, b) {
a = String(a);
b = String(b);

if (a.length !== b.length) return false;

let result = 0;

for (let i = 0; i < a.length; i++) {
result |= a.charCodeAt(i) ^ b.charCodeAt(i);
}

return result === 0;
}

function b64(value) {
return btoa(value)
.replace(/+/g, "-")
.replace(///g, "_")
.replace(/=+$/g, "");
}

function getCookie(request, name) {
const cookies = request.headers.get("Cookie") || "";

const item = cookies
.split(";")
.map(x => x.trim())
.find(x => x.startsWith(name + "="));

return item ? item.slice(name.length + 1) : "";
}

function json(data, status = 200) {
return new Response(JSON.stringify(data), {
status,
headers: {
"content-type": "application/json",
"cache-control": "no-store"
}
});
}

function page() {
const cards = CONTENT.map(
([name, icon, description, id]) =>   <article class="card" data-category="${id}">   <div class="icon">${escapeHtml(icon)}</div>   <h3>${escapeHtml(name)}</h3>   <p>${escapeHtml(description)}</p>   <button onclick="openPage('${id}')">EN SAVOIR PLUS →</button>   </article>  
).join("");

const navigation = CONTENT.map(
([name, , , id]) =>
<button onclick="openPage('${id}')">${escapeHtml(name)}</button>
).join("");

const articles = CONTENT.map(
([name, icon, description, id]) => {
const article = ARTICLES[id];

return `  
    <section id="${id}" class="page">  
      <h2>// ${escapeHtml(name)}</h2>  

      <p class="intro">${escapeHtml(description)}</p>  

      <div class="box">  
        <h3>${escapeHtml(article ? article[1] : name)}</h3>  
        <p>${escapeHtml(article ? article[2] : description)}</p>  
      </div>  

      <div class="box">  
        <h3>À RETENIR</h3>  
        <p>  
          SkillTools présente ces notions dans un objectif éducatif.  
          Respecte toujours la loi, la vie privée et les règles des services utilisés.  
        </p>  
      </div>  
    </section>  
  `;  
}

).join("");

return `<!DOCTYPE html>

<html lang="fr">  
<head>  
<meta charset="UTF-8">  
<meta name="viewport" content="width=device-width,initial-scale=1">  
<title>SKILLTOOLS</title>  <style>  
:root {  
  --primary: #ff009d;  
  --primary-soft: rgba(255,0,157,.13);  
  --primary-light: #ff9dde;  
  --border: rgba(255,0,157,.42);  
  --bg: #020002;  
  --panel: #040004;  
}  
  
* { box-sizing: border-box; }  
  
html { scroll-behavior: smooth; }  
  
body {  
  margin: 0;  
  background: var(--bg);  
  color: var(--primary-light);  
  font-family: "Courier New", monospace;  
}  
  
button,input,select,textarea { font-family: inherit; }  
  
button { touch-action: manipulation; }  
  
.header {  
  min-height: 74px;  
  position: sticky;  
  top: 0;  
  z-index: 10;  
  background: #030003ee;  
  border-bottom: 1px solid var(--border);  
  display: flex;  
  align-items: center;  
  padding: 12px 28px;  
  gap: 30px;  
  backdrop-filter: blur(8px);  
}  
  
.brand {  
  color: var(--primary);  
  cursor: pointer;  
  min-width: 245px;  
  user-select: none;  
}  
  
.brand b { font-size: 20px; }  
  
.brand small {  
  display: block;  
  font-size: 9px;  
  margin-top: 4px;  
}  
  
.nav {  
  display: flex;  
  gap: 18px;  
  overflow: auto;  
}  
  
.nav button {  
  background: none;  
  border: 0;  
  color: var(--primary);  
  white-space: nowrap;  
  cursor: pointer;  
  font: 11px "Courier New";  
}  
  
.nav button:hover { color: white; }  
  
.hero {  
  min-height: 470px;  
  display: grid;  
  grid-template-columns: 43% 57%;  
  border-bottom: 1px solid #3b0029;  
}  
  
.heroText { padding: 70px 45px 40px 65px; }  
  
.hero h1 {  
  color: var(--primary);  
  font-size: 42px;  
  font-weight: 400;  
  line-height: 1.1;  
  margin: 0;  
}  
  
.line {  
  height: 3px;  
  width: 60px;  
  background: var(--primary);  
  margin: 18px 0;  
}  
  
.hero p {  
  font-size: 13px;  
  line-height: 1.8;  
  color: var(--primary-light);  
}  
  
.buttons {  
  display: flex;  
  gap: 12px;  
  margin-top: 25px;  
}  
  
.btn {  
  border: 1px solid var(--primary);  
  background: var(--primary);  
  color: #080008;  
  padding: 13px 18px;  
  cursor: pointer;  
}  
  
.btn.alt {  
  background: transparent;  
  color: var(--primary);  
}  
  
.network {  
  background:  
    radial-gradient(circle,var(--primary-soft),transparent 48%),  
    repeating-linear-gradient(  
      90deg,transparent 0 60px,var(--primary-soft) 61px 62px  
    ),  
    repeating-linear-gradient(  
      0deg,transparent 0 40px,var(--primary-soft) 41px 42px  
    );  
}  
  
.section { padding: 25px 30px; }  
  
.title {  
  text-align: center;  
  color: var(--primary);  
  font-size: 16px;  
  margin-bottom: 18px;  
}  
  
.cards {  
  display: grid;  
  grid-template-columns: repeat(4,1fr);  
  gap: 13px;  
}  
  
.card {  
  border: 1px solid var(--border);  
  background: #050005;  
  padding: 18px;  
  min-height: 165px;  
  transition: .15s;  
}  
  
.card:hover {  
  border-color: var(--primary);  
  box-shadow: 0 0 18px var(--primary-soft);  
  transform: translateY(-2px);  
}  
  
.icon {  
  color: var(--primary);  
  font-size: 28px;  
}  
  
.card h3 {  
  color: var(--primary);  
  font-size: 15px;  
  font-weight: 400;  
}  
  
.card p {  
  font-size: 10px;  
  line-height: 1.7;  
  color: var(--primary-light);  
}  
  
.card button {  
  border: 0;  
  background: none;  
  color: var(--primary);  
  font: 10px "Courier New";  
  cursor: pointer;  
}  
  
.columns {  
  display: grid;  
  grid-template-columns: 1fr 1.2fr 1.2fr;  
  gap: 13px;  
  margin-top: 15px;  
}  
  
.panel,.box {  
  border: 1px solid var(--border);  
  padding: 18px;  
  background: var(--panel);  
}  
  
.panel h3,.box h3 {  
  color: var(--primary);  
  font-size: 13px;  
  font-weight: 400;  
}  
  
.panel p,.panel li,.box p {  
  font-size: 11px;  
  line-height: 1.8;  
  color: var(--primary-light);  
}  
  
.footer {  
  border-top: 1px solid var(--border);  
  padding: 25px 35px;  
  display: flex;  
  justify-content: space-between;  
  font-size: 9px;  
  color: var(--primary-light);  
}  
  
.pink { color: var(--primary); }  
  
.page {  
  display: none;  
  min-height: 75vh;  
  padding: 45px 30px;  
}  
  
.page.show { display: block; }  
  
.page h2 {  
  color: var(--primary);  
  font-size: 28px;  
  font-weight: 400;  
}  
  
.intro {  
  max-width: 850px;  
  line-height: 1.8;  
  color: var(--primary-light);  
  font-size: 12px;  
}  
  
.modal {  
  display: none;  
  position: fixed;  
  inset: 0;  
  background: #000e;  
  z-index: 100;  
  align-items: center;  
  justify-content: center;  
  padding: 15px;  
}  
  
.modal.show { display: flex; }  
  
.modalBox {  
  width: min(430px,92%);  
  border: 1px solid var(--primary);  
  background: #050005;  
  padding: 25px;  
  box-shadow: 0 0 35px var(--primary-soft);  
}  
  
.modalBox h2 {  
  color: var(--primary);  
  font-weight: 400;  
}  
  
.input,.adminInput {  
  width: 100%;  
  padding: 12px;  
  margin: 7px 0;  
  background: #010001;  
  color: white;  
  border: 1px solid var(--border);  
  outline: none;  
}  
  
.input:focus,.adminInput:focus { border-color: var(--primary); }  
  
.error {  
  color: var(--primary);  
  font-size: 11px;  
  display: none;  
}  
  
.founderPanel {  
  margin-top: 25px;  
  display: grid;  
  gap: 15px;  
}  
  
.founderSection {  
  border: 1px solid var(--border);  
  background: #050005;  
  padding: 20px;  
}  
  
.founderSection h3 {  
  margin-top: 0;  
  color: var(--primary);  
  font-size: 14px;  
  font-weight: 400;  
}  
  
.founderGrid {  
  display: grid;  
  grid-template-columns: repeat(2,1fr);  
  gap: 12px;  
}  
  
.control {  
  border: 1px solid var(--border);  
  padding: 15px;  
  background: #030003;  
}  
  
.controlTitle {  
  color: var(--primary);  
  font-size: 11px;  
  margin-bottom: 10px;  
}  
  
.adminButton {  
  border: 1px solid var(--primary);  
  background: var(--primary);  
  color: #050005;  
  padding: 10px 14px;  
  cursor: pointer;  
  margin-top: 5px;  
}  
  
.adminButton.alt {  
  background: transparent;  
  color: var(--primary);  
}  
  
.adminList {  
  display: grid;  
  gap: 8px;  
  margin-top: 12px;  
}  
  
.adminItem {  
  border: 1px solid var(--border);  
  padding: 12px;  
  display: flex;  
  align-items: center;  
  justify-content: space-between;  
  gap: 10px;  
}  
  
.adminItemInfo {  
  display: flex;  
  align-items: center;  
  gap: 10px;  
  min-width: 0;  
}  
  
.adminItemIcon {  
  color: var(--primary);  
  font-size: 20px;  
}  
  
.deleteButton {  
  background: transparent;  
  border: 1px solid #700;  
  color: #f66;  
  padding: 7px 10px;  
  cursor: pointer;  
  flex-shrink: 0;  
}  
  
.smallText {  
  color: var(--primary-light);  
  font-size: 10px;  
  line-height: 1.6;  
}  
  
.founderBadge {  
  display: inline-block;  
  padding: 5px 9px;  
  border: 1px solid var(--primary);  
  color: var(--primary);  
  font-size: 9px;  
  margin-bottom: 10px;  
}  
  
.purchaseGrid {  
  display: grid;  
  grid-template-columns: repeat(3,1fr);  
  gap: 10px;  
}  
  
.shopItem {  
  border: 1px solid var(--border);  
  padding: 15px;  
  background: #030003;  
}  
  
.shopItem h4 {  
  margin: 0 0 8px;  
  color: var(--primary);  
  font-weight: 400;  
}  
  
.price {  
  color: white;  
  font-size: 10px;  
}  
  
.shopItem button {  
  width: 100%;  
  margin-top: 10px;  
}  
  
.customElement {  
  border: 1px solid var(--border);  
  padding: 15px;  
  margin-top: 15px;  
}  
  
.customElement img {  
  max-width: 100%;  
  max-height: 150px;  
  display: block;  
  margin-top: 10px;  
}  
  
/* =========================================================  
   NOUVEL ÉDITEUR DE COULEUR  
   ========================================================= */  
  
.colorEditor {  
  border: 1px solid var(--border);  
  background: #020002;  
  padding: 18px;  
  max-width: 700px;  
}  
  
.colorTop {  
  display: grid;  
  grid-template-columns: minmax(280px,360px) 1fr;  
  gap: 22px;  
  align-items: center;  
}  
  
.colorWheelWrap {  
  width: min(330px,100%);  
  aspect-ratio: 1;  
  position: relative;  
  margin: auto;  
}  
  
#colorWheel,  
#svCanvas {  
  position: absolute;  
  inset: 0;  
  width: 100%;  
  height: 100%;  
  cursor: crosshair;  
}  
  
#svCanvas { pointer-events: auto; }  
  
.colorCenterDot {  
  position: absolute;  
  width: 16px;  
  height: 16px;  
  border: 3px solid white;  
  border-radius: 50%;  
  pointer-events: none;  
  transform: translate(-50%,-50%);  
  box-shadow: 0 0 0 1px #000;  
}  
  
.hexBox {  
  border: 1px solid var(--border);  
  padding: 14px;  
  background: #050005;  
}  
  
.colorPreview {  
  width: 100%;  
  height: 65px;  
  border: 1px solid white;  
  margin-bottom: 12px;  
  background: #ff009d;  
}  
  
.hexInput {  
  width: 100%;  
  padding: 12px;  
  background: #010001;  
  color: white;  
  border: 1px solid var(--border);  
  font-size: 16px;  
  text-transform: uppercase;  
  outline: none;  
}  
  
.colorRows {  
  margin-top: 20px;  
  display: grid;  
  gap: 9px;  
}  
  
.colorRow {  
  display: grid;  
  grid-template-columns: 55px 38px 1fr 38px 62px;  
  gap: 8px;  
  align-items: center;  
}  
  
.colorRowLabel {  
  color: white;  
  font-size: 11px;  
}  
  
.colorRound {  
  width: 38px;  
  height: 38px;  
  border-radius: 50%;  
  border: 0;  
  background: #000;  
  color: white;  
  font-size: 20px;  
  cursor: pointer;  
}  
  
.colorRange {  
  width: 100%;  
  accent-color: var(--primary);  
  cursor: pointer;  
}  
  
.colorNumber {  
  color: white;  
  text-align: right;  
  font-size: 11px;  
}  
  
.colorPresetGrid {  
  display: flex;  
  flex-wrap: wrap;  
  gap: 8px;  
  margin-top: 15px;  
}  
  
.colorPreset {  
  width: 32px;  
  height: 32px;  
  border-radius: 50%;  
  border: 2px solid #777;  
  cursor: pointer;  
}  
  
.colorPreset:hover {  
  border-color: white;  
  transform: scale(1.08);  
}  
  
.editorActions {  
  display: flex;  
  gap: 10px;  
  flex-wrap: wrap;  
  margin-top: 18px;  
}  
  
.saveNotice {  
  color: var(--primary);  
  font-size: 10px;  
  margin-top: 10px;  
}  
  
/* =========================================================  
   LIENS  
   ========================================================= */  
  
.linkGrid {  
  display: grid;  
  grid-template-columns: 1fr 1fr;  
  gap: 10px;  
}  
  
.publicLink {  
  color: var(--primary);  
  text-decoration: none;  
}  
  
.publicLink:hover {  
  color: white;  
  text-decoration: underline;  
}  
  
@media(max-width:900px) {  
  .header { flex-wrap: wrap; }  
  .nav { width: 100%; }  
  .hero { grid-template-columns: 1fr; }  
  .network { min-height: 220px; }  
  .cards { grid-template-columns: repeat(2,1fr); }  
  .columns { grid-template-columns: 1fr; }  
  .founderGrid { grid-template-columns: 1fr; }  
  .purchaseGrid { grid-template-columns: 1fr; }  
  .heroText { padding: 45px 25px; }  
  .colorTop { grid-template-columns: 1fr; }  
}  
  
@media(max-width:600px) {  
  .colorRow {  
    grid-template-columns: 45px 34px 1fr 34px 48px;  
    gap: 5px;  
  }  
  
  .linkGrid { grid-template-columns: 1fr; }  
}  
  
@media(max-width:520px) {  
  .cards { grid-template-columns: 1fr; }  
  .footer {  
    flex-direction: column;  
    gap: 15px;  
    text-align: center;  
  }  
  .hero h1 { font-size: 32px; }  
  .colorWheelWrap { width: 280px; }  
}  
</style>  </head>  <body>  <header class="header">    <div class="brand" id="founderTrigger">  
    <b>♢ SKILLTOOLS</b>  
    <small>COMPRENDRE POUR SE PROTÉGER</small>  
  </div>    <nav class="nav" id="navigation">  
    ${navigation}  
  </nav>  </header>  <main>  <section id="home" class="page show" style="padding:0">    <div class="hero">  <div class="heroText">  

  <h1>  
    COMPRENDRE<br>  
    L’INVISIBLE,<br>  
    POUR MIEUX<br>  
    SE PROTÉGER.  
  </h1>  

  <div class="line"></div>  

  <p>  
    Un site éducatif pour comprendre les concepts  
    clés de la cybersécurité, du renseignement en  
    ligne et des menaces numériques.  
  </p>  

  <div class="buttons">  

    <button class="btn" onclick="document.getElementById('themes').scrollIntoView()">  
      ›_ COMMENCER  
    </button>  

    <button class="btn alt" onclick="openPage('about')">  
      ⓘ À PROPOS  
    </button>  

  </div>  

</div>  

<div class="network"></div>

  </div>    <div id="themes" class="section">  <div class="title">// THÉMATIQUES PRINCIPALES</div>  

<div id="cards" class="cards">${cards}</div>  

<div class="columns">  

  <div class="panel">  
    <h3>// À RETENIR</h3>  
    <ul>  
      <li>L’information est puissante.</li>  
      <li>La connaissance est une arme.</li>  
      <li>La protection est essentielle.</li>  
      <li>L’éthique fait la différence.</li>  
    </ul>  
  </div>  

  <div class="panel">  
    <h3>// MYTHE OU RÉALITÉ ?</h3>  

    <p>  
      Un VPN rend totalement intraçable.  
      <b class="pink">MYTHE</b>  
    </p>  

    <p>  
      Les DDoS peuvent être illégaux.  
      <b class="pink">RÉALITÉ</b>  
    </p>  

    <p>  
      Les réseaux sociaux peuvent exposer  
      des informations.  
      <b class="pink">RÉALITÉ</b>  
    </p>  
  </div>  

  <div class="panel">  
    <h3>// NOS LIENS</h3>  
    <div id="publicLinks"></div>  
  </div>  

</div>  

<div id="customElements"></div>

  </div>  </section>  ${articles}

<section id="about" class="page">    <h2>// À PROPOS</h2>    <p class="intro">  
    SkillTools est un site éducatif consacré à la  
    compréhension de la cybersécurité, du renseignement  
    numérique et des risques en ligne.  
  </p>  </section>  <section id="admin" class="page">    <h2>// ESPACE FONDATEUR</h2>    <span class="founderBadge">  
    ● FONDATEUR — ACCÈS PRIVÉ  
  </span>    <p class="intro">  
    Interface privée de gestion de SKILLTOOLS.  
    Les modifications locales sont conservées dans ce navigateur.  
  </p>    <div class="founderPanel">  <!-- ================= APPARENCE ================= -->  

<div class="founderSection">  

  <h3>// ÉDITEUR DE COULEUR</h3>  

  <div class="colorEditor">  

    <div class="colorTop">  

      <div class="colorWheelWrap">  

        <canvas id="colorWheel"></canvas>  
        <canvas id="svCanvas"></canvas>  

        <div  
          id="wheelDot"  
          class="colorCenterDot"  
          style="left:50%;top:50%"  
        ></div>  

      </div>  

      <div class="hexBox">  

        <div  
          id="colorPreview"  
          class="colorPreview"  
        ></div>  

        <div class="controlTitle">  
          COULEUR HEX  
        </div>  

        <input  
          id="hexColor"  
          class="hexInput"  
          value="#FF009D"  
          maxlength="7"  
          spellcheck="false"  
        >  

        <p class="smallText">  
          Choisis directement une couleur avec la roue,  
          le losange central, les curseurs ou le code HEX.  
        </p>  

      </div>  

    </div>  

    <div class="colorRows">  

      <div class="colorRow">  
        <span class="colorRowLabel">HUE</span>  
        <button class="colorRound" onclick="adjustColor('h',-1)">−</button>  
        <input id="hueRange" class="colorRange" type="range" min="0" max="360" value="320">  
        <button class="colorRound" onclick="adjustColor('h',1)">+</button>  
        <span id="hueNumber" class="colorNumber">320°</span>  
      </div>  

      <div class="colorRow">  
        <span class="colorRowLabel">SAT</span>  
        <button class="colorRound" onclick="adjustColor('s',-1)">−</button>  
        <input id="satRange" class="colorRange" type="range" min="0" max="100" value="100">  
        <button class="colorRound" onclick="adjustColor('s',1)">+</button>  
        <span id="satNumber" class="colorNumber">100%</span>  
      </div>  

      <div class="colorRow">  
        <span class="colorRowLabel">LUM</span>  
        <button class="colorRound" onclick="adjustColor('v',-1)">−</button>  
        <input id="valueRange" class="colorRange" type="range" min="0" max="100" value="100">  
        <button class="colorRound" onclick="adjustColor('v',1)">+</button>  
        <span id="valueNumber" class="colorNumber">100%</span>  
      </div>  

      <div class="colorRow">  
        <span class="colorRowLabel">RED</span>  
        <button class="colorRound" onclick="adjustColor('r',-1)">−</button>  
        <input id="redRange" class="colorRange" type="range" min="0" max="255" value="255">  
        <button class="colorRound" onclick="adjustColor('r',1)">+</button>  
        <span id="redNumber" class="colorNumber">255</span>  
      </div>  

      <div class="colorRow">  
        <span class="colorRowLabel">GREEN</span>  
        <button class="colorRound" onclick="adjustColor('g',-1)">−</button>  
        <input id="greenRange" class="colorRange" type="range" min="0" max="255" value="0">  
        <button class="colorRound" onclick="adjustColor('g',1)">+</button>  
        <span id="greenNumber" class="colorNumber">0</span>  
      </div>  

      <div class="colorRow">  
        <span class="colorRowLabel">BLUE</span>  
        <button class="colorRound" onclick="adjustColor('b',-1)">−</button>  
        <input id="blueRange" class="colorRange" type="range" min="0" max="255" value="157">  
        <button class="colorRound" onclick="adjustColor('b',1)">+</button>  
        <span id="blueNumber" class="colorNumber">157</span>  
      </div>  

      <div class="colorRow">  
        <span class="colorRowLabel">ALPHA</span>  
        <button class="colorRound" onclick="adjustColor('a',-1)">−</button>  
        <input id="alphaRange" class="colorRange" type="range" min="0" max="100" value="100">  
        <button class="colorRound" onclick="adjustColor('a',1)">+</button>  
        <span id="alphaNumber" class="colorNumber">100%</span>  
      </div>  

    </div>  

    <div class="colorPresetGrid">  

      <button class="colorPreset" style="background:#ff009d" onclick="setEditorColor('#FF009D')" title="Magenta"></button>  
      <button class="colorPreset" style="background:#0066ff" onclick="setEditorColor('#0066FF')" title="Bleu"></button>  
      <button class="colorPreset" style="background:#ff2222" onclick="setEditorColor('#FF2222')" title="Rouge"></button>  
      <button class="colorPreset" style="background:#00d084" onclick="setEditorColor('#00D084')" title="Vert"></button>  
      <button class="colorPreset" style="background:#8b5cf6" onclick="setEditorColor('#8B5CF6')" title="Violet"></button>  
      <button class="colorPreset" style="background:#00c8ff" onclick="setEditorColor('#00C8FF')" title="Cyan"></button>  
      <button class="colorPreset" style="background:#ff8a00" onclick="setEditorColor('#FF8A00')" title="Orange"></button>  
      <button class="colorPreset" style="background:#ffffff" onclick="setEditorColor('#FFFFFF')" title="Blanc"></button>  
      <button class="colorPreset" style="background:#000000" onclick="setEditorColor('#000000')" title="Noir"></button>  

    </div>  

    <div class="editorActions">  

      <button class="adminButton" onclick="saveTheme()">  
        ✓ SAUVEGARDER LA COULEUR  
      </button>  

      <button class="adminButton alt" onclick="resetTheme()">  
        RÉINITIALISER  
      </button>  

    </div>  

    <div id="saveNotice" class="saveNotice"></div>  

  </div>  

</div>  

<!-- ================= CATEGORIES ================= -->  

<div class="founderSection">  

  <h3>// GESTION DES CATÉGORIES PERSONNALISÉES</h3>  

  <div class="control">  

    <input id="categoryName" class="adminInput" placeholder="Nom de la catégorie">  
    <input id="categoryIcon" class="adminInput" placeholder="Emoji / icône">  
    <input id="categoryDescription" class="adminInput" placeholder="Description">  

    <button class="adminButton" onclick="addCategory()">  
      + AJOUTER LA CATÉGORIE  
    </button>  

  </div>  

  <div id="categoryAdminList" class="adminList"></div>  

</div>  

<!-- ================= ELEMENTS ================= -->  

<div class="founderSection">  

  <h3>// AJOUTER DES ÉLÉMENTS</h3>  

  <div class="control">  

    <input id="elementTitle" class="adminInput" placeholder="Titre de l’élément">  
    <input id="elementText" class="adminInput" placeholder="Texte de l’élément">  
    <input id="elementEmoji" class="adminInput" placeholder="Emoji">  
    <input id="elementImage" class="adminInput" placeholder="URL d'une image ou d'un GIF (optionnel)">  

    <button class="adminButton" onclick="addElement()">  
      + AJOUTER L’ÉLÉMENT  
    </button>  

  </div>  

  <div id="elementAdminList" class="adminList"></div>  

</div>  

<!-- ================= LIENS ================= -->  

<div class="founderSection">  

  <h3>// GESTION DES LIENS</h3>  

  <div class="control">  

    <div class="linkGrid">  

      <input id="linkName" class="adminInput" placeholder="Nom du lien">  
      <input id="linkUrl" class="adminInput" placeholder="https://...">  

    </div>  

    <button class="adminButton" onclick="addLink()">  
      + AJOUTER LE LIEN  
    </button>  

  </div>  

  <div id="linkAdminList" class="adminList"></div>  

</div>  

<!-- ================= EMOJIS ================= -->  

<div class="founderSection">  

  <h3>// BOUTIQUE D’EMOJIS</h3>  

  <p class="smallText">  
    Les achats ci-dessous sont simulés localement.  
    Aucun paiement réel n’est effectué.  
  </p>  

  <div class="purchaseGrid">  

    <div class="shopItem">  
      <h4>⚡ PACK CYBER</h4>  
      <div class="price">100 crédits</div>  
      <button class="adminButton" onclick="buyEmoji('⚡')">ACHETER</button>  
    </div>  

    <div class="shopItem">  
      <h4>👾 PACK HACKER</h4>  
      <div class="price">150 crédits</div>  
      <button class="adminButton" onclick="buyEmoji('👾')">ACHETER</button>  
    </div>  

    <div class="shopItem">  
      <h4>💻 PACK TECH</h4>  
      <div class="price">200 crédits</div>  
      <button class="adminButton" onclick="buyEmoji('💻')">ACHETER</button>  
    </div>  

  </div>  

  <div id="emojiInventory" class="adminList"></div>  

</div>  

<!-- ================= SESSION ================= -->  

<div class="founderSection">  

  <h3>// SESSION</h3>  

  <button class="adminButton alt" onclick="logout()">  
    SE DÉCONNECTER  
  </button>  

</div>

  </div>  </section>  </main>  <footer class="footer">    <div>  
    root@skilltools:~#<br>  
    Apprendre. Comprendre. Se protéger.  
  </div>    <div id="footerLinks"></div>    <div>© 2026 SKILLTOOLS</div>  </footer>  <div id="modal" class="modal">    <div class="modalBox">  <h2>// ACCÈS FONDATEUR</h2>  

<p class="intro">  
  Accès réservé au compte fondateur.  
</p>  

<input id="email" class="input" type="email" autocomplete="username" placeholder="Adresse e-mail">  

<input id="code" class="input" type="password" autocomplete="current-password" placeholder="Code d’accès">  

<p id="error" class="error">Accès refusé.</p>  

<button class="btn" style="width:100%" onclick="login()">  
  ENTRER  
</button>  

<br><br>  

<button class="btn alt" style="width:100%" onclick="closeLogin()">  
  ANNULER  
</button>

  </div>  </div>  <script>  
/* =========================================================  
   NAVIGATION  
   ========================================================= */  
  
function openPage(id) {  
  document.querySelectorAll(".page").forEach(page => {  
    page.classList.remove("show");  
  });  
  
  const page = document.getElementById(id);  
  
  if (page) {  
    page.classList.add("show");  
  }  
  
  window.scrollTo({ top: 0, behavior: "smooth" });  
}  
  
function home() {  
  openPage("home");  
}  
  
/* =========================================================  
   LOGIN FONDATEUR  
   ========================================================= */  
  
function showLogin() {  
  document.getElementById("modal").classList.add("show");  
  setTimeout(() => document.getElementById("email").focus(), 50);  
}  
  
function closeLogin() {  
  document.getElementById("modal").classList.remove("show");  
  document.getElementById("code").value = "";  
}  
  
async function login() {  
  const email = document.getElementById("email").value.trim();  
  const code = document.getElementById("code").value;  
  const error = document.getElementById("error");  
  
  error.style.display = "none";  
  
  try {  
    const response = await fetch("/api/founder/login", {  
      method: "POST",  
      headers: { "content-type": "application/json" },  
      body: JSON.stringify({ email, code })  
    });  
  
    const result = await response.json();  
  
    if (!response.ok || !result.ok) {  
      error.textContent = result.error || "Accès refusé.";  
      error.style.display = "block";  
      return;  
    }  
  
    closeLogin();  
    openPage("admin");  
    loadFounderData();  
  
  } catch {  
    error.textContent = "Erreur de connexion.";  
    error.style.display = "block";  
  }  
}  
  
async function logout() {  
  await fetch("/api/founder/logout", { method: "POST" });  
  openPage("home");  
}  
  
/* =========================================================  
   THEME  
   ========================================================= */  
  
let colorState = {  
  h: 320,  
  s: 100,  
  v: 100,  
  r: 255,  
  g: 0,  
  b: 157,  
  a: 100  
};  
  
function changeTheme(color, alpha = 100) {  
  if (!/^#[0-9A-F]{6}$/i.test(color)) return;  
  
  const rgb = hexToRgb(color);  
  
  colorState.r = rgb.r;  
  colorState.g = rgb.g;  
  colorState.b = rgb.b;  
  colorState.a = alpha;  
  
  const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);  
  
  colorState.h = hsv.h;  
  colorState.s = hsv.s;  
  colorState.v = hsv.v;  
  
  applyTheme();  
  
  updateColorEditor(false);  
}  
  
function applyTheme() {  
  const color = rgbToHex(  
    colorState.r,  
    colorState.g,  
    colorState.b  
  );  
  
  document.documentElement.style.setProperty(  
    "--primary",  
    color  
  );  
  
  document.documentElement.style.setProperty(  
    "--primary-soft",  
    hexToRgba(color, Math.max(0, Math.min(1, colorState.a / 100 * .13)))  
  );  
  
  document.documentElement.style.setProperty(  
    "--border",  
    hexToRgba(color, Math.max(0, Math.min(1, colorState.a / 100 * .42)))  
  );  
  
  document.documentElement.style.setProperty(  
    "--primary-light",  
    mixColor(color, "#ffffff", .45)  
  );  
}  
  
function saveTheme() {  
  const data = {  
    color: rgbToHex(  
      colorState.r,  
      colorState.g,  
      colorState.b  
    ),  
    alpha: colorState.a  
  };  
  
  localStorage.setItem(  
    "skilltools_theme",  
    JSON.stringify(data)  
  );  
  
  const notice = document.getElementById("saveNotice");  
  
  if (notice) {  
    notice.textContent = "✓ Couleur enregistrée dans ce navigateur.";  
    setTimeout(() => {  
      notice.textContent = "";  
    }, 2500);  
  }  
}  
  
function resetTheme() {  
  setEditorColor("#FF009D");  
  colorState.a = 100;  
  updateColorEditor(true);  
  saveTheme();  
}  
  
function loadTheme() {  
  try {  
    const saved = JSON.parse(  
      localStorage.getItem("skilltools_theme") || "null"  
    );  
  
    if (saved && saved.color) {  
      changeTheme(saved.color, Number(saved.alpha ?? 100));  
      return;  
    }  
  } catch {}  
  
  changeTheme("#FF009D", 100);  
}  
  
/* =========================================================  
   COLOR EDITOR - ROUE + LOSANGE  
   ========================================================= */  
  
const wheelCanvas = document.getElementById("colorWheel");  
const svCanvas = document.getElementById("svCanvas");  
  
let wheelCtx;  
let svCtx;  
  
function setupColorCanvases() {  
  if (!wheelCanvas || !svCanvas) return;  
  
  const size = wheelCanvas.clientWidth || 330;  
  const dpr = window.devicePixelRatio || 1;  
  
  wheelCanvas.width = size * dpr;  
  wheelCanvas.height = size * dpr;  
  svCanvas.width = size * dpr;  
  svCanvas.height = size * dpr;  
  
  wheelCtx = wheelCanvas.getContext("2d");  
  svCtx = svCanvas.getContext("2d");  
  
  wheelCtx.setTransform(dpr,0,0,dpr,0,0);  
  svCtx.setTransform(dpr,0,0,dpr,0,0);  
  
  drawColorWheel(size);  
  drawSV(size);  
  positionWheelDot(size);  
}  
  
function drawColorWheel(size) {  
  const ctx = wheelCtx;  
  const center = size / 2;  
  const outer = size * .46;  
  const inner = size * .32;  
  
  ctx.clearRect(0,0,size,size);  
  
  for (let deg = 0; deg < 360; deg++) {  
    const start = (deg - 1) * Math.PI / 180;  
    const end = (deg + 1) * Math.PI / 180;  
  
    ctx.beginPath();  
    ctx.arc(center, center, outer, start, end);  
    ctx.arc(center, center, inner, end, start, true);  
    ctx.closePath();  
  
    ctx.fillStyle = "hsl(" + deg + ",100%,50%)";  
    ctx.fill();  
  }  
  
  ctx.beginPath();  
  ctx.arc(center, center, inner - 1, 0, Math.PI * 2);  
  ctx.fillStyle = "#111";  
  ctx.fill();  
}  
  
function drawSV(size) {  
  const ctx = svCtx;  
  const center = size / 2;  
  const radius = size * .33;  
  
  ctx.clearRect(0,0,size,size);  
  
  /*  
    On dessine une zone carrée/légèrement losangée au centre,  
    comme le sélecteur montré sur ta capture.  
  */  
  const left = center - radius;  
  const top = center - radius;  
  const width = radius * 2;  
  
  const hueColor = "hsl(" + colorState.h + ",100%,50%)";  
  
  const white = ctx.createLinearGradient(left,0,left+width,0);  
  white.addColorStop(0,"#fff");  
  white.addColorStop(1,hueColor);  
  
  ctx.save();  
  
  ctx.translate(center,center);  
  ctx.rotate(Math.PI / 4);  
  
  ctx.fillStyle = white;  
  ctx.fillRect(-radius,-radius,radius*2,radius*2);  
  
  const black = ctx.createLinearGradient(0,-radius,0,radius);  
  black.addColorStop(0,"rgba(0,0,0,0)");  
  black.addColorStop(1,"rgba(0,0,0,1)");  
  
  ctx.fillStyle = black;  
  ctx.fillRect(-radius,-radius,radius*2,radius*2);  
  
  ctx.restore();  
}  
  
function positionWheelDot(size) {  
  const dot = document.getElementById("wheelDot");  
  if (!dot) return;  
  
  const center = size / 2;  
  const radius = size * .39;  
  const angle = colorState.h * Math.PI / 180;  
  
  const x = center + Math.cos(angle) * radius;  
  const y = center + Math.sin(angle) * radius;  
  
  dot.style.left = (x / size * 100) + "%";  
  dot.style.top = (y / size * 100) + "%";  
  dot.style.background = rgbToHex(  
    colorState.r,  
    colorState.g,  
    colorState.b  
  );  
}  
  
function colorPointFromEvent(event, canvas) {  
  const rect = canvas.getBoundingClientRect();  
  
  return {  
    x: event.clientX - rect.left,  
    y: event.clientY - rect.top,  
    size: rect.width  
  };  
}  
  
function selectHueFromEvent(event) {  
  const p = colorPointFromEvent(event, wheelCanvas);  
  const c = p.size / 2;  
  
  const dx = p.x - c;  
  const dy = p.y - c;  
  
  const distance = Math.sqrt(dx*dx + dy*dy);  
  
  if (distance < p.size * .29 || distance > p.size * .49) {  
    return;  
  }  
  
  let h = Math.atan2(dy,dx) * 180 / Math.PI;  
  
  if (h < 0) h += 360;  
  
  colorState.h = Math.round(h);  
  
  const rgb = hsvToRgb(  
    colorState.h,  
    colorState.s,  
    colorState.v  
  );  
  
  colorState.r = rgb.r;  
  colorState.g = rgb.g;  
  colorState.b = rgb.b;  
  
  applyTheme();  
  updateColorEditor(true);  
}  
  
function selectSVFromEvent(event) {  
  const p = colorPointFromEvent(event, svCanvas);  
  const size = p.size;  
  const c = size / 2;  
  const radius = size * .33;  
  
  let x = p.x - c;  
  let y = p.y - c;  
  
  const angle = -Math.PI / 4;  
  
  const rx = x * Math.cos(angle) - y * Math.sin(angle);  
  const ry = x * Math.sin(angle) + y * Math.cos(angle);  
  
  const s = clamp(  
    ((rx + radius) / (radius * 2)) * 100,  
    0,  
    100  
  );  
  
  const v = clamp(  
    (1 - ((ry + radius) / (radius * 2))) * 100,  
    0,  
    100  
  );  
  
  colorState.s = Math.round(s);  
  colorState.v = Math.round(v);  
  
  const rgb = hsvToRgb(  
    colorState.h,  
    colorState.s,  
    colorState.v  
  );  
  
  colorState.r = rgb.r;  
  colorState.g = rgb.g;  
  colorState.b = rgb.b;  
  
  applyTheme();  
  updateColorEditor(false);  
}  
  
function updateColorEditor(redraw = true) {  
  const color = rgbToHex(  
    colorState.r,  
    colorState.g,  
    colorState.b  
  );  
  
  const ids = {  
    hueRange: colorState.h,  
    satRange: colorState.s,  
    valueRange: colorState.v,  
    redRange: colorState.r,  
    greenRange: colorState.g,  
    blueRange: colorState.b,  
    alphaRange: colorState.a  
  };  
  
  Object.entries(ids).forEach(([id,value]) => {  
    const el = document.getElementById(id);  
    if (el) el.value = value;  
  });  
  
  setText("hueNumber", colorState.h + "°");  
  setText("satNumber", colorState.s + "%");  
  setText("valueNumber", colorState.v + "%");  
  setText("redNumber", colorState.r);  
  setText("greenNumber", colorState.g);  
  setText("blueNumber", colorState.b);  
  setText("alphaNumber", colorState.a + "%");  
  
  const hex = document.getElementById("hexColor");  
  
  if (hex) hex.value = color.toUpperCase();  
  
  const preview = document.getElementById("colorPreview");  
  
  if (preview) {  
    preview.style.background =  
      "rgba(" +  
      colorState.r + "," +  
      colorState.g + "," +  
      colorState.b + "," +  
      colorState.a / 100 +  
      ")";  
  }  
  
  const dot = document.getElementById("wheelDot");  
  
  if (dot) {  
    dot.style.background = color;  
  }  
  
  if (redraw) {  
    const size = wheelCanvas?.clientWidth || 330;  
  
    if (wheelCtx && svCtx) {  
      drawColorWheel(size);  
      drawSV(size);  
      positionWheelDot(size);  
    }  
  } else {  
    if (svCtx) {  
      drawSV(wheelCanvas?.clientWidth || 330);  
    }  
  
    if (wheelCtx) {  
      positionWheelDot(wheelCanvas?.clientWidth || 330);  
    }  
  }  
}  
  
function setEditorColor(hex) {  
  if (!/^#[0-9A-F]{6}$/i.test(hex)) return;  
  
  const rgb = hexToRgb(hex);  
  const hsv = rgbToHsv(rgb.r,rgb.g,rgb.b);  
  
  colorState.r = rgb.r;  
  colorState.g = rgb.g;  
  colorState.b = rgb.b;  
  colorState.h = hsv.h;  
  colorState.s = hsv.s;  
  colorState.v = hsv.v;  
  
  applyTheme();  
  updateColorEditor(true);  
}  
  
function adjustColor(type, amount) {  
  if (type === "h") colorState.h = clamp(colorState.h + amount,0,360);  
  if (type === "s") colorState.s = clamp(colorState.s + amount,0,100);  
  if (type === "v") colorState.v = clamp(colorState.v + amount,0,100);  
  
  if (type === "r") colorState.r = clamp(colorState.r + amount,0,255);  
  if (type === "g") colorState.g = clamp(colorState.g + amount,0,255);  
  if (type === "b") colorState.b = clamp(colorState.b + amount,0,255);  
  if (type === "a") colorState.a = clamp(colorState.a + amount,0,100);  
  
  if (["h","s","v"].includes(type)) {  
    const rgb = hsvToRgb(  
      colorState.h,  
      colorState.s,  
      colorState.v  
    );  
  
    colorState.r = rgb.r;  
    colorState.g = rgb.g;  
    colorState.b = rgb.b;  
  } else if (["r","g","b"].includes(type)) {  
    const hsv = rgbToHsv(  
      colorState.r,  
      colorState.g,  
      colorState.b  
    );  
  
    colorState.h = hsv.h;  
    colorState.s = hsv.s;  
    colorState.v = hsv.v;  
  }  
  
  applyTheme();  
  updateColorEditor(true);  
}  
  
function bindColorEditor() {  
  [  
    ["hueRange","h"],  
    ["satRange","s"],  
    ["valueRange","v"],  
    ["redRange","r"],  
    ["greenRange","g"],  
    ["blueRange","b"],  
    ["alphaRange","a"]  
  ].forEach(([id,type]) => {  
    const el = document.getElementById(id);  
  
    if (!el) return;  
  
    el.addEventListener("input", event => {  
      const value = Number(event.target.value);  
  
      if (type === "h") colorState.h = value;  
      if (type === "s") colorState.s = value;  
      if (type === "v") colorState.v = value;  
      if (type === "r") colorState.r = value;  
      if (type === "g") colorState.g = value;  
      if (type === "b") colorState.b = value;  
      if (type === "a") colorState.a = value;  
  
      if (["h","s","v"].includes(type)) {  
        const rgb = hsvToRgb(  
          colorState.h,  
          colorState.s,  
          colorState.v  
        );  
  
        colorState.r = rgb.r;  
        colorState.g = rgb.g;  
        colorState.b = rgb.b;  
      } else if (["r","g","b"].includes(type)) {  
        const hsv = rgbToHsv(  
          colorState.r,  
          colorState.g,  
          colorState.b  
        );  
  
        colorState.h = hsv.h;  
        colorState.s = hsv.s;  
        colorState.v = hsv.v;  
      }  
  
      applyTheme();  
      updateColorEditor(true);  
    });  
  });  
  
  const hex = document.getElementById("hexColor");  
  
  if (hex) {  
    hex.addEventListener("change", () => {  
      let value = hex.value.trim().toUpperCase();  
  
      if (!value.startsWith("#")) value = "#" + value;  
  
      if (/^#[0-9A-F]{6}$/.test(value)) {  
        setEditorColor(value);  
      } else {  
        hex.value = rgbToHex(  
          colorState.r,  
          colorState.g,  
          colorState.b  
        );  
      }  
    });  
  }  
  
  let hueDown = false;  
  let svDown = false;  
  
  wheelCanvas.addEventListener("pointerdown", event => {  
    hueDown = true;  
    wheelCanvas.setPointerCapture(event.pointerId);  
    selectHueFromEvent(event);  
  });  
  
  wheelCanvas.addEventListener("pointermove", event => {  
    if (hueDown) selectHueFromEvent(event);  
  });  
  
  wheelCanvas.addEventListener("pointerup", () => hueDown = false);  
  wheelCanvas.addEventListener("pointercancel", () => hueDown = false);  
  
  svCanvas.addEventListener("pointerdown", event => {  
    svDown = true;  
    svCanvas.setPointerCapture(event.pointerId);  
    selectSVFromEvent(event);  
  });  
  
  svCanvas.addEventListener("pointermove", event => {  
    if (svDown) selectSVFromEvent(event);  
  });  
  
  svCanvas.addEventListener("pointerup", () => svDown = false);  
  svCanvas.addEventListener("pointercancel", () => svDown = false);  
}  
  
function rgbToHsv(r,g,b) {  
  r /= 255;  
  g /= 255;  
  b /= 255;  
  
  const max = Math.max(r,g,b);  
  const min = Math.min(r,g,b);  
  const d = max - min;  
  
  let h = 0;  
  
  if (d !== 0) {  
    if (max === r) h = 60 * (((g-b)/d) % 6);  
    else if (max === g) h = 60 * (((b-r)/d) + 2);  
    else h = 60 * (((r-g)/d) + 4);  
  }  
  
  if (h < 0) h += 360;  
  
  const s = max === 0 ? 0 : d / max;  
  const v = max;  
  
  return {  
    h: Math.round(h),  
    s: Math.round(s * 100),  
    v: Math.round(v * 100)  
  };  
}  
  
function hsvToRgb(h,s,v) {  
  s /= 100;  
  v /= 100;  
  
  const c = v * s;  
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));  
  const m = v - c;  
  
  let r = 0;  
  let g = 0;  
  let b = 0;  
  
  if (h < 60) {  
    r=c; g=x; b=0;  
  } else if (h < 120) {  
    r=x; g=c; b=0;  
  } else if (h < 180) {  
    r=0; g=c; b=x;  
  } else if (h < 240) {  
    r=0; g=x; b=c;  
  } else if (h < 300) {  
    r=x; g=0; b=c;  
  } else {  
    r=c; g=0; b=x;  
  }  
  
  return {  
    r: Math.round((r+m)*255),  
    g: Math.round((g+m)*255),  
    b: Math.round((b+m)*255)  
  };  
}  
  
function rgbToHex(r,g,b) {  
  return "#" + [r,g,b]  
    .map(x => Number(x).toString(16).padStart(2,"0"))  
    .join("")  
    .toUpperCase();  
}  
  
function hexToRgb(hex) {  
  return {  
    r: parseInt(hex.substring(1,3),16),  
    g: parseInt(hex.substring(3,5),16),  
    b: parseInt(hex.substring(5,7),16)  
  };  
}  
  
function hexToRgba(hex, alpha) {  
  const rgb = hexToRgb(hex);  
  return `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha})`;  
}  
  
function mixColor(color1,color2,amount) {  
  const a = hexToRgb(color1);  
  const b = hexToRgb(color2);  
  
  return `rgb(${  
    Math.round(a.r+(b.r-a.r)*amount)  
  },${  
    Math.round(a.g+(b.g-a.g)*amount)  
  },${  
    Math.round(a.b+(b.b-a.b)*amount)  
  })`;  
}  
  
/* =========================================================  
   CATEGORIES  
   ========================================================= */  
  
function getCustomCategories() {  
  try {  
    return JSON.parse(  
      localStorage.getItem("skilltools_categories") || "[]"  
    );  
  } catch {  
    return [];  
  }  
}  
  
function saveCustomCategories(categories) {  
  localStorage.setItem(  
    "skilltools_categories",  
    JSON.stringify(categories)  
  );  
}  
  
function addCategory() {  
  const name = document.getElementById("categoryName").value.trim();  
  const icon = document.getElementById("categoryIcon").value.trim() || "◇";  
  const description = document.getElementById("categoryDescription").value.trim();  
  
  if (!name || !description) {  
    alert("Ajoute un nom et une description.");  
    return;  
  }  
  
  const categories = getCustomCategories();  
  
  categories.push({  
    id: "custom_" + Date.now(),  
    name,  
    icon,  
    description  
  });  
  
  saveCustomCategories(categories);  
  
  document.getElementById("categoryName").value = "";  
  document.getElementById("categoryIcon").value = "";  
  document.getElementById("categoryDescription").value = "";  
  
  renderCustomCategories();  
}  
  
function deleteCategory(id) {  
  saveCustomCategories(  
    getCustomCategories().filter(category => category.id !== id)  
  );  
  
  renderCustomCategories();  
}  
  
function renderCustomCategories() {  
  const list = document.getElementById("categoryAdminList");  
  if (!list) return;  
  
  const categories = getCustomCategories();  
  
  if (!categories.length) {  
    list.innerHTML = `<p class="smallText">Aucune catégorie personnalisée.</p>`;  
    return;  
  }  
  
  list.innerHTML = categories.map(category => `  
    <div class="adminItem">  
  
      <div class="adminItemInfo">  
  
        <span class="adminItemIcon">  
          ${escapeHtml(category.icon)}  
        </span>  
  
        <div>  
          <strong>${escapeHtml(category.name)}</strong>  
          <div class="smallText">  
            ${escapeHtml(category.description)}  
          </div>  
        </div>  
  
      </div>  
  
      <button  
        class="deleteButton"  
        onclick="deleteCategory('${escapeJs(category.id)}')"  
      >  
        SUPPRIMER  
      </button>  
  
    </div>  
  `).join("");  
}  
  
/* =========================================================  
   ELEMENTS  
   ========================================================= */  
  
function getCustomElements() {  
  try {  
    return JSON.parse(  
      localStorage.getItem("skilltools_elements") || "[]"  
    );  
  } catch {  
    return [];  
  }  
}  
  
function saveCustomElements(elements) {  
  localStorage.setItem(  
    "skilltools_elements",  
    JSON.stringify(elements)  
  );  
}  
  
function addElement() {  
  const title = document.getElementById("elementTitle").value.trim();  
  const text = document.getElementById("elementText").value.trim();  
  const emoji = document.getElementById("elementEmoji").value.trim() || "◇";  
  const image = document.getElementById("elementImage").value.trim();  
  
  if (!title || !text) {  
    alert("Ajoute un titre et un texte.");  
    return;  
  }  
  
  const elements = getCustomElements();  
  
  elements.push({  
    id: "element_" + Date.now(),  
    title,  
    text,  
    emoji,  
    image  
  });  
  
  saveCustomElements(elements);  
  
  document.getElementById("elementTitle").value = "";  
  document.getElementById("elementText").value = "";  
  document.getElementById("elementEmoji").value = "";  
  document.getElementById("elementImage").value = "";  
  
  renderCustomElements();  
}  
  
function deleteElement(id) {  
  saveCustomElements(  
    getCustomElements().filter(element => element.id !== id)  
  );  
  
  renderCustomElements();  
}  
  
function renderCustomElements() {  
  const list = document.getElementById("elementAdminList");  
  const publicList = document.getElementById("customElements");  
  
  if (!list || !publicList) return;  
  
  const elements = getCustomElements();  
  
  if (!elements.length) {  
    list.innerHTML = `<p class="smallText">Aucun élément personnalisé.</p>`;  
    publicList.innerHTML = "";  
    return;  
  }  
  
  list.innerHTML = elements.map(element => `  
    <div class="adminItem">  
  
      <div class="adminItemInfo">  
  
        <span class="adminItemIcon">  
          ${escapeHtml(element.emoji)}  
        </span>  
  
        <div>  
          <strong>${escapeHtml(element.title)}</strong>  
          <div class="smallText">  
            ${escapeHtml(element.text)}  
          </div>  
        </div>  
  
      </div>  
  
      <button  
        class="deleteButton"  
        onclick="deleteElement('${escapeJs(element.id)}')"  
      >  
        SUPPRIMER  
      </button>  
  
    </div>  
  `).join("");  
  
  publicList.innerHTML = `  
    <div class="title">// ÉLÉMENTS AJOUTÉS PAR LE FONDATEUR</div>  
  
    <div class="cards">  
      ${elements.map(element => `  
        <article class="card customElement">  
  
          <div class="icon">${escapeHtml(element.emoji)}</div>  
  
          <h3>${escapeHtml(element.title)}</h3>  
  
          <p>${escapeHtml(element.text)}</p>  
  
          ${  
            element.image && isSafeHttpUrl(element.image)  
              ? `  
                <img  
                  src="${escapeAttribute(element.image)}"  
                  alt=""  
                  loading="lazy"  
                  onerror="this.style.display='none'"  
                >  
              `  
              : ""  
          }  
  
        </article>  
      `).join("")}  
    </div>  
  `;  
}  
  
/* =========================================================  
   LIENS  
   ========================================================= */  
  
function getCustomLinks() {  
  try {  
    return JSON.parse(  
      localStorage.getItem("skilltools_links") || "[]"  
    );  
  } catch {  
    return [];  
  }  
}  
  
function saveCustomLinks(links) {  
  localStorage.setItem(  
    "skilltools_links",  
    JSON.stringify(links)  
  );  
}  
  
function addLink() {  
  const name = document.getElementById("linkName").value.trim();  
  const url = document.getElementById("linkUrl").value.trim();  
  
  if (!name || !url) {  
    alert("Ajoute un nom et une URL.");  
    return;  
  }  
  
  if (!isSafeHttpUrl(url)) {  
    alert("L’URL doit commencer par http:// ou https://");  
    return;  
  }  
  
  const links = getCustomLinks();  
  
  links.push({  
    id: "link_" + Date.now(),  
    name,  
    url  
  });  
  
  saveCustomLinks(links);  
  
  document.getElementById("linkName").value = "";  
  document.getElementById("linkUrl").value = "";  
  
  renderLinks();  
}  
  
function deleteLink(id) {  
  saveCustomLinks(  
    getCustomLinks().filter(link => link.id !== id)  
  );  
  
  renderLinks();  
}  
  
function renderLinks() {  
  const admin = document.getElementById("linkAdminList");  
  const publicLinks = document.getElementById("publicLinks");  
  const footerLinks = document.getElementById("footerLinks");  
  
  const links = getCustomLinks();  
  
  if (admin) {  
    if (!links.length) {  
      admin.innerHTML = `<p class="smallText">Aucun lien personnalisé.</p>`;  
    } else {  
      admin.innerHTML = links.map(link => `  
        <div class="adminItem">  
  
          <div>  
            <strong>${escapeHtml(link.name)}</strong>  
            <div class="smallText">${escapeHtml(link.url)}</div>  
          </div>  
  
          <button  
            class="deleteButton"  
            onclick="deleteLink('${escapeJs(link.id)}')"  
          >  
            SUPPRIMER  
          </button>  
  
        </div>  
      `).join("");  
    }  
  }  
  
  if (publicLinks) {  
    publicLinks.innerHTML = links.length  
      ? links.map(link => `  
          <p>  
            <a  
              class="publicLink"  
              href="${escapeAttribute(link.url)}"  
              target="_blank"  
              rel="noopener noreferrer"  
            >  
              ${escapeHtml(link.name)}  
            </a>  
          </p>  
        `).join("")  
      : `<p class="smallText">Aucun lien personnalisé.</p>`;  
  }  
  
  if (footerLinks) {  
    footerLinks.innerHTML = links.length  
      ? links.map(link => `  
          <a  
            class="pink"  
            href="${escapeAttribute(link.url)}"  
            target="_blank"  
            rel="noopener noreferrer"  
          >  
            ${escapeHtml(link.name)}  
          </a><br>  
        `).join("")  
      : "";  
  }  
}  
  
/* =========================================================  
   EMOJIS  
   ========================================================= */  
  
function getEmojiInventory() {  
  try {  
    return JSON.parse(  
      localStorage.getItem("skilltools_emojis") || "[]"  
    );  
  } catch {  
    return [];  
  }  
}  
  
function buyEmoji(emoji) {  
  const inventory = getEmojiInventory();  
  
  if (inventory.includes(emoji)) {  
    alert("Cet emoji est déjà dans ton inventaire.");  
    return;  
  }  
  
  inventory.push(emoji);  
  
  localStorage.setItem(  
    "skilltools_emojis",  
    JSON.stringify(inventory)  
  );  
  
  renderEmojiInventory();  
  
  alert("Emoji ajouté à ton inventaire.");  
}  
  
function renderEmojiInventory() {  
  const list = document.getElementById("emojiInventory");  
  if (!list) return;  
  
  const inventory = getEmojiInventory();  
  
  if (!inventory.length) {  
    list.innerHTML = `<p class="smallText">Aucun emoji acheté.</p>`;  
    return;  
  }  
  
  list.innerHTML = `  
    <div class="adminItem">  
      <div>  
        <strong>MON INVENTAIRE</strong>  
        <div class="smallText">${inventory.map(escapeHtml).join("   ")}</div>  
      </div>  
    </div>  
  `;  
}  
  
/* =========================================================  
   INITIALISATION FONDATEUR  
   ========================================================= */  
  
function loadFounderData() {  
  loadTheme();  
  renderCustomCategories();  
  renderCustomElements();  
  renderLinks();  
  renderEmojiInventory();  
  
  setTimeout(() => {  
    setupColorCanvases();  
    updateColorEditor(true);  
  }, 50);  
}  
  
/* =========================================================  
   UTILITAIRES  
   ========================================================= */  
  
function setText(id,text) {  
  const el = document.getElementById(id);  
  if (el) el.textContent = text;  
}  
  
function clamp(value,min,max) {  
  return Math.min(max,Math.max(min,value));  
}  
  
function isSafeHttpUrl(value) {  
  try {  
    const url = new URL(value);  
    return url.protocol === "https:" || url.protocol === "http:";  
  } catch {  
    return false;  
  }  
}  
  
function escapeHtml(value) {  
  return String(value)  
    .replace(/&/g,"&amp;")  
    .replace(/</g,"&lt;")  
    .replace(/>/g,"&gt;")  
    .replace(/"/g,"&quot;")  
    .replace(/'/g,"&#039;");  
}  
  
function escapeAttribute(value) {  
  return escapeHtml(value);  
}  
  
function escapeJs(value) {  
  return String(value)  
    .replace(/\\/g,"\\\\")  
    .replace(/'/g,"\\'");  
}  
  
/* =========================================================  
   TRIPLE CLIC SUR LE LOGO  
   ========================================================= */  
  
let clicks = 0;  
let clickTimer = null;  
  
document.getElementById("founderTrigger").addEventListener("click", () => {  
  clicks++;  
  
  if (clicks === 3) {  
    clicks = 0;  
    clearTimeout(clickTimer);  
    showLogin();  
    return;  
  }  
  
  clearTimeout(clickTimer);  
  
  clickTimer = setTimeout(() => {  
    clicks = 0;  
  }, 1000);  
});  
  
/* =========================================================  
   INITIALISATION  
   ========================================================= */  
  
(function init() {  
  loadTheme();  
  renderCustomElements();  
  renderLinks();  
  bindColorEditor();  
  
  window.addEventListener("resize", () => {  
    if (document.getElementById("admin")?.classList.contains("show")) {  
      setupColorCanvases();  
      updateColorEditor(true);  
    }  
  });  
  
  document.getElementById("code").addEventListener("keydown", event => {  
    if (event.key === "Enter") login();  
  });  
  
  document.getElementById("email").addEventListener("keydown", event => {  
    if (event.key === "Enter") login();  
  });  
})();  
</script>  </body>  
</html>`;  
}  
