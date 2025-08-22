const Router = require("express").Router();

const userRouter = require("./user.routes");
const alertRouter = require("./alert.routes");
// const listingRouter = require("./listing.routes")
// const adminRouter = require("./admin.routes")
const uploadRouter = require("./upload.routes");

Router.use("/users", userRouter);
Router.use("/alerts", alertRouter);
// Router.use("/listings", listingRouter);
// Router.use("/admin", adminRouter);
Router.use("/upload", uploadRouter);

Router.use("/alerts", require("./alert.routes"));
// Router.use('/insights', require('./insights'));

Router.use("/auth", require("./auth.routes"));
Router.use("/invoices", require("./invoice.routes"));
Router.use("/inventory", require("./inventory"));
Router.use("/agent", require("./agent.routes"));
Router.use("/company", require("./company.routes.js"));
Router.use("/account", require("./account.routes.js"));
Router.use("/stripe", require("./stripe.routes.js"));
Router.use("/crm", require("./crm.routes.js"));
Router.use("/reports", require("./report.routes.js"));
Router.use("/support", require("./support.routes.js"));
Router.use("/disputes", require("./disputes.routes.js"));
Router.use("/escrow", require("./escrow.routes.js"));
Router.use("/repricing", require("./repricing.routes.js"));

const { Inventory } = require("../models/inventory");

Router.post("/share/:token", async (req, res) => {
  try {
    const { token } = req.params;

    const inventory = await Inventory.findById({ _id: token });

    if (!inventory) {
      return res.status(404).json({
        success: false,
        error: "Shared watch not found",
        shareUrl: `${req.protocol}://${req.get("host")}/share/${token}`,
      });
    }

    res.json({
      success: true,
      data: inventory,
      shareUrl: `${req.protocol}://${req.get("host")}/share/${token}`,
    });
  } catch (err) {
    console.error("Public share error:", err);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      shareUrl: `${req.protocol}://${req.get("host")}/share/${req.params.token}`,
    });
  }
});

Router.get("/share/:token", (req, res) => {
  const { token } = req.params;
  const frontendUrl =
    process.env.CLIENT_URL || "https://watch-dealer-hub.vercel.app";
  res.redirect(`${frontendUrl}/share/${token}`);
});

Router.get("/currency", async (req, res) => {
  res.json({
    currency: res.locals.currency,
  });
});

module.exports = Router;
