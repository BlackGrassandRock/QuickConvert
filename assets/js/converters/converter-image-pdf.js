// assets/js/converters/converter-image-pdf.js
// JPG/PNG ↔ PDF converter logic with lazy loading of jsPDF & pdf.js

const JSPDF_SRC = "assets/js/vendor/jspdf.umd.min.js";
const PDF_JS_SRC = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
const PDF_WORKER_SRC = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

// --- Lazy-load helpers ------------------------------------------------------

function loadScriptOnce(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === "true") {
        resolve();
      } else {
        existing.addEventListener("load", () => resolve());
        existing.addEventListener("error", () =>
          reject(new Error(`Failed to load ${src}`))
        );
      }
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.loaded = "false";
    script.addEventListener("load", () => {
      script.dataset.loaded = "true";
      resolve();
    });
    script.addEventListener("error", () =>
      reject(new Error(`Failed to load ${src}`))
    );
    document.head.appendChild(script);
  });
}

async function ensureJsPdf() {
  if (window.jspdf && window.jspdf.jsPDF) {
    return window.jspdf.jsPDF;
  }
  await loadScriptOnce(JSPDF_SRC);
  if (!window.jspdf || !window.jspdf.jsPDF) {
    throw new Error("jsPDF not available after loading.");
  }
  return window.jspdf.jsPDF;
}

async function ensurePdfJs() {
  if (window.pdfjsLib && window.pdfjsLib.GlobalWorkerOptions) {
    return window.pdfjsLib;
  }
  await loadScriptOnce(PDF_JS_SRC);
  if (!window.pdfjsLib || !window.pdfjsLib.GlobalWorkerOptions) {
    throw new Error("pdfjsLib not available after loading.");
  }
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_WORKER_SRC;
  return window.pdfjsLib;
}

// ---------------------------------------------------------------------------

