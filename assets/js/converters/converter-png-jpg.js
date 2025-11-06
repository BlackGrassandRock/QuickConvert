// converter-png-jpg.js
// Logic for PNG ↔ JPG on index.html
// Uses only browser APIs (FileReader, Image, Canvas).

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const uploadArea        = $('#upload-area');
  const fileInput         = $('#file-input');
  const fileInfoWrapper   = $('#file-info-wrapper');
  const fileNameEl        = $('#file-name');
  const fileSizeEl        = $('#file-size');

  const fromFormat        = $('#from-format');
  const toFormat          = $('#to-format');
  const swapBtn           = $('#swap-formats');

  const qualityRange      = $('#quality-range');
  const compressSwitch    = $('#compress-switch');

  const convertForm       = $('#converter-form');
  const convertBtn        = $('#convert-btn');
  const convertSpinner    = $('#convert-spinner');

  const resetBtn          = $('#reset-btn');

  const statusText        = $('#status-text');
  const progressWrapper   = $('#progress-bar-wrapper');
  const progressBar       = $('#progress-bar');
  const downloadHint      = $('#download-hint');
  const downloadLink      = $('#download-link');

  const changeFileBtn     = $('#change-file-btn');

  const lastConvLabel     = $('#last-conv-label');

  let currentFile = null;

  // Helpers
  function humanFileSize(bytes) {
    if (!bytes && bytes !== 0) return '';
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  function resetUI() {
    currentFile = null;
    fileInput.value = '';
    fileInfoWrapper.classList.add('d-none');
    uploadArea.classList.remove('dragover');

    fromFormat.value = 'auto';
    toFormat.value = 'jpg';
    qualityRange.value = 85;
    compressSwitch.checked = true;

    statusText.textContent = 'No file selected yet.';
    progressWrapper.classList.add('d-none');
    downloadHint.classList.add('d-none');
    downloadLink.classList.add('d-none');
    convertSpinner.classList.add('d-none');
    convertBtn.disabled = false;
  }

  function showFileInfo(file) {
    currentFile = file;
    fileNameEl.textContent = file.name;
    fileSizeEl.textContent = humanFileSize(file.size);
    fileInfoWrapper.classList.remove('d-none');
    statusText.textContent = `Selected: ${file.name}`;
  }

  function detectFormatFromFile(file) {
    if (!file) return null;
    if (file.type === 'image/png') return 'png';
    if (file.type === 'image/jpeg') return 'jpg';
    return null;
  }

  function handleFileSelected(file) {
    const allowed = ['image/png', 'image/jpeg', 'image/jpg'];
    if (!allowed.includes(file.type)) {
      statusText.textContent =
        'Unsupported file type — please choose PNG or JPG/JPEG.';
      return;
    }

    showFileInfo(file);

    // Auto-detect source format
    const detected = detectFormatFromFile(file);
    if (detected) {
      fromFormat.value = detected;
      // if target совпадает с source — переключим на противоположный
      if (toFormat.value === detected) {
        toFormat.value = detected === 'png' ? 'jpg' : 'png';
      }
    }
  }

  // Drag & drop + click
  uploadArea.addEventListener('click', () => fileInput.click());

  uploadArea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInput.click();
    }
  });

  uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
  });

  uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
  });

  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');

    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) handleFileSelected(f);
  });

  fileInput.addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    if (f) handleFileSelected(f);
  });

  // "Change" button
  changeFileBtn.addEventListener('click', () => fileInput.click());

  // Swap formats (как в webp-конвертере, но только для PNG/JPG)
  swapBtn.addEventListener('click', () => {
    const src = fromFormat.value;
    const dst = toFormat.value;

    // спец-логика, если source = auto
    if (src === 'auto') {
      if (dst === 'jpg') {
        fromFormat.value = 'png';
        toFormat.value = 'jpg';
      } else if (dst === 'png') {
        fromFormat.value = 'jpg';
        toFormat.value = 'png';
      } else {
        // теоретически не должно сюда попасть, но пусть:
        fromFormat.value = 'auto';
        toFormat.value = 'jpg';
      }
      return;
    }

    // обычный swap
    fromFormat.value = dst === 'auto' ? 'auto' : dst;
    toFormat.value = src === 'auto' ? 'auto' : src;
  });

  // Reset button
  resetBtn.addEventListener('click', () => {
    resetUI();
  });

  // Conversion submit
  convertForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!currentFile) {
      statusText.textContent = 'Please choose a file first.';
      return;
    }

    const target = toFormat.value;
    if (!['jpg', 'png'].includes(target)) {
      statusText.textContent = 'Please choose a valid target format.';
      return;
    }

    convertBtn.disabled = true;
    convertSpinner.classList.remove('d-none');
    progressWrapper.classList.remove('d-none');
    progressBar.style.width = '100%';
    downloadHint.classList.add('d-none');
    downloadLink.classList.add('d-none');
    statusText.textContent = 'Converting image...';

    try {
      const result = await convertImageFile(currentFile, target);

      const blobUrl = URL.createObjectURL(result.blob);
      const baseName = (currentFile && currentFile.name)
        ? currentFile.name.replace(/\.[^/.]+$/, '')
        : 'converted';
      const ext = target === 'jpg' ? '.jpg' : '.png';

      // Auto-download (как в webp-версии)
      const autoLink = document.createElement('a');
      autoLink.href = blobUrl;
      autoLink.download = baseName + ext;
      document.body.appendChild(autoLink);
      autoLink.click();
      document.body.removeChild(autoLink);

      // Показать кнопку на всякий случай
      downloadLink.href = blobUrl;
      downloadLink.download = baseName + ext;
      downloadLink.classList.remove('d-none');
      downloadHint.classList.remove('d-none');

      statusText.textContent = `Conversion ready — ${result.sizeHuman}`;
      lastConvLabel.textContent = new Date().toLocaleString();
    } catch (err) {
      console.error(err);
      statusText.textContent =
        'Conversion failed: ' + (err && err.message ? err.message : String(err));
    } finally {
      convertSpinner.classList.add('d-none');
      progressWrapper.classList.add('d-none');
      convertBtn.disabled = false;
    }
  });

  // Core converter
  async function convertImageFile(file, targetFormat) {
    const dataURL = await readFileAsDataURL(file);
    const img = await loadImage(dataURL);

    const outW = img.naturalWidth;
    const outH = img.naturalHeight;

    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;

    const ctx = canvas.getContext('2d');

    // Для JPG заливаем фон белым (без прозрачности)
    if (targetFormat === 'jpg') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, outW, outH);
    }

    ctx.drawImage(img, 0, 0, outW, outH);

    // Качество:
    //  - если compress-switch включен: используем слайдер (0.4–1.0)
    //  - если выключен: ставим максимальное качество (1.0)
    let quality = 1.0;
    if (compressSwitch.checked) {
      const qVal = parseFloat(qualityRange.value) || 85;
      quality = Math.min(Math.max(qVal / 100, 0.4), 1.0);
    }

    const mime = targetFormat === 'jpg' ? 'image/jpeg' : 'image/png';

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((b) => {
        if (!b) {
          reject(new Error('Failed to generate output file.'));
          return;
        }
        resolve(b);
      }, mime, targetFormat === 'jpg' ? quality : undefined);
      // для PNG качество обычно игнорируется, поэтому передаём только для JPG
    });

    return {
      blob,
      size: blob.size,
      sizeHuman: humanFileSize(blob.size),
    };
  }

  // Small helpers
  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = () => reject(fr.error || new Error('Failed to read file.'));
      fr.readAsDataURL(file);
    });
  }

  function loadImage(dataURL) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Invalid image data.'));
      img.src = dataURL;
    });
  }

  // Keyboard accessibility на блоке инфы о файле (Enter = Change)
  fileInfoWrapper.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      changeFileBtn.click();
    }
  });

  // Init
  resetUI();

  // Экспорт для дебага (по желанию)
  window.quickconvertPngJpg = {
    resetUI,
    convertImageFile,
  };
});
