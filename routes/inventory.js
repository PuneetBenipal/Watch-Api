const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const csv = require("csv-parser");
const {
  Inventory,
  createInventory,
  getInventoryByUser,
  getInventoryById,
  updateInventory,
  deleteInventory,
  getAllPublicInventory,
  getPublicInventoryByUser,
  toggleUserInventoryVisibility,
  generateShareToken,
  getPublicWatchByToken,
  bulkDeleteInventory,
} = require("../models/inventory");
const { buildDisplayPrice, ensureCode } = require("../utils/currency");
const authenticateToken = require("../middleware/auth");

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "../public/uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "inventory-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const fileFilter = (req, file, cb) => {
  const imageTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  const csvTypes = ["text/csv", "application/csv", "text/plain"];

  const isImage = imageTypes.includes(file.mimetype);
  const isCsv =
    csvTypes.includes(file.mimetype) ||
    file.originalname.toLowerCase().endsWith(".csv");

  if (isImage || isCsv) {
    console.log("File accepted:", file.originalname);
    cb(null, true);
  } else {
    console.log(
      "File rejected:",
      file.originalname,
      "MIME type:",
      file.mimetype
    );
    cb(
      new Error(
        `Invalid file type. Got ${file.mimetype}. Only images and CSV files are allowed.`
      ),
      false
    );
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 5, // Maximum 5 files
  },
});

