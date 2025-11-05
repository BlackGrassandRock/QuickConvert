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

    const fromSelect = document.getElementById("from-format"); // fixed to HEIC / HEIF in UI
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

    // Safely detect heic2any presence
    const hasHeic2Any =
        typeof window !== "undefined" &&
        typeof window.heic2any === "function";

    /* --------------------------------------------------------
       Drag & Drop + file input
       -------------------------------------------------------- */

    if (uploadArea && fileInput) {
        uploadArea.addEventListener("click", () => {
            fileInput.click();
        });

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
            const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
            if (file) handleFileSelect(file);
        });

        fileInput.addEventListener("change", (e) => {
            const file = e.target.files && e.target.files[0];
            if (file) handleFileSelect(file);
        });
    }

    if (changeFileBtn && fileInput) {
        changeFileBtn.addEventListener("click", () => {
            resetFileState();
            fileInput.click();
        });
    }

    /* --------------------------------------------------------
       File handling
       -------------------------------------------------------- */

    function handleFileSelect(file) {
        const mime = file.type || "";
        const name = (file.name || "").toLowerCase();

        const allowedMimeTypes = ["image/heic", "image/heif", "image/jpeg", "image/png"];
        const mimeAllowed = mime && allowedMimeTypes.includes(mime);

        const isHeicExt = /\.(heic|heif)$/.test(name);
        const isJpegExt = /\.(jpe?g)$/.test(name);
        const isPngExt = /\.png$/.test(name);
        const extAllowed = isHeicExt || isJpegExt || isPngExt;

        if (!mimeAllowed && !extAllowed) {
            showToast("Please select a HEIC, HEIF, JPG or PNG file.", "warning");
            setStatus(statusText, "Unsupported file type.", "error");
            return;
        }

        if (file.size > MAX_SIZE) {
            showToast("Selected file is too large (max 20 MB).", "warning");
            setStatus(statusText, "File size exceeds 20 MB limit.", "error");
            return;
        }

        currentFile = file;

        if (fileNameEl) fileNameEl.textContent = file.name;
        if (fileSizeEl) fileSizeEl.textContent = "Size: " + formatBytes(file.size);
        if (fileInfoWrapper) fileInfoWrapper.classList.remove("d-none");
        if (uploadArea) uploadArea.classList.add("d-none");
        if (downloadLink) downloadLink.classList.add("d-none");

        setStatus(statusText, "File selected. Ready to convert.", "muted");

        const isHeicFile =
            mime === "image/heic" ||
            mime === "image/heif" ||
            (!mime && isHeicExt);

        if (!hasHeic2Any && isHeicFile) {
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

        if (fileInput) fileInput.value = "";
        if (fileInfoWrapper) fileInfoWrapper.classList.add("d-none");
        if (uploadArea) uploadArea.classList.remove("d-none");
        if (downloadLink) downloadLink.classList.add("d-none");

        setStatus(statusText, "No file selected yet.", "muted");
    }

    /* --------------------------------------------------------
       Form submit: conversion
       -------------------------------------------------------- */

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!currentFile) {
            showToast("Please select a file first.", "warning");
            return;
        }

        const toValue = (toSelect && toSelect.value) || "jpg"; // "jpg" | "png"

        const rawQuality = qualityRange ? parseInt(qualityRange.value, 10) : 90;
        let quality = Number.isNaN(rawQuality) ? 0.9 : rawQuality / 100;
        if (compressSwitch && !compressSwitch.checked) {
            quality = Math.max(quality, 0.95);
        }

        setButtonLoading(convertBtn, true, "Converting...");
        toggleProgress(progressWrapper, true);
        setStatus(statusText, "Converting file...", "muted");

        try {
            const blob = await convertHeicOrImage(currentFile, toValue, quality);
            if (!blob) {
                throw new Error("Conversion failed.");
            }

            if (currentObjectUrl) {
                URL.revokeObjectURL(currentObjectUrl);
            }
            currentObjectUrl = URL.createObjectURL(blob);

            const ext = toValue === "png" ? "png" : "jpg";
            const filename = generateDownloadName(currentFile.name, ext);

            if (downloadLink) {
                downloadLink.href = currentObjectUrl;
                downloadLink.download = filename;
                downloadLink.classList.remove("d-none");

                // Auto-download after successful conversion
                try {
                    downloadLink.click();
                } catch (e) {
                    console.warn("Auto-download failed, fallback to manual link.", e);
                }
            }

            if (lastConvLabel) {
                const now = new Date();
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
            const message =
                err && err.message ? err.message : "Error during conversion.";
            setStatus(statusText, message, "error");
            showToast("Conversion failed.", "error");
        } finally {
            toggleProgress(progressWrapper, false);
            setButtonLoading(convertBtn, false);
        }
    });

    /* --------------------------------------------------------
       Reset button
       -------------------------------------------------------- */

    if (resetBtn) {
        resetBtn.addEventListener("click", () => {
            resetFileState();
            if (fromSelect) fromSelect.value = "heic"; // fixed in HTML
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
     * Detect source format and convert accordingly:
     * - HEIC/HEIF → JPG/PNG via heic2any
     * - JPG/PNG   → JPG/PNG via Canvas
     * @param {File} file
     * @param {"jpg"|"png"} toFormat
     * @param {number} quality
     * @returns {Promise<Blob>}
     */
    function convertHeicOrImage(file, toFormat, quality) {
        const sourceFormat = detectFormatFromFile(file);

        if (!sourceFormat) {
            return Promise.reject(
                new Error("Unsupported or unknown source format.")
            );
        }

        if (sourceFormat === "heic") {
            if (!hasHeic2Any || !window.heic2any) {
                return Promise.reject(
                    new Error(
                        "HEIC library (heic2any) is not available. Include it or handle HEIC on the backend."
                    )
                );
            }

            const targetMime = toFormat === "png" ? "image/png" : "image/jpeg";

            return window.heic2any({
                blob: file,
                toType: targetMime,
                quality
            })
                .then((result) => {
                    if (Array.isArray(result)) {
                        return result[0];
                    }
                    return result;
                })
                .catch((err) => {
                    // Fallback when heic2any reports that image is already browser-readable
                    if (
                        err &&
                        err.code === 1 &&
                        typeof err.message === "string" &&
                        /already browser readable/i.test(err.message)
                    ) {
                        return convertViaCanvas(file, toFormat, quality);
                    }
                    throw err;
                });
        }

        // JPG/PNG → JPG/PNG via Canvas
        return convertViaCanvas(file, toFormat, quality);
    }

    /**
     * Convert a regular image (JPG/PNG) via Canvas.
     * @param {File} file
     * @param {"jpg"|"png"} toFormat
     * @param {number} quality
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

                        if (toFormat === "jpg" || toFormat === "jpeg") {
                            ctx.fillStyle = "#ffffff";
                            ctx.fillRect(0, 0, canvas.width, canvas.height);
                        }

                        ctx.drawImage(img, 0, 0);

                        const mimeType =
                            toFormat === "png" ? "image/png" : "image/jpeg";

                        canvas.toBlob(
                            (blob) => {
                                if (!blob) {
                                    reject(
                                        new Error("Failed to generate output image.")
                                    );
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

    // Detect format using MIME first, then extension as fallback
    function detectFormatFromFile(file) {
        const mime = file.type || "";
        const name = (file.name || "").toLowerCase();

        if (mime === "image/heic" || mime === "image/heif") {
            return "heic";
        }
        if (mime === "image/jpeg") {
            return "jpg";
        }
        if (mime === "image/png") {
            return "png";
        }

        if (!mime) {
            if (/\.(heic|heif)$/.test(name)) return "heic";
            if (/\.(jpe?g)$/.test(name)) return "jpg";
            if (/\.png$/.test(name)) return "png";
        }

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
