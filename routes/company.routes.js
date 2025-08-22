const express = require("express");
const Router = express.Router();
const authenticateToken = require("../middleware/auth");
const companyCtrl = require("../controllers/company.ctrl");
const Company = require("../models/Company.model");

// Create checkout session
Router.get("/", authenticateToken, companyCtrl.getCompany);
// Branding settings (premium: branded invoices)
Router.get("/branding", authenticateToken, async (req, res) => {
  try {
    const company = await Company.findById(req.user.companyId).lean();
    if (!company) return res.status(404).json({ error: "Company not found" });
    res.json({ branding: company.branding || {} });
  } catch (e) {
    res
      .status(500)
      .json({ error: "Failed to load branding", detail: e.message });
  }
});

Router.put("/branding", authenticateToken, async (req, res) => {
  try {
    const update = req.body || {};
    const company = await Company.findById(req.user.companyId);
    if (!company) return res.status(404).json({ error: "Company not found" });
    company.branding = { ...(company.branding || {}), ...update };
    await company.save();
    res.json({ branding: company.branding });
  } catch (e) {
    res
      .status(500)
      .json({ error: "Failed to update branding", detail: e.message });
  }
});

Router.get("/dailyreports", authenticateToken, async (req, res) => {
  try {
    const company = await Company.findOne({
      team: { $in: [req.user._id] },
    }).populate("dailyreport");

    if (!company) {
      return res.status(404).json({ error: "Company not found" });
    }

    res.json({ dailyReports: company.dailyreport || [] });
  } catch (error) {
    console.error("Error fetching daily reports:", error);
    res.status(500).json({ error: "Failed to fetch daily reports" });
  }
});

// Create a new daily report
Router.post("/dailyreports", authenticateToken, async (req, res) => {
  try {
    const {
      status,
      product_name,
      product_name_type,
      product_price,
      min_price,
      max_price,
    } = req.body;

    // Validate required fields
    if (!status || !product_name_type || product_price === undefined) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const company = await Company.findOne({
      team: { $in: [req.user._id] },
    });

    if (!company) {
      return res.status(404).json({ error: "Company not found" });
    }

    const newDailyReport = {
      status,
      product_name,
      product_name_type,
      product_price,
      min_price,
      max_price,
    };

    company.dailyreport.push(newDailyReport);
    await company.save();

    res.status(201).json({
      message: "Daily report created successfully",
      dailyReport: newDailyReport,
    });
  } catch (error) {
    console.error("Error creating daily report:", error);
    res.status(500).json({ error: "Failed to create daily report" });
  }
});

// Update a daily report
Router.put("/dailyreports/:id", authenticateToken, async (req, res) => {
  try {
    const {
      status,
      product_name,
      product_name_type,
      product_price,
      min_price,
      max_price,
    } = req.body;
    const { id } = req.params;

    // Validate required fields
    if (!status || !product_name_type || product_price === undefined) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const company = await Company.findOne({
      team: { $in: [req.user._id] },
    });

    if (!company) {
      return res.status(404).json({ error: "Company not found" });
    }

    const dailyReportIndex = company.dailyreport.findIndex(
      (report) => report._id.toString() === id
    );

    if (dailyReportIndex === -1) {
      return res.status(404).json({ error: "Daily report not found" });
    }

    // Update the daily report
    company.dailyreport[dailyReportIndex] = {
      ...company.dailyreport[dailyReportIndex],
      status,
      product_name,
      product_name_type,
      product_price,
      min_price,
      max_price,
    };

    await company.save();

    res.json({
      message: "Daily report updated successfully",
      dailyReport: company.dailyreport[dailyReportIndex],
    });
  } catch (error) {
    console.error("Error updating daily report:", error);
    res.status(500).json({ error: "Failed to update daily report" });
  }
});

// Delete a daily report
Router.delete("/dailyreports/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const company = await Company.findOne({
      team: { $in: [req.user._id] },
    });

    if (!company) {
      return res.status(404).json({ error: "Company not found" });
    }

    const dailyReportIndex = company.dailyreport.findIndex(
      (report) => report._id.toString() === id
    );

    if (dailyReportIndex === -1) {
      return res.status(404).json({ error: "Daily report not found" });
    }

    // Remove the daily report
    company.dailyreport.splice(dailyReportIndex, 1);
    await company.save();

    res.json({ message: "Daily report deleted successfully" });
  } catch (error) {
    console.error("Error deleting daily report:", error);
    res.status(500).json({ error: "Failed to delete daily report" });
  }
});

module.exports = Router;
