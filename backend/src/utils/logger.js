import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));


// 定義日誌等級
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  perf: 4,
  debug: 5,
};


// 定義日誌等級顏色
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
  perf: 'cyan'
};

winston.addColors(colors);


// 定義日誌格式
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`,
  ),
);

// 定義文件日誌格式
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`,
  ),
);


// 性能日誌過濾器
const perfOnly = winston.format((info) => {
  if (info.level === 'perf') {
    return info;
  }
  return false;
});


// 定義傳輸層
const transports = [
  // 控制台輸出（所有日誌級別）
  new winston.transports.Console({ format: consoleFormat }),
  
  // 所有日誌寫入 all.log 文件
  new winston.transports.File({
    filename: path.join(__dirname, '../../logs/all.log'),
    dirname: path.join(__dirname, '../../logs'),
    format: fileFormat,
  }),
  
  // 只有錯誤寫入 error.log
  new winston.transports.File({
    level: 'error',
    filename: path.join(__dirname, '../../logs/error.log'),
    dirname: path.join(__dirname, '../../logs'),
    format: fileFormat,
  }),
  
  // 只有性能日誌寫入 performance.log
  new winston.transports.File({
    level: 'perf',
    filename: path.join(__dirname, '../../logs/performance.log'),
    dirname: path.join(__dirname, '../../logs'),
    format: winston.format.combine(perfOnly(), fileFormat),
  }),
];


/**
 * Winston 日誌工具-創建 Logger 實例
 * 
 * 傳入日誌等級
 * 設定最低記錄等級
 * 傳入輸出方式
 * 
*/
const logger = winston.createLogger({
  levels,
  level: process.env.LOG_LEVEL || 'debug',
  transports,
});

// 自定義性能日誌方法
logger.perf = (message, metadata = {}) => {
  logger.log('perf', message, metadata);
};

export default logger;
