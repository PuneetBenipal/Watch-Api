const svc = require('../services/reports.service');

exports.sales = async (req, res) => {
    try { const data = await svc.getSalesReport(req.query); res.json({ ok: true, data }); }
    catch (e) { res.status(500).json({ ok: false, error: e.message }); }
};

exports.aging = async (req, res) => {
    try { const data = await svc.getAgingReport(req.query); res.json({ ok: true, data }); }
    catch (e) { res.status(500).json({ ok: false, error: e.message }); }
};

exports.whatsapp = async (req, res) => {
    try { const data = await svc.getWhatsAppDaily(req.query, req.user.companyId); res.json({ ok: true, data }); }
    catch (e) { res.status(500).json({ ok: false, error: e.message }); }
};

exports.profit = async (req, res) => {
    try { const data = await svc.getProfit(req.query); res.json({ ok: true, data }); }
    catch (e) { res.status(500).json({ ok: false, error: e.message }); }
};