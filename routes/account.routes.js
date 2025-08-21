const Router = require("express").Router();

const authenticateToken = require("../middleware/auth");
const { isAdmin, isAuth } = require("../middlewares/auth.middleware");
const { getPlanSnapshot, getPaymentHistory, updatePlan, getTeam, addTeam, updateTeam, delteTeam,  } = require("../controllers/accountPlan.controller");

Router.get("/plan", authenticateToken, getPlanSnapshot);

Router.get("/payment-history", authenticateToken, getPaymentHistory);

// Router.post("/plan", authenticateToken, accountCtrl.add);

Router.put("/plan/:id", authenticateToken, updatePlan);

// Router.delete("/plan:id", authenticateToken, accountCtrl.delete);

Router.get("/team", authenticateToken, getTeam)

Router.post("/team", authenticateToken, addTeam)

Router.patch("/team/:id", authenticateToken, updateTeam)

Router.delete("/:id", authenticateToken, delteTeam)


module.exports = Router;
