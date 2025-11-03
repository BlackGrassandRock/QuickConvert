/* ============================================================
   app-common-ui.js
   Shared UI helpers:
   - status messages
   - progress visibility
   - loading state on buttons
   - lightweight toast notifications
   ============================================================ */

/**
 * Update status text element (e.g. under buttons).
 * @param {HTMLElement|null} el
 * @param {string} message
 * @param {"muted"|"success"|"error"|"warning"} [variant]
 */
export function setStatus(el, message, variant = "muted") {
    if (!el) return;

    el.textContent = message || "";

    // Remove old variants
    el.classList.remove("text-success", "text-danger", "text-warning", "text-secondary");

    switch (variant) {
        case "success":
            el.classList.add("text-success");
            break;
        case "error":
            el.classList.add("text-danger");
            break;
        case "warning":
            el.classList.add("text-warning");
            break;
        default:
            el.classList.add("text-secondary");
    }
}

/**
 * Show a temporary status message for a limited time.
 * Falls back to permanent status if duration <= 0.
 * @param {HTMLElement|null} el
 * @param {string} message
 * @param {"muted"|"success"|"error"|"warning"} [variant]
 * @param {number} [durationMs]
 */
export function setTemporaryStatus(el, message, variant = "muted", durationMs = 2500) {
    if (!el) return;
    if (durationMs <= 0) {
        setStatus(el, message, variant);
        return;
    }

    const prevText = el.textContent;
    const prevClass = el.className;

    setStatus(el, message, variant);

    window.setTimeout(() => {
        el.textContent = prevText;
        el.className = prevClass;
    }, durationMs);
}

/**
 * Show or hide a progress bar wrapper (e.g. #progress-bar-wrapper).
 * @param {HTMLElement|null} wrapper
 * @param {boolean} show
 */
export function toggleProgress(wrapper, show) {
    if (!wrapper) return;
    if (show) {
        wrapper.classList.remove("d-none");
    } else {
        wrapper.classList.add("d-none");
    }
}

/**
 * Put a button into a "loading" state:
 * - disables it
 * - replaces inner <span> text (if found) or textContent
 * @param {HTMLButtonElement|null} btn
 * @param {boolean} isLoading
 * @param {string} [loadingText]
 */
export function setButtonLoading(btn, isLoading, loadingText = "Working...") {
    if (!btn) return;

    const labelEl = btn.querySelector("span") || btn;

    if (isLoading) {
        if (!btn.dataset.originalText) {
            btn.dataset.originalText = labelEl.textContent || "";
        }
        btn.disabled = true;
        labelEl.textContent = loadingText;
    } else {
        btn.disabled = false;
        if (btn.dataset.originalText !== undefined) {
            labelEl.textContent = btn.dataset.originalText;
        }
    }
}

/* ============================================================
   Toast notifications
   Lightweight implementation that does not depend
   on Bootstrap JS. Uses a fixed-position container.
   ============================================================ */

let toastContainer = null;

/**
 * Create (once) and return the toast container element.
 * @returns {HTMLElement}
 */
function getToastContainer() {
    if (toastContainer && document.body.contains(toastContainer)) {
        return toastContainer;
    }

    toastContainer = document.createElement("div");
    toastContainer.className = "qc-toast-container";
    toastContainer.style.position = "fixed";
    toastContainer.style.zIndex = "1080";
    toastContainer.style.top = "1rem";
    toastContainer.style.right = "1rem";
    toastContainer.style.display = "flex";
    toastContainer.style.flexDirection = "column";
    toastContainer.style.gap = "0.5rem";
    document.body.appendChild(toastContainer);

    return toastContainer;
}

/**
 * Show a small floating toast notification.
 * @param {string} message
 * @param {"info"|"success"|"error"|"warning"} [type]
 * @param {number} [durationMs]
 */
export function showToast(message, type = "info", durationMs = 3000) {
    if (!message) return;

    const container = getToastContainer();
    const toast = document.createElement("div");

    // Basic look (we rely on theme colors but set some inline styles for layout)
    toast.className = "qc-toast shadow-sm";
    toast.style.minWidth = "220px";
    toast.style.maxWidth = "320px";
    toast.style.padding = "0.5rem 0.75rem";
    toast.style.borderRadius = "0.5rem";
    toast.style.fontSize = "0.85rem";
    toast.style.display = "flex";
    toast.style.alignItems = "center";
    toast.style.justifyContent = "space-between";
    toast.style.gap = "0.5rem";
    toast.style.opacity = "0";
    toast.style.transform = "translateY(-6px)";
    toast.style.transition = "opacity 0.15s ease, transform 0.15s ease";

    // Background / text colors by type – using CSS variables when possible
    const bgColors = {
        info: "rgba(37, 99, 235, 0.95)",
        success: "rgba(22, 163, 74, 0.95)",
        error: "rgba(220, 38, 38, 0.95)",
        warning: "rgba(217, 119, 6, 0.95)"
    };

    toast.style.backgroundColor = bgColors[type] || bgColors.info;
    toast.style.color = "#f9fafb";

    const textSpan = document.createElement("span");
    textSpan.textContent = message;

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.textContent = "×";
    closeBtn.setAttribute("aria-label", "Close");
    closeBtn.style.border = "none";
    closeBtn.style.background = "transparent";
    closeBtn.style.color = "inherit";
    closeBtn.style.fontSize = "1.1rem";
    closeBtn.style.lineHeight = "1";
    closeBtn.style.cursor = "pointer";

    closeBtn.addEventListener("click", () => {
        hideToast(toast);
    });

    toast.appendChild(textSpan);
    toast.appendChild(closeBtn);
    container.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => {
        toast.style.opacity = "1";
        toast.style.transform = "translateY(0)";
    });

    if (durationMs > 0) {
        window.setTimeout(() => {
            hideToast(toast);
        }, durationMs);
    }
}

function hideToast(toast) {
    if (!toast) return;
    toast.style.opacity = "0";
    toast.style.transform = "translateY(-6px)";
    window.setTimeout(() => {
        if (toast.parentElement) {
            toast.parentElement.removeChild(toast);
        }
    }, 180);
}

/* ============================================================
   Global namespace (optional)
   Allows usage as window.QCUI.* from non-module scripts
   ============================================================ */
window.QCUI = window.QCUI || {};
window.QCUI.setStatus = setStatus;
window.QCUI.setTemporaryStatus = setTemporaryStatus;
window.QCUI.toggleProgress = toggleProgress;
window.QCUI.setButtonLoading = setButtonLoading;
window.QCUI.showToast = showToast;
