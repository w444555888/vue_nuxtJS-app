const jwt = require("jsonwebtoken");

// 验证 JWT Token
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "没有 token，无法访问" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      id: decoded.id,
      username: decoded.username
    };
    next();
  } catch (error) {
    return res.status(403).json({ error: "Token 无效或过期" });
  }
};

module.exports = { verifyToken };
