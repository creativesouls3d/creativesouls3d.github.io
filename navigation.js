function goBackOrHome(fallback = "index.html") {
  if (window.history.length > 1) {
    window.history.back();
    return;
  }

  window.location.href = fallback;
}

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-back]");
  if (!button) return;

  goBackOrHome(button.dataset.fallback || "index.html");
});
