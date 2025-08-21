const mongoose = require("mongoose");
const User = require("./User.model");
const Company = require("./Company.model");

// Define the inventory schema
const InventorySchema = new mongoose.Schema(
  {
    brand: {
      type: String,
      required: true,
      trim: true,
    },
    model: {
      type: String,
      required: true,
      trim: true,
    },
    refNo: {
      type: String,
      trim: true,
    },
    year: {
      type: Number,
    },
    condition: {
      type: String,
      enum: [
        "New",
        "Like New",
        "Excellent",
        "Very Good",
        "Good",
        "Fair",
        "Poor",
      ],
      default: "Good",
    },
    status: {
      type: String,
      enum: ["Available", "On Hold", "Sold", "Reserved", "Under Negotiation"],
      default: "Available",
    },
    priceListed: {
      type: Number,
      required: true,
      min: 0,
    },
    pricePaid: {
      type: Number,
      min: 0,
    },
    currency: {
      type: String,
      default: "USD",
    },
    country: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    images: [
      {
        type: String,
      },
    ],
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    visibility: {
      type: String,
      enum: ["private", "selected_admins", "public"],
      default: "private",
    },
    selectedAdmins: [
      {
        type: String,
        // type: mongoose.Schema.Types.ObjectId,
        // ref: 'User'
      },
    ],
    shareToken: {
      type: String,
      unique: true,
      sparse: true,
    },
    isPublic: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
InventorySchema.index({ companyId: 1, status: 1 });
InventorySchema.index({ dealerId: 1, status: 1 });
InventorySchema.index({ brand: 1, model: 1 });
InventorySchema.index({ visibility: 1, status: 1 });

const Inventory = mongoose.model("Inventory", InventorySchema);

// Inventory service functions
const createInventory = async (userId, inventoryData) => {
  try {
    // Validate required fields
    if (!userId) {
      throw new Error("User ID is required");
    }

    if (!inventoryData.brand || !inventoryData.model) {
      throw new Error("Brand and model are required");
    }

    // Find the user to get their company association
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Get or create a company for the user
    let companyId = user.companyId;

    const inventory = new Inventory({
      ...inventoryData,
      companyId: companyId,
      createdBy: userId,
    });

    const savedInventory = await inventory.save();
    console.log("Successfully saved inventory item:", savedInventory._id);
    return savedInventory._id;
  } catch (error) {
    console.error("Create inventory error details:", error);
    throw new Error(`Failed to create inventory item: ${error.message}`);
  }
};

const getInventoryByUser = async (userId) => {
  try {
    // Get user's own inventory plus items shared with them
    const inventory = await Inventory.find({
      $or: [
        { createdBy: userId }, // User's own items
        { visibility: "selected_admins", selectedAdmins: userId }, // Items shared with this user
        { visibility: "public" }, // Public items
      ],
    })
      .populate("companyId", "name")
      .populate("createdBy", "fullName email")
      .populate("selectedAdmins", "fullName email")
      .sort({ createdAt: -1 });
    return inventory;
  } catch (error) {
    throw new Error("Failed to fetch inventory");
  }
};

const getInventoryById = async (id) => {
  try {
    const inventory = await Inventory.findById(id)
      .populate("companyId", "name")
      .populate("createdBy", "fullName email")
      .populate("selectedAdmins", "fullName email");
    return inventory;
  } catch (error) {
    throw new Error("Failed to fetch inventory item");
  }
};

const updateInventory = async (id, userId, updateData) => {
  try {
    console.log(id);
    const inventory = await Inventory.findOneAndUpdate(
      { _id: id },
      { $set: updateData }
    );
    if (!inventory) {
      throw new Error("Inventory item not found or unauthorized");
    }
    return inventory;
  } catch (error) {
    console.log("==>", error.message);
    throw new Error("Failed to update inventory item");
  }
};

const deleteInventory = async (id, userId) => {
  try {
    const inventory = await Inventory.findOneAndDelete({ _id: id });
    console.log("====", userId, inventory);
    if (!inventory) {
      throw new Error("Inventory item not found or unauthorized");
    }
    return inventory;
  } catch (error) {
    throw new Error("Failed to delete inventory item");
  }
};

// Get all public inventory items for customers
const getAllPublicInventory = async () => {
  try {
    const inventory = await Inventory.find({
      visibility: "public",
      status: { $in: ["Available", "On Hold"] },
    })
      .populate("companyId", "name")
      .populate("dealerId", "fullName")
      .populate("createdBy", "fullName email")
      .populate("selectedAdmins", "fullName email")
      .sort({ createdAt: -1 });
    return inventory;
  } catch (error) {
    throw new Error("Failed to fetch public inventory");
  }
};

// Get all public inventory items for a specific user
const getPublicInventoryByUser = async (userId) => {
  try {
    const inventory = await Inventory.find({
      // dealerId: userId,
      visibility: "public",
      status: { $in: ["Available", "On Hold"] },
    })
      .populate("companyId", "name")
      .populate("dealerId", "fullName")
      .sort({ createdAt: -1 });
    return inventory;
  } catch (error) {
    throw new Error("Failed to fetch user public inventory");
  }
};

// Toggle visibility of all inventory items for a user
const toggleUserInventoryVisibility = async (userId, visibility) => {
  try {
    const result = await Inventory.updateMany(
      { dealerId: userId },
      { visibility: visibility }
    );
    return result;
  } catch (error) {
    throw new Error("Failed to update inventory visibility");
  }
};

// Generate share token for inventory item
const generateShareToken = async (id, userId) => {
  try {
    const { nanoid } = await import("nanoid");
    const shareToken = nanoid(16); // Generate 16 character token

    const inventory = await Inventory.findOneAndUpdate(
      { _id: id, dealerId: userId },
      {
        shareToken: shareToken,
        isPublic: true,
      },
      { new: true }
    );

    if (!inventory) {
      throw new Error("Inventory item not found or unauthorized");
    }

    return shareToken;
  } catch (error) {
    throw new Error("Failed to generate share token");
  }
};

// Get public watch by share token
const getPublicWatchByToken = async (shareToken) => {
  try {
    const inventory = await Inventory.findOne({
      shareToken: shareToken,
      status: { $in: ["Available", "On Hold"] },
    }).populate("companyId", "name");

    if (!inventory) {
      throw new Error("Public watch not found");
    }

    return inventory;
  } catch (error) {
    throw new Error("Failed to fetch public watch");
  }
};

// Bulk delete inventory items
const bulkDeleteInventory = async (ids, userId) => {
  try {
    const result = await Inventory.deleteMany({
      _id: { $in: ids },
      dealerId: userId,
    });

    if (result.deletedCount === 0) {
      throw new Error("No inventory items found or unauthorized");
    }

    return result;
  } catch (error) {
    throw new Error("Failed to delete inventory items");
  }
};

module.exports = {
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
};
