/// <reference path="../digambaran.d.ts" />

type Condition = "PERMISSION" | "SACRIFICE" | "WAIT" | "MERCY";

const params = new URLSearchParams(window.location.search);
const downloadId = Number(params.get("downloadId"));
const filename = params.get("filename") || "download";
const sizeLabel = params.get("sizeLabel") || "unknown size";
const condition = (params.get("condition") || "PERMISSION") as Condition;
const waitSeconds = Number(params.get("waitSeconds") || "30");

const filenameEl = document.getElementById("filename")!;
const sizeEl = document.getElementById("size")!;
const bodyEl = document.getElementById("body")!;
const actionsEl = document.getElementById("actions")!;
const errorEl = document.getElementById("error")!;

filenameEl.textContent = filename;
sizeEl.textContent = sizeLabel;

function showError(message: string): void {
  errorEl.hidden = false;
  errorEl.textContent = message;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function button(label: string, className?: string): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.textContent = label;
  if (className) btn.className = className;
  return btn;
}

function renderPermissionLike(title: string, subtitle: string): void {
  bodyEl.innerHTML = `<h2>${title}</h2><p>${subtitle}</p>`;
  const continueBtn = button("CONTINUE", "primary");
  continueBtn.addEventListener("click", async () => {
    continueBtn.disabled = true;
    await window.digambaran.continueDownload(downloadId);
  });
  actionsEl.appendChild(continueBtn);
}

function renderWait(): void {
  bodyEl.innerHTML = `<h2>Not yet.</h2><p>Wait ${waitSeconds} seconds.</p><div class="countdown" id="countdown">${waitSeconds}</div>`;
  const countdownEl = document.getElementById("countdown")!;
  let remaining = waitSeconds;

  const timer = window.setInterval(async () => {
    remaining -= 1;
    countdownEl.textContent = String(Math.max(remaining, 0));
    if (remaining <= 0) {
      window.clearInterval(timer);
      await window.digambaran.continueDownload(downloadId);
    }
  }, 1000);
}

function renderSacrifice(): void {
  bodyEl.innerHTML = `
    <h2>Digambaran demands a sacrifice.</h2>
    <p>Choose a file to sacrifice. It will be moved to the Windows Recycle Bin.</p>
    <div id="sacrificeBox" class="sacrifice" hidden></div>
  `;
  const sacrificeBox = document.getElementById("sacrificeBox")!;

  let selectedPath: string | null = null;

  const chooseBtn = button("CHOOSE SACRIFICE", "primary");
  const sacrificeBtn = button("SACRIFICE", "danger");
  const refuseBtn = button("REFUSE");
  sacrificeBtn.disabled = true;
  sacrificeBtn.hidden = true;
  refuseBtn.hidden = true;

  chooseBtn.addEventListener("click", async () => {
    chooseBtn.disabled = true;
    const result = await window.digambaran.chooseSacrifice(downloadId);
    if (!result.ok || !result.sacrifice) {
      // Picker cancel / invalid file already DENYs in main process.
      if (result.reason) showError(result.reason);
      return;
    }

    selectedPath = result.sacrifice.path;
    const safeName = escapeHtml(result.sacrifice.name);
    const safePath = escapeHtml(result.sacrifice.path);
    const safeSize = escapeHtml(result.sacrifice.sizeLabel);
    sacrificeBox.hidden = false;
    sacrificeBox.innerHTML = `
      <strong>DIGAMBARAN DEMANDS A SACRIFICE</strong><br/><br/>
      File:<br/>
      ${safeName}<br/><br/>
      Location:<br/>
      ${safePath}<br/><br/>
      Size: ${safeSize}<br/><br/>
      The file will be moved to the Windows Recycle Bin.
    `;
    chooseBtn.hidden = true;
    sacrificeBtn.hidden = false;
    refuseBtn.hidden = false;
    sacrificeBtn.disabled = false;
  });

  sacrificeBtn.addEventListener("click", async () => {
    if (!selectedPath) return;
    sacrificeBtn.disabled = true;
    refuseBtn.disabled = true;
    chooseBtn.disabled = true;
    const result = await window.digambaran.confirmSacrifice(
      downloadId,
      selectedPath
    );
    if (!result.ok) {
      showError(result.reason || "Sacrifice failed.");
    }
  });

  refuseBtn.addEventListener("click", async () => {
    refuseBtn.disabled = true;
    sacrificeBtn.disabled = true;
    await window.digambaran.cancelDownload(downloadId);
  });

  actionsEl.append(chooseBtn, sacrificeBtn, refuseBtn);
}

switch (condition) {
  case "PERMISSION":
    renderPermissionLike("Permission granted.", "Download may continue.");
    break;
  case "MERCY":
    renderPermissionLike("You are fortunate.", "Digambaran has shown mercy.");
    break;
  case "WAIT":
    renderWait();
    break;
  case "SACRIFICE":
    renderSacrifice();
    break;
  default:
    renderPermissionLike("Permission granted.", "Download may continue.");
}
