const jwt = require("jsonwebtoken");

// JWT Token
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "沒有 token，無法訪問" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      id: decoded.id,
      username: decoded.username
    };
    next();
  } catch (error) {
    return res.status(403).json({ error: "Token無效或已過期" });
  }
};

module.exports = { verifyToken };
