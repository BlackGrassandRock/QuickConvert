// Cookie consent logic
document.addEventListener("DOMContentLoaded", () => {
  const banner = document.getElementById("cookie-banner");
  if (!banner) return;

  const acceptBtn = document.getElementById("accept-cookies");
  const declineBtn = document.getElementById("decline-cookies");

  const consent = localStorage.getItem("cookieConsent");

  // Show banner only if no prior choice
  if (!consent) {
    banner.style.display = "block";
  }

  function hideBanner() {
    banner.style.display = "none";
  }

  acceptBtn.addEventListener("click", () => {
    localStorage.setItem("cookieConsent", "accepted");
    hideBanner();
    // TODO: enable Google Analytics / AdSense here
    // initAnalytics();
  });

  declineBtn.addEventListener("click", () => {
    localStorage.setItem("cookieConsent", "declined");
    hideBanner();
    // Make sure you do NOT load GA / AdSense if declined
  });
});
