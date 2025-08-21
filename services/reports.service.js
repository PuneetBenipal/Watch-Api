const mongooseSvc = require('mongoose');
const InvoiceSvc = require('../models/Invoice.model.js');
const { Inventory } = require('../models/inventory');
const WhatsAppListingSvc = require('../models/WhatsappListing.model');

const toObjectId = (v) => { try { return new mongooseSvc.Types.ObjectId(String(v)); } catch { return null; } };
const parseDate = (v, fb) => { const d = v ? new Date(v) : fb; return isNaN(d.getTime()) ? fb : d; };

exports.getSalesReport = async (q) => {
    const { companyId, start, end, status } = q;
    const _companyId = toObjectId(companyId);
    const startDate = parseDate(start, new Date(Date.now() - 30 * 864e5));
    const endDate = parseDate(end, new Date());
    const statuses = status ? String(status).split(',') : ['paid', 'partial'];
    const match = { issuedAt: { $gte: startDate, $lte: endDate }, status: { $in: statuses } };
    if (_companyId) match.companyId = _companyId;
    const pipeline = [
        { $match: match },
        {
            $facet: {
                totalsByDay: [{ $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$issuedAt' } }, revenue: { $sum: '$total' }, deals: { $sum: 1 } } }, { $sort: { _id: 1 } }],
                paymentBreakdown: [{ $group: { _id: '$paymentMethod', revenue: { $sum: '$total' }, deals: { $sum: 1 } } }, { $project: { paymentMethod: '$_id', revenue: 1, deals: 1, _id: 0 } }],
                topBrands: [{ $unwind: '$items' }, { $group: { _id: '$items.brand', revenue: { $sum: { $multiply: ['$items.price', '$items.qty'] } }, qty: { $sum: '$items.qty' } } }, { $sort: { revenue: -1 } }, { $limit: 10 }, { $project: { brand: '$_id', revenue: 1, qty: 1, _id: 0 } }],
                summary: [{ $group: { _id: null, revenue: { $sum: '$total' }, deals: { $sum: 1 } } }, { $project: { _id: 0, revenue: 1, deals: 1 } }]
            }
        }
    ];
    const [result] = await InvoiceSvc.aggregate(pipeline);
    return result;
};

exports.getAgingReport = async (q) => {
    const { companyId, includeSold } = q;
    const _companyId = toObjectId(companyId);
    const match = {};
    if (_companyId) match.companyId = _companyId;
    if (!includeSold) match.status = { $ne: 'Sold' };
    const now = new Date();
    const pipeline = [
        { $match: match },
        { $addFields: { ageDays: { $divide: [{ $subtract: [now, '$createdAt'] }, 86400000] } } },
        {
            $facet: {
                buckets: [{ $bucket: { groupBy: '$ageDays', boundaries: [0, 31, 61, 91, 1e9], default: 1e9, output: { count: { $sum: 1 }, valuePaid: { $sum: '$pricePaid' } } } }],
                byBrand: [{ $group: { _id: '$brand', avgAge: { $avg: '$ageDays' }, count: { $sum: 1 }, valuePaid: { $sum: '$pricePaid' } } }, { $sort: { count: -1 } }, { $limit: 20 }, { $project: { brand: '$_id', avgAge: { $round: ['$avgAge', 1] }, count: 1, valuePaid: 1, _id: 0 } }],
                summary: [{ $group: { _id: null, items: { $sum: 1 }, valuePaid: { $sum: '$pricePaid' }, avgAge: { $avg: '$ageDays' } } }, { $project: { _id: 0, items: 1, valuePaid: 1, avgAge: { $round: ['$avgAge', 1] } } }]
            }
        }
    ];
    const [result] = await Inventory.aggregate(pipeline);
    const labels = ['0-30', '31-60', '61-90', '90+'];
    const buckets = (result.buckets || []).map((b, i) => ({ bucket: labels[i] || '90+', count: b.count, valuePaid: b.valuePaid }));
    return { ...result, buckets };
};

exports.getWhatsAppDaily = async (q, companyId) => {
    const { start, end } = q;
    const _companyId = toObjectId(companyId);
    const startDate = parseDate(start, new Date(Date.now() - 7 * 864e5));
    const endDate = parseDate(end, new Date());
    const match = { createdAt: { $gte: startDate, $lte: endDate } };
    if (_companyId) match.companyId = _companyId;
    const pipeline = [
        { $match: match },
        {
            $facet: {
                totalsByDay: [{ $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, listings: { $sum: 1 } } }, { $sort: { _id: 1 } }],
                byCountry: [{ $group: { _id: '$country', listings: { $sum: 1 } } }, { $project: { country: '$_id', listings: 1, _id: 0 } }, { $sort: { listings: -1 } }],
                topBrands: [{ $group: { _id: '$brand', listings: { $sum: 1 } } }, { $sort: { listings: -1 } }, { $limit: 10 }, { $project: { brand: '$_id', listings: 1, _id: 0 } }],
                topDealers: [{ $group: { _id: '$dealer', listings: { $sum: 1 } } }, { $sort: { listings: -1 } }, { $limit: 10 }, { $project: { dealer: '$_id', listings: 1, _id: 0 } }],
                summary: [{ $group: { _id: null, listings: { $sum: 1 } } }, { $project: { _id: 0, listings: 1 } }]
            }
        }
    ];
    const [result] = await WhatsAppListingSvc.aggregate(pipeline);
    return result;
};

exports.getProfit = async (q) => {
    const { companyId, start, end } = q;
    const _companyId = toObjectId(companyId);
    const startDate = parseDate(start, new Date(Date.now() - 90 * 864e5));
    const endDate = parseDate(end, new Date());
    const match = { issuedAt: { $gte: startDate, $lte: endDate }, status: { $in: ['paid', 'partial'] } };
    if (_companyId) match.companyId = _companyId;
    const pipeline = [
        { $match: match },
        { $unwind: '$items' },
        { $lookup: { from: 'inventoryitems', localField: 'items.inventoryId', foreignField: '_id', as: 'inv' } },
        { $unwind: { path: '$inv', preserveNullAndEmptyArrays: true } },
        {
            $addFields: {
                itemRevenue: { $multiply: ['$items.price', { $ifNull: ['$items.qty', 1] }] },
                itemCOGS: { $multiply: [{ $ifNull: ['$inv.pricePaid', 0] }, { $ifNull: ['$items.qty', 1] }] },
                period: { $dateToString: { format: '%Y-%m', date: '$issuedAt' } },
                brand: { $ifNull: ['$items.brand', '$inv.brand'] }
            }
        },
        {
            $facet: {
                byPeriod: [{ $group: { _id: '$period', revenue: { $sum: '$itemRevenue' }, cogs: { $sum: '$itemCOGS' } } }, { $project: { period: '$_id', revenue: 1, cogs: 1, grossProfit: { $subtract: ['$revenue', '$cogs'] }, _id: 0 } }, { $sort: { period: 1 } }],
                byBrand: [{ $group: { _id: '$brand', revenue: { $sum: '$itemRevenue' }, cogs: { $sum: '$itemCOGS' } } }, { $project: { brand: '$_id', revenue: 1, cogs: 1, grossProfit: { $subtract: ['$revenue', '$cogs'] }, _id: 0 } }, { $sort: { grossProfit: -1 } }, { $limit: 20 }],
                summary: [{ $group: { _id: null, revenue: { $sum: '$itemRevenue' }, cogs: { $sum: '$itemCOGS' } } }, { $project: { _id: 0, revenue: 1, cogs: 1, grossProfit: { $subtract: ['$revenue', '$cogs'] } } }]
            }
        }
    ];
    const [result] = await mongooseSvc.connection.collection('invoices').aggregate(pipeline).toArray();
    return result;
};