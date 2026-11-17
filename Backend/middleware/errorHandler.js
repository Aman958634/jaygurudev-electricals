export default function errorHandler(err, req, res, next) {
  console.error(err);

  const statusCode = err.statusCode || (err.name === 'MulterError' ? 400 : (err.message === 'Origin is not allowed by CORS.' ? 403 : 500));
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
}
