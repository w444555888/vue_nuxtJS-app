/**
 * 統一 API 響應處理
 * 所有響應格式: { success: boolean, code: number, data: any }
 */

// 成功響應
const successResponse = (res, data = null, message = '成功', code = 200) => {
  return res.status(code).json({
    success: true,
    code,
    message,
    data
  });
};

// 失敗響應
const errorResponse = (res, message = '失敗', statusCode = 400) => {
  // 如果 message 是 Error 對象，提取消息
  let errorMessage = message;
  if (message instanceof Error) {
    errorMessage = message.message || '內部伺服器錯誤';
  } else if (typeof message !== 'string') {
    errorMessage = '內部伺服器錯誤';
  }

  return res.status(statusCode).json({
    success: false,
    code: statusCode,
    message: errorMessage,
    data: null
  });
};

module.exports = {
  successResponse,
  errorResponse
};