document.addEventListener("DOMContentLoaded", () => {
  const $ = (sel, root = document) => root.querySelector(sel);

  // DOM refs
  const uploadArea        = $("#upload-area");
  const fileInput         = $("#file-input");
  const fileInfoWrapper   = $("#file-info-wrapper");
  const fileSummaryEl     = $("#file-summary");
  const fileSizeEl        = $("#file-size");
  const fileListEl        = $("#file-list");
  const changeFileBtn     = $("#change-file-btn");

  const conversionModeSelect = $("#conversion-mode");
  const swapModeBtn          = $("#swap-mode");
  const toFormatSelect       = $("#to-format");
  const pageSizeSelect       = $("#page-size");
  const qualityRange         = $("#quality-range");

  const convertForm       = $("#converter-form");
  const convertBtn        = $("#convert-btn");
  const convertSpinner    = $("#convert-spinner");
  const resetBtn          = $("#reset-btn");

  const statusText        = $("#status-text");
  const progressWrapper   = $("#progress-bar-wrapper");
  const progressBar       = $("#progress-bar");
  const downloadLink      = $("#download-link");
  const lastConvLabel     = $("#last-conv-label");

  let selectedFiles = [];

  // --- Small helpers --------------------------------------------------------

  function formatBytes(bytes) {
    if (!bytes && bytes !== 0) return "";
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  }

  function setStatus(message) {
    statusText.textContent = message;
  }

  function toggleLoading(isLoading) {
    if (isLoading) {
      convertSpinner.classList.remove("d-none");
      convertBtn.disabled = true;
      progressWrapper.classList.remove("d-none");
    } else {
      convertSpinner.classList.add("d-none");
      convertBtn.disabled = false;
      progressWrapper.classList.add("d-none");
    }
  }

  function resetUI() {
    selectedFiles = [];
    fileInput.value = "";
    fileInfoWrapper.classList.add("d-none");
    uploadArea.classList.remove("upload-area-active", "dragover");
    downloadLink.classList.add("d-none");
    progressWrapper.classList.add("d-none");

    conversionModeSelect.value = "auto";
    toFormatSelect.value = "pdf";
    pageSizeSelect.value = "a4";
    qualityRange.value = 90;

    setStatus("No files selected yet.");
  }

  function getBaseName(filename) {
    const dotIdx = filename.lastIndexOf(".");
    if (dotIdx === -1) return filename;
    return filename.slice(0, dotIdx);
  }

  function detectMode(files) {
    const hasPdf = files.some(
      (f) =>
        f.type === "application/pdf" ||
        f.name.toLowerCase().endsWith(".pdf")
    );
    return hasPdf ? "pdf-to-image" : "image-to-pdf";
  }

  // --- File selection UI ----------------------------------------------------

  function handleFiles(files) {
    selectedFiles = Array.from(files || []).filter((f) => f && f.size > 0);

    if (!selectedFiles.length) {
      fileInfoWrapper.classList.add("d-none");
      setStatus("No files selected yet.");
      downloadLink.classList.add("d-none");
      return;
    }

    const totalSize = selectedFiles.reduce((sum, f) => sum + f.size, 0);
    fileSummaryEl.textContent =
      selectedFiles.length === 1
        ? selectedFiles[0].name
        : `${selectedFiles.length} files selected`;
    fileSizeEl.textContent = formatBytes(totalSize);

    fileListEl.innerHTML = selectedFiles
      .slice(0, 10)
      .map((f) => f.name)
      .join("<br>");
    if (selectedFiles.length > 10) {
      fileListEl.innerHTML += `<br>… and ${
        selectedFiles.length - 10
      } more`;
    }

    fileInfoWrapper.classList.remove("d-none");
    downloadLink.classList.add("d-none");
    setStatus("Ready to convert.");

    // Авто-настройка направления, если пользователь в режиме auto
    if (conversionModeSelect.value === "auto") {
      const autoMode = detectMode(selectedFiles);
      conversionModeSelect.value = autoMode;
      if (autoMode === "image-to-pdf") {
        toFormatSelect.value = "pdf";
      } else {
        // pdf-to-image
        if (toFormatSelect.value === "pdf") {
          toFormatSelect.value = "jpg";
        }
      }
    }
  }

  uploadArea.addEventListener("click", () => fileInput.click());

  uploadArea.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.stopPropagation();
    uploadArea.classList.add("upload-area-active");
  });

  uploadArea.addEventListener("dragleave", (e) => {
    e.preventDefault();
    e.stopPropagation();
    uploadArea.classList.remove("upload-area-active");
  });

  uploadArea.addEventListener("drop", (e) => {
    e.preventDefault();
    e.stopPropagation();
    uploadArea.classList.remove("upload-area-active");
    if (e.dataTransfer.files && e.dataTransfer.files.length) {
      handleFiles(e.dataTransfer.files);
    }
  });

  fileInput.addEventListener("change", () => {
    handleFiles(fileInput.files);
  });

  if (changeFileBtn) {
    changeFileBtn.addEventListener("click", () => {
      fileInput.click();
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      resetUI();
    });
  }

  // --- Mode switching (Swap) ------------------------------------------------

  if (swapModeBtn) {
    swapModeBtn.addEventListener("click", () => {
      const mode = conversionModeSelect.value;
      const target = toFormatSelect.value;

      if (mode === "image-to-pdf" && target === "pdf") {
        // было image -> pdf, делаем pdf -> jpg
        conversionModeSelect.value = "pdf-to-image";
        toFormatSelect.value = "jpg";
      } else if (mode === "pdf-to-image") {
        // было pdf -> image, делаем image -> pdf
        conversionModeSelect.value = "image-to-pdf";
        toFormatSelect.value = "pdf";
      } else {
        // auto или прочее — сброс в "классический" сценарий
        conversionModeSelect.value = "image-to-pdf";
        toFormatSelect.value = "pdf";
      }
    });
  }

  // --- Image -> PDF ---------------------------------------------------------

  async function convertImagesToPdf(files) {
    const imageFiles = files.filter((f) => f.type.startsWith("image/"));
    if (!imageFiles.length) {
      throw new Error("No images found in selection.");
    }

    const jsPDF = await ensureJsPdf();

    const pageSizeKey = pageSizeSelect.value; // "a4" | "letter" | "fit-image"
    const qualityVal = parseInt(qualityRange.value, 10) || 90;
    const quality = Math.min(Math.max(qualityVal / 100, 0.4), 1.0);

    const sizes = {
      a4: [595.28, 841.89],
      letter: [612, 792],
    };

    let pdf = null;

    const createFirstPdf = (orientation, format) => {
      pdf = new jsPDF({
        orientation,
        unit: "pt",
        format,
      });
    };

    for (let index = 0; index < imageFiles.length; index++) {
      const file = imageFiles[index];

      const imageDataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () =>
          reject(new Error("Failed to read an image file."));
        reader.readAsDataURL(file);
      });

      const img = await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("Failed to load image data."));
        image.src = imageDataUrl;
      });

      let pageWidth, pageHeight;

      if (pageSizeKey === "fit-image") {
        pageWidth = img.width;
        pageHeight = img.height;
        const orientation =
          img.width >= img.height ? "landscape" : "portrait";

        if (!pdf) {
          createFirstPdf(orientation, [pageWidth, pageHeight]);
        } else if (index > 0) {
          pdf.addPage([pageWidth, pageHeight], orientation);
        }
      } else {
        const [w, h] = sizes[pageSizeKey] || sizes.a4;
        pageWidth = w;
        pageHeight = h;
        const orientation = w >= h ? "landscape" : "portrait";

        if (!pdf) {
          createFirstPdf(orientation, pageSizeKey);
        } else if (index > 0) {
          pdf.addPage(pageSizeKey, orientation);
        }
      }

      const margin = 20;
      const maxWidth = pageWidth - margin * 2;
      const maxHeight = pageHeight - margin * 2;

      let drawWidth = maxWidth;
      let drawHeight = (img.height * maxWidth) / img.width;

      if (drawHeight > maxHeight) {
        drawHeight = maxHeight;
        drawWidth = (img.width * maxHeight) / img.height;
      }

      const x = (pageWidth - drawWidth) / 2;
      const y = (pageHeight - drawHeight) / 2;

      // addImage: последний аргумент — compression/quality (для JPEG)
      pdf.addImage(
        imageDataUrl,
        "JPEG",
        x,
        y,
        drawWidth,
        drawHeight,
        undefined,
        "FAST",
        quality
      );

      progressBar.style.width = `${
        ((index + 1) / imageFiles.length) * 100
      }%`;
    }

    const outputBlob = pdf.output("blob");
    const firstName = imageFiles[0].name || "converted";
    const base = getBaseName(firstName);
    const blobUrl = URL.createObjectURL(outputBlob);

    // авто-скачивание
    const autoLink = document.createElement("a");
    autoLink.href = blobUrl;
    autoLink.download = `${base}.pdf`;
    document.body.appendChild(autoLink);
    autoLink.click();
    document.body.removeChild(autoLink);

    // fallback-кнопка
    downloadLink.href = blobUrl;
    downloadLink.download = `${base}.pdf`;
    downloadLink.classList.remove("d-none");

    lastConvLabel.textContent = new Date().toLocaleString();
    setStatus("PDF ready — downloaded automatically. If not, use the button below.");
  }

  // --- PDF -> Images --------------------------------------------------------

  async function convertPdfToImages(files) {
    const pdfFile = files.find(
      (f) =>
        f.type === "application/pdf" ||
        f.name.toLowerCase().endsWith(".pdf")
    );
    if (!pdfFile) {
      throw new Error("No PDF file found in selection.");
    }

    const pdfjsLib = await ensurePdfJs();
    const pdfData = await pdfFile.arrayBuffer();

    const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
    const numPages = pdf.numPages;

    const targetFormat = toFormatSelect.value === "png" ? "png" : "jpg";

    const qualityVal = parseInt(qualityRange.value, 10) || 90;
    const quality = Math.min(Math.max(qualityVal / 100, 0.4), 1.0);

    setStatus(
      `Rendering ${numPages} page(s) to ${targetFormat.toUpperCase()}...`
    );
    downloadLink.classList.add("d-none");

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 2.0 });

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({ canvasContext: ctx, viewport }).promise;

      const mimeType =
        targetFormat === "png" ? "image/png" : "image/jpeg";

      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob(
          (b) => {
            if (!b) {
              reject(new Error("Failed to create image blob."));
              return;
            }
            resolve(b);
          },
          mimeType,
          targetFormat === "jpg" ? quality : undefined
        );
      });

      const base = getBaseName(pdfFile.name);
      const filename = `${base}-page-${pageNum}.${targetFormat}`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      progressBar.style.width = `${(pageNum / numPages) * 100}%`;
    }

    lastConvLabel.textContent = new Date().toLocaleString();
    setStatus("All pages exported as images and downloaded one by one.");
  }

  // --- Form submit ----------------------------------------------------------

  if (convertForm) {
    convertForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      if (!selectedFiles.length) {
        setStatus("Please select at least one file first.");
        return;
      }

      let mode = conversionModeSelect.value;
      if (mode === "auto") {
        mode = detectMode(selectedFiles);
      }

      toggleLoading(true);
      progressBar.style.width = "15%";
      setStatus("Preparing conversion...");

      try {
        if (mode === "image-to-pdf") {
          await convertImagesToPdf(selectedFiles);
        } else if (mode === "pdf-to-image") {
          await convertPdfToImages(selectedFiles);
        } else {
          throw new Error("Unsupported conversion mode.");
        }
      } catch (err) {
        console.error(err);
        setStatus(`Error: ${err.message || "conversion failed."}`);
        downloadLink.classList.add("d-none");
      } finally {
        toggleLoading(false);
      }
    });
  }

  // init
  resetUI();
});