// CSV upload endpoint with better error handling
router.post(
  "/upload-csv",
  authenticateToken,
  (req, res, next) => {
    upload.single("csvFile")(req, res, (err) => {
      if (err) {
        console.error("Multer error:", err);
        if (err.code === "LIMIT_FILE_SIZE") {
          return res
            .status(400)
            .json({ error: "File too large. Maximum size is 10MB." });
        }
        if (err.code === "LIMIT_UNEXPECTED_FILE") {
          return res.status(400).json({
            error: "Unexpected file field. Expected field name: csvFile",
          });
        }
        return res
          .status(400)
          .json({ error: err.message || "File upload error" });
      }
      next();
    });
  },
  async (req, res) => {
    try {
      console.log("CSV upload request received");
      console.log("User:", req.user ? req.user._id : "No user");
      console.log("File:", req.file ? req.file.originalname : "No file");
      console.log("Request headers:", req.headers);
      if (!req.file) {
        console.log("Error: No CSV file uploaded");
        return res.status(400).json({ error: "No CSV file uploaded" });
      }

      if (!req.file.originalname.toLowerCase().endsWith(".csv")) {
        console.log("Error: File is not CSV format:", req.file.originalname);
        return res.status(400).json({ error: "File must be a CSV file" });
      }

      console.log("CSV upload started for user:", req.user._id);
      console.log("File details:", {
        originalname: req.file.originalname,
        size: req.file.size,
        path: req.file.path,
      });

      const results = [];
      const errors = [];
      let rowNumber = 0;

      // Read and parse CSV file
      fs.createReadStream(req.file.path)
        .pipe(csv())
        .on("data", (data) => {
          rowNumber++;
          console.log(`Processing row ${rowNumber}:`, data);

          // Check if data is empty or malformed
          if (!data || Object.keys(data).length === 0) {
            const errorMsg = `Row ${rowNumber}: Empty or malformed row`;
            console.log(errorMsg);
            errors.push(errorMsg);
            return;
          }

          // Validate required fields
          if (!data.brand || !data.model) {
            const errorMsg = `Row ${rowNumber}: Brand and Model are required fields`;
            console.log(errorMsg);
            errors.push(errorMsg);
            return;
          }

          // Clean and validate data with better handling
          const inventoryData = {
            brand: data.brand ? String(data.brand).trim() : "",
            model: data.model ? String(data.model).trim() : "",
            year:
              data.year && String(data.year).trim() !== ""
                ? parseInt(String(data.year).trim())
                : undefined,
            refNo: data.refNo ? String(data.refNo).trim() : "",
            condition: data.condition ? String(data.condition).trim() : "",
            status: data.status ? String(data.status).trim() : "Available",
            priceListed:
              data.priceListed && String(data.priceListed).trim() !== ""
                ? parseFloat(String(data.priceListed).trim())
                : undefined,
            currency: data.currency ? String(data.currency).trim() : "USD",
            description: data.description
              ? String(data.description).trim()
              : "",
            visibility: data.visibility
              ? String(data.visibility).trim()
              : "public",
          };

          // Validate year (more flexible - allow years from 1800 to future, or skip validation for very low numbers)
          if (inventoryData.year && !isNaN(inventoryData.year)) {
            // If year is less than 1800, treat it as invalid, but allow empty/null years
            if (
              inventoryData.year < 1800 ||
              inventoryData.year > new Date().getFullYear() + 5
            ) {
              console.log(
                `Row ${rowNumber}: Year ${inventoryData.year} seems invalid, skipping year validation for this row`
              );
              // Don"t fail validation, just set year to undefined
              inventoryData.year = undefined;
            }
          }

          // Validate price
          if (
            inventoryData.priceListed &&
            (isNaN(inventoryData.priceListed) || inventoryData.priceListed < 0)
          ) {
            const errorMsg = `Row ${rowNumber}: Invalid price (${data.priceListed})`;
            console.log(errorMsg);
            errors.push(errorMsg);
            return;
          }

          // Validate condition (case-insensitive and more flexible)
          const validConditions = [
            "New",
            "Like New",
            "Excellent",
            "Good",
            "Fair",
            "Poor",
          ];
          if (inventoryData.condition) {
            const conditionLower = inventoryData.condition.toLowerCase();
            const validConditionLower = validConditions.map((c) =>
              c.toLowerCase()
            );
            if (!validConditionLower.includes(conditionLower)) {
              console.log(
                `Row ${rowNumber}: Invalid condition (${data.condition}), setting to "New" as default`
              );
              inventoryData.condition = "New"; // Set default instead of failing
            } else {
              // Fix the casing to match valid conditions
              const correctIndex = validConditionLower.indexOf(conditionLower);
              inventoryData.condition = validConditions[correctIndex];
            }
          }

          // Validate status (case-insensitive and more flexible)
          const validStatuses = [
            "Available",
            "Sold",
            "Reserved",
            "In Transit",
            "Under Repair",
          ];
          if (inventoryData.status) {
            const statusLower = inventoryData.status.toLowerCase();
            const validStatusLower = validStatuses.map((s) => s.toLowerCase());
            if (!validStatusLower.includes(statusLower)) {
              console.log(
                `Row ${rowNumber}: Invalid status (${data.status}), setting to "Available" as default`
              );
              inventoryData.status = "Available"; // Set default instead of failing
            } else {
              // Fix the casing to match valid statuses
              const correctIndex = validStatusLower.indexOf(statusLower);
              inventoryData.status = validStatuses[correctIndex];
            }
          }

          // Validate currency (case-insensitive and more flexible)
          const validCurrencies = ["USD", "EUR", "GBP", "CHF", "JPY"];
          if (inventoryData.currency) {
            const currencyUpper = inventoryData.currency.toUpperCase();
            if (!validCurrencies.includes(currencyUpper)) {
              console.log(
                `Row ${rowNumber}: Invalid currency (${data.currency}), setting to "USD" as default`
              );
              inventoryData.currency = "USD"; // Set default instead of failing
            } else {
              inventoryData.currency = currencyUpper;
            }
          }

          console.log(
            `Row ${rowNumber} validated successfully:`,
            inventoryData
          );
          results.push(inventoryData);
        })
        .on("end", async () => {
          try {
            // Delete the uploaded CSV file
            fs.unlinkSync(req.file.path);
            console.log("CSV file deleted successfully");

            if (errors.length > 0) {
              console.log("CSV validation failed with errors:", errors);
              return res.status(400).json({
                error: "CSV validation failed",
                errors,
                validRows: results.length,
              });
            }

            if (results.length === 0) {
              console.log("No valid data found in CSV file");
              return res
                .status(400)
                .json({ error: "No valid data found in CSV file" });
            }

            console.log(
              `Processing ${results.length} valid rows for database insertion`
            );

            // Create inventory items
            const createdItems = [];
            const failedItems = [];

            for (const itemData of results) {
              try {
                console.log("Creating inventory item:", itemData);
                const userId = req.user._id;
                const id = await createInventory(userId, itemData);
                console.log("Successfully created inventory item with ID:", id);
                createdItems.push({ id, ...itemData });
              } catch (error) {
                console.error("Failed to create inventory item:", error);
                failedItems.push({ ...itemData, error: error.message });
              }
            }

            console.log(
              `CSV upload completed. ${createdItems.length} items created, ${failedItems.length} failed`
            );

            res.json({
              message: `CSV upload completed. ${createdItems.length} items created successfully.`,
              createdItems,
              failedItems,
              totalProcessed: results.length,
            });
          } catch (error) {
            console.error("CSV processing error:", error);
            res
              .status(500)
              .json({ error: "Failed to process CSV file: " + error.message });
          }
        })
        .on("error", (error) => {
          console.error("CSV parsing error:", error);
          res
            .status(500)
            .json({ error: "Failed to parse CSV file: " + error.message });
        });
    } catch (error) {
      console.error("CSV upload error:", error);
      res
        .status(500)
        .json({ error: "Failed to upload CSV file: " + error.message });
    }
  }
);

