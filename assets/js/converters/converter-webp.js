/* ============================================================
   converter-webp.js
   WebP ↔ JPG / PNG / GIF (frontend demo)
   - Uses <canvas> for image → image conversion
   - GIF output is NOT implemented (needs extra encoder/back-end)
   - Animated WebP/GIF are flattened to a single frame
   Dependencies:
   - app-common-ui.js (status, progress, button helpers, toasts)
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

    /* --------------------------------------------------------
       Feature detection: can this browser encode WebP?
       -------------------------------------------------------- */
    const canEncodeWebP = (() => {
        try {
            const canvas = document.createElement("canvas");
            if (!canvas.toDataURL) return false;
            const dataUrl = canvas.toDataURL("image/webp");
            return dataUrl.startsWith("data:image/webp");
        } catch {
            return false;
        }
    })();

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
        // Only allow WebP + common image formats as source
        const allowedTypes = ["image/webp", "image/png", "image/jpeg", "image/gif"];
        if (!allowedTypes.includes(file.type)) {
            showToast("Please select a WebP, PNG, JPG or GIF image.", "warning");
            setStatus(statusText, "Unsupported file type.", "error");
            return;
        }

        if (file.size > MAX_SIZE) {
            showToast("Selected file is too large for this demo (max 20 MB).", "warning");
            setStatus(statusText, "File size exceeds 20 MB limit.", "error");
            return;
        }

        currentFile = file;

        // Try to detect source format
        const mime = file.type;
        const detected = mimeToFormat(mime);
        if (detected && fromSelect && fromSelect.value === "auto") {
            fromSelect.value = detected;
        }

        fileNameEl.textContent = file.name;
        fileSizeEl.textContent = "Size: " + formatBytes(file.size);
        fileInfoWrapper.classList.remove("d-none");
        uploadArea.classList.add("d-none");

        setStatus(statusText, "File selected. Ready to convert.", "muted");

        if ((mime === "image/webp" || mime === "image/gif")) {
            setTemporaryStatus(
                statusText,
                "Note: animated images will be converted to a single static frame.",
                "warning",
                4000
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

            const toFormat = (toSelect && toSelect.value) || "webp";
            const fromValue = (fromSelect && fromSelect.value) || "auto";

            // GIF output is not implemented in this pure-frontend demo
            if (toFormat === "gif") {
                const msg =
                    "GIF output is not supported in this frontend demo. " +
                    "Please choose JPG, PNG or WebP as the target format.";
                showToast(msg, "warning");
                setStatus(statusText, msg, "warning");
                return;
            }

            // WebP encoding support check
            if (toFormat === "webp" && !canEncodeWebP) {
                const msg =
                    "This browser does not support WebP encoding via Canvas. " +
                    "Try using JPG or PNG as the target format.";
                showToast(msg, "error");
                setStatus(statusText, msg, "error");
                return;
            }

            const rawQuality = qualityRange ? parseInt(qualityRange.value, 10) : 85;
            let quality = isNaN(rawQuality) ? 0.85 : rawQuality / 100;
            if (compressSwitch && !compressSwitch.checked) {
                // Less compression → higher quality
                quality = Math.max(quality, 0.9);
            }

            setButtonLoading(convertBtn, true, "Converting...");
            toggleProgress(progressWrapper, true);
            setStatus(statusText, "Converting image...", "muted");

            try {
                const blob = await convertImage(currentFile, fromValue, toFormat, quality);
                if (!blob) throw new Error("Conversion failed.");

                if (currentObjectUrl) {
                    URL.revokeObjectURL(currentObjectUrl);
                }
                currentObjectUrl = URL.createObjectURL(blob);

                const ext = toFormat;
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
                showToast("Image converted successfully.", "success");
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
            if (toSelect) toSelect.value = "webp";
            if (qualityRange) qualityRange.value = "85";
            if (compressSwitch) compressSwitch.checked = true;

            setTemporaryStatus(statusText, "Form reset.", "muted", 2000);
        });
    }

    /* --------------------------------------------------------
       Core conversion using Canvas
       -------------------------------------------------------- */

    /**
     * Convert current image to desired format using Canvas.
     * @param {File} file
     * @param {string} fromFormat - "auto" | "webp" | "jpg" | "png" | "gif"
     * @param {string} toFormat   - "webp" | "jpg" | "png" | "gif"
     * @param {number} quality    - 0..1
     * @returns {Promise<Blob>}
     */
    function convertImage(file, fromFormat, toFormat, quality) {
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

                        // If we output JPG, fill with white (to avoid black where transparency was)
                        if (toFormat === "jpg" || toFormat === "jpeg") {
                            ctx.fillStyle = "#ffffff";
                            ctx.fillRect(0, 0, canvas.width, canvas.height);
                        }

                        ctx.drawImage(img, 0, 0);

                        // GIF output not supported with plain Canvas
                        if (toFormat === "gif") {
                            reject(
                                new Error(
                                    "GIF output is not available in this frontend-only demo."
                                )
                            );
                            return;
                        }

                        let mimeType = "image/jpeg";
                        if (toFormat === "png") mimeType = "image/png";
                        if (toFormat === "webp") mimeType = "image/webp";

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
        if (mime === "image/webp") return "webp";
        if (mime === "image/jpeg") return "jpg";
        if (mime === "image/png") return "png";
        if (mime === "image/gif") return "gif";
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
