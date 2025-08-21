const mongoose = require("mongoose");
const { Schema } = mongoose;

const DocArticleSchema = new Schema({
    // Multi-tenant docs: if you want global docs, keep companyId null
    companyId: { type: Schema.Types.ObjectId, ref: "Company", index: true, default: null },
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true, index: true },
    category: { type: String, index: true }, // e.g., whatsapp, inventory, invoices, account
    summary: { type: String },
    content: { type: String, required: true }, // Markdown content
    isPublished: { type: Boolean, default: true },
    tags: [{ type: String }],
    views: { type: Number, default: 0 },
    publishedAt: { type: Date, default: Date.now },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true });

DocArticleSchema.index({ category: 1, isPublished: 1 });

module.exports = DocArticle = mongoose.model("DocArticle", DocArticleSchema);
