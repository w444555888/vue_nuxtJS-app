import logger from "../utils/logger.js";

/**
 * 性能監控中間件
 * 記錄每個 API 請求的响應時間
 * 使用方法: app.use(performanceMiddleware);
 */
export const performanceMiddleware = (req, res, next) => {
  const start = Date.now();
  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);

  res.json = function (data) {
    const duration = Date.now() - start;
    logger.perf(`API ${req.method} ${req.path}`, {
      duration,
      status: res.statusCode,
    });
    return originalJson(data);
  };

  res.send = function (data) {
    const duration = Date.now() - start;
    logger.perf(`API ${req.method} ${req.path}`, {
      duration,
      status: res.statusCode,
    });
    return originalSend(data);
  };

  next();
};

export default performanceMiddleware;
