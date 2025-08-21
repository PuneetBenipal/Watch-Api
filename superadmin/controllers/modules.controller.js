// const Module = require("../../models/Module.model");
const Module = require("../../models/Features.model");


exports.listModules = async (req, res) => {
    const list = await Module.find();

    res.json({ state: "success", items: list });
}

exports.createModule = async (req, res) => {
    const {
        name,
        slug,
        type,
        category,
        shortDesc,
        description,
        priceMonthly,
        priceYearly,
        currency,
        trialDays,
        featured,
        status,
        sortOrder,
    } = req.body;


    const newModule = new Module({
        name, slug, type, category, shortDesc, description, priceMonthly, priceYearly,
        currency, trialDays, featured, status, sortOrder, iconUrl, updatedAt: Date.now(),
    })

    let savedModule = await newModule.save()
    
    res.json({
        state: "success",
        msg: "New module is saved successful",
        module: savedModule
    })
}

exports.updateModule = async (req, res) => {
    try {
        const dbId = req.params.id;
    
        let patch = {}
        Object.keys(req.body).map((key) => {
            patch[key] = req.body[key];
        })
        console.log(patch)
        await Module.findOneAndUpdate({ _id: dbId }, { $set: patch });
    
        res.json({ state: "success", msg: "Module is updated", data: patch, id: dbId });
    } catch (error) {
        res.status(500).json({ state: "error", msg: "Module update is failed." })
    }
}

exports.deleteModule = async (req, res) => {
    try {
        const dbId = req.params.id;

        await Module.deleteOne({ _id: dbId });
        
        res.status(200).json({ state: "success", msg: "Module is deleted" });
    } catch (error) {
        res.status(500).json({ state: "error", msg: error.message });
    }

}