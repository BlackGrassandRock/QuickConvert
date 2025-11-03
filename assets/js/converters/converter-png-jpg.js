/* ============================================================
   converter-png-jpg.js
   Handles client-side PNG ↔ JPG conversion using <canvas>.
   Dependencies:
   - app-common-ui.js (status, progress, button helpers)
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
    if (!form) return;

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

    let currentFile = null;
    let lastConvertedBlob = null;

    /* ---------------- Drag & Drop Handling ---------------- */

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

            const file = e.dataTransfer.files[0];
            if (file) handleFileSelect(file);
        });
    }

    if (fileInput) {
        fileInput.addEventListener("change", (e) => {
            const file = e.target.files[0];
            if (file) handleFileSelect(file);
        });
    }

    if (changeFileBtn) {
        changeFileBtn.addEventListener("click", () => {
            resetFile();
            fileInput.click();
        });
    }

    /* ---------------- File Handling ---------------- */

    function handleFileSelect(file) {
        const validTypes = ["image/png", "image/jpeg"];
        if (!validTypes.includes(file.type)) {
            showToast("Please select a PNG or JPG file.", "warning");
            setStatus(statusText, "Unsupported file type.", "error");
            return;
        }

        currentFile = file;
        fileNameEl.textContent = file.name;
        fileSizeEl.textContent = formatBytes(file.size);
        fileInfoWrapper.classList.remove("d-none");
        uploadArea.classList.add("d-none");
        setStatus(statusText, "Ready to convert.", "muted");
    }

    function resetFile() {
        currentFile = null;
        lastConvertedBlob = null;
        fileInput.value = "";
        fileInfoWrapper.classList.add("d-none");
        uploadArea.classList.remove("d-none");
        downloadLink.classList.add("d-none");
        setStatus(statusText, "No file selected yet.", "muted");
    }

    /* ---------------- Conversion Logic ---------------- */

    if (form) {
        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            if (!currentFile) {
                showToast("Please select a file first.", "warning");
                return;
            }

            const toFormat = toSelect.value;
            const quality = parseInt(qualityRange.value, 10) / 100;
            const compress = compressSwitch.checked;

            setButtonLoading(convertBtn, true, "Converting...");
            toggleProgress(progressWrapper, true);
            setStatus(statusText, "Converting...", "muted");

            try {
                const blob = await convertImage(currentFile, toFormat, quality, compress);
                if (!blob) throw new Error("Conversion failed.");

                lastConvertedBlob = blob;
                const url = URL.createObjectURL(blob);
                const ext = toFormat === "jpg" ? "jpg" : "png";
                downloadLink.href = url;
                downloadLink.download = generateDownloadName(currentFile.name, ext);
                downloadLink.classList.remove("d-none");

                const now = new Date();
                lastConvLabel.textContent = now.toLocaleTimeString();
                setStatus(statusText, "Conversion successful!", "success");
                showToast("File converted successfully.", "success");
            } catch (err) {
                console.error(err);
                setStatus(statusText, "Error during conversion.", "error");
                showToast("Conversion failed.", "error");
            } finally {
                toggleProgress(progressWrapper, false);
                setButtonLoading(convertBtn, false);
            }
        });
    }

    if (resetBtn) {
        resetBtn.addEventListener("click", () => {
            resetFile();
            setTemporaryStatus(statusText, "Form reset.", "muted", 2000);
        });
    }

    /* ---------------- Core Conversion ---------------- */

    async function convertImage(file, toFormat, quality = 0.85, compress = true) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const img = new Image();
                img.onload = () => {
                    try {
                        const canvas = document.createElement("canvas");
                        canvas.width = img.width;
                        canvas.height = img.height;
                        const ctx = canvas.getContext("2d");

                        // Fill white background if converting to JPG (since JPG has no transparency)
                        if (toFormat === "jpg" || toFormat === "jpeg") {
                            ctx.fillStyle = "#ffffff";
                            ctx.fillRect(0, 0, canvas.width, canvas.height);
                        }

                        ctx.drawImage(img, 0, 0);

                        let mimeType =
                            toFormat === "png"
                                ? "image/png"
                                : "image/jpeg";

                        const dataUrl = canvas.toDataURL(mimeType, quality);
                        const blob = dataURLtoBlob(dataUrl);

                        resolve(blob);
                    } catch (err) {
                        reject(err);
                    }
                };
                img.onerror = (e) => reject(e);
                img.src = reader.result;
            };
            reader.onerror = (e) => reject(e);
            reader.readAsDataURL(file);
        });
    }

    /* ---------------- Utility Functions ---------------- */

    function formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return "0 Bytes";
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ["Bytes", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
    }

    function dataURLtoBlob(dataUrl) {
        const arr = dataUrl.split(",");
        const mime = arr[0].match(/:(.*?);/)[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) u8arr[n] = bstr.charCodeAt(n);
        return new Blob([u8arr], { type: mime });
    }

    function generateDownloadName(original, newExt) {
        const base = original.replace(/\.[^/.]+$/, "");
        return `${base}-converted.${newExt}`;
    }
});
