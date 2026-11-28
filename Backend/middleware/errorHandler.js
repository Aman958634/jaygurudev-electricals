export default function errorHandler(err, req, res, next) {
  console.error(err);

  const statusCode = err.statusCode || (err.name === 'MulterError' ? 400 : (err.message === 'Origin is not allowed by CORS.' ? 403 : 500));
  let message = err.message || 'Internal Server Error';
  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') message = 'Uploaded file exceeds the allowed size.';
    else if (err.code === 'LIMIT_FILE_COUNT') message = 'Too many files were uploaded.';
    else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      const field = typeof err.field === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(err.field) ? err.field : 'unknown';
      message = `Unexpected upload field: ${field}.`;
    } else message = 'The upload could not be processed.';
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
}
