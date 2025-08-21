const mongoose = require("mongoose");
const { Schema } = mongoose;
const bcrypt = require("bcrypt");

const USER_KINDS = ["dealer", "agent", "admin"];     // admin = payer/owner
const ROLES = ["superadmin", "owner", "member", "readonly"];
const STATUSES = ["suspended", "active"];
const CURRENCIES = ["GBP", "USD", "AED", "HKD", "EUR"];

const UserSchema = new Schema({
    // Identity
    // name: { type: String, trim: true },  // item to delete
    fullName: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true, required: true },
    passwordHash: { type: String },

    // Admin vs agent
    userKind: { type: String, enum: USER_KINDS, required: true, default: "dealer" },
    role: { type: String, enum: ROLES, default: "owner" },

    // Tenancy
    companyId: { type: Schema.Types.ObjectId, ref: "Company", index: true },

    // Contact / region
    phone: { type: String, trim: true },
    whatsapp: { type: String, trim: true },
    country: { type: String, trim: true },
    city: { type: String, trim: true },
    defaultCurrency: { type: String, enum: CURRENCIES, default: "USD" },

    // Platform flags & prefs
    whatsappConnected: { type: Boolean, default: false },
    isVerified: { type: Boolean, default: true },
    status: { type: String, enum: STATUSES, default: "active" },
    settings: {
        theme: { type: String, default: "auto" },         // 'light'|'dark'|'auto'
        notifications: { type: String, default: "all" }   // 'all'|'important'|'none'
    },

    // Activity
    lastLoginAt: { type: Date },
    lastLoginIp: { type: String },

    // Invite flow (for agents)
    invitedBy: { type: Schema.Types.ObjectId, ref: "User" },
    inviteToken: { type: String, select: false },
    inviteExpiresAt: { type: Date },
    invitedAt: { type: Date },
    acceptedAt: { type: Date },

    // Soft delete
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date },
    resetPasswordTokenHash: { type: String, default: null },
    resetPasswordExpiresAt: { type: Date, default: null },

    whatsappStatus: {
        currentPeriodStart: Date,
        currentPeriodEnd: Date,
        limit: Number,
        usedThisPeriod: { type: Number, default: 0 },
        paidAt: Date,
    },

    createdAt: Date,
}, { timestamps: true });

// Uniqueness per tenant (same email can exist in different companies if needed)
UserSchema.index({ companyId: 1, email: 1 }, { unique: true });

// Hash password before saving
UserSchema.pre('save', async function (next) {
    if (!this.isModified('passwordHash')) return next();

    try {
        this.passwordHash = await bcrypt.hash(this.passwordHash, 12);
        next();
    } catch (error) {
        next(error);
    }
});

// Method to compare password
UserSchema.methods.comparePassword = async function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.passwordHash);
};

// Method to get user without sensitive data
UserSchema.methods.toJSON = function () {
    const user = this.toObject();
    delete user.passwordHash;
    return user;
};

module.exports = User = mongoose.model("User", UserSchema);
