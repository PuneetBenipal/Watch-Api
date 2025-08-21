const mongoose = require("mongoose");

const listingSchema = new mongoose.Schema(
  {
    groupId: {
      type: String,
      required: true,
      index: true,
    },
    messageText: {
      type: String,
      required: true,
    },
    parsed: {
      brand: {
        type: String,
        trim: true,
      },
      model: {
        type: String,
        trim: true,
      },
      price: {
        type: Number,
      },
      currency: {
        type: String,
        default: "USD",
      },
      images: [
        {
          type: String,
        },
      ],
      sellerName: {
        type: String,
        trim: true,
      },
      sellerPhone: {
        type: String,
        trim: true,
      },
      location: {
        type: String,
        trim: true,
      },
      condition: {
        type: String,
        trim: true,
      },
      year: {
        type: Number,
      },
      refNo: {
        type: String,
        trim: true,
      },
      description: {
        type: String,
        trim: true,
      },
    },
    duplicateHash: {
      type: String,
      index: true,
    },
    sourceType: {
      type: String,
      enum: ["scraped", "manual", "api"],
      default: "scraped",
    },
    countryTag: {
      type: String,
      trim: true,
    },
    isProcessed: {
      type: Boolean,
      default: false,
    },
    processingStatus: {
      type: String,
      enum: ["pending", "processed", "failed", "duplicate"],
      default: "pending",
    },
    confidence: {
      type: Number,
      min: 0,
      max: 1,
      default: 0,
    },
    metadata: {
      messageId: String,
      timestamp: Date,
      groupName: String,
      senderId: String,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
listingSchema.index({ groupId: 1, createdAt: -1 });
listingSchema.index({ "parsed.brand": 1, "parsed.model": 1 });
listingSchema.index({ duplicateHash: 1 });
listingSchema.index({ processingStatus: 1 });
listingSchema.index({ countryTag: 1 });

const Listing = mongoose.model("Listing", listingSchema);

module.exports = Listing;
