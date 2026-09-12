/// <reference path="../digambaran.d.ts" />

document.getElementById("install")?.addEventListener("click", async () => {
  await window.digambaran.openExtensionFolder();
  await window.digambaran.openChromeExtensions();
});

document.getElementById("folder")?.addEventListener("click", async () => {
  await window.digambaran.openExtensionFolder();
});

document.getElementById("close")?.addEventListener("click", () => {
  window.close();
});
