/* ============================================================
   converter-heic.js
   HEIC ↔ JPG / PNG (frontend-focused demo)
   - Uses heic2any (if available) for HEIC → JPG/PNG
   - Uses <canvas> for JPG/PNG re-encoding
   - JPG/PNG → HEIC is NOT available in pure frontend (no encoder)
   Dependencies:
   - app-common-ui.js (status, progress, button helpers, toasts)
   - (optional) heic2any (global window.heic2any from vendor script)
   ============================================================ */

import {
    setStatus,
    setTemporaryStatus,
    toggleProgress,
    setButtonLoading,
    showToast
} from "../app-common-ui.js";

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("converter-form");
    if (!form) return; // Not on this page

    // Core DOM elements
    const fileInput = document.getElementById("file-input");
    const uploadArea = document.getElementById("upload-area");
    const fileInfoWrapper = document.getElementById("file-info-wrapper");
    const fileNameEl = document.getElementById("file-name");
    const fileSizeEl = document.getElementById("file-size");
    const changeFileBtn = document.getElementById("change-file-btn");

    const fromSelect = document.getElementById("from-format");
    const toSelect = document.getElementById("to-format");
    const qualityRange = document.getElementById("quality-range");
    const compressSwitch = document.getElementById("compress-switch");

    const statusText = document.getElementById("status-text");
    const progressWrapper = document.getElementById("progress-bar-wrapper");
    const downloadLink = document.getElementById("download-link");
    const convertBtn = document.getElementById("convert-btn");
    const resetBtn = document.getElementById("reset-btn");
    const lastConvLabel = document.getElementById("last-conv-label");

    const MAX_SIZE = 20 * 1024 * 1024; // 20 MB
    let currentFile = null;
    let currentObjectUrl = null;

    // Check for heic2any library (should be loaded via <script> on the page if you use it)
    const hasHeic2Any = typeof window.heic2any === "function";

    /* --------------------------------------------------------
       Drag & Drop + file input
       -------------------------------------------------------- */

    if (uploadArea && fileInput) {
        uploadArea.addEventListener("click", () => fileInput.click());

        uploadArea.addEventListener("dragover", (e) => {
            e.preventDefault();
            uploadArea.classList.add("dragover");
        });

        uploadArea.addEventListener("dragleave", (e) => {
            e.preventDefault();
            uploadArea.classList.remove("dragover");
        });

        uploadArea.addEventListener("drop", (e) => {
            e.preventDefault();
            uploadArea.classList.remove("dragover");
            const file = e.dataTransfer && e.dataTransfer.files[0];
            if (file) handleFileSelect(file);
        });

        fileInput.addEventListener("change", (e) => {
            const file = e.target.files && e.target.files[0];
            if (file) handleFileSelect(file);
        });
    }

    if (changeFileBtn) {
        changeFileBtn.addEventListener("click", () => {
            resetFileState();
            fileInput.click();
        });
    }

    /* --------------------------------------------------------
       File handling
       -------------------------------------------------------- */

    function handleFileSelect(file) {
        const allowedTypes = ["image/heic", "image/heif", "image/jpeg", "image/png"];
        if (!allowedTypes.includes(file.type)) {
            showToast("Please select a HEIC, HEIF, JPG or PNG file.", "warning");
            setStatus(statusText, "Unsupported file type.", "error");
            return;
        }

        if (file.size > MAX_SIZE) {
            showToast("Selected file is too large for this demo (max 20 MB).", "warning");
            setStatus(statusText, "File size exceeds 20 MB limit.", "error");
            return;
        }

        currentFile = file;

        // Detect source format for dropdown
        const detected = mimeToFormat(file.type);
        if (detected && fromSelect && fromSelect.value === "auto") {
            fromSelect.value = detected;
        }

        fileNameEl.textContent = file.name;
        fileSizeEl.textContent = "Size: " + formatBytes(file.size);
        fileInfoWrapper.classList.remove("d-none");
        uploadArea.classList.add("d-none");

        setStatus(statusText, "File selected. Ready to convert.", "muted");

        if (!hasHeic2Any && (file.type === "image/heic" || file.type === "image/heif")) {
            setTemporaryStatus(
                statusText,
                "HEIC library (heic2any) is not loaded. HEIC conversion will not work until you include it.",
                "warning",
                5000
            );
        }
    }

    function resetFileState() {
        if (currentObjectUrl) {
            URL.revokeObjectURL(currentObjectUrl);
            currentObjectUrl = null;
        }

        currentFile = null;
        fileInput.value = "";
        fileInfoWrapper.classList.add("d-none");
        uploadArea.classList.remove("d-none");
        downloadLink.classList.add("d-none");
        setStatus(statusText, "No file selected yet.", "muted");
    }

    /* --------------------------------------------------------
       Form submit: conversion
       -------------------------------------------------------- */

    if (form) {
        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            if (!currentFile) {
                showToast("Please select a file first.", "warning");
                return;
            }

            const fromValue = (fromSelect && fromSelect.value) || "auto";
            const toValue = (toSelect && toSelect.value) || "jpg";

            // Frontend demo only supports HEIC → JPG/PNG and JPG ↔ PNG
            if ((fromValue === "jpg" || fromValue === "png") && toValue === "heic") {
                const msg =
                    "JPG/PNG → HEIC is not supported in this frontend demo. " +
                    "You can implement it later on a backend service.";
                showToast(msg, "warning");
                setStatus(statusText, msg, "warning");
                return;
            }

            const rawQuality = qualityRange ? parseInt(qualityRange.value, 10) : 90;
            let quality = isNaN(rawQuality) ? 0.9 : rawQuality / 100;
            if (compressSwitch && !compressSwitch.checked) {
                quality = Math.max(quality, 0.95);
            }

            setButtonLoading(convertBtn, true, "Converting...");
            toggleProgress(progressWrapper, true);
            setStatus(statusText, "Converting file...", "muted");

            try {
                const blob = await convertHeicOrImage(currentFile, fromValue, toValue, quality);
                if (!blob) throw new Error("Conversion failed.");

                if (currentObjectUrl) {
                    URL.revokeObjectURL(currentObjectUrl);
                }
                currentObjectUrl = URL.createObjectURL(blob);

                const ext = toValue === "png" ? "png" : "jpg";
                const filename = generateDownloadName(currentFile.name, ext);

                downloadLink.href = currentObjectUrl;
                downloadLink.download = filename;
                downloadLink.classList.remove("d-none");

                const now = new Date();
                if (lastConvLabel) {
                    const timeStr = now.toLocaleTimeString("en-US", {
                        hour: "2-digit",
                        minute: "2-digit"
                    });
                    lastConvLabel.textContent = "Last conversion: " + timeStr;
                }

                setStatus(statusText, "Conversion successful!", "success");
                showToast("File converted successfully.", "success");
            } catch (err) {
                console.error(err);
                setStatus(
                    statusText,
                    err && err.message ? err.message : "Error during conversion.",
                    "error"
                );
                showToast("Conversion failed.", "error");
            } finally {
                toggleProgress(progressWrapper, false);
                setButtonLoading(convertBtn, false);
            }
        });
    }

    /* --------------------------------------------------------
       Reset button
       -------------------------------------------------------- */

    if (resetBtn) {
        resetBtn.addEventListener("click", () => {
            resetFileState();
            if (fromSelect) fromSelect.value = "auto";
            if (toSelect) toSelect.value = "jpg";
            if (qualityRange) qualityRange.value = "90";
            if (compressSwitch) compressSwitch.checked = true;

            setTemporaryStatus(statusText, "Form reset.", "muted", 2000);
        });
    }

    /* --------------------------------------------------------
       Core conversion logic
       -------------------------------------------------------- */

    /**
     * Convert HEIC/HEIF to JPG/PNG via heic2any (if available),
     * or re-encode JPG/PNG via Canvas.
     * @param {File} file
     * @param {string} fromFormat - "auto" | "heic" | "jpg" | "png"
     * @param {string} toFormat   - "jpg" | "png"
     * @param {number} quality    - 0..1
     * @returns {Promise<Blob>}
     */
    function convertHeicOrImage(file, fromFormat, toFormat, quality) {
        const mime = file.type;
        const detected = mimeToFormat(mime);
        const effectiveFrom = fromFormat === "auto" ? detected : fromFormat;

        if (effectiveFrom === "heic") {
            if (!hasHeic2Any || !window.heic2any) {
                return Promise.reject(
                    new Error(
                        "HEIC library (heic2any) is not available. Include it or handle HEIC on the backend."
                    )
                );
            }

            // Convert HEIC/HEIF via heic2any library
            const targetMime = toFormat === "png" ? "image/png" : "image/jpeg";

            return window.heic2any({
                blob: file,
                toType: targetMime,
                quality // some versions of heic2any support quality
            }).then((result) => {
                // heic2any may return a single Blob or an array of Blobs
                if (Array.isArray(result)) {
                    return result[0];
                }
                return result;
            });
        }

        // For JPG/PNG → JPG/PNG we just use Canvas to optionally adjust quality
        return convertViaCanvas(file, toFormat, quality);
    }

    /**
     * Convert a regular image (JPG/PNG) via Canvas.
     * @param {File} file
     * @param {string} toFormat - "jpg" | "png"
     * @param {number} quality  - 0..1
     * @returns {Promise<Blob>}
     */
    function convertViaCanvas(file, toFormat, quality) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onerror = () => reject(new Error("Failed to read file."));
            reader.onload = () => {
                const img = new Image();
                img.onload = () => {
                    try {
                        const canvas = document.createElement("canvas");
                        canvas.width = img.width;
                        canvas.height = img.height;
                        const ctx = canvas.getContext("2d");

                        if (!ctx) {
                            reject(new Error("Canvas is not supported in this browser."));
                            return;
                        }

                        // If we output JPG, fill with white (avoid black under transparency)
                        if (toFormat === "jpg" || toFormat === "jpeg") {
                            ctx.fillStyle = "#ffffff";
                            ctx.fillRect(0, 0, canvas.width, canvas.height);
                        }

                        ctx.drawImage(img, 0, 0);

                        let mimeType = toFormat === "png" ? "image/png" : "image/jpeg";

                        canvas.toBlob(
                            (blob) => {
                                if (!blob) {
                                    reject(new Error("Failed to generate output image."));
                                    return;
                                }
                                resolve(blob);
                            },
                            mimeType,
                            quality
                        );
                    } catch (err) {
                        reject(err);
                    }
                };
                img.onerror = () => reject(new Error("Failed to decode image."));
                img.src = reader.result;
            };

            reader.readAsDataURL(file);
        });
    }

    /* --------------------------------------------------------
       Utilities
       -------------------------------------------------------- */

    function mimeToFormat(mime) {
        if (mime === "image/heic" || mime === "image/heif") return "heic";
        if (mime === "image/jpeg") return "jpg";
        if (mime === "image/png") return "png";
        return null;
    }

    function formatBytes(bytes, decimals = 1) {
        if (!bytes) return "0 B";
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ["B", "KB", "MB", "GB", "TB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
    }

    function generateDownloadName(original, newExt) {
        const base = original.replace(/\.[^/.]+$/, "");
        return `${base}-converted.${newExt}`;
    }

    // Initial status
    setStatus(statusText, "No file selected yet.", "muted");
});
