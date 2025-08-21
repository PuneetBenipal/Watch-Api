module.exports = async function paginate(Model, { filter = {}, select, sort, page = 1, limit = 10, lean = true }) {
    page = Math.max(1, Number(page || 1));
    limit = Math.max(1, Math.min(200, Number(limit || 10)));

    const [items, total] = await Promise.all([
        Model.find(filter).select(select).sort(sort || { createdAt: -1 }).skip((page - 1) * limit).limit(limit)[lean ? "lean" : ""](),
        Model.countDocuments(filter),
    ]);

    return { data: items, total, page, pageSize: limit };
};

module.exports = async function paginate(
    Model,
    { filter = {}, select, sort, page = 1, limit = 10, lean = true, populate }
) {
    page = Math.max(1, Number(page || 1));
    limit = Math.max(1, Math.min(200, Number(limit || 10)));

    let q = Model.find(filter).select(select).sort(sort || { createdAt: -1 });
    if (populate) q = q.populate(populate);
    if (lean) q = q.lean();

    const [items, total] = await Promise.all([
        q.skip((page - 1) * limit).limit(limit),
        Model.countDocuments(filter),
    ]);

    return { data: items, total, page, pageSize: limit };
};