// Share route to get inventory by ID (no authentication required) - MUST BE BEFORE /:id route
router.post("/share/:id", async (req, res) => {
  const { id } = req.params;
  console.log("Share route called with ID:", id);
  const goods = await Inventory.findById(id);
  console.log(goods, "goods$$$$$");
  res.json(goods);
});

router.post("/addinventory", authenticateToken, async (req, res) => {
  try {
    const {
      sender_name,
      sender_number,
      status,
      product_name,
      product_price,
      notes,
      createdAt,
      companyId,
      dealer,
      product_image,
    } = req.body;

    // Helper function to map status
    const mapStatus = (status) => {
      switch (status) {
        case "online":
        case "pending":
          return "Available";
        case "confirmed":
        case "completed":
          return "Sold";
        case "cancelled":
          return "On Hold";
        default:
          return "Available";
      }
    };

    // Map frontend fields to schema fields
    const newItem = new Inventory({
      companyId: new mongoose.Types.ObjectId(companyId || req.user.companyId),
      dealerId: new mongoose.Types.ObjectId(req.user._id),
      brand: sender_name || "Unknown",
      model: product_name || "Unknown",
      priceListed: parseFloat(product_price) || 0,
      status: mapStatus(status),
      description: notes || "",
      createdBy: req.user._id,
      images: product_image ? [product_image] : [],
      year: createdAt ? new Date(createdAt).getFullYear() : undefined,
    });

    await newItem.save();

    res.status(201).json({
      success: true,
      data: newItem,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

// Get all inventory for user (authenticated)
router.get("/", authenticateToken, async (req, res) => {
  try {
    // Use req.user._id (the full user object from middleware)
    const userId = req.user._id;
    console.log("Fetching inventory for user:", userId);

    const inventory = await getInventoryByUser(userId);
    console.log("Found inventory items:", inventory.length);

    const targetCurrency = ensureCode(
      req.user?.defaultCurrency || res.locals.currency || "USD"
    );
    const enriched = await Promise.all(
      inventory.map(async (item) => {
        const display = await buildDisplayPrice(
          item.priceListed,
          item.currency,
          targetCurrency
        );
        return { ...item.toObject(), displayPrice: display };
      })
    );

    res.json(enriched);
  } catch (err) {
    console.error("Error fetching inventory:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Get all public inventory (for customers)
router.get("/public", async (req, res) => {
  try {
    const inventory = await getAllPublicInventory();
    const targetCurrency = ensureCode(res.locals.currency || "USD");
    const enriched = await Promise.all(
      inventory.map(async (item) => {
        const display = await buildDisplayPrice(
          item.priceListed,
          item.currency,
          targetCurrency
        );
        return { ...item.toObject(), displayPrice: display };
      })
    );
    res.json(enriched);
  } catch (err) {
    console.error("Public inventory error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Get public inventory for a specific user (for public profile pages)
router.get("/public/user/:userId", async (req, res) => {
  try {
    const inventory = await getPublicInventoryByUser(req.params.userId);

    console.log(req.params.userId);

    res.json(inventory);
  } catch (err) {
    console.error("User public inventory error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Toggle visibility of all inventory items for a user
router.post("/toggle-visibility", authenticateToken, async (req, res) => {
  try {
    const { visibility } = req.body;
    if (!["private", "shared", "public"].includes(visibility)) {
      return res.status(400).json({ error: "Invalid visibility value" });
    }

    const result = await toggleUserInventoryVisibility(
      req.user._id,
      visibility
    );
    res.json({
      message: `All inventory items set to ${visibility}`,
      updatedCount: result.modifiedCount,
    });
  } catch (err) {
    console.error("Toggle visibility error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Get single inventory item
router.get("/:id", authenticateToken, async (req, res) => {
  try {
    const item = await getInventoryById(req.params.id);
    if (!item || item.dealerId.toString() !== req.user._id.toString())
      return res.status(404).json({ error: "Not found" });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Create inventory item with image uploads
router.post(
  "/",
  authenticateToken,
  upload.array("images", 5),
  async (req, res) => {
    try {
      // Extract form data
      const inventoryData = {
        brand: req.body.brand,
        model: req.body.model,
        year: req.body.year ? parseInt(req.body.year) : undefined,
        refNo: req.body.refNo,
        condition: req.body.condition,
        status: req.body.status || "Available",
        priceListed: req.body.priceListed
          ? parseFloat(req.body.priceListed)
          : undefined,
        currency: req.body.currency || "USD",
        description: req.body.description,
        country: req.body.country,
        visibility: req.body.visibility || "public",
        images: [],
      };

      // Process uploaded images
      if (req.files && req.files.length > 0) {
        inventoryData.images = req.files.map(
          (file) => `/uploads/${file.filename}`
        );
      }

      // Use req.user._id (the full user object from middleware)
      const userId = req.user._id;
      console.log("User ID from token:", userId);

      const id = await createInventory(userId, inventoryData);
      res.status(201).json({
        id,
        message: "Inventory item created successfully",
        images: inventoryData.images,
      });
    } catch (err) {
      console.error("Create inventory error:", err);
      res.status(500).json({ error: err.message || "Server error" });
    }
  }
);

// Update inventory item
router.put(
  "/:id",
  authenticateToken,
  upload.array("images", 5),
  async (req, res) => {
    try {
      // Extract form data
      const updateData = {
        brand: req.body.brand,
        model: req.body.model,
        year: req.body.year ? parseInt(req.body.year) : undefined,
        refNo: req.body.refNo,
        condition: req.body.condition,
        status: req.body.status || "Available",
        selectedAdmins: req.body.selectedAdmins,
        priceListed: req.body.priceListed
          ? parseFloat(req.body.priceListed)
          : undefined,
        currency: req.body.currency || "USD",
        description: req.body.description,
        visibility: req.body.visibility || "public",
      };
      console.log(updateData, "updateDATA ==== >>> ");

      // Process uploaded images if any
      if (req.files && req.files.length > 0) {
        updateData.images = req.files.map(
          (file) => `/uploads/${file.filename}`
        );
      }
      await updateInventory(req.params.id, req.user._id, updateData);
      res.status(200).json({ message: "Inventory item updated successfully" });
    } catch (err) {
      console.error("Update inventory error:", err);
      res.status(500).json({ error: err.message || "Server error" });
    }
  }
);

// Delete inventory item
router.delete("/:id", authenticateToken, async (req, res) => {
  try {
    await deleteInventory(req.params.id, req.user._id);
    res.status(200).json({ message: "Inventory item deleted successfully" });
  } catch (err) {
    console.error("Delete inventory error:", err);
    res.status(500).json({ error: err.message || "Server error" });
  }
});

// Generate share link for inventory item
router.post("/:id/share", authenticateToken, async (req, res) => {
  try {
    const shareToken = await generateShareToken(req.params.id, req.user._id);

    const shareUrl = `${req.protocol}://${req.get("host")}/share/${shareToken}`;

    res.json({
      message: "Share link generated successfully",
      shareToken: shareToken,
      shareUrl: shareUrl,
    });
  } catch (err) {
    console.error("Generate share token error:", err);
    res.status(500).json({ error: err.message || "Server error" });
  }
});

// Bulk delete inventory items
router.post("/bulk-delete", authenticateToken, async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "Invalid or empty IDs array" });
    }

    const result = await bulkDeleteInventory(ids, req.user._id);

    res.json({
      message: `${result.deletedCount} inventory items deleted successfully`,
      deletedCount: result.deletedCount,
    });
  } catch (err) {
    console.error("Bulk delete inventory error:", err);
    res.status(500).json({ error: err.message || "Server error" });
  }
});

// Test endpoint to verify database connection and inventory items
router.get("/test", async (req, res) => {
  try {
    const count = await Inventory.countDocuments();
    const sampleItem = await Inventory.findOne().populate("companyId", "name");

    res.json({
      success: true,
      message: "Database connection working",
      totalItems: count,
      sampleItem: sampleItem
        ? {
            _id: sampleItem._id,
            brand: sampleItem.brand,
            model: sampleItem.model,
          }
        : null,
    });
  } catch (err) {
    console.error("Test endpoint error:", err);
    res.status(500).json({
      success: false,
      error: "Database connection failed",
    });
  }
});

// Public route to get shared watch by token (no authentication required)
router.get("/public/share/:token", async (req, res) => {
  try {
    const { token } = req.params;

    const inventory = await getPublicWatchByToken(token);

    if (!inventory) {
      return res.status(404).json({
        success: false,
        error: "Shared watch not found",
      });
    }

    res.json({
      success: true,
      data: inventory,
    });
  } catch (err) {
    console.error("Public share error:", err);
    res.status(404).json({
      success: false,
      error: "Shared watch not found",
    });
  }
});

// Public route to get inventory by ID for sharing (no authentication required)
router.get("/public/item/:id", async (req, res) => {
  try {
    const { id } = req.params;
    console.log("Public item route called with ID:", id);

    const inventory = await Inventory.findById(id).populate(
      "companyId",
      "name"
    );
    console.log("Found inventory:", inventory ? "Yes" : "No");

    if (!inventory) {
      console.log("No inventory found for ID:", id);
      return res.status(404).json({
        success: false,
        error: "Inventory item not found",
      });
    }

    console.log("Returning inventory data for ID:", id);
    res.json({
      success: true,
      data: inventory,
    });
  } catch (err) {
    console.error("Public inventory by ID error:", err);
    res.status(404).json({
      success: false,
      error: "Inventory item not found",
    });
  }
});

// Error handling middleware for multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res
        .status(400)
        .json({ error: "File too large. Maximum size is 10MB." });
    }
    if (error.code === "LIMIT_FILE_COUNT") {
      return res
        .status(400)
        .json({ error: "Too many files. Maximum is 5 images." });
    }
    return res.status(400).json({ error: "File upload error" });
  }

  if (error.message.includes("Invalid file type")) {
    return res.status(400).json({ error: error.message });
  }

  console.error("Upload error:", error);
  res.status(500).json({ error: "Upload failed" });
});

module.exports = router;
