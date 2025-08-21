const { Schema, model, Types } = require("mongoose");

const AuditLogSchema = new Schema(
    {
        ts: { type: Date, default: Date.now, index: true },

        // who did it
        actorUserId: { type: Types.ObjectId, ref: "User", index: true },
        actorEmail: { type: String, index: true },
        ip: String,
        ua: String,

        // where/tenant
        companyId: { type: Types.ObjectId, ref: "Company", index: true },

        // what happened
        action: { type: String, required: true, index: true }, // e.g., "user.update", "company.modules.toggle"
        targetType: { type: String }, // "user" | "company" | "invoice" | "ticket"
        targetId: { type: String },   // store id as string for convenience
        message: { type: String },

        // state change (optional, keep small)
        before: Schema.Types.Mixed,
        after: Schema.Types.Mixed,

        // extra context
        meta: Schema.Types.Mixed,
        level: { type: String, enum: ["info", "warn", "error"], default: "info", index: true },
    },
    { timestamps: false }
);

AuditLogSchema.index({ ts: -1, action: 1 });
module.exports = model("AuditLog", AuditLogSchema);
