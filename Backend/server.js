import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { uploadsDir, uploadErrorHandler } from './middleware/upload.js';
import productRoutes from './routes/products.js';
import categoryRoutes from './routes/categories.js';
import brandRoutes from './routes/brands.js';
import adminRoutes from './routes/admin.js';
import enquiryRoutes from './routes/enquiries.js';
import galleryRoutes from './routes/gallery.js';
import pageRoutes from './routes/pages.js';
import settingsRoutes from './routes/settings.js';
import dashboardRoutes from './routes/dashboard.js';
import bannerRoutes from './routes/banners.js';
import statisticsRoutes from './routes/statistics.js';
import errorHandler from './middleware/errorHandler.js';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 5000);
const backendDirectory = path.dirname(fileURLToPath(import.meta.url));
const pidFilePath = path.join(backendDirectory, '.backend-5000.pid');

app.use(helmet({ crossOriginResourcePolicy: false }));
const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('Origin is not allowed by CORS.'));
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(uploadsDir, { fallthrough: false, maxAge: '1d' }));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please try again later.' },
});
app.use('/api', apiLimiter);

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Jay GuruDev backend is running.' });
});

app.use('/api/admin', adminRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/brands', brandRoutes);
app.use('/api/enquiries', enquiryRoutes);
app.use('/api/gallery', galleryRoutes);
app.use('/api/pages', pageRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/banners', bannerRoutes);
app.use('/api/statistics', statisticsRoutes);

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found.' });
});

app.use((err, req, res, next) => {
  if (err.status === 404 && req.path.startsWith('/uploads/')) {
    return res.status(404).json({ success: false, message: 'Uploaded file not found.' });
  }
  return next(err);
});

app.use(uploadErrorHandler);
app.use(errorHandler);

const server = app.listen(PORT);

server.on('listening', async () => {
  if (PORT === 5000) {
    try {
      await writeFile(pidFilePath, JSON.stringify({
        pid: process.pid,
        serverPath: path.join(backendDirectory, 'server.js'),
        startedAt: Date.now() - process.uptime() * 1000,
      }));
    } catch (error) {
      console.error(`Backend is listening, but its process marker could not be written: ${error.message}`);
    }
  }

  console.log(`Jay GuruDev backend listening on port ${PORT}`);
});

server.on('close', async () => {
  if (PORT !== 5000) return;

  try {
    const marker = JSON.parse(await readFile(pidFilePath, 'utf8'));
    if (marker.pid === process.pid) {
      await unlink(pidFilePath);
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error(`Could not clean up the backend process marker: ${error.message}`);
    }
  }
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(
      `Cannot start the Jay GuruDev backend: port ${PORT} is already in use. ` +
      'Run "npm run backend:status" to inspect the listener. If it is this backend, reuse it; ' +
      'stop it only with "npm run backend:stop" after it is verified as this project.',
    );
    process.exitCode = 1;
    return;
  }

  console.error(`The Jay GuruDev backend could not listen on port ${PORT}: ${error.message}`);
  process.exitCode = 1;
});
