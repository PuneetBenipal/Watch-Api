const Discount = require('../../models/Discount');
const { DISCOUNT_ITEMS } = require('../../config/discount-items');
const { syncStripeArtifacts } = require('../../services/discountService');

exports.listItems = async (req, res) => {
    // for admin UI – returns predefined items for selection
    res.json(DISCOUNT_ITEMS);
};

exports.create = async (req, res, next) => {
    try {
        const payload = req.body;
        // Enforce the predefined item key
        if (!DISCOUNT_ITEMS.find(i => i.key === payload.itemKey)) {
            return res.status(400).json({ error: 'Invalid itemKey' });
        }
        const discount = await Discount.create({
            ...payload,
            code: String(payload.code || '').toUpperCase().trim(),
            createdBy: req.user?._id,
        });
        // await syncStripeArtifacts(discount);
        res.status(201).json(discount);
    } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
    try {
        const { id } = req.params;
        const discount = await Discount.findByIdAndUpdate(id, req.body, { new: true });
        if (!discount) return res.status(404).json({ error: 'Not found' });
        // await syncStripeArtifacts(discount);
        res.json(discount);
    } catch (err) { next(err); }
};

exports.index = async (req, res, next) => {
    try {
        const q = await Discount.find().sort({ createdAt: -1 });
        res.json(q);
    } catch (err) { next(err); }
};

exports.toggle = async (req, res, next) => {
    try {
        const { id } = req.params;
        const discount = await Discount.findById(id);
        if (!discount) return res.status(404).json({ error: 'Not found' });
        discount.active = !discount.active;
        await discount.save();
        res.json(discount);
    } catch (err) { next(err); }
};
