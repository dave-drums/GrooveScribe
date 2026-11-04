// Presentation controls only. Metadata values and export logic remain owned by
// GrooveWriter and its original tuneTitle/tuneAuthor/tuneComments inputs.
(() => {
  "use strict";

  const dialog = document.getElementById("grooveDetailsDialog");
  const opener = document.getElementById("grooveDetailsButton");
  const close = document.getElementById("grooveDetailsClose");
  const grooves = document.getElementById("groovesAnchor");
  if (!dialog || !opener || !close || !grooves) return;

  const commitPendingEdit = () => {
    const active = document.activeElement;
    // Blurring fires the existing onchange handler, including on Escape/Done.
    if (active && dialog.contains(active)) active.blur();
  };
  const closeDetails = () => {
    commitPendingEdit();
    if (typeof dialog.close === "function") dialog.close();
    else {
      dialog.removeAttribute("open");
      grooves.focus({ preventScroll: true });
    }
  };

  opener.addEventListener("click", () => {
    if (dialog.open) return;
    const utils = window.myGrooveWriter && window.myGrooveWriter.myGrooveUtils;
    if (utils) utils.hideContextMenu(document.getElementById("grooveListWrapper"));
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    document.getElementById("tuneTitle").focus();
  });
  close.addEventListener("click", closeDetails);
  dialog.addEventListener("cancel", commitPendingEdit);
  dialog.addEventListener("close", () => grooves.focus({ preventScroll: true }));
  dialog.addEventListener("keydown", (event) => {
    // Dialog button keystrokes must not trigger the editor's playback hotkeys.
    event.stopPropagation();
    if (event.key === "Escape" && typeof dialog.close !== "function") {
      event.preventDefault();
      closeDetails();
    }
  });
  grooves.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    event.stopPropagation();
    grooves.click();
  });
})();
