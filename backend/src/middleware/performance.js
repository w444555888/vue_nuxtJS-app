import logger from "../utils/logger.js";

/**
 * 性能監控中間件
 * 記錄每個 API 請求的响應時間
 * 使用方法: app.use(performanceMiddleware);
 */
export const performanceMiddleware = (req, res, next) => {
  const start = Date.now();
  let logged = false;

  const logPerf = () => {
    if (logged) {
      return;
    }

    logged = true;
    const duration = Date.now() - start;
    logger.perf(`API ${req.method} ${req.path}`, {
      duration,
      status: res.statusCode,
    });
  };

  res.once("finish", logPerf);
  res.once("close", logPerf);

  next();
};

export default performanceMiddleware;
