import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { open, unlink } from 'fs/promises';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const backendDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const uploadsDir = path.join(backendDirectory, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, uploadsDir);
  },
  filename(req, file, cb) {
    const safeName = file.originalname.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9._-]/g, '');
    cb(null, `${Date.now()}-${randomUUID()}-${safeName}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
    return;
  }

  cb(new Error('Only JPG, JPEG, PNG, and WEBP files are allowed.'));
};

export const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 12,
    fields: 30,
    parts: 42,
    fieldNameSize: 100,
    fieldSize: 1024 * 1024,
  },
  fileFilter,
});

function validImageSignature(file, bytes) {
  if (file.mimetype === 'image/png') {
    return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  }
  if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/jpg') {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (file.mimetype === 'image/webp') {
    return bytes.length >= 12
      && bytes.toString('ascii', 0, 4) === 'RIFF'
      && bytes.toString('ascii', 8, 12) === 'WEBP';
  }
  return false;
}

export async function validateImageContent(req, res, next) {
  const files = req.file ? [req.file] : (req.files || []);
  if (!files.length) return next();

  try {
    for (const file of files) {
      const handle = await open(file.path, 'r');
      let bytes;
      try {
        bytes = Buffer.alloc(12);
        const { bytesRead } = await handle.read(bytes, 0, bytes.length, 0);
        bytes = bytes.subarray(0, bytesRead);
      } finally {
        await handle.close();
      }

      if (!validImageSignature(file, bytes)) {
        await Promise.all(files.map((uploadedFile) => unlink(uploadedFile.path)));
        return res.status(400).json({ success: false, message: 'Uploaded file content is not a valid image.' });
      }
    }
    return next();
  } catch (error) {
    await Promise.all(files.map((file) => unlink(file.path).catch(() => {})));
    return next(error);
  }
}

export function uploadErrorHandler(error, req, res, next) {
  if (error instanceof multer.MulterError) {
    return res.status(400).json({ success: false, message: error.message });
  }
  if (error.message?.startsWith('Only JPG')) {
    return res.status(400).json({ success: false, message: error.message });
  }
  return next(error);
}
