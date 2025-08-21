const mongoose = require("mongoose");
const { Schema } = mongoose;

const TICKET_STATUSES = ["open", "in_progress", "resolved", "closed"];
const TICKET_PRIORITIES = ["low", "normal", "high", "urgent"];

const MessageSchema = new mongoose.Schema({
    ticketId: { type: mongoose.Schema.Types.ObjectId, index: true },
    type: { type: String, enum: ["public", "internal"], default: "public" },
    author: { id: String, fullName: String, role: { type: String, enum: ["agent", "admin", "user"] } },
    body: String,
    attachments: [{ name: String, url: String, mime: String, size: Number }],
}, { timestamps: true });


const TicketSchema = new mongoose.Schema({
    subject: String,
    requester: { id: String, fullName: String, email: String, accountId: String }, // dealer/member
    status: { type: String, enum: ["open", "pending", "on_hold", "solved", "closed"], default: "open" },
    priority: { type: String, enum: ["low", "medium", "high", "urgent"], default: "medium" },
    assignee: { id: String, name: String, avatar: String },
    accountId: String,          // dealer/company id
    category: String,           // Billing | API | Security | ...
    channel: { type: String, enum: ["web", "email", "whatsapp", "api"], default: "web" },
    lastMessageAt: Date,
    messagesCount: { type: Number, default: 0 },
    links: { quickbooks_invoice_id: String, stripe_invoice_id: String, orderId: String },
    sla: { targetAt: Date, breachedAt: Date, paused: { type: Boolean, default: false } },
}, { timestamps: true });


TicketSchema.index({ updatedAt: -1 });
// TicketSchema.index({ subject: "text", "requester.email": 1 });

const Ticket = mongoose.model("Ticket", TicketSchema);
const Message = mongoose.model("Message", MessageSchema);

module.exports = {
    Ticket, Message
}