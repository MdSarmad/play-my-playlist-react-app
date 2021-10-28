const jwt = require("jsonwebtoken");

function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (token == null) return res.status(401);
  //   if (token == null) return res.sendStatus(401)

  jwt.verify(token, process.env.TOKEN_SECRET, (err, user_id) => {
    console.log(err);

    if (err) return res.status(403);
    // if (err) return res.sendStatus(403)

    req.user_id = user_id;

    next();
  });
}
