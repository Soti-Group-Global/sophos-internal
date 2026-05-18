/**
 * validateUpload — checks magic bytes (file signature) of uploaded buffer.
 * Use after multer parses the file into req.file.
 *
 * Usage:
 *   router.post('/upload', upload.single('file'), validateUpload(['image', 'pdf', 'doc']), handler)
 *   router.post('/avatar', upload.single('profileImage'), validateUpload(['image']), handler)
 */

const SIGNATURES = {
  // Images
  jpg:  { bytes: [0xff, 0xd8, 0xff], offset: 0 },
  png:  { bytes: [0x89, 0x50, 0x4e, 0x47], offset: 0 },
  gif:  { bytes: [0x47, 0x49, 0x46, 0x38], offset: 0 },
  webp: { bytes: [0x57, 0x45, 0x42, 0x50], offset: 8 },
  // Documents
  pdf:  { bytes: [0x25, 0x50, 0x44, 0x46], offset: 0 },    // %PDF
  // Office (DOCX, XLSX, PPTX are ZIP internally)
  zip:  { bytes: [0x50, 0x4b, 0x03, 0x04], offset: 0 },
  // Legacy Office (DOC, XLS)
  doc:  { bytes: [0xd0, 0xcf, 0x11, 0xe0], offset: 0 },
};

const ALLOWED_BY_GROUP = {
  image:    ['jpg', 'png', 'gif', 'webp'],
  pdf:      ['pdf'],
  doc:      ['pdf', 'zip', 'doc'],   // covers PDF + modern + legacy Office
  any:      Object.keys(SIGNATURES),
};

const MAX_SIZE_BYTES = {
  image: 5  * 1024 * 1024,  // 5 MB
  pdf:   20 * 1024 * 1024,  // 20 MB
  doc:   20 * 1024 * 1024,
  any:   20 * 1024 * 1024,
};

function matchesSignature(buffer, sig) {
  if (buffer.length < sig.offset + sig.bytes.length) return false;
  return sig.bytes.every((b, i) => buffer[sig.offset + i] === b);
}

function detectType(buffer) {
  return Object.entries(SIGNATURES).find(([, sig]) => matchesSignature(buffer, sig))?.[0] || null;
}

/**
 * @param {string[]} groups - e.g. ['image'] or ['image', 'pdf', 'doc']
 */
const validateUpload = (groups = ['any']) => (req, res, next) => {
  if (!req.file) return next(); // no file — let controller decide

  const { buffer, size, originalname } = req.file;

  // Determine allowed types from groups
  const allowedTypes = [...new Set(groups.flatMap(g => ALLOWED_BY_GROUP[g] || []))];

  // Size check — use the most permissive limit across selected groups
  const maxSize = Math.max(...groups.map(g => MAX_SIZE_BYTES[g] || MAX_SIZE_BYTES.any));
  if (size > maxSize) {
    return res.status(400).json({
      message: `File too large. Maximum allowed size is ${Math.round(maxSize / 1024 / 1024)} MB.`,
    });
  }

  // Magic-byte check
  const detected = detectType(buffer);
  if (!detected || !allowedTypes.includes(detected)) {
    return res.status(400).json({
      message: `Invalid file type. Allowed: ${allowedTypes.join(', ').toUpperCase()}. Detected: ${detected?.toUpperCase() || 'unknown'}.`,
    });
  }

  next();
};

module.exports = validateUpload;
