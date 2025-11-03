/* ============================================================
   app-theme.js
   Handles theme switching (dark / light) + persistence
   ============================================================ */

document.addEventListener("DOMContentLoaded", () => {
    const body = document.body;
    const toggleBtn = document.getElementById("theme-toggle");
    const icon = document.getElementById("theme-toggle-icon");
    const text = document.getElementById("theme-toggle-text");

    // --- Load initial theme from localStorage or system preference ---
    const savedTheme = localStorage.getItem("qc-theme");
    const prefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;

    if (savedTheme === "light" || (!savedTheme && prefersLight)) {
        setTheme("light", false);
    } else {
        setTheme("dark", false);
    }

    // --- Event listener for toggle button ---
    if (toggleBtn) {
        toggleBtn.addEventListener("click", () => {
            const isLight = body.classList.contains("theme-light");
            setTheme(isLight ? "dark" : "light", true);
        });
    }

    // --- Function to apply theme ---
    function setTheme(theme, persist = true) {
        if (theme === "light") {
            body.classList.add("theme-light");
            icon.classList.replace("bi-moon-stars", "bi-sun");
            text.textContent = "Light";
        } else {
            body.classList.remove("theme-light");
            icon.classList.replace("bi-sun", "bi-moon-stars");
            text.textContent = "Dark";
        }

        if (persist) {
            localStorage.setItem("qc-theme", theme);
        }
    }

    // --- (Optional) react to OS theme change dynamically ---
    window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", (e) => {
        const currentPref = e.matches ? "light" : "dark";
        const saved = localStorage.getItem("qc-theme");
        // Change theme only if user hasn't manually selected one
        if (!saved) {
            setTheme(currentPref, false);
        }
    });
});
