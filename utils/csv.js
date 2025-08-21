// utils/csv.js


const { parse } = require("csv-parse/sync")


exports.parseContactsCsv = async (buffer) => {
    const text = buffer.toString("utf8");
    // columns inferred from header row
    const rows = parse(text, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
    });
    return rows;
}

exports.contactsToCsv = async (rows = []) => {
    const headers = [
        "type",
        "companyName",
        "fullName",
        "contactPerson",
        "whatsapp",
        "phone",
        "email",
        "country",
        "city",
        "defaultCurrency",
        "tags",
        "notes",
        "lastContactedAt",
        "lifetimeValue",
        "createdAt",
        "updatedAt",
    ];
    const esc = (v) => {
        if (v === null || v === undefined) return "";
        const s = Array.isArray(v) ? v.join("; ") : String(v);
        // escape quotes/newlines/commas
        const needsQuotes = /[",\n]/.test(s);
        return needsQuotes ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [headers.join(",")];
    for (const r of rows) {
        const line = headers.map((h) => {
            if (h === "tags" && Array.isArray(r.tags)) return esc(r.tags.join(","));
            if (r[h] instanceof Date) return esc(r[h].toISOString());
            return esc(r[h]);
        }).join(",");
        lines.push(line);
    }
    return lines.join("\n");
}
