const PlanCard = require("../../models/PlanCards.model");

exports.create = async (req, res) => {
    try {
        const payload = req.body;

        const planCard = new PlanCard(payload)
        let savedPlanCard = await planCard.save();

        res.json(savedPlanCard);
    } catch (error) {
        res.json({ state: "error", msg: error.message })
    }
}

exports.list = async (req, res) => {
    const list = await PlanCard.find();
    res.json(list)
}

exports.update = async (req, res) => {
    const payload = req.body;
    const id = req.params.id;

    await PlanCard.findOneAndUpdate({ _id: id }, payload);

    res.json({ state: "success", msg: "Plan is updated" });
}

exports.delete = async (req, res) => {
    try {
        const id = req.params.id;

        const plan = PlanCard.findOne({ _id: id });

        if (plan.baseKey) throw new Error("Free plan can't be deleted");

        await PlanCard.deleteOne({ _id: id });
        res.json({ state: "successs", msg: "Plan is Deleted" });
    } catch (error) {
        res.json({ state: "errror", msg: error.message })
    }
}